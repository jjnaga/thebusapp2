import { ApolloWrapper } from '@/lib/apollo-wrapper';
import './globals.css';
import Header from '@/components/shared/Header';
import Footer from '@/components/shared/Footer';

// styles the main html tag
const styles = {
  display: 'flex',
  flexDirection: 'row',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body className="h-100">
        <Header />
        <main className="flex flex-row">
          <ApolloWrapper>{children}</ApolloWrapper>
        </main>
        <Footer />
      </body>
    </html>
  );
}
