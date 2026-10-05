import "dotenv/config";
import next from "next";

async function iniciar() {
  const produccion = process.argv.includes("--produccion");
  Object.assign(process.env, {
    NODE_ENV: produccion ? "production" : "development",
  });
  const puerto = Number(process.env.PUERTO);
  const direccion = process.env.HOST_ESCUCHA;
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535 || !direccion) {
    throw new Error("Configura PUERTO y HOST_ESCUCHA en .env.");
  }
  const cliente = next({ dev: !produccion, port: puerto, hostname: direccion });
  await cliente.prepare();
  const { crearAplicacion } = await import("./src/aplicacion");
  const servidor = crearAplicacion();
  const atender = cliente.getRequestHandler();
  servidor.use((solicitud, respuesta) => atender(solicitud, respuesta));
  const instancia = servidor.listen(puerto, direccion, () => {
    console.info(
      `ERP Agrícola Siempre Alcachofa disponible en ${process.env.ORIGEN_FRONTEND}`,
    );
  });
  const cerrar = () =>
    instancia.close(() => {
      void cliente.close().finally(() => process.exit(0));
    });
  process.once("SIGINT", cerrar);
  process.once("SIGTERM", cerrar);
}

iniciar().catch((error: unknown) => {
  console.error("No se pudo iniciar el sistema.", error);
  process.exitCode = 1;
});
