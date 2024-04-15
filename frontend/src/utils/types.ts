export type Coordinates = {
  lat: number;
  lng: number;
};

export type BusMarkerProps = {
  coordinates: Coordinates;
};

export type SingleBusInfo = {
  number: number:
  trip: number;
  driver: number;
  latitude: number;
  longitude: number;
  adherence: number;
  last_message: string;
  route_short_name: string;
  headsign: string;
};

export type MultipleBusInfo = SingleBusInfo[];
