import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mariadb, { type Connection } from "mariadb";

// Los nombres ingleses siguientes identifican exclusivamente el esquema histórico.
// No se eliminan tablas originales ni se alteran importes históricos.
type Valor = string | number | boolean | null | Date | Record<string, unknown>;
type Fila = Record<string, Valor>;
type Transformacion = {
  origen: string;
  destino: string;
  convertir: (fila: Fila) => Fila;
};
type Resumen = {
  origen: string;
  destino: string;
  registros_origen: number;
  nuevos: number;
  existentes: number;
};
const directorio = path.dirname(fileURLToPath(import.meta.url));
const argumentos = new Set(process.argv.slice(2));
const soloVerificar = argumentos.has("--verificar");
const soloEsquema = argumentos.has("--solo-esquema");
const baseDestino = variableObligatoria("DB_NAME");
const baseOrigen = process.env.DB_ORIGEN || baseDestino;
const tablasDisponibles = new Map<string, string>();
const informes: Resumen[] = [];

function variableObligatoria(nombre: string): string {
  const valor = process.env[nombre]?.trim();
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}.`);
  return valor;
}
function identificador(nombre: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(nombre))
    throw new Error(
      "El nombre de base o tabla contiene caracteres no permitidos.",
    );
  return `\`${nombre}\``;
}
function texto(valor: Valor | undefined): string {
  return valor === null || valor === undefined ? "" : String(valor);
}
function idHistorico(tabla: string, valor: Valor | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  const huella = createHash("sha256")
    .update(`siempre-alcachofa:v1:${baseOrigen}:${tabla}:${texto(valor)}`)
    .digest("hex");
  return `${huella.slice(0, 8)}-${huella.slice(8, 12)}-5${huella.slice(13, 16)}-a${huella.slice(17, 20)}-${huella.slice(20, 32)}`;
}
function fechas(fila: Fila, eliminable = true): Fila {
  return {
    fecha_creacion: fila.createdAt,
    fecha_actualizacion: fila.updatedAt,
    ...(eliminable ? { fecha_eliminacion: fila.deletedAt ?? null } : {}),
  };
}
function estado(valor: Valor): string {
  return valor === "ACTIVE" ? "activo" : "inactivo";
}
function valorEnumerado(valor: Valor, mapa: Record<string, string>): string {
  const resultado = mapa[texto(valor)];
  if (!resultado)
    throw new Error(
      "Un valor histórico no coincide con los valores permitidos; revise el esquema de origen.",
    );
  return resultado;
}
const pagos = {
  HOUR: "hora",
  DAY: "dia",
  WAGE: "jornal",
  WEEK: "semana",
  MONTH: "mes",
  OTHER: "otro",
};
const categorias = {
  PRACTICE: "practica_general",
  IRRIGATION: "riego",
  FERTILIZATION: "fertilizante",
  FUMIGATION: "fumigacion",
  HERBICIDE: "herbicida",
  OTHER: "otro",
};
const estadosOperacion = {
  DRAFT: "borrador",
  CONFIRMED: "confirmada",
  PAID: "pagada",
  PENDING_PAYMENT: "pendiente_pago",
  CANCELLED: "cancelada",
};
function json(valor: Valor | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  return typeof valor === "string" ? valor : JSON.stringify(valor);
}
function objetoJson(valor: Valor | undefined): unknown {
  if (typeof valor !== "string") return valor ?? null;
  try {
    return JSON.parse(valor);
  } catch {
    return valor;
  }
}
function superficieHa(valor: Valor, unidad: Valor): string {
  // Aritmética entera: conserva la superficie de origen y redondea solo la conversión a seis decimales.
  const partes = texto(valor).split(".");
  if (!/^\d+$/.test(partes[0]) || (partes[1] && !/^\d{1,4}$/.test(partes[1])))
    throw new Error("Superficie histórica inválida.");
  const escala =
    BigInt(partes[0]) * 10_000n + BigInt((partes[1] || "").padEnd(4, "0"));
  const factores: Record<string, bigint> = {
    HECTARE: 100_000_000_000n,
    SQUARE_METER: 10_000_000n,
    ACRE: 40_468_564_224n,
  };
  const factor = factores[texto(unidad)];
  if (!factor) throw new Error("Unidad de superficie histórica desconocida.");
  const divisor = 1_000_000_000n;
  const resultado = (escala * factor + divisor / 2n) / divisor;
  return `${resultado / 1_000_000n}.${(resultado % 1_000_000n).toString().padStart(6, "0")}`;
}
function lote(fila: Fila, division: boolean): Fila {
  return {
    nombre_lote: fila.name,
    codigo: fila.code,
    superficie_ha: superficieHa(fila.surfaceArea, fila.surfaceUnit),
    unidad_superficie: valorEnumerado(fila.surfaceUnit, {
      HECTARE: "hectarea",
      SQUARE_METER: "metro_cuadrado",
      ACRE: "acre",
    }),
    superficie_original: fila.surfaceArea,
    variedad: null,
    fecha_siembra: null,
    estado: estado(fila.status),
    ubicacion: fila.location ?? null,
    latitud: fila.latitude ?? null,
    longitud: fila.longitude ?? null,
    centroide: json(fila.centroid),
    geometria: json(fila.geoJson),
    notas: fila.notes,
    lote_padre_id: division ? idHistorico("Lot", fila.lotId) : null,
    finca_id: division ? null : idHistorico("Farm", fila.farmId),
    ...fechas(fila),
  };
}

