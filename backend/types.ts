export type Bus = {
  id: Number;
  name: String;
  last_updated: Date;
  bus_needs_update: Boolean;
};

export type BusUpdateStatus = {
  id: Number;
  updated: Boolean;
};

export type LastUpdate = {
  gtfs_last_update: String;
};

export type TableName = {
  table_name: String;
};
