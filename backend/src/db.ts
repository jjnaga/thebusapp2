import pg from 'pg';

let config = {
  host: 'localhost',
  user: 'postgres',
  password: 'postgrespassword',
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,

  max: 200,
  min: 20,
};

let pool = new pg.Pool(config);
console.log('New Pool made');

// let data = pool.query(`SELECT CURRENT_TIMESTAMP`).then((res) => res.rows);

export default pool;
