import pg from 'pg';
const { Pool, Client } = pg;

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'postgres',
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query(sql: string, params?: Array<any>, func?: string) {
  if (func) console.log(`Function called: ${func} `);

  const res = await pool.query(sql, params).catch((e) => {
    console.error(e.stack);
    throw new Error('Database Error. Ending.');
  });
  return res;
}

export function end() {
  pool.end();
}
