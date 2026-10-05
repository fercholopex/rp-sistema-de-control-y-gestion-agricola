import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import mariadb from "mariadb";
import type { Server } from "node:http";
import { solicitar as solicitarCliente } from "../cliente/src/servicios/http";

// Exclusivamente datos temporales: nunca ejecutar contra una base de producción.
async function principal() {
  if (!process.env.DB_PRUEBAS_USUARIO)
    throw new Error(
      "Define DB_PRUEBAS_USUARIO con permisos para crear una base temporal.",
    );
  const base = `alcachofa_pruebas_${Date.now()}`;
  const administracion = await mariadb.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_PRUEBAS_USUARIO,
    password: process.env.DB_PRUEBAS_PASSWORD ?? "",
    multipleStatements: false,
  });
  let servidor: Server | undefined;
  let cerrar: (() => Promise<void>) | undefined;
  let completado = false;
  let comprobaciones = 0;
  const comprobar = (condicion: unknown, mensaje: string) => {
    assert.ok(condicion, mensaje);
    comprobaciones++;
  };
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
    const cookies: Record<string, string> = {};
    async function solicitar(
      ruta: string,
      metodo = "GET",
      datos?: unknown,
      cuenta = "admin",
      esperado = 200,
      cabeceras: Record<string, string> = {},
    ) {
      const respuesta = await fetch(`${origen}/api${ruta}`, {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
          "X-Solicitud-Segura": "1",
          Origin: process.env.ORIGEN_FRONTEND!,
          ...(cookies[cuenta] ? { Cookie: cookies[cuenta] } : {}),
          ...cabeceras,
        },
        body: metodo === "GET" ? undefined : JSON.stringify(datos ?? {}),
      });
      const cuerpo = await respuesta.json();
      assert.equal(
        respuesta.status,
        esperado,
        `${metodo} ${ruta}: ${JSON.stringify(cuerpo)}`,
      );
      comprobaciones++;
      const cookie = respuesta.headers.get("set-cookie");
      if (cookie) {
        cookies[cuenta] = cookie.split(";")[0];
        comprobar(
          cookie.includes("HttpOnly") && cookie.includes("SameSite=Strict"),
          "Cookie protegida",
        );
      }
      return cuerpo;
    }
    comprobar(
      (await solicitar("/autenticacion/estado")).datos.requiere_configuracion,
      "Instalación sin usuarios",
    );
    await solicitar("/lotes", "GET", undefined, "anonimo", 401);
    const clave = `Pruebas-${randomUUID()}!`;
    const alta = {
      nombre: "Cuenta temporal de pruebas",
      email: "administrador@pruebas.invalid",
      contrasena: clave,
    };
    const carreras = await Promise.all(
      [0, 1].map(async () => {
        const respuesta = await fetch(`${origen}/api/autenticacion/setup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Solicitud-Segura": "1",
            Origin: process.env.ORIGEN_FRONTEND!,
          },
          body: JSON.stringify(alta),
        });
        return { codigo: respuesta.status, cuerpo: await respuesta.json() };
      }),
    );
    assert.deepEqual(
      carreras.map((resultado) => resultado.codigo).sort(),
      [201, 409],
      "Solo una petición concurrente puede crear al administrador",
    );
    comprobaciones += 2;
    const idAdministrador = carreras.find(
      (resultado) => resultado.codigo === 201,
    )!.cuerpo.datos.id;
    comprobar(
      !(await solicitar("/autenticacion/estado")).datos.requiere_configuracion,
      "Configuración cerrada",
    );
    await solicitar(
      "/autenticacion/iniciar-sesion",
      "POST",
      { email: alta.email, contrasena: "incorrecta" },
      "admin",
      401,
    );
    const acceso = await solicitar("/autenticacion/iniciar-sesion", "POST", {
      email: alta.email,
      contrasena: clave,
    });
    comprobar(
      !JSON.stringify(acceso).includes("password_hash"),
      "No se filtran hashes",
    );
    await solicitar("/autenticacion/sesion");
    await solicitar("/usuarios", "GET", undefined, "admin", 403, {
      Origin: "https://origen-ajeno.invalid",
    });
    await solicitar("/lotes", "POST", {}, "admin", 403, {
      "X-Solicitud-Segura": "0",
    });
    await solicitar(
      `/usuarios/${idAdministrador}`,
      "PATCH",
      { estado: "inactivo" },
      "admin",
      409,
    );
    const encargado = (
      await solicitar(
        "/usuarios",
        "POST",
        {
          nombre: "Encargado temporal",
          email: "encargado@pruebas.invalid",
          contrasena: clave,
          rol: "encargado",
          estado: "activo",
        },
        "admin",
        201,
      )
    ).datos;
    const operador = (
      await solicitar(
        "/usuarios",
        "POST",
        {
          nombre: "Operador temporal",
          email: "operador@pruebas.invalid",
          contrasena: clave,
          rol: "operador",
          estado: "activo",
        },
        "admin",
        201,
      )
    ).datos;
    for (const rol of ["encargado", "operador"])
      await solicitar(
        "/autenticacion/iniciar-sesion",
        "POST",
        { email: `${rol}@pruebas.invalid`, contrasena: clave },
        rol,
      );
    await solicitar("/usuarios", "GET", undefined, "operador", 403);
    await solicitar(
      "/usuarios",
      "POST",
      { ...alta, rol: "admin" },
      "encargado",
      403,
    );
    await solicitar("/bitacora", "GET", undefined, "encargado", 403);
    const opciones = (
      await solicitar("/usuarios/encargados", "GET", undefined, "operador")
    ).datos;
    comprobar(
      opciones.some((fila: { id: string }) => fila.id === encargado.id) &&
        !opciones.some((fila: { id: string }) => fila.id === operador.id),
      "Solo encargados habilitados",
    );
    const datosLote = {
      nombre_lote: "Lote temporal",
      codigo: "PRUEBA-01",
      superficie_ha: 2.5,
      unidad_superficie: "hectarea",
      latitud: 14.63,
      longitud: -90.51,
      variedad: "Prueba",
      fecha_siembra: "2026-09-01",
      estado: "activo",
    };
    await solicitar("/lotes", "POST", datosLote, "operador", 403);
    const lote = (
      await solicitar("/lotes", "POST", datosLote, "encargado", 201)
    ).datos;
    comprobar(Number(lote.longitud) < 0, "Longitud negativa conservada");
    await solicitar("/lotes", "POST", datosLote, "admin", 409);
    await solicitar(
      `/lotes/${lote.id}`,
      "PATCH",
      { nombre_lote: "Lote temporal actualizado" },
      "encargado",
    );
    await solicitar(`/lotes/${lote.id}`, "DELETE", {}, "encargado", 403);
    await solicitar(
      "/lotes",
      "POST",
      { ...datosLote, codigo: "MAL", fecha_siembra: "2026-02-30" },
      "admin",
      400,
    );
    comprobar(
      (await solicitar("/lotes?buscar=actualizado&limite=1")).total === 1,
      "Búsqueda y paginación servidor",
    );
    comprobar(
      (await solicitar("/lotes?buscar=%27%20OR%201%3D1--")).total === 0,
      "Consulta parametrizada",
    );
    const empleado = (
      await solicitar(
        "/empleados",
        "POST",
        {
          nombre_completo: "Persona temporal",
          tarifa_actual: 100,
          tipo_pago: "hora",
          unidad_pago: "hora",
          estado: "activo",
        },
        "admin",
        201,
      )
    ).datos;
    const cultivo = (
      await solicitar(
        "/cultivos",
        "POST",
        { nombre: "Cultivo temporal", variedad: "Prueba", estado: "activo" },
        "admin",
        201,
      )
    ).datos;
    const producto = (
      await solicitar(
        "/productos",
        "POST",
        {
          nombre: "Producto temporal",
          codigo: "PROD-TEMP",
          categoria: "fertilizante",
          unidad_base: "kg",
          precio_actual: 20,
          activo: true,
        },
        "admin",
        201,
      )
    ).datos;
    const datosMedicion = {
      lote_id: lote.id,
      profundidad_cm: 20,
      humedad_porcentaje: 42,
      conductividad_ce: 1.8,
      ph_suelo: 6.8,
      fecha_hora: "2026-09-21T14:00:00Z",
    };
    await solicitar(
      "/mediciones",
      "POST",
      { ...datosMedicion, humedad_porcentaje: 101 },
      "operador",
      400,
    );
    await solicitar(
      "/mediciones",
      "POST",
      { ...datosMedicion, lote_id: "inexistente" },
      "operador",
      400,
    );
    const medicion = (
      await solicitar("/mediciones", "POST", datosMedicion, "operador", 201)
    ).datos;
    comprobar(
      medicion.usuario_id === operador.id,
      "Autor de medición desde sesión",
    );
    await solicitar(
      `/mediciones/${medicion.id}`,
      "PATCH",
      { ph_suelo: 7 },
      "operador",
      403,
    );
    await solicitar(
      `/mediciones/${medicion.id}`,
      "PUT",
      { ...datosMedicion, ph_suelo: 7 },
      "encargado",
    );
    const datosOperacion = {
      lote_id: lote.id,
      encargado_id: encargado.id,
      cultivo_id: cultivo.id,
      tipo_operacion: "riego",
      descripcion: "Operación temporal de prueba",
      cantidad_dosificacion: 12,
      fecha_operacion: "2026-09-21T14:00:00Z",
      estado: "confirmada",
      mano_obra: [{ empleado_id: empleado.id, cantidad: 2 }],
      productos: [{ producto_id: producto.id, cantidad: 3 }],
      riego: {
        inicio: "2026-09-21T12:00:00Z",
        fin: "2026-09-21T14:00:00Z",
        tarifa_hora: 10,
        costo_agua: 5,
      },
      costo_aplicacion: 7,
      otros_costos: 8,
    };
    await solicitar(
      "/operaciones",
      "POST",
      { ...datosOperacion, encargado_id: operador.id },
      "operador",
      400,
    );
    const operacion = (
      await solicitar("/operaciones", "POST", datosOperacion, "operador", 201)
    ).datos;
    comprobar(
      Number(operacion.costo_total) === 300,
      "Costos: 200+60+25+7+8 = 300",
    );
    await solicitar(
      `/productos/${producto.id}`,
      "PATCH",
      { precio_actual: 40 },
      "encargado",
    );
    await solicitar(
      `/empleados/${empleado.id}`,
      "PATCH",
      { tarifa_actual: 200 },
      "encargado",
    );
    const modificada = (
      await solicitar(
        `/operaciones/${operacion.id}`,
        "PATCH",
        { descripcion: "Texto actualizado sin recotizar" },
        "encargado",
      )
    ).datos;
    comprobar(
      Number(modificada.costo_total) === 300,
      "Snapshots económicos no recotizados",
    );
    const historial = (await solicitar(`/productos/${producto.id}`)).datos;
    comprobar(
      Array.isArray(historial.precios)
        ? historial.precios.length === 2
        : Array.isArray(historial.historial_precios) &&
            historial.historial_precios.length === 2,
      "Dos precios históricos",
    );
    comprobar(
      (
        await solicitar(
          `/operaciones?lote_id=${lote.id}&encargado_id=${encargado.id}&tipo_operacion=riego&desde=2026-09-01&hasta=2026-09-30`,
        )
      ).total === 1,
      "Filtros operación",
    );
    await solicitar(
      "/operaciones?desde=2026-10-01&hasta=2026-09-01",
      "GET",
      undefined,
      "admin",
      400,
    );
    await solicitar("/resumen");
    const sinCoordenadas = (
      await solicitar(
        "/lotes",
        "POST",
        { ...datosLote, codigo: "SIN-COORD", latitud: null, longitud: null },
        "admin",
        201,
      )
    ).datos;
    const clima = await solicitar(
      `/clima?lote_id=${sinCoordenadas.id}`,
      "GET",
      undefined,
      "admin",
      422,
    );
    comprobar(
      clima.mensaje.includes("latitud"),
      "Clima sin coordenadas explícito",
    );
    const bitacora = await solicitar("/bitacora?limite=100");
    comprobar(
      bitacora.total >= 16 &&
        !JSON.stringify(bitacora).includes(clave) &&
        !JSON.stringify(bitacora).includes("scrypt$"),
      "Auditoría real sin secretos",
    );
    await solicitar("/bitacora", "POST", {}, "admin", 404);
    await solicitar(
      `/operaciones/${operacion.id}`,
      "DELETE",
      {},
      "operador",
      403,
    );
    const bajaDesdeCliente = await solicitarCliente(
      `${origen}/api/operaciones/${operacion.id}`,
      {
        method: "DELETE",
        headers: {
          Cookie: cookies.admin,
          Origin: process.env.ORIGEN_FRONTEND!,
        },
      },
    );
    comprobar(
      bajaDesdeCliente.exito,
      "La baja desde el cliente cumple el contrato JSON de seguridad",
    );
    await solicitar(
      `/operaciones/${operacion.id}`,
      "GET",
      undefined,
      "admin",
      404,
    );
    const [historica] = await administracion.query(
      "SELECT fecha_eliminacion,costo_total FROM operaciones_campo WHERE id=?",
      [operacion.id],
    );
    comprobar(
      historica.fecha_eliminacion && Number(historica.costo_total) === 300,
      "Eliminación conserva datos históricos",
    );
    await solicitar(`/mediciones/${medicion.id}`, "DELETE");
    await solicitar(`/usuarios/${operador.id}`, "PATCH", {
      estado: "inactivo",
    });
    await solicitar("/autenticacion/sesion", "GET", undefined, "operador", 401);
    await solicitar(
      "/autenticacion/iniciar-sesion",
      "POST",
      { email: "operador@pruebas.invalid", contrasena: clave },
      "operador",
      401,
    );
    await solicitar(`/usuarios/${operador.id}`, "PATCH", {
      estado: "activo",
      contrasena: `${clave}2`,
    });
    await solicitar(
      "/autenticacion/iniciar-sesion",
      "POST",
      { email: "operador@pruebas.invalid", contrasena: clave },
      "operador",
      401,
    );
    await solicitar(
      "/autenticacion/iniciar-sesion",
      "POST",
      { email: "operador@pruebas.invalid", contrasena: `${clave}2` },
      "operador",
    );
    await administracion.query(
      "UPDATE sesiones SET fecha_expiracion=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 HOUR) WHERE usuario_id=?",
      [operador.id],
    );
    await solicitar("/autenticacion/sesion", "GET", undefined, "operador", 401);
    await solicitar("/autenticacion/cerrar-sesion", "POST", {}, "encargado");
    await solicitar(
      "/autenticacion/sesion",
      "GET",
      undefined,
      "encargado",
      401,
    );
    const [cuenta] = await administracion.query(
      "SELECT password_hash FROM usuarios WHERE id=?",
      [idAdministrador],
    );
    comprobar(
      cuenta.password_hash.startsWith("scrypt$") &&
        cuenta.password_hash !== clave,
      "Contraseña derivada en base",
    );
    // Dejar fixtures solo si se solicitan para inspección visual posterior de esta base temporal.
    if (process.argv.includes("--conservar"))
      await writeFile(
        "tmp/pruebas-interfaz.json",
        JSON.stringify(
          {
            base,
            email: alta.email,
            contrasena: clave,
            usuario_db: process.env.DB_PRUEBAS_USUARIO,
            comprobaciones,
          },
          null,
          2,
        ),
      );
    completado = true;
    console.info(
      `${comprobaciones} comprobaciones de integración correctas; base temporal ${base}.`,
    );
  } finally {
    if (servidor)
      await new Promise<void>((resolver) => servidor!.close(() => resolver()));
    if (cerrar) await cerrar();
    if (!(completado && process.argv.includes("--conservar"))) {
      assert.match(base, /^alcachofa_pruebas_\d+$/);
      await administracion.query(`DROP DATABASE IF EXISTS \`${base}\``);
    }
    await administracion.end();
  }
}
principal().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
