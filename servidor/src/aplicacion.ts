import express from "express";
import { autenticar, proteccionOrigen } from "./intermediarios/seguridad";
import { rutasAutenticacion } from "./rutas/autenticacion";
import { rutasConsultas } from "./rutas/consultas";
import { rutasBitacora, rutasRegistros } from "./rutas/registros";
import { rutasUsuarios } from "./rutas/usuarios";
import { manejarErrores } from "./utilidades/errores";
import { esquemas, type Recurso } from "./utilidades/validacion";
import { obtenerZonaHoraria } from "./utilidades/fechas";

export function crearAplicacion() {
  const origen = process.env.ORIGEN_FRONTEND;
  if (!origen || new URL(origen).origin !== origen)
    throw new Error(
      "ORIGEN_FRONTEND debe contener un origen válido sin ruta ni barra final.",
    );
  obtenerZonaHoraria();
  const aplicacion = express();
  aplicacion.disable("x-powered-by");
  if (process.env.CONFIAR_PROXY === "1") aplicacion.set("trust proxy", 1);
  aplicacion.use(
    "/api",
    proteccionOrigen(origen),
    express.json({ limit: "256kb" }),
  );
  aplicacion.use("/api/autenticacion", rutasAutenticacion());
  aplicacion.use("/api", autenticar);
  aplicacion.use("/api/usuarios", rutasUsuarios());
  for (const recurso of Object.keys(esquemas) as Recurso[])
    aplicacion.use(`/api/${recurso}`, rutasRegistros(recurso));
  aplicacion.use("/api/bitacora", rutasBitacora());
  aplicacion.use("/api", rutasConsultas());
  aplicacion.use("/api", (_solicitud, respuesta) => {
    respuesta
      .status(404)
      .json({ exito: false, mensaje: "La ruta solicitada no existe." });
  });
  aplicacion.use(manejarErrores);
  return aplicacion;
}
