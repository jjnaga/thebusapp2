import Link from 'next/link';
import config from '@/lib/config';

export default function Header() {
  return (
    <header className="flex text-center sm:text-left text-lg">
      <h1>
        <Link href="/">{config.siteName}</Link>
      </h1>
    </header>
  );
}
