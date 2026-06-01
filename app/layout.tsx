import type { Metadata } from 'next';
import { Barlow_Condensed } from 'next/font/google';
import './globals.css';

const barlowCondensed = Barlow_Condensed({
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  variable: '--font-barlow-condensed',
});

export const metadata: Metadata = {
  title: 'Market Pulse',
  description: 'Live stock watchlist dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en' className={barlowCondensed.variable}>
      <body>{children}</body>
    </html>
  );
}
