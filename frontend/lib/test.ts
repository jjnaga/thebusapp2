import { getBusesData } from './functions';

const main = async () => {
  const busesData = await getBusesData();
  console.log(busesData);
};

main();
