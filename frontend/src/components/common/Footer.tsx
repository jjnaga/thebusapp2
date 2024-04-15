const Footer = () => {
  const KAIDO_BOYS = ['Jeremy Nagahama', 'Eric Yang', 'Albert Babachinko'];

  return (
    <footer className="bg-slate-300 p-2">
      <span className="p-3">
        {'Kaido Boys: '}
        {KAIDO_BOYS.sort(() => 0.5 - Math.random()).join(', ')}
      </span>
    </footer>
  );
};

export default Footer;
