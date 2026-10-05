import { randomBytes, randomUUID } from "node:crypto";
import { Router } from "express";
import { consultar, obtenerGrupo, transaccion } from "../base_datos/conexion";
import {
  autenticar,
  leerCookie,
  limitarAcceso,
  nombreCookie,
  resumirToken,
} from "../intermediarios/seguridad";
import { registrarBitacora } from "../servicios/bitacora";
import {
  comprobarContrasena,
  protegerContrasena,
} from "../utilidades/contrasenas";
import { ErrorSolicitud } from "../utilidades/errores";
import { datosAcceso, datosIniciales } from "../utilidades/validacion";
import { fechaParaSQL } from "../utilidades/fechas";

export function rutasAutenticacion() {
  const rutas = Router();
  rutas.get("/estado", async (_solicitud, respuesta) => {
    const [fila] = await consultar("SELECT COUNT(*) cantidad FROM usuarios");
    respuesta.json({
      exito: true,
      datos: { requiere_configuracion: Number(fila.cantidad) === 0 },
    });
  });
  rutas.post("/setup", limitarAcceso, async (solicitud, respuesta) => {
    const datos = datosIniciales.parse(solicitud.body);
    const resumen = await protegerContrasena(datos.contrasena);
    const conexion = await obtenerGrupo().getConnection();
    let bloqueada = false;
    try {
      const [bloqueo] = await consultar(
        "SELECT GET_LOCK(CONCAT(DATABASE(), ':configuracion_inicial'), 5) adquirido",
        [],
        conexion,
      );
      if (Number(bloqueo.adquirido) !== 1)
        throw new ErrorSolicitud(
          409,
          "La configuración inicial ya se está procesando.",
        );
      bloqueada = true;
      await conexion.beginTransaction();
      const [conteo] = await consultar(
        "SELECT COUNT(*) cantidad FROM usuarios",
        [],
        conexion,
      );
      if (Number(conteo.cantidad) > 0)
        throw new ErrorSolicitud(
          409,
          "La configuración inicial ya fue completada. Inicia sesión.",
        );
      const id = randomUUID();
      await conexion.query(
        "INSERT INTO usuarios (id,nombre,email,password_hash,rol,estado) VALUES (?,?,?,?,'admin','activo')",
        [id, datos.nombre, datos.email, resumen],
      );
      await registrarBitacora(
        conexion,
        solicitud,
        "configuracion_inicial",
        "usuarios",
        id,
        { nombre: datos.nombre, email: datos.email, rol: "admin" },
        id,
      );
      await conexion.commit();
      respuesta
        .status(201)
        .json({
          exito: true,
          datos: {
            id,
            mensaje:
              "Administrador principal creado. Ya puedes iniciar sesión.",
          },
        });
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      if (bloqueada)
        await conexion.query(
          "SELECT RELEASE_LOCK(CONCAT(DATABASE(), ':configuracion_inicial'))",
        );
      conexion.release();
    }
  });
  rutas.post("/iniciar-sesion", limitarAcceso, async (solicitud, respuesta) => {
    const datos = datosAcceso.parse(solicitud.body);
    const [usuario] = await consultar(
      "SELECT id,nombre,email,rol,estado,password_hash,fecha_eliminacion FROM usuarios WHERE email=?",
      [datos.email],
    );
    const coincide = await comprobarContrasena(
      datos.contrasena,
      usuario?.password_hash,
    );
    if (!coincide || usuario.estado !== "activo" || usuario.fecha_eliminacion)
      throw new ErrorSolicitud(401, "El usuario o contraseña son incorrectos.");
    const horas = Number(process.env.SESION_HORAS ?? 12);
    const duracion =
      Number.isFinite(horas) && horas >= 1 && horas <= 168
        ? horas * 3600000
        : 12 * 3600000;
    const token = randomBytes(32).toString("hex");
    await transaccion(async (conexion) => {
      const [actual] = await consultar(
        "SELECT id,estado,password_hash,fecha_eliminacion FROM usuarios WHERE id=? FOR UPDATE",
        [usuario.id],
        conexion,
      );
      if (
        !actual ||
        actual.estado !== "activo" ||
        actual.fecha_eliminacion ||
        actual.password_hash !== usuario.password_hash
      )
        throw new ErrorSolicitud(
          401,
          "El usuario o contraseña son incorrectos.",
        );
      await conexion.query(
        "DELETE FROM sesiones WHERE fecha_expiracion<=UTC_TIMESTAMP(3)",
      );
      const anterior = leerCookie(solicitud.headers.cookie);
      if (anterior)
        await conexion.query("DELETE FROM sesiones WHERE id=?", [
          resumirToken(anterior),
        ]);
      await conexion.query(
        "INSERT INTO sesiones (id,usuario_id,fecha_expiracion) VALUES (?,?,?)",
        [
          resumirToken(token),
          usuario.id,
          fechaParaSQL(new Date(Date.now() + duracion)),
        ],
      );
      await registrarBitacora(
        conexion,
        solicitud,
        "inicio_sesion",
        "autenticacion",
        String(usuario.id),
        { descripcion: "Inicio de sesión correcto." },
        String(usuario.id),
      );
    });
    respuesta.cookie(nombreCookie, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: duracion,
    });
    respuesta.json({
      exito: true,
      datos: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        estado: usuario.estado,
      },
    });
  });
  rutas.get("/sesion", autenticar, (solicitud, respuesta) =>
    respuesta.json({ exito: true, datos: solicitud.usuario }),
  );
  rutas.post("/cerrar-sesion", autenticar, async (solicitud, respuesta) => {
    await transaccion(async (conexion) => {
      await conexion.query("DELETE FROM sesiones WHERE id=?", [
        solicitud.sesionId,
      ]);
      await registrarBitacora(
        conexion,
        solicitud,
        "cierre_sesion",
        "autenticacion",
        solicitud.usuario!.id,
        { descripcion: "Cierre de sesión." },
      );
    });
    respuesta.clearCookie(nombreCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });
    respuesta.json({
      exito: true,
      datos: { mensaje: "La sesión ha finalizado." },
    });
  });
  return rutas;
}
