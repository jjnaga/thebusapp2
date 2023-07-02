import { ApolloWrapper } from '@/lib/apollo-wrapper';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body className="h-100">
        <ApolloWrapper>{children}</ApolloWrapper>
      </body>
    </html>
  );
}
