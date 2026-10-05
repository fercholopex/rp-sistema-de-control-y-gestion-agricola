import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consultar,
  obtenerGrupo,
  type Conexion,
} from "../servidor/src/base_datos/conexion";
import { obtenerClima } from "../servidor/src/servicios/clima";
import { prepararOperacion } from "../servidor/src/servicios/operaciones";
import {
  normalizarFila,
  validarEntrada,
  validarRelaciones,
} from "../servidor/src/servicios/registros";
import {
  fechaCampoAUTC,
  fechaParaSQL,
  periodosResumen,
} from "../servidor/src/utilidades/fechas";
import {
  esquemaAplicacionProducto,
  esquemaEmpleado,
  esquemaManoObra,
  esquemaMedicion,
  esquemaOperacion,
  esquemaProducto,
  esquemaRiego,
  fecha,
} from "../servidor/src/utilidades/validacion";

vi.mock("../servidor/src/base_datos/conexion", () => {
  const grupo = { query: vi.fn() };
  return { consultar: vi.fn(), obtenerGrupo: () => grupo };
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const conexion = {} as Conexion;

describe("Fechas agrícolas y períodos contables", () => {
  it("serializa parámetros UTC sin usar los componentes locales de Date", () => {
    expect(fechaParaSQL(new Date("2026-09-22T14:30:00Z"))).toBe(
      "2026-09-22 14:30:00.000",
    );
    expect(
      fechaParaSQL(fechaCampoAUTC("2026-09-22T08:30", "America/Guatemala")),
    ).toBe("2026-09-22 14:30:00.000");
  });
  it("expone fechas SQL de usuarios como instantes UTC y conserva fechas de calendario", () => {
    expect(
      normalizarFila({
        fecha_creacion: "2026-09-22 01:02:03.000",
        fecha_actualizacion: "2026-09-22 02:03:04.001",
        fecha_siembra: "2026-09-21",
      }),
    ).toEqual({
      fecha_creacion: "2026-09-22T01:02:03.000Z",
      fecha_actualizacion: "2026-09-22T02:03:04.001Z",
      fecha_siembra: "2026-09-21",
    });
  });
  it("mantiene el domingo de Guatemala aunque UTC ya sea lunes", () => {
    const periodos = periodosResumen(
      new Date("2026-09-21T02:00:00Z"),
      "America/Guatemala",
    );
    expect(periodos.inicio_semana.toISOString()).toBe(
      "2026-09-14T06:00:00.000Z",
    );
    expect(periodos.fin_semana.toISOString()).toBe("2026-09-21T06:00:00.000Z");
    expect(periodos.dias.at(-1)?.fecha).toBe("2026-09-20");
  });
  it("separa meses por medianoche local y calcula siete días completos", () => {
    const periodos = periodosResumen(
      new Date("2026-10-01T02:00:00Z"),
      "America/Guatemala",
    );
    expect(periodos.inicio_mes.toISOString()).toBe("2026-09-01T06:00:00.000Z");
    expect(periodos.fin_mes.toISOString()).toBe("2026-10-01T06:00:00.000Z");
    expect(periodos.dias.map((dia) => dia.fecha)).toEqual([
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
    ]);
  });
  it("respeta offsets explícitos y cambios de horario de una zona configurada", () => {
    expect(
      fechaCampoAUTC(
        "2026-09-22T12:34:56.123",
        "America/Guatemala",
      ).toISOString(),
    ).toBe("2026-09-22T18:34:56.123Z");
    expect(
      fechaCampoAUTC(
        "2026-09-22T12:00:00+02:00",
        "America/Guatemala",
      ).toISOString(),
    ).toBe("2026-09-22T10:00:00.000Z");
    const inicio = fechaCampoAUTC("2026-03-08", "America/New_York");
    const fin = fechaCampoAUTC("2026-03-09", "America/New_York");
    expect((fin.getTime() - inicio.getTime()) / 3600000).toBe(23);
    expect(fecha.safeParse("2026-09-22T24:00:00").success).toBe(false);
  });
});

describe("Precisión de SQL y conservación de superficies", () => {
  it("rechaza fracciones que SQL redondearía antes de guardar un costo", () => {
    expect(
      esquemaManoObra.safeParse({
        empleado_id: "persona",
        tarifa_capturada: 1.001,
      }).success,
    ).toBe(false);
    expect(
      esquemaManoObra.safeParse({ empleado_id: "persona", cantidad: 1.00001 })
        .success,
    ).toBe(false);
    expect(
      esquemaAplicacionProducto.safeParse({
        producto_id: "producto",
        cantidad: 1,
        precio_unitario: 0.00001,
      }).success,
    ).toBe(false);
    expect(
      esquemaRiego.safeParse({
        inicio: "2026-09-22T08:00:00Z",
        fin: "2026-09-22T09:00:00Z",
        costo_agua: 0.001,
      }).success,
    ).toBe(false);
    expect(
      esquemaEmpleado.shape.tarifa_actual.safeParse(10000000000).success,
    ).toBe(false);
    expect(
      esquemaProducto.shape.precio_actual.safeParse(100000000).success,
    ).toBe(false);
    expect(
      esquemaMedicion.shape.humedad_porcentaje.safeParse(55.555).success,
    ).toBe(false);
    expect(
      esquemaProducto.shape.precio_actual.safeParse(99999999.9999).success,
    ).toBe(true);
  });
  it("rechaza el total fuera de DECIMAL(12,2) antes de ejecutar una escritura", async () => {
    const datos = esquemaOperacion.parse({
      lote_id: "lote",
      encargado_id: "persona",
      tipo_operacion: "practica_general",
      descripcion: "Prueba de límite",
      fecha_operacion: "2026-09-22",
      costo_aplicacion: 9999999999.99,
      otros_costos: 0.01,
    });
    await expect(prepararOperacion(conexion, datos)).rejects.toMatchObject({
      codigo: 400,
    });
    expect(consultar).not.toHaveBeenCalled();
  });
  it("rechaza el desbordamiento de cantidad por precio antes de persistir partidas", async () => {
    vi.mocked(consultar).mockResolvedValueOnce([
      {
        id: "producto",
        nombre: "Producto de prueba",
        unidad_base: "kg",
        precio_actual: 99999999.9999,
      },
    ]);
    const datos = esquemaOperacion.parse({
      lote_id: "lote",
      encargado_id: "persona",
      tipo_operacion: "fertilizante",
      descripcion: "Prueba de límite",
      fecha_operacion: "2026-09-22",
      productos: [{ producto_id: "producto", cantidad: 1000000 }],
    });
    await expect(prepararOperacion(conexion, datos)).rejects.toMatchObject({
      codigo: 400,
    });
  });
  it("una edición de notas conserva el área original exacta de un lote migrado", async () => {
    const anterior = {
      nombre_lote: "Lote histórico",
      codigo: "LOTE",
      superficie_ha: 0.404686,
      unidad_superficie: "acre",
      superficie_original: 1,
      centroide: [14.6, -90.5],
      estado: "activo",
    };
    const datos = validarEntrada(
      "lotes",
      { notas: "Observación actualizada" },
      anterior,
    );
    await validarRelaciones(conexion, "lotes", datos, "lote", anterior);
    expect(datos.superficie_original).toBe(1);
    expect(datos.centroide).toEqual([14.6, -90.5]);
    const modificado = validarEntrada(
      "lotes",
      { superficie_ha: 0.809371 },
      anterior,
    );
    await validarRelaciones(conexion, "lotes", modificado, "lote", anterior);
    expect(modificado.superficie_original).toBe(2);
  });
  it("rechaza superficies cuya conversión excedería la columna de unidad original", async () => {
    const datos = validarEntrada("lotes", {
      nombre_lote: "Lote grande",
      codigo: "GRANDE",
      superficie_ha: 10000,
      unidad_superficie: "metro_cuadrado",
    });
    await expect(
      validarRelaciones(conexion, "lotes", datos),
    ).rejects.toMatchObject({ codigo: 400 });
  });
  it("conserva nombres, unidades y tarifas históricos al reenviar partidas existentes", async () => {
    vi.mocked(consultar)
      .mockResolvedValueOnce([
        {
          empleado_id: "persona",
          nombre_empleado: "Nombre histórico",
          tipo_pago: "jornal",
          tarifa_capturada: 100,
        },
      ])
      .mockResolvedValueOnce([
        {
          producto_id: "producto",
          nombre_producto: "Producto histórico",
          unidad: "litro",
          precio_unitario: 20,
        },
      ]);
    const datos = esquemaOperacion.parse({
      lote_id: "lote",
      encargado_id: "encargado",
      tipo_operacion: "fertilizante",
      descripcion: "Descripción actualizada",
      fecha_operacion: "2026-09-22",
      mano_obra: [{ empleado_id: "persona", cantidad: 2 }],
      productos: [{ producto_id: "producto", cantidad: 3 }],
    });
    const preparado = await prepararOperacion(conexion, datos, {
      id: "operacion",
      costo_mano_obra: 200,
      costo_productos: 60,
    });
    expect(preparado.valores.costo_total).toBe(260);
    expect(preparado.manoObra[0]).toMatchObject({
      nombre_empleado: "Nombre histórico",
      tipo_pago: "jornal",
      tarifa_capturada: 100,
    });
    expect(preparado.productos[0]).toMatchObject({
      nombre_producto: "Producto histórico",
      unidad: "litro",
      precio_unitario: 20,
    });
    expect(consultar).toHaveBeenCalledTimes(2);
  });
  it("permite corregir historia con relaciones inactivas y valida una nueva relación", async () => {
    const anterior = {
      lote_id: "lote-retirado",
      encargado_id: "encargado-anterior",
      cultivo_id: "cultivo-retirado",
    };
    await validarRelaciones(
      conexion,
      "operaciones",
      { ...anterior },
      "operacion",
      anterior,
    );
    expect(consultar).not.toHaveBeenCalled();
    vi.mocked(consultar).mockResolvedValueOnce([]);
    await expect(
      validarRelaciones(
        conexion,
        "operaciones",
        { ...anterior, lote_id: "otro-lote" },
        "operacion",
        anterior,
      ),
    ).rejects.toMatchObject({ codigo: 400 });
  });
});

describe("Meteorología sin valores inventados ni caché de otra fuente", () => {
  const lote = {
    id: "lote",
    nombre_lote: "Lote de prueba",
    latitud: 14.6,
    longitud: -90.5,
  };
  const proveedor = {
    current: {
      time: "2026-09-22T12:00",
      temperature_2m: null,
      weather_code: 0,
      is_day: 0,
    },
    hourly: {
      time: ["2026-09-22T12:00"],
      shortwave_radiation: [null],
      et0_fao_evapotranspiration: [],
    },
    daily: { time: ["2026-09-22"], precipitation_sum: [0] },
  };
  function configurarFuente() {
    vi.stubEnv("CLIMA_URL", "https://primera.example.test/forecast");
    vi.stubEnv("ZONA_HORARIA", "America/Guatemala");
    const consultarFuente = vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify(proveedor), { status: 200 }),
      );
    vi.stubGlobal("fetch", consultarFuente);
    vi.mocked(obtenerGrupo().query).mockResolvedValue({});
    return consultarFuente;
  }
  it("conserva nulos y ceros reales y convierte la hora local del proveedor", async () => {
    configurarFuente();
    vi.mocked(consultar)
      .mockResolvedValueOnce([lote])
      .mockResolvedValueOnce([]);
    const clima = await obtenerClima("lote");
    expect(clima.actual.temperatura).toBeNull();
    expect(clima.actual.humedad_ambiental).toBeNull();
    expect(clima.actual.radiacion_solar).toBeNull();
    expect(clima.actual.evapotranspiracion).toBeNull();
    expect(clima.actual.codigo_clima).toBe(0);
    expect(clima.actual.es_dia).toBe(false);
    expect(clima.actual.fecha_hora).toBe("2026-09-22T18:00:00.000Z");
    expect(clima.pronostico[0].precipitacion).toBe(0);
    expect(clima.pronostico[0].temperatura_maxima).toBeNull();
  });
  it("cambia la clave de caché al cambiar de fuente y no expone su dirección", async () => {
    const consultarFuente = configurarFuente();
    vi.mocked(consultar)
      .mockResolvedValueOnce([lote])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([lote])
      .mockResolvedValueOnce([]);
    await obtenerClima("lote");
    vi.stubEnv(
      "CLIMA_URL",
      "https://segunda.example.test/forecast?clave=privada",
    );
    const clima = await obtenerClima("lote");
    expect(consultarFuente).toHaveBeenCalledTimes(2);
    const consultas = vi.mocked(consultar).mock.calls;
    expect(consultas[1][1]?.[2]).not.toEqual(consultas[3][1]?.[2]);
    expect(JSON.stringify(clima)).not.toContain("privada");
    expect(String(consultas[3][1]?.[2])).not.toContain("privada");
  });
  it("descarta una caché corrupta y reutiliza una respuesta completa válida", async () => {
    const consultarFuente = configurarFuente();
    vi.mocked(consultar)
      .mockResolvedValueOnce([lote])
      .mockResolvedValueOnce([{ contenido: { actual: { temperatura: 999 } } }]);
    const clima = await obtenerClima("lote");
    expect(consultarFuente).toHaveBeenCalledTimes(1);
    vi.mocked(consultar)
      .mockResolvedValueOnce([lote])
      .mockResolvedValueOnce([{ contenido: JSON.stringify(clima) }]);
    const repetido = await obtenerClima("lote");
    expect(consultarFuente).toHaveBeenCalledTimes(1);
    expect(repetido).toEqual(clima);
  });
});
