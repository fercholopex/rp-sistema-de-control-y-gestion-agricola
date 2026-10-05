import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class ErrorSolicitud extends Error {
  constructor(
    public codigo: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

export const manejarErrores: ErrorRequestHandler = (
  error: unknown,
  _solicitud,
  respuesta,
  _siguiente,
) => {
  if (error instanceof ZodError) {
    respuesta
      .status(400)
      .json({
        exito: false,
        mensaje: "Revisa los campos indicados.",
        errores: error.issues.map((detalle) => ({
          campo: detalle.path.join("."),
          mensaje: detalle.message,
        })),
      });
    return;
  }
  if (error instanceof ErrorSolicitud) {
    respuesta
      .status(error.codigo)
      .json({ exito: false, mensaje: error.message });
    return;
  }
  const detalle = error as { code?: string; type?: string; status?: number };
  if (detalle.type === "entity.parse.failed") {
    respuesta
      .status(400)
      .json({
        exito: false,
        mensaje: "El contenido enviado no tiene un formato válido.",
      });
    return;
  }
  if (detalle.type === "entity.too.large") {
    respuesta
      .status(413)
      .json({
        exito: false,
        mensaje: "El contenido enviado excede el tamaño permitido.",
      });
    return;
  }
  if (detalle.code === "ER_DUP_ENTRY") {
    respuesta
      .status(409)
      .json({
        exito: false,
        mensaje: "Ya existe un registro con ese código o correo electrónico.",
      });
    return;
  }
  if (
    detalle.code === "ER_NO_REFERENCED_ROW_2" ||
    detalle.code === "ER_ROW_IS_REFERENCED_2"
  ) {
    respuesta
      .status(409)
      .json({
        exito: false,
        mensaje:
          "No se puede guardar el cambio porque existen relaciones incompatibles.",
      });
    return;
  }
  console.error("Error del servidor agrícola:", error);
  respuesta
    .status(500)
    .json({
      exito: false,
      mensaje:
        "No se pudo completar la solicitud. Comprueba la conexión y configuración del servidor.",
    });
};
