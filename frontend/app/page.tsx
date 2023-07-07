import Search from '@/components/search';
import { MapWrapper } from './map-wrapper';

export default async function Home() {
  return (
    <>
      <MapWrapper />
      <Search />
    </>
  );
}
