'use client';

import { Inter } from "next/font/google";
import "./globals.css";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';
import { AuthProvider } from '../components/auth-provider';
import { Navbar } from '../components/navbar';
import { ThemeProvider, useTheme } from '../components/theme-provider';

const inter = Inter({ subsets: ["latin"] });

function ToasterWithTheme() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: theme === 'dark' ? '#1e1e2e' : '#ffffff',
          color: theme === 'dark' ? '#f1f5f9' : '#0f172a',
          border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
        },
      }}
    />
  );
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
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <Navbar />
              <main className="pt-14">
                {children}
              </main>
            </AuthProvider>
            <ToasterWithTheme />
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
