import { BusMarkerProps } from '@/utils/types';
import { Marker } from '@react-google-maps/api';

const BusMarker = ({ coordinates }: BusMarkerProps) => {
  return <Marker position={coordinates} />;
};

export default BusMarker;
