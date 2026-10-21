"use strict";

require("tsx/esm/api").register();

if (!process.argv.includes("--produccion")) {
  process.argv.push("--produccion");
}

import("./servidor/iniciar.ts").catch((error) => {
  console.error("No se pudo cargar el servidor.", error);
  process.exitCode = 1;
});
