import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PsychoHistory - Probabilistic Event Forecasting',
  description: 'Generate probability trees of future events based on historical research',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} text-gray-100`} style={{ backgroundColor: '#0a0f1e' }}>{children}</body>
    </html>
  );
}
