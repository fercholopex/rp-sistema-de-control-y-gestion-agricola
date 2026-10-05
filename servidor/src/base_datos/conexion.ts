import mariadb, { type Pool, type PoolConnection } from "mariadb";
import { fechaParaSQL } from "../utilidades/fechas";

export type Fila = Record<string, unknown>;
export type Conexion = PoolConnection;
let grupo: Pool | undefined;

export function obtenerGrupo() {
  if (!grupo) {
    const necesarias = [
      "DB_HOST",
      "DB_PORT",
      "DB_NAME",
      "DB_USER",
      "DB_PASSWORD",
    ];
    if (
      necesarias.some((nombre) => process.env[nombre] === undefined) ||
      necesarias
        .filter((nombre) => nombre !== "DB_PASSWORD")
        .some((nombre) => !process.env[nombre]?.trim())
    ) {
      throw new Error("La configuración de la base de datos está incompleta.");
    }
    const puerto = Number(process.env.DB_PORT);
    if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535)
      throw new Error("El puerto de la base de datos no es válido.");
    grupo = mariadb.createPool({
      host: process.env.DB_HOST,
      port: puerto,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectionLimit: 10,
      acquireTimeout: 10000,
      connectTimeout: 8000,
      decimalAsNumber: true,
      bigIntAsNumber: true,
      dateStrings: true,
      timezone: "+00:00",
      multipleStatements: false,
    });
  }
  return grupo;
}

export async function consultar(
  sql: string,
  parametros: unknown[] = [],
  conexion?: Conexion,
): Promise<Fila[]> {
  return (conexion ?? obtenerGrupo()).query(
    sql,
    parametros.map((valor) =>
      valor instanceof Date ? fechaParaSQL(valor) : valor,
    ),
  );
}

export async function transaccion<T>(
  trabajo: (conexion: Conexion) => Promise<T>,
): Promise<T> {
  const conexion = await obtenerGrupo().getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await trabajo(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

export async function cerrarBaseDatos() {
  if (grupo) await grupo.end();
  grupo = undefined;
}
