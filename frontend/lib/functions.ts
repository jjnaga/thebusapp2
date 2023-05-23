import { Pool } from 'pg';

let conn;

if (!conn) {
  conn = await new Pool({
    user: process.env.PGSQL_USER,
    password: process.env.PGSQL_PASSWORD,
    host: process.env.PGSQL_HOST,
    port: process.env.PGSQL_PORT,
    database: process.env.PGSQL_DATABASE,
  });
}

try {
  console.log('Starting');

  let conn;

  if (!conn) {
    conn = await new Pool({
      user: process.env.PGSQL_USER,
      password: process.env.PGSQL_PASSWORD,
      host: process.env.PGSQL_HOST,
      port: process.env.PGSQL_PORT,
      database: process.env.PGSQL_DATABASE,
    });
  }

  // Get vehicle_info where a heartbeat was detected within the last 30 minutes.
  const result = await conn.query(
    `SELECT
      current_timestamp, bus_number,trip,driver,latitude,longitude,adherence,last_message,route,headsign
    from api.vehicle_info
    where last_message > current_timestamp - interval '30 minutes'
    order by last_message desc`
  );

  let json_status = {
    status: 'sucess',
    vehicles: result.rows,
  };

  return NextResponse.json(json_status);
} catch (err) {
  console.log(err);
}
