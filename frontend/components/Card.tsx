import { IncomingBusData } from '@/lib/types';
import { useMapContext } from './DataProvider';
import { useEffect } from 'react';

export interface CardProps {
  bus: IncomingBusData;
}

export default function Card(props: CardProps) {
  const { id, routeName, routeNumber, arrivalTime } = props.bus;
  const { map } = useMapContext();
  const { selectedBus, setSelectedBus } = useMapContext();

  return (
    <>
      <button className="w-full flex border border-gray-50 m-1 p-3" onClick={() => setSelectedBus(props.bus)}>
        {/* <button className="w-full flex border border-gray-50 m-1 p-3" onClick={(e) => wtf(e)}> */}
        <p className="mr-3">{routeNumber}</p>
        <p>{routeName}</p>
        {/* <p className="m-3 ml-auto">{arrivalTime.toLocaleString()}</p> */}
        <p>{arrivalTime.format('hh:mm A')}</p>
        <p className="ml-auto">{arrivalTime.fromNow(true)}</p>
      </button>
    </>
  );
}
