// import { Pool } from 'pg';

import { cache } from 'react';

// let conn;

// if (!conn) {
//   conn = await new Pool({
//     user: process.env.PGSQL_USER,
//     password: process.env.PGSQL_PASSWORD,
//     host: process.env.PGSQL_HOST,
//     port: process.env.PGSQL_PORT,
//     database: process.env.PGSQL_DATABASE,
//   });
// }

// try {
//   console.log('Starting');

//   let conn;

//   if (!conn) {
//     conn = await new Pool({
//       user: process.env.PGSQL_USER,
//       password: process.env.PGSQL_PASSWORD,
//       host: process.env.PGSQL_HOST,
//       port: process.env.PGSQL_PORT,
//       database: process.env.PGSQL_DATABASE,
//     });
//   }

//   // Get vehicle_info where a heartbeat was detected within the last 30 minutes.
//   const result = await conn.query(
//     `SELECT
//       current_timestamp, bus_number,trip,driver,latitude,longitude,adherence,last_message,route,headsign
//     from api.vehicle_info
//     where last_message > current_timestamp - interval '30 minutes'
//     order by last_message desc`
//   );

//   let json_status = {
//     status: 'sucess',
//     vehicles: result.rows,
//   };

//   return NextResponse.json(json_status);
// } catch (err) {
//   console.log(err);
// }
export const getBusesData = async () => {
  try {
    console.log('starting');
    console.log(process.env.GRAPHQL_URL_LOCAL);
    const response = await fetch(`${process.env.NEXT_PUBLIC_GRAPHQL_URL_LOCAL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query GetVehicleInfo {
            api_vehicle_info(limit: 50, where: {latitude: {_is_null: false}, longitude: {_is_null: false}}) {
              adherence
              driver
              latitude
              longitude
              bus_number
              route
              last_message
              updated_on
            }
          }
        `,
      }),
    });

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const bussesData = await response.json();

    if (bussesData === null) {
      throw new Error('Busses not found!');
    }

    return bussesData;
  } catch (error) {
    console.error('graphql error');
    console.error(error);
  }
};
