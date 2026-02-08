import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'doc-store',
  description: 'Multi-user Markdown document storage service',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
