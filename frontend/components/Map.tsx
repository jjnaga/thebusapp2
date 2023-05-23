'use client';
import { useLoadScript, GoogleMap, MarkerF, CircleF, LoadScript } from '@react-google-maps/api';
import { Vehicle } from '@/lib/types';

interface Props {
  vehicles?: Vehicle[];
}

// Google Maps
export default function Map(props: Props) {
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
        {/* Child components, such as markers, info windows, etc. */}
        <></>
      </GoogleMap>
    </LoadScript>
  );
}
