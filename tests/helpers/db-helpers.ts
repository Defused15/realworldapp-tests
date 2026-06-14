import {Pool} from 'pg';

export const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5433),
  database: process.env.DB_NAME ?? 'rwa_dev',
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  max: 5,
  idleTimeoutMillis: 10_000,
});

/** Returns one row typed as T, or null if not found. */
export async function queryOne<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const {rows} = await pool.query<T>(sql, params);
  return rows[0] ?? null;
}

/** Returns all matching rows typed as T[]. */
export async function queryMany<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const {rows} = await pool.query<T>(sql, params);
  return rows;
}

/** Returns COUNT(*) for a table + WHERE clause. Params use $1, $2 syntax. */
export async function queryCount(
  table: string,
  where: string,
  params: unknown[] = [],
): Promise<number> {
  const {rows} = await pool.query<{count: string}>(
    `SELECT COUNT(*)::text AS count FROM ${table} WHERE ${where}`,
    params,
  );
  return parseInt(rows[0].count, 10);
}

/** Returns the first column of the first row as a string. */
export async function queryScalar(
  sql: string,
  params: unknown[] = [],
): Promise<string> {
  const {rows} = await pool.query(sql, params);
  return String(Object.values(rows[0])[0]);
}
