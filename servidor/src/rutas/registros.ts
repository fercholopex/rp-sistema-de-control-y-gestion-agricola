import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { consultar, transaccion } from "../base_datos/conexion";
import { exigirPermiso, permitirRoles } from "../intermediarios/seguridad";
import { registrarBitacora } from "../servicios/bitacora";
import { guardarDetalles, prepararOperacion } from "../servicios/operaciones";
import {
  actualizarFila,
  actualizarHistorialPrecio,
  insertar,
  normalizarFila,
  obtenerRegistro,
  tablas,
  validarEntrada,
  validarRelaciones,
} from "../servicios/registros";
import { ErrorSolicitud } from "../utilidades/errores";
import {
  filtrosConsulta,
  identificador,
  normalizarFecha,
  type Recurso,
} from "../utilidades/validacion";
import { desplazarDia } from "../utilidades/fechas";

const columnasBuscar: Record<Recurso, string[]> = {
  lotes: ["t.nombre_lote", "t.codigo", "t.variedad"],
  cultivos: ["t.nombre", "t.variedad"],
  empleados: ["t.nombre_completo"],
  productos: ["t.nombre", "t.codigo", "t.proveedor"],
  mediciones: ["l.nombre_lote", "t.observaciones"],
  operaciones: [
    "l.nombre_lote",
    "t.descripcion",
    "t.observaciones",
    "u.nombre",
  ],
};

