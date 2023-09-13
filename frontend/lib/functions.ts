import moment from 'moment';
import { XMLParser } from 'fast-xml-parser';
import { IncomingBusData, RawIncomingBusData } from '@/lib/types';

export async function fetchBusStopData(busStopID: number) {
  const parser = new XMLParser();

  try {
    const url = `http://api.thebus.org/arrivals/?key=${process.env.NEXT_PUBLIC_THEBUS_API_KEY}&stop=${busStopID}`;
    const response = await fetch(url);
    const xml = await response.text();
    const json = parser.parse(xml);
    console.log(json);
    const stopData: IncomingBusData[] = json.stopTimes.arrival.map((rawArrival: RawIncomingBusData) => {
      const {
        vehicle,
        id,
        route: routeNumber,
        headsign: routeName,
        stopTime,
        date,
        estimated: minutesToArrival,
      } = rawArrival;

      const arrivalTime = moment(`${date} ${stopTime}`);

      const arrival: IncomingBusData = {
        id,
        vehicle,
        arrivalTime,
        routeNumber,
        routeName,
        minutesToArrival,
      };

      return arrival;
    });
    console.log(stopData);

    stopData.sort((a, b) => (a.arrivalTime.isBefore(b.arrivalTime) === true ? -1 : 1));
    return stopData;
  } catch (err) {
    console.error(err);
  }
}
