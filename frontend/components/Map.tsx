'use client';
import {
  useLoadScript,
  GoogleMap,
  MarkerF,
  CircleF,
  LoadScript,
  TransitLayer,
  InfoWindow,
} from '@react-google-maps/api';
import { Vehicle } from '@/lib/types';
import { useState } from 'react';

// Google Maps
export const Map = (props) => {
  console.log(props);
  const [selectedElement, setSelectedElement] = useState(null);
  // @ts-ignore
  const [activeMarker, setActiveMarker] = useState(null);
  const [showInfoWindow, setInfoWindowFlag] = useState(true);
  let vehicleData = props.data.api_vehicle_info;

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
        <TransitLayer />
        <>
          {vehicleData.map((vehicle) => {
            const { bus_number: busNumber, latitude: lat, longitude: lng } = vehicle;
            let coordinates = {
              lat,
              lng,
            };
            return (
              <MarkerF
                key={busNumber}
                position={coordinates}
                onClick={(marker) => {
                  console.log(marker);
                  // @ts-ignore
                  setSelectedElement(marker);
                  // setActiveMarker(marker);
                }}
              />
            );
          })}
          {/* <InfoWindow
            // visible={showInfoWindow}
            // @ts-ignore
            marker={activeMarker}
            // options={}
            // onCloseClick={() => {
            //   // setSelectedElement(null);
            // }}
          >
            <div>
              <h1>Test Test</h1>
            </div>
          </InfoWindow> */}
        </>
      </GoogleMap>
    </LoadScript>
  );
};
