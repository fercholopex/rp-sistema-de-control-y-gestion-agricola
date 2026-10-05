import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mariadb, { type Connection } from "mariadb";

const directorio = path.dirname(fileURLToPath(import.meta.url));
const argumentos = new Set(process.argv.slice(2));
const limpiar =
  argumentos.has("--limpiar") ||
  argumentos.has("--reset") ||
  argumentos.has("--forzar");

function identificador(nombre: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(nombre)) {
    throw new Error(
      `El nombre de base '${nombre}' contiene caracteres no permitidos. Use solo letras, números, guiones y guiones bajos.`,
    );
  }
  return `\`${nombre}\``;
}

function variableObligatoria(nombre: string): string {
  const valor = process.env[nombre]?.trim();
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre} en el archivo .env.`);
  return valor;
}

async function principal() {
  const host = process.env.DB_HOST?.trim() || "localhost";
  const puerto = Number(process.env.DB_PORT || "3306");
  const baseDatos = variableObligatoria("DB_NAME");
  const usuario = variableObligatoria("DB_USER");
  const contrasena = process.env.DB_PASSWORD ?? "";

  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    throw new Error("DB_PORT debe ser un número de puerto válido (ej. 3306).");
  }

  const idBase = identificador(baseDatos);

  console.log("=================================================");
  console.log("  Generador de Base de Datos - ERP Agrícola");
  console.log("=================================================");
  console.log(`Servidor:    ${host}:${puerto}`);
  console.log(`Usuario:     ${usuario}`);
  console.log(`Base datos:  ${baseDatos}`);
  console.log(`Modo:        ${limpiar ? "Recreación limpia (DROP + CREATE)" : "Creación segura (IF NOT EXISTS)"}`);
  console.log("-------------------------------------------------");

  let conexion: Connection | undefined;

  try {
    conexion = await mariadb.createConnection({
      host,
      port: puerto,
      user: usuario,
      password: contrasena,
      dateStrings: true,
      multipleStatements: false,
      connectTimeout: 8000,
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error("\n❌ Error al conectar con el servidor MariaDB/MySQL:");
    if (err.code === "ECONNREFUSED") {
      console.error(
        `   No se pudo conectar a ${host}:${puerto}. Asegúrate de que el servicio MySQL/MariaDB (o XAMPP) esté iniciado.`,
      );
    } else if (err.code === "ER_ACCESS_DENIED_ERROR") {
      console.error(
        `   Acceso denegado para el usuario '${usuario}'. Verifica DB_USER y DB_PASSWORD en .env.`,
      );
    } else {
      console.error(`   ${err.message || String(error)}`);
    }
    process.exitCode = 1;
    return;
  }

  try {
    if (limpiar) {
      console.log(`Eliminando base de datos anterior '${baseDatos}' si existe...`);
      await conexion.query(`DROP DATABASE IF EXISTS ${idBase}`);
      console.log("✓ Base anterior eliminada.");
    }

    console.log(`Creando base de datos '${baseDatos}'...`);
    await conexion.query(
      `CREATE DATABASE IF NOT EXISTS ${idBase} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await conexion.query(`USE ${idBase}`);
    console.log("✓ Base de datos seleccionada.");

    const rutaSql = path.join(directorio, "schema_migration.sql");
    console.log(`Leyendo esquema desde: ${path.basename(rutaSql)}...`);
    const contenidoSql = await readFile(rutaSql, "utf8");

    const sentencias = contenidoSql
      .replaceAll("`alcachofa_cultivos_db`", idBase)
      .split(/;\s*(?:\r?\n|$)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    console.log(`Ejecutando ${sentencias.length} sentencias de estructura y catálogos...`);
    for (const sentencia of sentencias) {
      await conexion.query(sentencia);
    }

    console.log("✓ Estructura de tablas y permisos aplicada.");

    // Verificación
    const tablas = await conexion.query<Array<{ TABLE_NAME: string }>>(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME",
      [baseDatos],
    );

    const roles = await conexion.query<Array<{ codigo: string; nombre: string }>>(
      "SELECT codigo, nombre FROM roles ORDER BY codigo",
    );

    const usuarios = await conexion.query<Array<{ cantidad: number }>>(
      "SELECT COUNT(*) AS cantidad FROM usuarios",
    );

    console.log("\n=================================================");
    console.log(`  Resumen de instalación en '${baseDatos}'`);
    console.log("=================================================");
    console.log(`Tablas creadas:  ${tablas.length}`);
    console.log(`Roles técnicos:  ${roles.map((r) => r.codigo).join(", ")}`);
    console.log(`Usuarios:        ${usuarios[0]?.cantidad ?? 0}`);
    console.log("-------------------------------------------------");
    console.log("Tablas disponibles:");
    for (let i = 0; i < tablas.length; i += 3) {
      const fila = tablas
        .slice(i, i + 3)
        .map((t) => t.TABLE_NAME.padEnd(26))
        .join("");
      console.log(`  ${fila}`);
    }
    console.log("-------------------------------------------------");

    if (Number(usuarios[0]?.cantidad ?? 0) === 0) {
      console.log("📌 Siguiente paso:");
      console.log("   1. Ejecuta 'npm run dev' para iniciar el sistema.");
      console.log("   2. Ingresa a http://localhost:3100/");
      console.log("   3. El sistema te dirigirá automáticamente a /setup para crear tu Administrador principal.");
    } else {
      console.log("✓ Ya existen usuarios registrados en la base de datos.");
    }
    console.log("=================================================\n");
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string; sqlMessage?: string };
    console.error("\n❌ Error durante la generación del esquema:");
    console.error(`   ${err.sqlMessage || err.message || String(error)}`);
    process.exitCode = 1;
  } finally {
    await conexion.end();
  }
}

principal().catch((error) => {
  console.error("Error inesperado:", error);
  process.exitCode = 1;
});
