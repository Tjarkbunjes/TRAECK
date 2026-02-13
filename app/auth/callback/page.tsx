'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) {
          router.replace('/');
        } else {
          router.replace('/auth/login?error=confirmation');
        }
      });
    } else {
      router.replace('/auth/login?error=confirmation');
    }
  }, [searchParams, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-muted-foreground">verifying...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><p className="text-muted-foreground">verifying...</p></div>}>
      <CallbackHandler />
    </Suspense>
  );
}
