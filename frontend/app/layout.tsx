import { ApolloWrapper } from '@/lib/apollo-wrapper';
import './globals.css';
import Header from '@/components/shared/Header';
import Footer from '@/components/shared/Footer';
import MapProvider from '@/components/MapProvider';
// Script component
import Script from 'next/script';

// styles the main html tag
const styles = {
  display: 'flex',
  flexDirection: 'row',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;

  return (
    <html>
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css" />
        <Script src={src} />
      </head>
      <body className="h-screen flex flex-col">
        <Header />
        <MapProvider>
          <ApolloWrapper>{children}</ApolloWrapper>
        </MapProvider>
      </body>
    </html>
  );
}
