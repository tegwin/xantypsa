import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import Providers from '@/components/Providers';
import { getAppSession } from '@/lib/session';
import './globals.css';

export const metadata: Metadata = {
  title: 'Xanty PSA',
  description: 'Professional Services Automation by Xanty PSA',
  icons: { icon: '/favicon.ico' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  return (
    <html lang="en" className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans bg-surface-950 text-surface-200 antialiased`}>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
