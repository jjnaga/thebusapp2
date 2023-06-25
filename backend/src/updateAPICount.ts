import { getClient, poolDebug, query } from './db.js';

let client: PoolClient;

try {
  client = await getClient();
} catch (err) {
  poolDebug();
  throw new Error('Getting Client: updateAPICount');
}

const updateAPICount = async () => {
  client.query(
    `insert into api.api_hits_count 
      values (date(timezone('HST', now())), 1)
      on conflict("date") DO
      update 
      set hits = api.api_hits_count.hits + 1`,
    (err, res) => {
      client.release();
      if (err) {
        console.error(`[UpdateAPICount] Error when querying cilent: ` + err);
      }
    }
  );
};

export default {};
