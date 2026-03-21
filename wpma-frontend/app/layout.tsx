'use client';

import { Inter } from "next/font/google";
import "./globals.css";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { AppHeader } from '../components/app-header';
import { useThemeStore } from '../lib/theme-store';

const inter = Inter({ subsets: ["latin"] });

function ThemeInit() {
  const { isDark } = useThemeStore();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);
  return null;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
    },
  }));

  return (
    <html lang="de">
      <head>
        <title>WPMA.io - WordPress Management AI Platform</title>
        <meta name="description" content="KI-gestützte WordPress-Management-Plattform für proaktive Wartung, Sicherheit und Performance-Optimierung" />
        {/* Prevent flash of unstyled dark/light on load */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = JSON.parse(localStorage.getItem('wpma-theme') || '{}');
            var dark = t.state?.isDark !== false;
            if (dark) document.documentElement.classList.add('dark');
          } catch(e) { document.documentElement.classList.add('dark'); }
        ` }} />
      </head>
      <body className={inter.className}>
        <QueryClientProvider client={queryClient}>
          <ThemeInit />
          <AppHeader />
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e1e2e',
                color: '#e2e8f0',
                border: '1px solid rgba(255,255,255,0.08)',
              },
            }}
          />
        </QueryClientProvider>
      </body>
    </html>
  );
}
