export type getVehicles = {
  status: string;
  vehicles?: Vehicle[];
};

export type Vehicle = {
  bus_number: string;
  trip: string;
  driver?: string;
  latitude?: number;
  longitude?: number;
  adherence?: number;
  last_message?: number;
  route: string;
  headsign: string;
};
