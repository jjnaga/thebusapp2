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

export type Coordinates = {
  lat: number;
  lng: number;
};

export type Bounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export interface ClientMapContextProps {
  route: string;
  setRoute: (route: string) => void;
  coordinates: Coordinates;
  setCoordinates: (coordiantes: Coordiantes) => void;
}

export interface ReactChildren {
  children: React.ReactNode;
}

export type BusStop = {
  lat: number;
  lng: number;
  stopID: number;
};
