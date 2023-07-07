import { ApolloWrapper } from '@/lib/apollo-wrapper';
import './globals.css';
import Header from '@/components/shared/Header';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body className="h-100">
        <Header />
        <ApolloWrapper>{children}</ApolloWrapper>
      </body>
    </html>
  );
}
