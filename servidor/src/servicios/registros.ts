import { randomUUID } from "node:crypto";
import { consultar, type Conexion, type Fila } from "../base_datos/conexion";
import { ErrorSolicitud } from "../utilidades/errores";
import {
  esquemas,
  normalizarFecha,
  type Recurso,
} from "../utilidades/validacion";
import { fechaParaSQL } from "../utilidades/fechas";

export const tablas: Record<Recurso, string> = {
  lotes: "lotes",
  cultivos: "cultivos",
  empleados: "empleados",
  productos: "productos",
  mediciones: "mediciones_campo",
  operaciones: "operaciones_campo",
};

export function normalizarFila(fila: Fila) {
  const resultado = { ...fila };
  for (const [clave, valor] of Object.entries(resultado)) {
    if (["activo", "encargado_historico"].includes(clave))
      resultado[clave] = Boolean(valor);
    if (
      ["centroide", "geometria", "detalles"].includes(clave) &&
      typeof valor === "string"
    ) {
      try {
        resultado[clave] = JSON.parse(valor);
      } catch {
        resultado[clave] = null;
      }
    }
    if (
      (clave.startsWith("fecha_") || ["inicio", "fin"].includes(clave)) &&
      typeof valor === "string" &&
      /^\d{4}-\d{2}-\d{2} /.test(valor)
    )
      resultado[clave] = valor.replace(" ", "T") + "Z";
  }
  return resultado;
}

export async function insertar(conexion: Conexion, tabla: string, datos: Fila) {
  const valores = Object.entries(datos).filter(
    ([, valor]) => valor !== undefined,
  );
  await conexion.query(
    `INSERT INTO ${tabla} (${valores.map(([clave]) => clave).join(",")}) VALUES (${valores.map(() => "?").join(",")})`,
    valores.map(([clave, valor]) => prepararValor(clave, valor)),
  );
}
export async function actualizarFila(
  conexion: Conexion,
  tabla: string,
  id: string,
  datos: Fila,
) {
  const valores = Object.entries(datos).filter(
    ([, valor]) => valor !== undefined,
  );
  if (valores.length)
    await conexion.query(
      `UPDATE ${tabla} SET ${valores.map(([clave]) => `${clave}=?`).join(",")} WHERE id=?`,
      [...valores.map(([clave, valor]) => prepararValor(clave, valor)), id],
    );
}
function prepararValor(clave: string, valor: unknown) {
  if (["centroide", "geometria"].includes(clave) && valor !== null)
    return JSON.stringify(valor);
  if (clave === "fecha_siembra" && typeof valor === "string") return valor;
  if (
    (clave.startsWith("fecha_") || clave === "inicio" || clave === "fin") &&
    typeof valor === "string"
  )
    return fechaParaSQL(normalizarFecha(valor));
  if (valor instanceof Date) return fechaParaSQL(valor);
  return valor;
}

export async function exigirRelacionado(
  conexion: Conexion,
  tabla: string,
  id: unknown,
  mensaje: string,
  condicion = "estado='activo'",
) {
  const [fila] = await consultar(
    `SELECT * FROM ${tabla} WHERE id=? AND fecha_eliminacion IS NULL ${condicion ? `AND ${condicion}` : ""} FOR UPDATE`,
    [id],
    conexion,
  );
  if (!fila) throw new ErrorSolicitud(400, mensaje);
  return fila;
}

export async function obtenerRegistro(
  recurso: Recurso,
  id: string,
  conexion?: Conexion,
) {
  let columnas = "t.*",
    uniones = "";
  if (recurso === "mediciones") {
    columnas += ",l.nombre_lote,u.nombre nombre_usuario";
    uniones =
      " JOIN lotes l ON l.id=t.lote_id JOIN usuarios u ON u.id=t.usuario_id";
  }
  if (recurso === "operaciones") {
    columnas += ",l.nombre_lote,u.nombre nombre_encargado";
    uniones =
      " JOIN lotes l ON l.id=t.lote_id LEFT JOIN usuarios u ON u.id=t.encargado_id";
  }
  const [fila] = await consultar(
    `SELECT ${columnas} FROM ${tablas[recurso]} t${uniones} WHERE t.id=? AND t.fecha_eliminacion IS NULL`,
    [id],
    conexion,
  );
  if (!fila) throw new ErrorSolicitud(404, "El registro solicitado no existe.");
  const resultado = normalizarFila(fila);
  if (recurso === "productos")
    resultado.historial_precios = (
      await consultar(
        "SELECT * FROM historial_precios_productos WHERE producto_id=? ORDER BY fecha_inicio DESC",
        [id],
        conexion,
      )
    ).map(normalizarFila);
  if (recurso === "operaciones") {
    resultado.mano_obra = await consultar(
      "SELECT * FROM detalles_mano_obra WHERE operacion_id=? ORDER BY id",
      [id],
      conexion,
    );
    resultado.productos = await consultar(
      "SELECT * FROM aplicaciones_productos WHERE operacion_id=? ORDER BY id",
      [id],
      conexion,
    );
    const [riego] = await consultar(
      "SELECT * FROM detalles_riego WHERE operacion_id=?",
      [id],
      conexion,
    );
    resultado.riego = riego ? normalizarFila(riego) : null;
  }
  if (recurso === "lotes") {
    resultado.lotes_dependientes = (
      await consultar(
        "SELECT id,nombre_lote,codigo,superficie_ha,estado FROM lotes WHERE lote_padre_id=? AND fecha_eliminacion IS NULL ORDER BY codigo",
        [id],
        conexion,
      )
    ).map(normalizarFila);
    resultado.asignaciones_cultivo = (
      await consultar(
        "SELECT a.*,c.nombre nombre_cultivo,c.variedad FROM asignaciones_cultivo a JOIN cultivos c ON c.id=a.cultivo_id WHERE a.lote_id=? ORDER BY a.fecha_inicio DESC",
        [id],
        conexion,
      )
    ).map(normalizarFila);
  }
  return resultado;
}

