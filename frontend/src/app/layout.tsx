import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { CurrencyProvider } from '@/context/CurrencyContext';

export const metadata: Metadata = {
  title: 'VBoost — Earn on Microtasks & Social Promotion',
  description: 'Complete tasks (VK, Instagram, YouTube, Telegram, TikTok) and earn real money.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-800 antialiased selection:bg-blue-500 selection:text-white">
        <CurrencyProvider>
          <AuthProvider>{children}</AuthProvider>
        </CurrencyProvider>
      </body>
    </html>
  );
}
