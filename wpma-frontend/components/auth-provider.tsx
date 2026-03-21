'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../lib/auth-store';

const publicPaths = ['/auth/login', '/auth/register', '/auth/forgot-password'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loadUser, token } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  // Verify token on mount
  useEffect(() => {
    if (token) {
      loadUser();
    }
  }, []);

  // Redirect unauthenticated users away from protected pages
  useEffect(() => {
    const isPublicPath = publicPaths.some(p => pathname?.startsWith(p));

    if (!isPublicPath && !isAuthenticated && !token) {
      router.replace('/auth/login');
    }
  }, [pathname, isAuthenticated, token]);

  return <>{children}</>;
}