const transformaciones: Transformacion[] = [
  {
    origen: "User",
    destino: "usuarios",
    convertir: (f) => ({
      nombre: f.name,
      email: f.email,
      password_hash: null,
      rol: valorEnumerado(f.role, {
        ADMIN: "admin",
        MANAGER: "encargado",
        VIEWER: "operador",
      }),
      estado: "inactivo",
      ...fechas(f),
    }),
  },
  {
    origen: "Farm",
    destino: "fincas",
    convertir: (f) => ({
      nombre: f.name,
      ubicacion: f.location,
      latitud: f.latitude,
      longitud: f.longitude,
      notas: f.notes,
      ...fechas(f),
    }),
  },
  { origen: "Lot", destino: "lotes", convertir: (f) => lote(f, false) },
  { origen: "Parcel", destino: "lotes", convertir: (f) => lote(f, true) },
  {
    origen: "Crop",
    destino: "cultivos",
    convertir: (f) => ({
      nombre: f.name,
      variedad: f.variety,
      estado: estado(f.status),
      descripcion: f.description,
      notas: f.notes,
      ...fechas(f),
    }),
  },
  {
    origen: "CropAssignment",
    destino: "asignaciones_cultivo",
    convertir: (f) => ({
      lote_id: idHistorico("Parcel", f.parcelId),
      cultivo_id: idHistorico("Crop", f.cropId),
      fecha_inicio: f.startsAt,
      fecha_fin: f.endsAt,
      superficie_original: f.surfaceArea,
      notas: f.notes,
      ...fechas(f, false),
    }),
  },
  {
    origen: "Employee",
    destino: "empleados",
    convertir: (f) => ({
      nombre_completo: f.fullName,
      tarifa_actual: f.currentRate,
      tipo_pago: valorEnumerado(f.paymentType, pagos),
      unidad_pago: f.paymentUnit,
      estado: estado(f.status),
      fecha_contratacion: f.hiredAt,
      notas: f.notes,
      ...fechas(f),
    }),
  },
  {
    origen: "Unit",
    destino: "unidades",
    convertir: (f) => ({
      codigo: f.code,
      nombre: f.name,
      dimension:
        (
          {
            mass: "masa",
            volume: "volumen",
            time: "tiempo",
            labor: "trabajo",
          } as Record<string, string>
        )[texto(f.dimension)] ?? f.dimension,
      es_base: f.baseUnit,
      multiplicador: f.multiplier,
      estado: estado(f.status),
      ...fechas(f),
    }),
  },
  {
    origen: "ApplicationMethod",
    destino: "metodos_aplicacion",
    convertir: (f) => ({
      nombre: f.name,
      estado: estado(f.status),
      notas: f.notes,
      ...fechas(f),
    }),
  },
  {
    origen: "WorkType",
    destino: "tipos_trabajo",
    convertir: (f) => ({
      nombre: f.name,
      estado: estado(f.status),
      notas: f.notes,
      ...fechas(f),
    }),
  },
  {
    origen: "Product",
    destino: "productos",
    convertir: (f) => ({
      codigo: f.code,
      nombre: f.name,
      categoria: valorEnumerado(f.category, {
        FERTILIZER: "fertilizante",
        FUNGICIDE: "fungicida",
        INSECTICIDE: "insecticida",
        HERBICIDE: "herbicida",
        ADJUVANT: "adyuvante",
        OTHER: "otro",
      }),
      unidad_base: f.baseUnitCode,
      precio_actual: f.currentPrice,
      proveedor: f.supplier,
      activo: f.active,
      notas: f.notes,
      ...fechas(f),
    }),
  },
  {
    origen: "ProductPriceHistory",
    destino: "historial_precios_productos",
    convertir: (f) => ({
      producto_id: idHistorico("Product", f.productId),
      precio: f.price,
      fecha_inicio: f.startsAt,
      fecha_fin: f.endsAt,
      fecha_creacion: f.createdAt,
    }),
  },
  {
    origen: "AgriculturalActivity",
    destino: "operaciones_campo",
    convertir: (f) => ({
      lote_id: f.parcelId
        ? idHistorico("Parcel", f.parcelId)
        : idHistorico("Lot", f.lotId),
      lote_original_id: idHistorico("Lot", f.lotId),
      tipo_operacion: valorEnumerado(f.category, categorias),
      encargado_id: null,
      encargado_historico: true,
      descripcion: f.notes ?? "Registro histórico migrado sin descripción",
      cantidad_dosificacion: null,
      unidad_dosificacion: null,
      fecha_operacion: f.occurredAt,
      observaciones: f.notes,
      estado: valorEnumerado(f.status, estadosOperacion),
      tipo_fertilizante: null,
      cultivo_id: idHistorico("Crop", f.cropId),
      asignacion_cultivo_id: idHistorico("CropAssignment", f.cropAssignmentId),
      tipo_trabajo_id: idHistorico("WorkType", f.workTypeId),
      metodo_id: idHistorico("ApplicationMethod", f.methodId),
      costo_mano_obra: f.laborCost,
      costo_productos: f.productCost,
      costo_aplicacion: f.applicationCost,
      costo_riego: f.irrigationCost,
      otros_costos: f.otherCost,
      costo_total: f.totalCost,
      ...fechas(f),
    }),
  },
  {
    origen: "LaborEntry",
    destino: "detalles_mano_obra",
    convertir: (f) => ({
      operacion_id: idHistorico("AgriculturalActivity", f.activityId),
      empleado_id: idHistorico("Employee", f.employeeId),
      nombre_empleado: f.employeeName,
      tipo_pago: valorEnumerado(f.paymentType, pagos),
      tarifa_capturada: f.rateSnapshot,
      cantidad: f.quantity,
      porcentaje_asignacion: f.allocationPct,
      costo_individual: f.individualCost,
      fecha_creacion: f.createdAt,
    }),
  },
  {
    origen: "ProductApplication",
    destino: "aplicaciones_productos",
    convertir: (f) => ({
      operacion_id: idHistorico("AgriculturalActivity", f.activityId),
      producto_id: idHistorico("Product", f.productId),
      nombre_producto: f.productName,
      cantidad: f.quantity,
      unidad: f.unitCode,
      precio_unitario: f.unitPrice,
      costo_producto: f.productCost,
      fecha_creacion: f.createdAt,
    }),
  },
  {
    origen: "IrrigationDetail",
    destino: "detalles_riego",
    convertir: (f) => ({
      operacion_id: idHistorico("AgriculturalActivity", f.activityId),
      inicio: f.startsAt,
      fin: f.endsAt,
      duracion_horas: f.durationHours,
      tarifa_hora: f.ratePerHour,
      costo_tarifa: f.rateCost,
      costo_agua: f.waterCost,
      costo_valvulas: f.valveCost,
      costo_operador: f.operatorCost,
      otros_costos: f.otherCost,
      ...fechas(f, false),
    }),
  },
  {
    origen: "WeatherCache",
    destino: "cache_clima",
    convertir: (f) => ({
      latitud: f.latitude,
      longitud: f.longitude,
      tipo_consulta: f.queryType,
      contenido: json(f.payload),
      expira_en: f.expiresAt,
      ...fechas(f, false),
    }),
  },
  {
    origen: "AuditLog",
    destino: "bitacora_logs",
    convertir: (f) => ({
      usuario_id: null,
      accion:
        (
          {
            CREATE: "creacion",
            UPDATE: "modificacion",
            SOFT_DELETE: "eliminacion",
          } as Record<string, string>
        )[texto(f.action)] ?? f.action,
      modulo:
        (
          {
            lots: "lotes",
            parcels: "lotes",
            crops: "cultivos",
            employees: "empleados",
            products: "productos",
          } as Record<string, string>
        )[texto(f.entityType)] ?? "historico",
      registro_id: null,
      detalles: JSON.stringify({
        origen: "migracion",
        tabla_original: f.entityType,
        registro_original: f.entityId,
        usuario_original: f.actorId,
        accion_original: f.action,
        antes: objetoJson(f.before),
        despues: objetoJson(f.after),
      }),
      ip: null,
      fecha_hora: f.createdAt,
    }),
  },
];

