import Link from 'next/link';
import config from '@/lib/config';

export default function Footer() {
  return (
    <header className="text-center sm:text-left">
      <h1>
        <Link href="/">{config.siteName}</Link>
      </h1>
    </header>
  );
}
