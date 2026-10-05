import { randomUUID } from "node:crypto";
import type { Request } from "express";
import type { Conexion } from "../base_datos/conexion";

export async function registrarBitacora(
  conexion: Conexion,
  solicitud: Request,
  accion: string,
  modulo: string,
  registroId: string,
  detalles: unknown,
  usuarioId?: string | null,
) {
  await conexion.query(
    "INSERT INTO bitacora_logs (id,usuario_id,accion,modulo,registro_id,detalles,ip,fecha_hora) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP(3))",
    [
      randomUUID(),
      usuarioId === undefined ? (solicitud.usuario?.id ?? null) : usuarioId,
      accion,
      modulo,
      registroId,
      JSON.stringify(detalles),
      solicitud.ip?.slice(0, 45) ?? null,
    ],
  );
}
