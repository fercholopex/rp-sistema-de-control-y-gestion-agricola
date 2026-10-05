import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { consultar, obtenerGrupo } from "../base_datos/conexion";
import { ErrorSolicitud } from "../utilidades/errores";
import { fechaCampoAUTC, obtenerZonaHoraria } from "../utilidades/fechas";
import { fecha } from "../utilidades/validacion";

const lectura = z.number().nullable().optional();
const serie = z.array(z.number().nullable()).optional();
const respuestaProveedor = z.object({
  current: z.object({
    time: fecha,
    temperature_2m: lectura,
    relative_humidity_2m: lectura,
    weather_code: lectura,
    wind_speed_10m: lectura,
    is_day: z
      .union([z.literal(0), z.literal(1)])
      .nullable()
      .optional(),
  }),
  hourly: z.object({
    time: z.array(fecha),
    shortwave_radiation: serie,
    et0_fao_evapotranspiration: serie,
  }),
  daily: z.object({
    time: z.array(fecha),
    temperature_2m_max: serie,
    temperature_2m_min: serie,
    precipitation_sum: serie,
    et0_fao_evapotranspiration: serie,
    weather_code: serie,
  }),
});
const valorGuardado = z.number().nullable();
const climaGuardado = z.object({
  fuente: z.literal("Open-Meteo"),
  actualizado_en: z.iso.datetime(),
  actual: z.object({
    fecha_hora: z.iso.datetime(),
    temperatura: valorGuardado,
    humedad_ambiental: valorGuardado,
    radiacion_solar: valorGuardado,
    evapotranspiracion: valorGuardado,
    codigo_clima: valorGuardado,
    velocidad_viento: valorGuardado,
    es_dia: z.boolean().nullable(),
  }),
  pronostico: z.array(
    z.object({
      fecha,
      temperatura_maxima: valorGuardado,
      temperatura_minima: valorGuardado,
      precipitacion: valorGuardado,
      evapotranspiracion: valorGuardado,
      codigo_clima: valorGuardado,
    }),
  ),
  unidades: z.object({
    temperatura: z.literal("°C"),
    humedad_ambiental: z.literal("%"),
    radiacion_solar: z.literal("W/m²"),
    evapotranspiracion: z.literal("mm"),
    velocidad_viento: z.literal("km/h"),
    precipitacion: z.literal("mm"),
  }),
});

