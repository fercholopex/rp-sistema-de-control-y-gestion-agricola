import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { consultar } from "../base_datos/conexion";
import { ErrorSolicitud } from "../utilidades/errores";

export type Rol = "admin" | "encargado" | "operador";
export type UsuarioSesion = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  estado: "activo" | "inactivo";
};

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioSesion;
      sesionId?: string;
    }
  }
}

export const nombreCookie =
  process.env.NODE_ENV === "production"
    ? "__Host-sesion_agricola"
    : "sesion_agricola";
export const resumirToken = (valor: string) =>
  createHash("sha256").update(valor).digest("hex");

export function leerCookie(cabecera: string | undefined) {
  const valor = cabecera
    ?.split(";")
    .map((parte) => parte.trim())
    .find((parte) => parte.startsWith(`${nombreCookie}=`))
    ?.slice(nombreCookie.length + 1);
  return valor && /^[a-f0-9]{64}$/.test(valor) ? valor : null;
}

export function proteccionOrigen(origen: string): RequestHandler {
  return (solicitud, respuesta, siguiente) => {
    respuesta.setHeader("Cache-Control", "no-store");
    respuesta.setHeader("X-Content-Type-Options", "nosniff");
    respuesta.setHeader("Referrer-Policy", "same-origin");
    const origenRecibido = solicitud.get("Origin");
    if (origenRecibido && origenRecibido !== origen)
      throw new ErrorSolicitud(
        403,
        "El origen de la solicitud no está autorizado.",
      );
    if (origenRecibido === origen) {
      respuesta.setHeader("Access-Control-Allow-Origin", origen);
      respuesta.setHeader("Access-Control-Allow-Credentials", "true");
      respuesta.setHeader("Vary", "Origin");
    }
    if (solicitud.method === "OPTIONS") {
      respuesta.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      );
      respuesta.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type,X-Solicitud-Segura",
      );
      respuesta.status(204).end();
      return;
    }
    if (!["GET", "HEAD"].includes(solicitud.method)) {
      if (
        solicitud.get("X-Solicitud-Segura") !== "1" ||
        !solicitud.is("application/json")
      ) {
        throw new ErrorSolicitud(
          403,
          "La solicitud no supera la verificación de seguridad.",
        );
      }
      if (solicitud.get("Sec-Fetch-Site") === "cross-site")
        throw new ErrorSolicitud(
          403,
          "La solicitud debe realizarse desde el sistema agrícola.",
        );
    }
    siguiente();
  };
}

export const autenticar: RequestHandler = async (
  solicitud,
  _respuesta,
  siguiente,
) => {
  const token = leerCookie(solicitud.headers.cookie);
  if (!token) throw new ErrorSolicitud(401, "Inicia sesión para continuar.");
  const id = resumirToken(token);
  const [usuario] = await consultar(
    "SELECT u.id,u.nombre,u.email,u.rol,u.estado FROM sesiones s JOIN usuarios u ON u.id=s.usuario_id WHERE s.id=? AND s.fecha_expiracion>UTC_TIMESTAMP(3) AND u.estado='activo' AND u.fecha_eliminacion IS NULL",
    [id],
  );
  if (!usuario)
    throw new ErrorSolicitud(
      401,
      "La sesión expiró o el usuario está inactivo. Inicia sesión nuevamente.",
    );
  solicitud.usuario = usuario as UsuarioSesion;
  solicitud.sesionId = id;
  siguiente();
};

export function permitirRoles(...roles: Rol[]): RequestHandler {
  return (solicitud, _respuesta, siguiente) => {
    if (!solicitud.usuario || !roles.includes(solicitud.usuario.rol))
      throw new ErrorSolicitud(
        403,
        "No tienes permisos para realizar esta acción.",
      );
    siguiente();
  };
}

export function exigirPermiso(permiso: string): RequestHandler {
  return async (solicitud, _respuesta, siguiente) => {
    const [concedido] = await consultar(
      "SELECT permiso FROM roles_permisos WHERE rol=? AND permiso=?",
      [solicitud.usuario?.rol, permiso],
    );
    if (!concedido)
      throw new ErrorSolicitud(
        403,
        "No tienes permisos para realizar esta acción.",
      );
    siguiente();
  };
}

const intentos = new Map<string, { cantidad: number; vence: number }>();
export const limitarAcceso: RequestHandler = (
  solicitud,
  respuesta,
  siguiente,
) => {
  const ahora = Date.now();
  if (intentos.size > 10000)
    for (const [clave, valor] of intentos)
      if (valor.vence < ahora) intentos.delete(clave);
  const claves = [
    `ip:${solicitud.ip ?? "desconocida"}`,
    `cuenta:${String(solicitud.body?.email ?? "")
      .trim()
      .toLowerCase()
      .slice(0, 254)}`,
  ];
  for (const clave of claves) {
    const limite = clave.startsWith("ip:") ? 30 : 10;
    const previo = intentos.get(clave);
    const actual =
      previo && previo.vence > ahora
        ? previo
        : { cantidad: 0, vence: ahora + 15 * 60000 };
    actual.cantidad++;
    if (intentos.size < 20000 || intentos.has(clave))
      intentos.set(clave, actual);
    if (actual.cantidad > limite) {
      respuesta.setHeader(
        "Retry-After",
        Math.ceil((actual.vence - ahora) / 1000),
      );
      throw new ErrorSolicitud(
        429,
        "Se realizaron demasiados intentos. Espera unos minutos antes de volver a intentarlo.",
      );
    }
  }
  siguiente();
};
