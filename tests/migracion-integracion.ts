import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import mariadb, { type Connection } from "mariadb";

// Prueba real y aislada. Nunca usa DB_NAME como destino ni modifica tablas del sistema.
const basePrueba = `alcachofa_prueba_migracion_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
const configuracion = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_PRUEBAS_USUARIO || process.env.DB_USER,
  password: process.env.DB_PRUEBAS_PASSWORD ?? process.env.DB_PASSWORD ?? "",
  dateStrings: true,
  decimalAsNumber: false,
  timezone: "Z",
  connectTimeout: 5000,
};
const fecha = "2026-09-01 09:30:00.000";
const fechas = { createdAt: fecha, updatedAt: fecha };
const casos: string[] = [];
let etapa = "conexión";

function baseSegura(): string {
  assert.match(basePrueba, /^alcachofa_prueba_migracion_[a-f0-9]{16}$/);
  return `\`${basePrueba}\``;
}
async function ejecutarMigrador(
  argumentos: string[] = [],
): Promise<{ codigo: number; salida: string }> {
  return await new Promise((resolve, reject) => {
    const proceso = spawn(
      process.execPath,
      ["--import", "tsx", "database/migrar.ts", ...argumentos],
      {
        cwd: process.cwd(),
        windowsHide: true,
        env: {
          ...process.env,
          DB_NAME: basePrueba,
          DB_ORIGEN: basePrueba,
          DB_USER: configuracion.user,
          DB_PASSWORD: configuracion.password,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let salida = "";
    proceso.stdout.on("data", (dato) => {
      salida += dato.toString();
    });
    proceso.stderr.on("data", (dato) => {
      salida += dato.toString();
    });
    proceso.on("error", reject);
    proceso.on("close", (codigo) => resolve({ codigo: codigo ?? -1, salida }));
  });
}
async function insertar(
  conexion: Connection,
  tabla: string,
  datos: Record<string, unknown>,
): Promise<void> {
  assert.match(tabla, /^[A-Za-z_]+$/);
  const columnas = Object.keys(datos);
  await conexion.query(
    `INSERT INTO \`${tabla}\` (${columnas.map((nombre) => `\`${nombre}\``).join(",")}) VALUES (${columnas.map(() => "?").join(",")})`,
    columnas.map((nombre) => datos[nombre]),
  );
}
async function cargarOrigen(conexion: Connection): Promise<void> {
  let sql = "";
  for (const candidato of ["database/historico/estructura-anterior.sql"]) {
    try {
      sql = await readFile(path.resolve(candidato), "utf8");
      break;
    } catch {
      /* Se busca también la ubicación archivada. */
    }
  }
  assert.ok(sql, "No se encontró la migración histórica conservada.");
  for (const sentencia of sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    etapa = `estructura histórica: ${sentencia.match(/(?:CREATE TABLE|ALTER TABLE)\s+`?(\w+)/)?.[1] ?? "sentencia"}`;
    await conexion.query(sentencia);
  }
  etapa = "carga de las 18 entidades históricas";
  await insertar(conexion, "User", {
    id: "usuario-origen",
    name: "Usuario de prueba aislada",
    email: "historico@example.invalid",
    role: "MANAGER",
    active: 1,
    ...fechas,
  });
  await insertar(conexion, "Farm", {
    id: "finca-origen",
    name: "Finca de prueba",
    location: "Referencia original",
    latitude: "14.1234567",
    longitude: "-90.1234567",
    notes: "Notas conservadas",
    ...fechas,
  });
  await insertar(conexion, "Lot", {
    id: "lote-origen",
    farmId: "finca-origen",
    name: "Lote de prueba",
    code: "CODIGO-COMPARTIDO",
    surfaceArea: "2.5000",
    surfaceUnit: "ACRE",
    latitude: "14.1234567",
    longitude: "-90.1234567",
    centroid: JSON.stringify([14, -90]),
    geoJson: JSON.stringify({ type: "Point", coordinates: [-90, 14] }),
    ...fechas,
  });
  await insertar(conexion, "Parcel", {
    id: "division-origen",
    lotId: "lote-origen",
    name: "División histórica de prueba",
    code: "CODIGO-COMPARTIDO",
    surfaceArea: "2500.0000",
    surfaceUnit: "SQUARE_METER",
    ...fechas,
  });
  await insertar(conexion, "Crop", {
    id: "cultivo-origen",
    name: "Cultivo de prueba",
    variety: "Variedad original",
    description: "Descripción conservada",
    ...fechas,
  });
  await insertar(conexion, "CropAssignment", {
    id: "asignacion-origen",
    parcelId: "division-origen",
    cropId: "cultivo-origen",
    startsAt: fecha,
    surfaceArea: "2500.0000",
    ...fechas,
  });
  await insertar(conexion, "Employee", {
    id: "empleado-origen",
    fullName: "Empleado de prueba",
    currentRate: "416.35",
    paymentType: "WAGE",
    paymentUnit: "jornal",
    ...fechas,
  });
  await insertar(conexion, "Unit", {
    id: "unidad-origen",
    code: "kg",
    name: "Kilogramo",
    dimension: "mass",
    baseUnit: 1,
    multiplier: "1.000000",
    ...fechas,
  });
  await insertar(conexion, "ApplicationMethod", {
    id: "metodo-origen",
    name: "Método de prueba",
    ...fechas,
  });
  await insertar(conexion, "WorkType", {
    id: "trabajo-origen",
    name: "Trabajo de prueba",
    ...fechas,
  });
  await insertar(conexion, "Product", {
    id: "producto-origen",
    code: "PRODUCTO-PRUEBA",
    name: "Producto de prueba",
    category: "FERTILIZER",
    baseUnitCode: "kg",
    currentPrice: "6.1234",
    supplier: "Proveedor de prueba",
    ...fechas,
  });
  await insertar(conexion, "ProductPriceHistory", {
    id: "precio-origen",
    productId: "producto-origen",
    price: "5.6789",
    startsAt: fecha,
    createdAt: fecha,
  });
  await insertar(conexion, "AgriculturalActivity", {
    id: "operacion-origen",
    category: "FERTILIZATION",
    occurredAt: fecha,
    lotId: "lote-origen",
    parcelId: "division-origen",
    cropId: "cultivo-origen",
    cropAssignmentId: "asignacion-origen",
    workTypeId: "trabajo-origen",
    methodId: "metodo-origen",
    status: "PENDING_PAYMENT",
    laborCost: "416.35",
    productCost: "18.37",
    applicationCost: "10.50",
    irrigationCost: "125.25",
    otherCost: "2.75",
    totalCost: "573.22",
    notes: "Registro histórico con todas las relaciones",
    ...fechas,
  });
  await insertar(conexion, "LaborEntry", {
    id: "mano-obra-origen",
    activityId: "operacion-origen",
    employeeId: "empleado-origen",
    employeeName: "Nombre capturado originalmente",
    paymentType: "WAGE",
    rateSnapshot: "416.35",
    quantity: "1.0000",
    allocationPct: "100.00",
    individualCost: "416.35",
    createdAt: fecha,
  });
  await insertar(conexion, "ProductApplication", {
    id: "aplicacion-origen",
    activityId: "operacion-origen",
    productId: "producto-origen",
    productName: "Nombre original producto",
    quantity: "3.0000",
    unitCode: "kg",
    unitPrice: "6.1234",
    productCost: "18.37",
    createdAt: fecha,
  });
  await insertar(conexion, "IrrigationDetail", {
    id: "riego-origen",
    activityId: "operacion-origen",
    startsAt: fecha,
    endsAt: "2026-09-01 12:00:00.000",
    durationHours: "2.50",
    ratePerHour: "40.0000",
    rateCost: "100.00",
    waterCost: "10.25",
    valveCost: "5.00",
    operatorCost: "7.50",
    otherCost: "2.50",
    ...fechas,
  });
  await insertar(conexion, "WeatherCache", {
    id: "clima-origen",
    latitude: "14.1234567",
    longitude: "-90.1234567",
    queryType: "current",
    payload: JSON.stringify({ temperatura: 23.5, origen: "prueba aislada" }),
    expiresAt: "2026-09-01 10:00:00.000",
    ...fechas,
  });
  await insertar(conexion, "AuditLog", {
    id: "bitacora-origen",
    actorId: "usuario-origen",
    action: "UPDATE",
    entityType: "lots",
    entityId: "lote-origen",
    before: JSON.stringify({ superficie: 2 }),
    after: JSON.stringify({ superficie: 2.5 }),
    createdAt: fecha,
  });
}
async function prueba(): Promise<void> {
  assert.ok(
    configuracion.host && configuracion.user && configuracion.port,
    "Configure conexión y DB_PRUEBAS_USUARIO antes de ejecutar.",
  );
  const conexion = await mariadb.createConnection(configuracion);
  let creada = false;
  try {
    etapa = "creación de base temporal";
    await conexion.query(
      `CREATE DATABASE ${baseSegura()} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    creada = true;
    await conexion.query(`USE ${baseSegura()}`);
    await cargarOrigen(conexion);
    etapa = "protección del administrador inicial";
    let resultado = await ejecutarMigrador();
    assert.equal(
      resultado.codigo,
      1,
      "Debe bloquear usuarios históricos sin administrador inicial.",
    );
    assert.match(resultado.salida, /cree primero el administrador/);
    let filas = await conexion.query(
      "SELECT COUNT(*) cantidad FROM mapa_migracion",
    );
    assert.equal(Number(filas[0].cantidad), 0);
    casos.push(
      "Se exige configurar el administrador antes de copiar usuarios históricos.",
    );
    await insertar(conexion, "usuarios", {
      id: randomUUID(),
      nombre: "Administrador de prueba aislada",
      email: "administrador-prueba@example.invalid",
      password_hash: "solo-prueba-aislada-no-utilizable",
      rol: "admin",
      estado: "activo",
    });
    etapa = "copia de 18 entidades";
    resultado = await ejecutarMigrador();
    assert.equal(resultado.codigo, 0, resultado.salida);
    filas = await conexion.query(
      "SELECT COUNT(*) cantidad, COUNT(DISTINCT origen_tabla) entidades FROM mapa_migracion",
    );
    assert.equal(Number(filas[0].cantidad), 18);
    assert.equal(Number(filas[0].entidades), 18);
    casos.push(
      "Se migran las 18 entidades y se conserva cada correspondencia.",
    );
    filas = await conexion.query("SELECT COUNT(*) cantidad FROM lotes");
    assert.equal(Number(filas[0].cantidad), 2);
    filas = await conexion.query(
      "SELECT * FROM lotes ORDER BY lote_padre_id IS NULL DESC",
    );
    assert.equal(filas[0].superficie_ha, "1.011714");
    assert.equal(filas[1].superficie_ha, "0.250000");
    assert.equal(filas[1].lote_padre_id, filas[0].id);
    assert.match(filas[1].codigo, /-MIG-/);
    assert.deepEqual(
      typeof filas[0].geometria === "string"
        ? JSON.parse(filas[0].geometria)
        : filas[0].geometria,
      { type: "Point", coordinates: [-90, 14] },
    );
    casos.push(
      "Se conservan jerarquía, geometrías, unidades y códigos coincidentes sin fusión.",
    );
    filas = await conexion.query(
      "SELECT o.*, l.lote_padre_id FROM operaciones_campo o JOIN lotes l ON l.id=o.lote_id",
    );
    assert.equal(filas[0].lote_original_id, filas[0].lote_padre_id);
    assert.equal(filas[0].costo_total, "573.22");
    assert.equal(filas[0].encargado_id, null);
    assert.equal(Number(filas[0].encargado_historico), 1);
    assert.equal(filas[0].estado, "pendiente_pago");
    filas = await conexion.query(
      "SELECT u.estado,u.password_hash,b.usuario_id FROM usuarios u JOIN bitacora_logs b ON b.usuario_id=u.id WHERE u.email='historico@example.invalid'",
    );
    assert.equal(filas[0].estado, "inactivo");
    assert.equal(filas[0].password_hash, null);
    assert.ok(filas[0].usuario_id);
    casos.push(
      "Se conservan costos, vínculos de auditoría y acceso histórico deshabilitado.",
    );
    resultado = await ejecutarMigrador(["--verificar"]);
    assert.equal(resultado.codigo, 0, resultado.salida);
    resultado = await ejecutarMigrador();
    assert.equal(resultado.codigo, 0, resultado.salida);
    filas = await conexion.query(
      "SELECT COUNT(*) cantidad FROM mapa_migracion",
    );
    assert.equal(Number(filas[0].cantidad), 18);
    casos.push("Verificación e importación repetida no duplican registros.");
    await conexion.query("UPDATE Crop SET name=? WHERE id=?", [
      "Origen modificado",
      "cultivo-origen",
    ]);
    resultado = await ejecutarMigrador();
    assert.equal(resultado.codigo, 1);
    assert.match(resultado.salida, /cambió después de migrarse/);
    await conexion.query("UPDATE Crop SET name=? WHERE id=?", [
      "Cultivo de prueba",
      "cultivo-origen",
    ]);
    casos.push("Un origen modificado se detecta y no sobrescribe el destino.");
    await insertar(conexion, "Lot", {
      id: "lote-rollback",
      name: "No debe persistir en destino",
      code: "LOTE-ROLLBACK",
      surfaceArea: "1.0000",
      surfaceUnit: "HECTARE",
      ...fechas,
    });
    await insertar(conexion, "Product", {
      id: "producto-rollback",
      code: "PRODUCTO-ROLLBACK",
      name: "Importe inválido de prueba",
      category: "OTHER",
      baseUnitCode: "kg",
      currentPrice: "-1.0000",
      ...fechas,
    });
    resultado = await ejecutarMigrador();
    assert.equal(resultado.codigo, 1);
    filas = await conexion.query(
      "SELECT COUNT(*) cantidad FROM lotes WHERE codigo='LOTE-ROLLBACK'",
    );
    assert.equal(Number(filas[0].cantidad), 0);
    filas = await conexion.query(
      "SELECT COUNT(*) cantidad FROM mapa_migracion",
    );
    assert.equal(Number(filas[0].cantidad), 18);
    filas = await conexion.query(
      "SELECT COUNT(*) cantidad FROM Lot WHERE id='lote-rollback'",
    );
    assert.equal(Number(filas[0].cantidad), 1);
    casos.push(
      "Un fallo tardío revierte toda la copia y conserva los registros originales.",
    );
    await conexion.query("DELETE FROM Product WHERE id='producto-rollback'");
    await conexion.query("DELETE FROM Lot WHERE id='lote-rollback'");
    await conexion.query(
      "UPDATE operaciones_campo SET costo_total=costo_total+1",
    );
    resultado = await ejecutarMigrador(["--verificar"]);
    assert.equal(resultado.codigo, 1);
    assert.match(resultado.salida, /valores históricos no coinciden/);
    casos.push(
      "La comparación decimal detecta alteraciones de importes históricos.",
    );
    filas = await conexion.query(
      "SELECT COUNT(*) cantidad FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=?",
      [basePrueba],
    );
    assert.equal(
      Number(filas[0].cantidad),
      39,
      "Deben permanecer activas las 16 relaciones originales y las 23 nuevas.",
    );
    casos.push("Las claves foráneas originales y nuevas permanecen activas.");
    console.log(
      JSON.stringify(
        { resultado: "correcto", casos: casos.length, comprobaciones: casos },
        null,
        2,
      ),
    );
  } finally {
    if (creada) await conexion.query(`DROP DATABASE ${baseSegura()}`);
    await conexion.end();
  }
}
prueba().catch((error: unknown) => {
  const fallo = error as {
    code?: string;
    message?: string;
    sqlMessage?: string;
  };
  console.error(
    fallo.code?.startsWith("ER_")
      ? `Prueba de migración fallida (${etapa}): ${fallo.code}; ${fallo.sqlMessage ?? ""}`
      : fallo.message,
  );
  process.exitCode = 1;
});
