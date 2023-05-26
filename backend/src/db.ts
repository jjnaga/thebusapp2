import pg from 'pg';

let config = {
  host: 'localhost',
  user: 'postgres',
  password: 'postgres',
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

let pool = new pg.Pool(config);
console.log('New Pool made');

// let data = pool.query(`SELECT CURRENT_TIMESTAMP`).then((res) => res.rows);

export default pool;
