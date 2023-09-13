'use client';
import { GoogleMap, MarkerF, RectangleF } from '@react-google-maps/api';
import { Bounds, BusStop, Vehicle } from '@/lib/types';
import { useEffect, useState } from 'react';
import { useMapContext } from './MapProvider';
import { useSuspenseQuery } from '@apollo/experimental-nextjs-app-support/ssr';
import { gql, useLazyQuery } from '@apollo/client';
export const dynamic = 'force-dynamic';

const query = gql`
  query get_nearby_stops_query($north: numeric!, $south: numeric!, $east: numeric!, $west: numeric!) {
    gtfs_stops(where: { stop_lat: { _gt: $south, _lt: $north }, stop_lon: { _gt: $west, _lt: $east } }) {
      lat: stop_lat
      lng: stop_lon
      stopID: stop_id
    }
  }
`;

// Google Maps
export const Map = () => {
  // TODO: this needs to spit out errors.
  const [getData, { loading, data }] = useLazyQuery(query);

  const DEFAULT_RECTANGLE_OFFSET = 0.005;
  const [selectedElement, setSelectedElement] = useState(null);
  // @ts-ignore
  const [activeMarker, setActiveMarker] = useState(null);
  const [showInfoWindow, setInfoWindowFlag] = useState(true);
  // let vehicleData = props.data.api_vehicle_info;
  const [center, setCenter] = useState({
    lat: 21.315590993778137,
    lng: -157.85889586252094,
  });

  const [bounds, setBounds] = useState<Bounds>();
  const [marker, setMarker] = useState({});
  const { coordinates, setCoordinates } = useMapContext();
  const { selectedBusStop, setSelectedBusStop } = useMapContext();

  const containerStyle = {
    width: '100%',
    height: '100%',
  };

  useEffect(() => {
    const { lat, lng } = coordinates;

    const newBounds = {
      north: lat + DEFAULT_RECTANGLE_OFFSET,
      south: lat - DEFAULT_RECTANGLE_OFFSET,
      east: lng + DEFAULT_RECTANGLE_OFFSET,
      west: lng - DEFAULT_RECTANGLE_OFFSET,
    };

    setBounds(newBounds);
  }, [coordinates]);

  useEffect(() => {
    if (bounds !== undefined) {
      const { north, south, east, west } = bounds;
      getData({ variables: { north, south, east, west } });
    }
  }, [bounds]);

  // Get Location of user
  useEffect(() => {
    navigator.geolocation.getCurrentPosition((position) => {
      setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
      setCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
    });
  }, []);

  return (
    <GoogleMap mapContainerStyle={containerStyle} id="map" center={center} zoom={15}>
      <MarkerF key="person" position={center} />
      {data &&
        data.gtfs_stops.map((busStop: BusStop) => {
          const { lat, lng, stopID } = busStop;
          const latLng: google.maps.LatLngLiteral = { lat, lng };

          return (
            <MarkerF
              key={stopID}
              position={latLng}
              onClick={() => {
                setSelectedBusStop(busStop);
              }}
            />
          );
        })}
      {bounds !== undefined && <RectangleF bounds={bounds!} />}
    </GoogleMap>
  );
};