export function validarEntrada(
  recurso: Recurso,
  entrada: unknown,
  anterior?: Fila,
) {
  const esquema = esquemas[recurso];
  if (!anterior) return esquema.parse(entrada) as Fila;
  const validados = esquema.partial().parse(entrada) as Fila;
  // Zod aplica valores predeterminados aun dentro de algunos campos opcionales.
  // Una edición parcial solo puede reemplazar claves presentes en la solicitud.
  const cambios = Object.fromEntries(
    Object.entries(validados).filter(([clave]) =>
      Object.hasOwn(entrada as object, clave),
    ),
  );
  if (!Object.keys(cambios).length)
    throw new ErrorSolicitud(400, "No hay cambios para guardar.");
  const existentes = normalizarFila(anterior);
  const valores: Fila = {};
  for (const clave of Object.keys(esquema.shape))
    if (existentes[clave] !== undefined) valores[clave] = existentes[clave];
  const completo = esquema.parse({ ...valores, ...cambios }) as Fila;
  // Las partidas omitidas conservan sus importes históricos sin volver a cotizarse.
  if (recurso === "operaciones")
    for (const clave of ["mano_obra", "productos", "riego"])
      if (!(clave in cambios)) delete completo[clave];
  return completo;
}

export async function validarRelaciones(
  conexion: Conexion,
  recurso: Recurso,
  datos: Fila,
  id?: string,
  anterior?: Fila,
) {
  if (recurso === "lotes") {
    if ((datos.latitud == null) !== (datos.longitud == null))
      throw new ErrorSolicitud(
        400,
        "Latitud y longitud deben capturarse juntas.",
      );
    if (
      datos.lote_padre_id &&
      (!anterior || anterior.lote_padre_id !== datos.lote_padre_id)
    ) {
      const vistos = new Set<string>(id ? [id] : []);
      let padre: unknown = datos.lote_padre_id;
      for (let pasos = 0; padre; pasos++) {
        if (vistos.has(String(padre)) || pasos > 100)
          throw new ErrorSolicitud(
            400,
            "La relación entre lotes no puede formar un ciclo.",
          );
        vistos.add(String(padre));
        const fila = await exigirRelacionado(
          conexion,
          "lotes",
          padre,
          "El lote superior no existe o está inactivo.",
        );
        padre = fila.lote_padre_id;
      }
    }
    if (datos.finca_id && (!anterior || anterior.finca_id !== datos.finca_id))
      await exigirRelacionado(
        conexion,
        "fincas",
        datos.finca_id,
        "La finca no existe.",
        "",
      );
    const hectareas = Number(datos.superficie_ha);
    if (
      anterior &&
      Number(anterior.superficie_ha) === hectareas &&
      anterior.unidad_superficie === datos.unidad_superficie
    ) {
      // La conversión migrada puede tener una precisión distinta; una edición de texto no la recalcula.
      datos.superficie_original = anterior.superficie_original;
    } else {
      const superficie =
        datos.unidad_superficie === "metro_cuadrado"
          ? hectareas * 10000
          : datos.unidad_superficie === "acre"
            ? hectareas / 0.40468564224
            : hectareas;
      datos.superficie_original = Number(superficie.toFixed(4));
    }
    if (Number(datos.superficie_original) > 99999999.9999)
      throw new ErrorSolicitud(
        400,
        "La superficie excede el máximo permitido para la unidad seleccionada.",
      );
  }
  // Las relaciones históricas pueden estar inactivas. Se exige vigencia al seleccionarlas por primera vez o cambiarlas.
  if (
    (recurso === "mediciones" || recurso === "operaciones") &&
    (!anterior || anterior.lote_id !== datos.lote_id)
  )
    await exigirRelacionado(
      conexion,
      "lotes",
      datos.lote_id,
      "El lote seleccionado no existe o está inactivo.",
    );
  if (recurso === "operaciones") {
    if (!anterior || anterior.encargado_id !== datos.encargado_id)
      await exigirRelacionado(
        conexion,
        "usuarios",
        datos.encargado_id,
        "El encargado seleccionado no es válido.",
        "estado='activo' AND rol IN ('admin','encargado')",
      );
    if (
      datos.cultivo_id &&
      (!anterior || anterior.cultivo_id !== datos.cultivo_id)
    )
      await exigirRelacionado(
        conexion,
        "cultivos",
        datos.cultivo_id,
        "El cultivo seleccionado no existe o está inactivo.",
      );
  }
}

export async function actualizarHistorialPrecio(
  conexion: Conexion,
  id: string,
  precio: unknown,
  anterior?: unknown,
) {
  const actual = precio == null ? null : Number(precio);
  const previo = anterior == null ? null : Number(anterior);
  if (actual === previo) return;
  await conexion.query(
    "UPDATE historial_precios_productos SET fecha_fin=UTC_TIMESTAMP(3) WHERE producto_id=? AND fecha_fin IS NULL",
    [id],
  );
  if (actual !== null)
    await conexion.query(
      "INSERT INTO historial_precios_productos (id,producto_id,precio,fecha_inicio) VALUES (?,?,?,UTC_TIMESTAMP(3))",
      [randomUUID(), id, actual],
    );
}