export function rutasRegistros(recurso: Recurso) {
  const rutas = Router();
  const tabla = tablas[recurso];
  const campo = recurso === "operaciones" || recurso === "mediciones";
  const permiso = campo ? recurso : "catalogos";
  rutas.get(
    "/",
    exigirPermiso(`${permiso}.consultar`),
    async (solicitud, respuesta) => {
      const filtro = filtrosConsulta.parse(solicitud.query);
      const condiciones = ["t.fecha_eliminacion IS NULL"];
      const parametros: unknown[] = [];
      let columnas = "t.*",
        uniones = "";
      if (recurso === "operaciones") {
        uniones =
          " JOIN lotes l ON l.id=t.lote_id LEFT JOIN usuarios u ON u.id=t.encargado_id";
        columnas += ",l.nombre_lote,u.nombre nombre_encargado";
      }
      if (recurso === "mediciones") {
        uniones =
          " JOIN lotes l ON l.id=t.lote_id JOIN usuarios u ON u.id=t.usuario_id";
        columnas += ",l.nombre_lote,u.nombre nombre_usuario";
      }
      if (filtro.buscar) {
        condiciones.push(
          `(${columnasBuscar[recurso].map((columna) => `${columna} LIKE ?`).join(" OR ")})`,
        );
        parametros.push(
          ...columnasBuscar[recurso].map(() => `%${filtro.buscar}%`),
        );
      }
      if (filtro.estado && recurso !== "mediciones") {
        condiciones.push(recurso === "productos" ? "t.activo=?" : "t.estado=?");
        parametros.push(
          recurso === "productos"
            ? filtro.estado === "activo"
              ? 1
              : 0
            : filtro.estado,
        );
      }
      if (campo && filtro.lote_id) {
        condiciones.push("t.lote_id=?");
        parametros.push(filtro.lote_id);
      }
      if (recurso === "operaciones")
        for (const clave of [
          "tipo_operacion",
          "encargado_id",
          "tipo_fertilizante",
        ] as const) {
          if (filtro[clave]) {
            condiciones.push(`t.${clave}=?`);
            parametros.push(filtro[clave]);
          }
        }
      if (recurso === "mediciones" && filtro.usuario_id) {
        condiciones.push("t.usuario_id=?");
        parametros.push(filtro.usuario_id);
      }
      if (recurso === "productos" && filtro.categoria) {
        condiciones.push("t.categoria=?");
        parametros.push(filtro.categoria);
      }
      const columnaFecha =
        recurso === "operaciones"
          ? "fecha_operacion"
          : recurso === "mediciones"
            ? "fecha_hora"
            : "fecha_creacion";
      if (filtro.desde) {
        condiciones.push(`t.${columnaFecha}>=?`);
        parametros.push(normalizarFecha(filtro.desde));
      }
      if (filtro.hasta) {
        condiciones.push(`t.${columnaFecha}<?`);
        parametros.push(
          normalizarFecha(desplazarDia(filtro.hasta.slice(0, 10), 1)),
        );
      }
      const donde = condiciones.join(" AND ");
      const [conteo] = await consultar(
        `SELECT COUNT(*) total FROM ${tabla} t${uniones} WHERE ${donde}`,
        parametros,
      );
      const datos = await consultar(
        `SELECT ${columnas} FROM ${tabla} t${uniones} WHERE ${donde} ORDER BY t.${columnaFecha} DESC,t.id LIMIT ? OFFSET ?`,
        [...parametros, filtro.limite, (filtro.pagina - 1) * filtro.limite],
      );
      respuesta.json({
        exito: true,
        datos: datos.map(normalizarFila),
        total: Number(conteo.total),
        pagina: filtro.pagina,
        limite: filtro.limite,
      });
    },
  );
  rutas.get(
    "/:id",
    exigirPermiso(`${permiso}.consultar`),
    async (solicitud, respuesta) => {
      respuesta.json({
        exito: true,
        datos: await obtenerRegistro(
          recurso,
          identificador.parse(solicitud.params.id),
        ),
      });
    },
  );
  rutas.post(
    "/",
    permitirRoles(
      ...(campo
        ? (["admin", "encargado", "operador"] as const)
        : (["admin", "encargado"] as const)),
    ),
    exigirPermiso(`${permiso}.${campo ? "crear" : "escribir"}`),
    async (solicitud, respuesta) => {
      const datos = validarEntrada(recurso, solicitud.body);
      const id = randomUUID();
      const resultado = await transaccion(async (conexion) => {
        await validarRelaciones(conexion, recurso, datos);
        const preparado =
          recurso === "operaciones"
            ? await prepararOperacion(conexion, datos)
            : undefined;
        const valores = preparado?.valores ?? datos;
        if (recurso === "mediciones")
          valores.usuario_id = solicitud.usuario!.id;
        await insertar(conexion, tabla, { id, ...valores });
        if (preparado) await guardarDetalles(conexion, id, preparado);
        if (recurso === "productos")
          await actualizarHistorialPrecio(conexion, id, datos.precio_actual);
        const creado = await obtenerRegistro(recurso, id, conexion);
        await registrarBitacora(conexion, solicitud, "creacion", recurso, id, {
          despues: creado,
        });
        return creado;
      });
      respuesta.status(201).json({ exito: true, datos: resultado });
    },
  );
  rutas.put(
    "/:id",
    permitirRoles("admin", "encargado"),
    exigirPermiso(`${permiso}.${campo ? "editar" : "escribir"}`),
    actualizar,
  );
  rutas.patch(
    "/:id",
    permitirRoles("admin", "encargado"),
    exigirPermiso(`${permiso}.${campo ? "editar" : "escribir"}`),
    actualizar,
  );
  async function actualizar(solicitud: Request, respuesta: Response) {
    const id = identificador.parse(solicitud.params.id);
    const resultado = await transaccion(async (conexion) => {
      const [existente] = await consultar(
        `SELECT * FROM ${tabla} WHERE id=? AND fecha_eliminacion IS NULL FOR UPDATE`,
        [id],
        conexion,
      );
      if (!existente)
        throw new ErrorSolicitud(404, "El registro solicitado no existe.");
      const antes = await obtenerRegistro(recurso, id, conexion);
      const datos = validarEntrada(recurso, solicitud.body, existente);
      await validarRelaciones(conexion, recurso, datos, id, existente);
      const preparado =
        recurso === "operaciones"
          ? await prepararOperacion(conexion, datos, existente)
          : undefined;
      await actualizarFila(conexion, tabla, id, preparado?.valores ?? datos);
      if (preparado) await guardarDetalles(conexion, id, preparado);
      if (recurso === "productos")
        await actualizarHistorialPrecio(
          conexion,
          id,
          datos.precio_actual,
          existente.precio_actual,
        );
      const despues = await obtenerRegistro(recurso, id, conexion);
      await registrarBitacora(
        conexion,
        solicitud,
        "modificacion",
        recurso,
        id,
        { antes, despues },
      );
      return despues;
    });
    respuesta.json({ exito: true, datos: resultado });
  }
  rutas.delete(
    "/:id",
    permitirRoles("admin"),
    exigirPermiso(`${permiso}.eliminar`),
    async (solicitud, respuesta) => {
      const id = identificador.parse(solicitud.params.id);
      await transaccion(async (conexion) => {
        const [existente] = await consultar(
          `SELECT id FROM ${tabla} WHERE id=? AND fecha_eliminacion IS NULL FOR UPDATE`,
          [id],
          conexion,
        );
        if (!existente)
          throw new ErrorSolicitud(404, "El registro solicitado no existe.");
        if (recurso === "lotes") {
          const hijos = await consultar(
            "SELECT id FROM lotes WHERE lote_padre_id=? AND fecha_eliminacion IS NULL LIMIT 1",
            [id],
            conexion,
          );
          if (hijos.length)
            throw new ErrorSolicitud(
              409,
              "El lote tiene lotes dependientes. Reasígnalos antes de eliminarlo.",
            );
        }
        const antes = await obtenerRegistro(recurso, id, conexion);
        await conexion.query(
          `UPDATE ${tabla} SET fecha_eliminacion=UTC_TIMESTAMP(3)${recurso === "productos" ? ",activo=0" : ""} WHERE id=?`,
          [id],
        );
        await registrarBitacora(
          conexion,
          solicitud,
          "eliminacion",
          recurso,
          id,
          {
            antes,
            descripcion:
              "Baja lógica. Se conservan los registros históricos y relaciones.",
          },
        );
      });
      respuesta.json({ exito: true, datos: { id } });
    },
  );
  return rutas;
}

