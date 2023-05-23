import Header from '@/components/shared/Header';
import './globals.css';
import { Inter } from 'next/font/google';
import config from '@/lib/config';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: config.siteName,
  description: config.siteDescription,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
