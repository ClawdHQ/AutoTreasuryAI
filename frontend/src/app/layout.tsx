import type { Metadata } from 'next';
import './globals.css';
import { Web3Provider } from '@/providers/Web3Provider';

export const metadata: Metadata = {
  title: 'AutoTreasury AI',
  description: 'AI-powered treasury management for DAOs on BNB Chain',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