export async function obtenerClima(idLote: string) {
  const [lote] = await consultar(
    "SELECT id,nombre_lote,latitud,longitud FROM lotes WHERE id=? AND fecha_eliminacion IS NULL",
    [idLote],
  );
  if (!lote) throw new ErrorSolicitud(404, "El lote seleccionado no existe.");
  if (lote.latitud == null || lote.longitud == null)
    throw new ErrorSolicitud(
      422,
      "Registra latitud y longitud del lote para consultar su clima.",
    );
  const origen = process.env.CLIMA_URL;
  if (!origen)
    throw new ErrorSolicitud(
      503,
      "La fuente de meteorología no está configurada.",
    );
  let direccion: URL;
  try {
    direccion = new URL(origen);
  } catch {
    throw new ErrorSolicitud(
      503,
      "La dirección de la fuente meteorológica no es válida.",
    );
  }
  if (direccion.protocol !== "https:")
    throw new ErrorSolicitud(
      503,
      "La fuente de meteorología debe usar una conexión segura.",
    );
  const zona = obtenerZonaHoraria();
  // Una respuesta de otra fuente o zona no se reutiliza después de cambiar la configuración.
  const tipo =
    "pronostico_v2_" +
    createHash("sha256").update(`${direccion.href}|${zona}`).digest("hex");
  const [guardado] = await consultar(
    "SELECT contenido FROM cache_clima WHERE latitud=? AND longitud=? AND tipo_consulta=? AND expira_en>UTC_TIMESTAMP(3)",
    [lote.latitud, lote.longitud, tipo],
  );
  if (guardado) {
    try {
      const contenido = climaGuardado.parse(
        typeof guardado.contenido === "string"
          ? JSON.parse(guardado.contenido)
          : guardado.contenido,
      );
      return { ...contenido, lote_id: lote.id, nombre_lote: lote.nombre_lote };
    } catch {
      /* Una entrada dañada se sustituye con una consulta real. */
    }
  }
  direccion.searchParams.set("latitude", String(lote.latitud));
  direccion.searchParams.set("longitude", String(lote.longitud));
  direccion.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
  );
  direccion.searchParams.set(
    "hourly",
    "shortwave_radiation,et0_fao_evapotranspiration",
  );
  direccion.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,weather_code",
  );
  direccion.searchParams.set("timezone", zona);
  direccion.searchParams.set("forecast_days", "7");
  let proveedor: z.infer<typeof respuestaProveedor>;
  try {
    const respuesta = await fetch(direccion, {
      signal: AbortSignal.timeout(10000),
      redirect: "error",
      headers: { Accept: "application/json" },
    });
    if (!respuesta.ok)
      throw new Error(`Proveedor meteorológico respondió ${respuesta.status}`);
    proveedor = respuestaProveedor.parse(await respuesta.json());
  } catch (error) {
    console.error(
      "No se pudo consultar la fuente meteorológica:",
      error instanceof Error ? error.message : "Error desconocido",
    );
    throw new ErrorSolicitud(
      502,
      "La fuente meteorológica no está disponible. Intenta nuevamente más tarde.",
    );
  }
  const instante = proveedor.current.time.slice(0, 13);
  const indice = proveedor.hourly.time.findIndex(
    (hora) => hora.slice(0, 13) === instante,
  );
  const valorHorario = (valores: (number | null)[] | undefined) =>
    indice >= 0 ? (valores?.[indice] ?? null) : null;
  const datos = {
    fuente: "Open-Meteo",
    actualizado_en: new Date().toISOString(),
    actual: {
      fecha_hora: fechaCampoAUTC(proveedor.current.time, zona).toISOString(),
      temperatura: proveedor.current.temperature_2m ?? null,
      humedad_ambiental: proveedor.current.relative_humidity_2m ?? null,
      radiacion_solar: valorHorario(proveedor.hourly.shortwave_radiation),
      evapotranspiracion: valorHorario(
        proveedor.hourly.et0_fao_evapotranspiration,
      ),
      codigo_clima: proveedor.current.weather_code ?? null,
      velocidad_viento: proveedor.current.wind_speed_10m ?? null,
      es_dia:
        proveedor.current.is_day == null
          ? null
          : proveedor.current.is_day === 1,
    },
    pronostico: proveedor.daily.time.map((dia, posicion) => ({
      fecha: dia,
      temperatura_maxima:
        proveedor.daily.temperature_2m_max?.[posicion] ?? null,
      temperatura_minima:
        proveedor.daily.temperature_2m_min?.[posicion] ?? null,
      precipitacion: proveedor.daily.precipitation_sum?.[posicion] ?? null,
      evapotranspiracion:
        proveedor.daily.et0_fao_evapotranspiration?.[posicion] ?? null,
      codigo_clima: proveedor.daily.weather_code?.[posicion] ?? null,
    })),
    unidades: {
      temperatura: "°C",
      humedad_ambiental: "%",
      radiacion_solar: "W/m²",
      evapotranspiracion: "mm",
      velocidad_viento: "km/h",
      precipitacion: "mm",
    },
  };
  await obtenerGrupo().query(
    "INSERT INTO cache_clima (id,latitud,longitud,tipo_consulta,contenido,expira_en) VALUES (?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 10 MINUTE)) ON DUPLICATE KEY UPDATE contenido=VALUES(contenido),expira_en=VALUES(expira_en)",
    [randomUUID(), lote.latitud, lote.longitud, tipo, JSON.stringify(datos)],
  );
  return { ...datos, lote_id: lote.id, nombre_lote: lote.nombre_lote };
}
