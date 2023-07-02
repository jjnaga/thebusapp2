'use client';
import { useLoadScript, GoogleMap, MarkerF, CircleF, LoadScript } from '@react-google-maps/api';
import { Vehicle } from '@/lib/types';

// Google Maps
export const Map = (props) => {
  let vehicleData = props.data.api_vehicle_info;
  console.log(vehicleData);

  const containerStyle = {
    width: '100%',
    height: '100%',
  };

  const center = {
    lat: 21.315590993778137,
    lng: -157.85889586252094,
  };
  return (
    <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
      <GoogleMap mapContainerStyle={containerStyle} id="map" center={center} zoom={12}>
        <>
          {vehicleData.map((vehicle) => {
            const { bus_number: busNumber, latitude: lat, longitude: lng } = vehicle;
            let coordinates = {
              lat,
              lng,
            };

            return <MarkerF key={busNumber} position={coordinates} />;
          })}
        </>
      </GoogleMap>
    </LoadScript>
  );
};
