import { Bus } from './types';

const getAllActiveBusses = `
  SELECT * 
  FROM sfrbusr
  WHERE (
    bus_needs_update = TRUE 
    OR
    last_updated = NULL
  )
`;

const updateBusMutation = (updatedBus: Bus) => `
  UPDATE sfrbusr
  SET 
    last_updated = ${updatedBus.last_updated},
    bus_needs_update = ${updatedBus.bus_needs_update},
  WHERE id = ${updatedBus.id}
`;

export { getAllActiveBusses, updateBusMutation };
