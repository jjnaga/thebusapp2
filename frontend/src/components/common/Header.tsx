import Link from 'next/link';

const Header = () => {
  return (
    <header className="bg-slate-800">
      <div className="ml-5 p-3 text-white text-2xl tracking-wide">
        <Link href="#">Bus2</Link>
      </div>
    </header>
  );
};

export default Header;
