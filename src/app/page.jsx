'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/rundown');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-k-page text-k-ink">
      <meta httpEquiv="refresh" content="0; url=./rundown/" />
      <p className="text-sm text-k-ink-muted">Redirecting to Rundown...</p>
    </div>
  );
}
