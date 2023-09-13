import { IncomingBusData } from '@/lib/types';
import Card from './Card';

export interface IncomingBusesProps {
  buses: IncomingBusData[];
}

export default function IncomingBuses(props: IncomingBusesProps) {
  const { buses } = props;

  return (
    <div className="flex flex-col">
      {buses.map((bus) => (
        <Card key={bus.id} bus={bus} />
      ))}
    </div>
  );
}
