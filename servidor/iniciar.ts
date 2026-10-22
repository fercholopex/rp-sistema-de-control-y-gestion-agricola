import "dotenv/config";
import next from "next";

async function iniciar() {
  const produccion = process.argv.includes("--produccion");
  Object.assign(process.env, {
    NODE_ENV: produccion ? "production" : "development",
  });
  const puertoConfigurado = produccion
    ? (process.env.PORT || "3000")
    : (process.env.PUERTO || process.env.PORT || "3000");
  const puerto = Number(puertoConfigurado);
  const direccion = produccion
    ? (process.env.HOST || "0.0.0.0")
    : (process.env.HOST_ESCUCHA || "127.0.0.1");
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    throw new Error(
      `El puerto de escucha (${produccion ? "PORT" : "PUERTO"}) no es válido.`,
    );
  }
  const cliente = next({ dev: !produccion, port: puerto, hostname: direccion });
  await cliente.prepare();
  const { crearAplicacion } = require("./src/aplicacion") as typeof import(
    "./src/aplicacion"
  );
  const servidor = crearAplicacion();
  const atender = cliente.getRequestHandler();
  servidor.use((solicitud, respuesta) => atender(solicitud, respuesta));
  const instancia = servidor.listen(puerto, direccion, () => {
    console.info(`Servidor iniciado en ${direccion}:${puerto}.`);
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
