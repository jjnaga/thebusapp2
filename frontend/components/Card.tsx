import { IncomingBusData } from '@/lib/types';

export interface CardProps {
  bus: IncomingBusData;
}

export default function Card(props: CardProps) {
  const { id, routeName, routeNumber, arrivalTime, minutesToArrival } = props.bus;
  return (
    <div className="w-full flex border border-gray-50 m-1 p-3">
      <p className="mr-3">{routeNumber}</p>
      <p>{routeName}</p>
      {/* <p className="m-3 ml-auto">{arrivalTime.toLocaleString()}</p> */}
      <p className="ml-auto">{arrivalTime.fromNow()}</p>
    </div>
  );
}
