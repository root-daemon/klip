import type { Metadata, Viewport } from 'next';
import { Inter, Unbounded, Chivo_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const display = Unbounded({
  subsets: ['latin'],
  display: 'swap',
  weight: ['700', '800', '900'],
  variable: '--font-display',
});

const mono = Chivo_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'KLIP - a screen-aware desktop companion',
  description:
    'Hold a shortcut, speak naturally, and KLIP can carefully operate your desktop when you ask it to.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'KLIP',
    description:
      'A screen-aware desktop companion that listens, reasons, and works carefully.',
    url: 'https://github.com/root-daemon/klip',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#060606' },
    { media: '(prefers-color-scheme: dark)', color: '#060606' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable} ${mono.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
