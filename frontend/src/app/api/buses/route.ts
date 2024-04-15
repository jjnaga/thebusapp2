import { MultipleBusInfo } from '@/utils/types';
import { NextResponse } from 'next/server';
import xml2js from 'xml2js';

export async function GET() {
  let errorMessage: undefined | string;
  const sortedByRouteBusData = {};

  // Attempt to get data.
  try {
    const apiResponse = await fetch(
      `http://api.thebus.org/vehicle/?key=6A9D054D-9D15-458F-95E2-38A2DC10FB85`
    );
    let xml = await apiResponse.text();

    // Bus API has ampersand's in their XML, which isn't supported in XML...
    xml = xml.replace(/&/g, '&amp;');

    // Convert XML to JSON and clean data.
    xml2js.parseString(xml, (err, result) => {
      let multipleBusData: MultipleBusInfo | undefined;
      if (err) {
        throw new Error(String(err));
      }
      // Values come in as an array. Each array only have one element, the data in question. Extract data from array.
      multipleBusData = result.vehicles.vehicle.reduce((acc, bus) => {
        const newBusObject = bus;

        if (newBusObject.trip[0] === 'null_trip') {
          return acc;
        }
        console.log(newBusObject.trip);

        for (const key in newBusObject) {
          newBusObject[key] = newBusObject[key][0];
        }

        newBusObject.number = parseFloat(newBusObject.number);
        newBusObject.trip = parseFloat(newBusObject.trip);
        newBusObject.driver = parseFloat(newBusObject.driver);
        newBusObject.latitude = parseFloat(newBusObject.latitude);
        newBusObject.longitude = parseFloat(newBusObject.longitude);
        newBusObject.adherence = parseFloat(newBusObject.adherence);

        acc.push(newBusObject);
        return acc;
      }, []);

      // Sort buses by route.
      multipleBusData?.forEach((bus) => {
        if (!sortedByRouteBusData[bus.route_short_name]) {
          sortedByRouteBusData[bus.route_short_name] = [];
        }
        sortedByRouteBusData[bus.route_short_name].push(bus);
      });
    });
  } catch (error) {
    console.error('Error in fetch: ', String(error));
    errorMessage = String(error);
  }

  // Create Response
  let response;
  if (typeof errorMessage === 'undefined') {
    response = new NextResponse(
      JSON.stringify({
        status: 'success',
        data: sortedByRouteBusData
      })
    );
  } else {
    response = new NextResponse(
      JSON.stringify({
        status: 'fail',
        error: errorMessage
      }),
      {
        status: 400
      }
    );
  }
  response.headers.set('Content-Type', 'application/json'); // Set the header to application/json
  return response;
}
