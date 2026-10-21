"use strict";

require("tsx/cjs");

if (!process.argv.includes("--produccion")) {
  process.argv.push("--produccion");
}

require("./servidor/iniciar.ts");