async function crearEsquema(conexion: Connection): Promise<void> {
  const sql = await readFile(
    path.join(directorio, "schema_migration.sql"),
    "utf8",
  );
  // El archivo sigue siendo importable directamente; la herramienta permite otra base mediante DB_NAME.
  const sentencias = sql
    .replaceAll("`alcachofa_cultivos_db`", identificador(baseDestino))
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const sentencia of sentencias) await conexion.query(sentencia);
}
async function listarTablas(conexion: Connection): Promise<void> {
  const filas = await conexion.query<Array<{ TABLE_NAME: string }>>(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
    [baseOrigen],
  );
  for (const fila of filas)
    tablasDisponibles.set(fila.TABLE_NAME.toLowerCase(), fila.TABLE_NAME);
}
async function verificarEsquema(conexion: Connection): Promise<void> {
  const sql = await readFile(
    path.join(directorio, "schema_migration.sql"),
    "utf8",
  );
  const tablas = [
    ...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\) ENGINE/g),
  ];
  const columnasActuales = await conexion.query<
    Array<{ TABLE_NAME: string; COLUMN_NAME: string }>
  >(
    "SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=?",
    [baseDestino],
  );
  const columnas = new Set(
    columnasActuales.map((fila) =>
      `${fila.TABLE_NAME}.${fila.COLUMN_NAME}`.toLowerCase(),
    ),
  );
  for (const tabla of tablas) {
    for (const coincidencia of tabla[2].matchAll(
      /^\s{2}([a-z_]+)\s+(?:VARCHAR|CHAR|ENUM|DECIMAL|DATE|DATETIME|BOOLEAN|JSON|TEXT)\b/gm,
    )) {
      if (!columnas.has(`${tabla[1]}.${coincidencia[1]}`))
        throw new Error(
          `El esquema está incompleto: falta ${tabla[1]}.${coincidencia[1]}. Solicite al instalador aplicar la estructura actualizada.`,
        );
    }
  }
  // MariaDB oculta algunas restricciones de information_schema a cuentas de solo consulta.
  // SHOW CREATE TABLE conserva la definición completa con el permiso SELECT suficiente.
  const restricciones = new Set<string>();
  const indices = new Set<string>();
  for (const tabla of tablas) {
    const definiciones = await conexion.query<Array<Record<string, string>>>(
      `SHOW CREATE TABLE ${identificador(tabla[1])}`,
    );
    const definicion =
      Object.values(definiciones[0]).find((valor) =>
        valor.startsWith("CREATE TABLE"),
      ) ?? "";
    for (const coincidencia of definicion.matchAll(
      /CONSTRAINT `?(\w+)`?\s+(?:FOREIGN KEY|CHECK)/g,
    ))
      restricciones.add(coincidencia[1].toLowerCase());
    for (const coincidencia of definicion.matchAll(
      /(?:UNIQUE )?KEY `?(\w+)`?\s*\(/g,
    ))
      indices.add(coincidencia[1].toLowerCase());
  }
  for (const coincidencia of sql.matchAll(
    /CONSTRAINT (\w+)\s+(?:FOREIGN KEY|CHECK)/g,
  )) {
    if (!restricciones.has(coincidencia[1]))
      throw new Error(
        `El esquema está incompleto: falta la restricción ${coincidencia[1]}.`,
      );
  }
  for (const coincidencia of sql.matchAll(/(?:UNIQUE )?KEY (\w+)\(/g)) {
    if (!indices.has(coincidencia[1]))
      throw new Error(
        `El esquema está incompleto: falta el índice ${coincidencia[1]}.`,
      );
  }
  const roles = await conexion.query<Array<{ cantidad: number }>>(
    "SELECT COUNT(*) cantidad FROM roles WHERE codigo IN ('admin','encargado','operador')",
  );
  if (Number(roles[0].cantidad) !== 3)
    throw new Error("La configuración de roles está incompleta.");
  console.log(
    `Estructura verificada: ${tablas.length} tablas con columnas, relaciones, restricciones, índices y roles requeridos.`,
  );
}
function fuente(tabla: string): string | null {
  const encontrada = tablasDisponibles.get(tabla.toLowerCase());
  return encontrada
    ? `${identificador(baseOrigen)}.${identificador(encontrada)}`
    : null;
}
async function resolverCodigoLote(
  conexion: Connection,
  datos: Fila,
  tabla: string,
  idOrigen: string,
): Promise<void> {
  const coincidencia = await conexion.query<Fila[]>(
    "SELECT id FROM lotes WHERE codigo = ?",
    [datos.codigo],
  );
  if (!coincidencia.length) return;
  const sufijo = createHash("sha256")
    .update(`${baseOrigen}:${tabla}:${idOrigen}`)
    .digest("hex")
    .slice(0, 16);
  datos.codigo = `${texto(datos.codigo).slice(0, 166)}-MIG-${sufijo}`;
  const duplicado = await conexion.query<Fila[]>(
    "SELECT id FROM lotes WHERE codigo = ?",
    [datos.codigo],
  );
  if (duplicado.length)
    throw new Error(
      "No se pudo asignar un código de lote único sin sobrescribir registros existentes.",
    );
}
async function migrarTabla(
  conexion: Connection,
  paso: Transformacion,
): Promise<void> {
  const tablaOrigen = fuente(paso.origen);
  if (!tablaOrigen) return;
  const filas = await conexion.query<Fila[]>(
    `SELECT * FROM ${tablaOrigen} ORDER BY id`,
  );
  const resumen: Resumen = {
    origen: paso.origen,
    destino: paso.destino,
    registros_origen: filas.length,
    nuevos: 0,
    existentes: 0,
  };
  for (const fila of filas) {
    const idOrigen = texto(fila.id);
    const huella = createHash("sha256")
      .update(JSON.stringify(fila))
      .digest("hex");
    const mapeo = await conexion.query<
      Array<{ destino_id: string; huella_origen: string }>
    >(
      "SELECT destino_id, huella_origen FROM mapa_migracion WHERE origen_base = ? AND origen_tabla = ? AND origen_id = ?",
      [baseOrigen, paso.origen, idOrigen],
    );
    if (mapeo.length) {
      if (mapeo[0].huella_origen !== huella)
        throw new Error(
          `La fuente ${paso.origen} cambió después de migrarse. No se sobrescribieron datos; requiere conciliación.`,
        );
      const presente = await conexion.query<Fila[]>(
        `SELECT id FROM ${identificador(paso.destino)} WHERE id = ?`,
        [mapeo[0].destino_id],
      );
      if (!presente.length)
        throw new Error(
          `Falta un registro migrado en ${paso.destino}. Restaure el respaldo antes de continuar.`,
        );
      resumen.existentes += 1;
      continue;
    }
    if (soloVerificar)
      throw new Error(
        `Hay registros pendientes de migración en ${paso.origen}. Ejecute la migración antes de verificar.`,
      );
    const datos: Fila = {
      id: idHistorico(paso.origen, fila.id),
      ...paso.convertir(fila),
    };
    if (paso.destino === "lotes")
      await resolverCodigoLote(conexion, datos, paso.origen, idOrigen);
    if (paso.origen === "AuditLog") {
      const actor = fila.actorId
        ? await conexion.query<Fila[]>("SELECT id FROM usuarios WHERE id = ?", [
            idHistorico("User", fila.actorId),
          ])
        : [];
      if (actor.length) datos.usuario_id = actor[0].id;
      const entidades: Record<string, string> = {
        lots: "Lot",
        parcels: "Parcel",
        crops: "Crop",
        employees: "Employee",
        products: "Product",
      };
      if (entidades[texto(fila.entityType)])
        datos.registro_id = idHistorico(
          entidades[texto(fila.entityType)],
          fila.entityId,
        );
    }
    const columnas = Object.keys(datos);
    await conexion.query(
      `INSERT INTO ${identificador(paso.destino)} (${columnas.map(identificador).join(",")}) VALUES (${columnas.map(() => "?").join(",")})`,
      columnas.map((columna) => datos[columna] ?? null),
    );
    await conexion.query(
      "INSERT INTO mapa_migracion(origen_base,origen_tabla,origen_id,destino_tabla,destino_id,huella_origen) VALUES (?,?,?,?,?,?)",
      [baseOrigen, paso.origen, idOrigen, paso.destino, datos.id, huella],
    );
    resumen.nuevos += 1;
  }
  const conteo = await conexion.query<Array<{ cantidad: number }>>(
    "SELECT COUNT(*) cantidad FROM mapa_migracion WHERE origen_base = ? AND origen_tabla = ?",
    [baseOrigen, paso.origen],
  );
  if (Number(conteo[0].cantidad) !== filas.length)
    throw new Error(
      `El número de registros no coincide en ${paso.origen}; la fuente pudo cambiar.`,
    );
  informes.push(resumen);
}
async function verificarCostos(conexion: Connection): Promise<void> {
  const componentes: Record<string, Record<string, string>> = {
    AgriculturalActivity: {
      laborCost: "costo_mano_obra",
      productCost: "costo_productos",
      applicationCost: "costo_aplicacion",
      irrigationCost: "costo_riego",
      otherCost: "otros_costos",
      totalCost: "costo_total",
    },
    LaborEntry: {
      rateSnapshot: "tarifa_capturada",
      quantity: "cantidad",
      allocationPct: "porcentaje_asignacion",
      individualCost: "costo_individual",
    },
    ProductApplication: {
      quantity: "cantidad",
      unitPrice: "precio_unitario",
      productCost: "costo_producto",
    },
    IrrigationDetail: {
      durationHours: "duracion_horas",
      ratePerHour: "tarifa_hora",
      rateCost: "costo_tarifa",
      waterCost: "costo_agua",
      valveCost: "costo_valvulas",
      operatorCost: "costo_operador",
      otherCost: "otros_costos",
    },
    ProductPriceHistory: { price: "precio" },
  };
  for (const [tabla, campos] of Object.entries(componentes)) {
    const origen = fuente(tabla);
    if (!origen) continue;
    const destino = transformaciones.find(
      (paso) => paso.origen === tabla,
    )!.destino;
    const diferencias = Object.entries(campos)
      .map(
        ([antes, despues]) =>
          `NOT (a.${identificador(antes)} <=> d.${identificador(despues)})`,
      )
      .join(" OR ");
    const filas = await conexion.query<Array<{ diferencias: number }>>(
      `SELECT COUNT(*) diferencias FROM ${origen} a JOIN mapa_migracion m ON m.origen_base = ? AND m.origen_tabla = ? AND m.origen_id = a.id JOIN ${identificador(destino)} d ON d.id = m.destino_id WHERE ${diferencias}`,
      [baseOrigen, tabla],
    );
    if (Number(filas[0].diferencias) !== 0)
      throw new Error(
        `Los valores históricos no coinciden en ${tabla}. Se canceló la importación.`,
      );
  }
}
async function principal(): Promise<void> {
  identificador(baseDestino);
  identificador(baseOrigen);
  const puerto = Number(process.env.DB_PORT);
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535)
    throw new Error("DB_PORT debe ser un puerto válido.");
  const conexion = await mariadb.createConnection({
    host: variableObligatoria("DB_HOST"),
    port: puerto,
    user: variableObligatoria("DB_USER"),
    password: process.env.DB_PASSWORD ?? "",
    dateStrings: true,
    autoJsonMap: false,
    decimalAsNumber: false,
    timezone: "Z",
    connectTimeout: 5000,
    multipleStatements: false,
  });
  let transaccion = false;
  try {
    if (soloVerificar)
      await conexion.query(`USE ${identificador(baseDestino)}`);
    else await crearEsquema(conexion);
    await verificarEsquema(conexion);
    if (soloEsquema) {
      console.log(
        "Esquema español listo. No se generaron usuarios ni registros de campo.",
      );
      return;
    }
    await listarTablas(conexion);
    const disponibles = transformaciones.filter((paso) => fuente(paso.origen));
    if (!disponibles.length) {
      console.log(
        "Esquema listo. No se encontraron tablas históricas; no hay datos que importar.",
      );
      return;
    }
    const usuariosHistoricos = fuente("User");
    if (usuariosHistoricos) {
      const originales = await conexion.query<Array<{ cantidad: number }>>(
        `SELECT COUNT(*) cantidad FROM ${usuariosHistoricos}`,
      );
      const actuales = await conexion.query<Array<{ cantidad: number }>>(
        "SELECT COUNT(*) cantidad FROM usuarios",
      );
      if (
        Number(originales[0].cantidad) > 0 &&
        Number(actuales[0].cantidad) === 0
      ) {
        throw new Error(
          "La fuente contiene usuarios históricos sin contraseña. Ejecute --solo-esquema y cree primero el administrador desde /setup con un correo distinto a los históricos; después repita la migración. No se copiaron datos.",
        );
      }
    }
    await conexion.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await conexion.beginTransaction();
    transaccion = true;
    for (const paso of transformaciones) await migrarTabla(conexion, paso);
    await verificarCostos(conexion);
    if (soloVerificar) await conexion.rollback();
    else await conexion.commit();
    transaccion = false;
    await mkdir(path.join(directorio, "informes"), { recursive: true });
    const archivo = `migracion-${new Date().toISOString().replaceAll(":", "-")}.json`;
    await writeFile(
      path.join(directorio, "informes", archivo),
      JSON.stringify(
        {
          fecha: new Date().toISOString(),
          modo: soloVerificar ? "verificacion" : "migracion",
          base_origen: baseOrigen,
          base_destino: baseDestino,
          verificaciones: {
            conteos: "correctos",
            referencias: "claves foraneas activas",
            costos_historicos: "coinciden registro por registro",
          },
          tablas: informes,
        },
        null,
        2,
      ),
    );
    console.table(informes);
    console.log(
      `Migración verificada. Informe: database/informes/${archivo}. Las tablas originales se conservaron intactas.`,
    );
  } catch (error) {
    if (transaccion) await conexion.rollback();
    throw error;
  } finally {
    await conexion.end();
  }
}

principal().catch((error: unknown) => {
  const fallo = error as { code?: string; sql?: string; message?: string };
  // Los errores del conector pueden incluir consultas con datos: no se imprimen.
  console.error(
    fallo.code
      ? `La migración no terminó (${fallo.code}). Revise acceso, compatibilidad o integridad. No se modificó la fuente.`
      : (fallo.message ?? "No se pudo completar la migración."),
  );
  process.exitCode = 1;
});