export function rutasBitacora() {
  const rutas = Router();
  rutas.use(permitirRoles("admin"), exigirPermiso("bitacora.consultar"));
  rutas.get("/", async (solicitud, respuesta) => {
    const filtro = filtrosConsulta.parse(solicitud.query);
    const condiciones = ["1=1"],
      parametros: unknown[] = [];
    if (filtro.buscar) {
      condiciones.push(
        "(b.accion LIKE ? OR b.modulo LIKE ? OR u.nombre LIKE ?)",
      );
      parametros.push(...Array(3).fill(`%${filtro.buscar}%`));
    }
    if (filtro.usuario_id) {
      condiciones.push("b.usuario_id=?");
      parametros.push(filtro.usuario_id);
    }
    if (filtro.modulo) {
      condiciones.push("b.modulo=?");
      parametros.push(filtro.modulo);
    }
    if (filtro.desde) {
      condiciones.push("b.fecha_hora>=?");
      parametros.push(normalizarFecha(filtro.desde));
    }
    if (filtro.hasta) {
      condiciones.push("b.fecha_hora<?");
      parametros.push(
        normalizarFecha(desplazarDia(filtro.hasta.slice(0, 10), 1)),
      );
    }
    const donde = condiciones.join(" AND ");
    const [conteo] = await consultar(
      `SELECT COUNT(*) total FROM bitacora_logs b LEFT JOIN usuarios u ON u.id=b.usuario_id WHERE ${donde}`,
      parametros,
    );
    const datos = await consultar(
      `SELECT b.*,u.nombre nombre_usuario FROM bitacora_logs b LEFT JOIN usuarios u ON u.id=b.usuario_id WHERE ${donde} ORDER BY b.fecha_hora DESC,b.id LIMIT ? OFFSET ?`,
      [...parametros, filtro.limite, (filtro.pagina - 1) * filtro.limite],
    );
    respuesta.json({
      exito: true,
      datos: datos.map(normalizarFila),
      total: Number(conteo.total),
      pagina: filtro.pagina,
      limite: filtro.limite,
    });
  });
  rutas.get("/:id", async (solicitud, respuesta) => {
    const [datos] = await consultar(
      "SELECT b.*,u.nombre nombre_usuario FROM bitacora_logs b LEFT JOIN usuarios u ON u.id=b.usuario_id WHERE b.id=?",
      [identificador.parse(solicitud.params.id)],
    );
    if (!datos)
      throw new ErrorSolicitud(404, "El registro de bitácora no existe.");
    respuesta.json({ exito: true, datos: normalizarFila(datos) });
  });
  return rutas;
}
