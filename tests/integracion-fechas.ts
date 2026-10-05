import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Server } from "node:http";
import mariadb from "mariadb";

// Regresión real de fechas: solo crea y elimina una base temporal propia.
async function principal() {
  if (!process.env.DB_PRUEBAS_USUARIO)
    throw new Error(
      "Define DB_PRUEBAS_USUARIO para la prueba aislada de fechas.",
    );
  const base = `alcachofa_fechas_${Date.now()}`;
  const administracion = await mariadb.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_PRUEBAS_USUARIO,
    password: process.env.DB_PRUEBAS_PASSWORD ?? "",
    dateStrings: true,
    timezone: "+00:00",
  });
  let servidor: Server | undefined;
  let cerrar: (() => Promise<void>) | undefined;
  try {
    await administracion.query(
      `CREATE DATABASE \`${base}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await administracion.query(`USE \`${base}\``);
    const esquema = (await readFile("database/schema_migration.sql", "utf8"))
      .replace(/^--.*$/gm, "")
      .replace(/CREATE DATABASE[^;]+;/gi, "")
      .replace(/USE\s+`[^`]+`;/gi, "");
    for (const sentencia of esquema
      .split(";")
      .map((valor) => valor.trim())
      .filter(Boolean))
      await administracion.query(sentencia);
    Object.assign(process.env, {
      NODE_ENV: "test",
      DB_NAME: base,
      DB_USER: process.env.DB_PRUEBAS_USUARIO,
      DB_PASSWORD: process.env.DB_PRUEBAS_PASSWORD ?? "",
      ORIGEN_FRONTEND: "http://localhost:3100",
      SESION_HORAS: "12",
      ZONA_HORARIA: "America/Guatemala",
    });
    const { crearAplicacion } = await import("../servidor/src/aplicacion");
    cerrar = (await import("../servidor/src/base_datos/conexion"))
      .cerrarBaseDatos;
    servidor = crearAplicacion().listen(0, "127.0.0.1");
    await new Promise<void>((resolver) =>
      servidor!.once("listening", resolver),
    );
    const direccion = servidor.address();
    assert.ok(direccion && typeof direccion !== "string");
    const origen = `http://127.0.0.1:${direccion.port}`;
    let cookie = "";
    async function solicitar(ruta: string, metodo = "GET", datos?: unknown) {
      const respuesta = await fetch(`${origen}/api${ruta}`, {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
          "X-Solicitud-Segura": "1",
          Origin: process.env.ORIGEN_FRONTEND!,
          Cookie: cookie,
        },
        body: metodo === "GET" ? undefined : JSON.stringify(datos),
      });
      const contenido = await respuesta.json();
      assert.ok(
        respuesta.ok,
        `${metodo} ${ruta}: ${JSON.stringify(contenido)}`,
      );
      if (respuesta.headers.get("set-cookie"))
        cookie = respuesta.headers.get("set-cookie")!.split(";")[0];
      return contenido;
    }
    const clave = `Temporal-${randomUUID()}`;
    const cuenta = {
      nombre: "Cuenta temporal fechas",
      email: "fechas@pruebas.invalid",
      contrasena: clave,
    };
    const usuario = (await solicitar("/autenticacion/setup", "POST", cuenta))
      .datos;
    await solicitar("/autenticacion/iniciar-sesion", "POST", {
      email: cuenta.email,
      contrasena: clave,
    });
    const lote = (
      await solicitar("/lotes", "POST", {
        nombre_lote: "Lote temporal fechas",
        codigo: "FECHAS",
        superficie_ha: 1,
        fecha_siembra: "2026-09-22",
      })
    ).datos;
    assert.equal(
      lote.fecha_siembra,
      "2026-09-22",
      "Las fechas sin hora mantienen el día de calendario",
    );
    const entrada = "2026-09-22T14:30:00Z";
    const esperado = "2026-09-22T14:30:00.000Z";
    const operacion = (
      await solicitar("/operaciones", "POST", {
        lote_id: lote.id,
        encargado_id: usuario.id,
        tipo_operacion: "riego",
        descripcion: "Prueba de instante UTC",
        fecha_operacion: entrada,
        riego: { inicio: "2026-09-22T12:30:00Z", fin: entrada, tarifa_hora: 1 },
      })
    ).datos;
    const [sqlInicial] = await administracion.query(
      "SELECT CAST(fecha_operacion AS CHAR) fecha FROM operaciones_campo WHERE id=?",
      [operacion.id],
    );
    console.info(
      JSON.stringify({
        entrada,
        respuesta: operacion.fecha_operacion,
        sql: sqlInicial.fecha,
        zona_proceso: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    );
    assert.equal(
      operacion.fecha_operacion,
      esperado,
      "La respuesta conserva el instante recibido",
    );
    assert.equal(
      sqlInicial.fecha,
      "2026-09-22 14:30:00.000",
      "MySQL almacena UTC sin restar seis horas",
    );
    assert.equal(operacion.riego.inicio, "2026-09-22T12:30:00.000Z");
    assert.equal(operacion.riego.fin, esperado);
    for (let pasada = 0; pasada < 3; pasada++) {
      const cambiada = (
        await solicitar(`/operaciones/${operacion.id}`, "PATCH", {
          descripcion: `Descripción corregida ${pasada}`,
        })
      ).datos;
      assert.equal(
        cambiada.fecha_operacion,
        esperado,
        "Editar repetidamente no desplaza las fechas",
      );
    }
    const local = (
      await solicitar(`/operaciones/${operacion.id}`, "PATCH", {
        fecha_operacion: "2026-09-22T08:30:00-06:00",
      })
    ).datos;
    assert.equal(
      local.fecha_operacion,
      esperado,
      "Un offset explícito representa el mismo instante UTC",
    );
    const medicion = (
      await solicitar("/mediciones", "POST", {
        lote_id: lote.id,
        profundidad_cm: 10,
        humedad_porcentaje: 30,
        conductividad_ce: 1,
        ph_suelo: 7,
        fecha_hora: entrada,
      })
    ).datos;
    assert.equal(medicion.fecha_hora, esperado);
    const nocturna = (
      await solicitar("/operaciones", "POST", {
        lote_id: lote.id,
        encargado_id: usuario.id,
        tipo_operacion: "practica_general",
        descripcion: "Evento del día anterior en Guatemala",
        fecha_operacion: "2026-09-22T02:00:00Z",
      })
    ).datos;
    const dia22 = await solicitar(
      `/operaciones?desde=2026-09-22&hasta=2026-09-22&lote_id=${lote.id}`,
    );
    assert.equal(
      dia22.total,
      1,
      "Los filtros empiezan a las 06:00 UTC de Guatemala",
    );
    const dia21 = await solicitar(
      `/operaciones?desde=2026-09-21&hasta=2026-09-21&lote_id=${lote.id}`,
    );
    assert.equal(dia21.datos[0].id, nocturna.id);
    const [sesion] = await administracion.query(
      "SELECT TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(),fecha_expiracion) segundos FROM sesiones WHERE usuario_id=?",
      [usuario.id],
    );
    assert.ok(
      sesion.segundos > 43100 && sesion.segundos <= 43200,
      "La sesión dura doce horas reales, no seis",
    );
    console.info(
      "Fechas de operación/riego/medición, edición repetida, filtros locales y expiración: correctos en MariaDB real.",
    );
  } finally {
    if (servidor)
      await new Promise<void>((resolver) => servidor!.close(() => resolver()));
    if (cerrar) await cerrar();
    assert.match(base, /^alcachofa_fechas_\d+$/);
    await administracion.query(`DROP DATABASE IF EXISTS \`${base}\``);
    await administracion.end();
  }
}

principal().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
