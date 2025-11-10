'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/auth/login'); // oder /dashboard, wenn du willst
  }, [router]);

  return null;
}
