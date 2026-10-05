import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { consultar, transaccion, type Fila } from "../base_datos/conexion";
import { permitirRoles } from "../intermediarios/seguridad";
import { registrarBitacora } from "../servicios/bitacora";
import { protegerContrasena } from "../utilidades/contrasenas";
import { ErrorSolicitud } from "../utilidades/errores";
import {
  datosUsuario,
  filtrosConsulta,
  identificador,
} from "../utilidades/validacion";
import { normalizarFila } from "../servicios/registros";

const columnas =
  "id,nombre,email,rol,estado,fecha_creacion,fecha_actualizacion";
export function rutasUsuarios() {
  const rutas = Router();
  rutas.get("/encargados", async (_solicitud, respuesta) => {
    const datos = await consultar(
      "SELECT id,nombre,email,rol,estado FROM usuarios WHERE rol IN ('admin','encargado') AND estado='activo' AND fecha_eliminacion IS NULL ORDER BY nombre",
    );
    respuesta.json({ exito: true, datos });
  });
  rutas.use(permitirRoles("admin"));
  rutas.get("/", async (solicitud, respuesta) => {
    const filtro = filtrosConsulta.parse(solicitud.query);
    const condiciones = ["fecha_eliminacion IS NULL"];
    const parametros: unknown[] = [];
    if (filtro.buscar) {
      condiciones.push("(nombre LIKE ? OR email LIKE ?)");
      parametros.push(`%${filtro.buscar}%`, `%${filtro.buscar}%`);
    }
    if (filtro.estado) {
      condiciones.push("estado=?");
      parametros.push(filtro.estado);
    }
    if (filtro.rol) {
      condiciones.push("rol=?");
      parametros.push(filtro.rol);
    }
    const donde = condiciones.join(" AND ");
    const [conteo] = await consultar(
      `SELECT COUNT(*) total FROM usuarios WHERE ${donde}`,
      parametros,
    );
    const datos = await consultar(
      `SELECT ${columnas} FROM usuarios WHERE ${donde} ORDER BY nombre,id LIMIT ? OFFSET ?`,
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
      `SELECT ${columnas} FROM usuarios WHERE id=? AND fecha_eliminacion IS NULL`,
      [identificador.parse(solicitud.params.id)],
    );
    if (!datos) throw new ErrorSolicitud(404, "El usuario no existe.");
    respuesta.json({ exito: true, datos: normalizarFila(datos) });
  });
  rutas.post("/", async (solicitud, respuesta) => {
    const datos = datosUsuario.parse(solicitud.body);
    const resumen = await protegerContrasena(datos.contrasena);
    const id = randomUUID();
    const resultado = await transaccion(async (conexion) => {
      await conexion.query(
        "INSERT INTO usuarios (id,nombre,email,password_hash,rol,estado) VALUES (?,?,?,?,?,?)",
        [id, datos.nombre, datos.email, resumen, datos.rol, datos.estado],
      );
      const [creado] = await consultar(
        `SELECT ${columnas} FROM usuarios WHERE id=?`,
        [id],
        conexion,
      );
      await registrarBitacora(
        conexion,
        solicitud,
        "creacion_usuario",
        "usuarios",
        id,
        { despues: creado },
      );
      return creado;
    });
    respuesta
      .status(201)
      .json({ exito: true, datos: normalizarFila(resultado) });
  });
  rutas.put("/:id", actualizar);
  rutas.patch("/:id", actualizar);
  async function actualizar(solicitud: Request, respuesta: Response) {
    const id = identificador.parse(solicitud.params.id);
    const validados = datosUsuario.partial().parse(solicitud.body);
    const cambios = Object.fromEntries(
      Object.entries(validados).filter(([clave]) =>
        Object.hasOwn(solicitud.body, clave),
      ),
    ) as typeof validados;
    if (!Object.keys(cambios).length)
      throw new ErrorSolicitud(400, "No hay cambios para guardar.");
    const resumen = cambios.contrasena
      ? await protegerContrasena(cambios.contrasena)
      : undefined;
    const resultado = await transaccion(async (conexion) => {
      // Serializa cambios de administradores para impedir perder la última cuenta activa.
      const administradores = await consultar(
        "SELECT id FROM usuarios WHERE rol='admin' AND estado='activo' AND fecha_eliminacion IS NULL ORDER BY id FOR UPDATE",
        [],
        conexion,
      );
      const [antes] = await consultar(
        `SELECT ${columnas} FROM usuarios WHERE id=? AND fecha_eliminacion IS NULL FOR UPDATE`,
        [id],
        conexion,
      );
      if (!antes) throw new ErrorSolicitud(404, "El usuario no existe.");
      const nuevo = { ...antes, ...cambios };
      const pierdeAcceso = nuevo.rol !== "admin" || nuevo.estado !== "activo";
      if (
        antes.rol === "admin" &&
        antes.estado === "activo" &&
        pierdeAcceso &&
        administradores.length <= 1
      )
        throw new ErrorSolicitud(
          409,
          "Debe permanecer al menos un administrador activo.",
        );
      if (id === solicitud.usuario!.id && pierdeAcceso)
        throw new ErrorSolicitud(
          409,
          "No puedes desactivar tu cuenta ni quitarte el rol de administrador.",
        );
      const valores: Fila = { ...cambios };
      delete valores.contrasena;
      if (resumen) valores.password_hash = resumen;
      const claves = Object.keys(valores);
      await conexion.query(
        `UPDATE usuarios SET ${claves.map((clave) => `${clave}=?`).join(",")} WHERE id=?`,
        [...claves.map((clave) => valores[clave]), id],
      );
      if (
        resumen ||
        (cambios.rol !== undefined && cambios.rol !== antes.rol) ||
        (cambios.estado !== undefined && cambios.estado !== antes.estado)
      )
        await conexion.query("DELETE FROM sesiones WHERE usuario_id=?", [id]);
      const [despues] = await consultar(
        `SELECT ${columnas} FROM usuarios WHERE id=?`,
        [id],
        conexion,
      );
      await registrarBitacora(
        conexion,
        solicitud,
        cambios.estado === "inactivo"
          ? "desactivacion_usuario"
          : "modificacion_usuario",
        "usuarios",
        id,
        { antes, despues, contrasena_actualizada: Boolean(resumen) },
      );
      return despues;
    });
    respuesta.json({ exito: true, datos: normalizarFila(resultado) });
  }
  rutas.delete("/:id", async (solicitud, respuesta) => {
    const id = identificador.parse(solicitud.params.id);
    if (id === solicitud.usuario!.id)
      throw new ErrorSolicitud(409, "No puedes eliminar tu propia cuenta.");
    await transaccion(async (conexion) => {
      const administradores = await consultar(
        "SELECT id FROM usuarios WHERE rol='admin' AND estado='activo' AND fecha_eliminacion IS NULL ORDER BY id FOR UPDATE",
        [],
        conexion,
      );
      const [antes] = await consultar(
        `SELECT ${columnas} FROM usuarios WHERE id=? AND fecha_eliminacion IS NULL FOR UPDATE`,
        [id],
        conexion,
      );
      if (!antes) throw new ErrorSolicitud(404, "El usuario no existe.");
      if (
        antes.rol === "admin" &&
        antes.estado === "activo" &&
        administradores.length <= 1
      )
        throw new ErrorSolicitud(
          409,
          "Debe permanecer al menos un administrador activo.",
        );
      await conexion.query(
        "UPDATE usuarios SET estado='inactivo',fecha_eliminacion=UTC_TIMESTAMP(3) WHERE id=?",
        [id],
      );
      await conexion.query("DELETE FROM sesiones WHERE usuario_id=?", [id]);
      await registrarBitacora(
        conexion,
        solicitud,
        "eliminacion_usuario",
        "usuarios",
        id,
        { antes },
      );
    });
    respuesta.json({ exito: true, datos: { id } });
  });
  return rutas;
}
