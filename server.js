"use strict";

require("tsx/cjs/api").register();

if (!process.argv.includes("--produccion")) {
  process.argv.push("--produccion");
}

require("./servidor/iniciar.ts");
