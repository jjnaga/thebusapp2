import { IncomingBusData } from '@/lib/types';
import Card from './Card';
import moment from 'moment';
import { useState, useEffect } from 'react';

type ScheduleProps = {
  incomingBuses?: IncomingBusData[];
};

export const Schedule = (props: ScheduleProps) => {
  const { incomingBuses } = props;
  const lateBuses: IncomingBusData[] = [];
  const onTimeBuses: IncomingBusData[] = [];
  let [time, setTime] = useState(moment());

  useEffect(() => {
    setTimeout(() => {
      setTime(moment());
    }, 1000);
  }, [time]);

  return (
    <>
      <>
        <button id="wtf" className="w-full flex border border-gray-50 m-1 p-3">
          {time.format('h:mm:ss a')}
        </button>
      </>
      {incomingBuses && incomingBuses.map((bus) => <Card key={bus.id} bus={bus} />)}
    </>
  );
};
