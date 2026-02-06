'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed
      });
    }

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    const prompt = deferredPrompt as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    await prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === 'accepted') {
      setShowInstall(false);
    }
    setDeferredPrompt(null);
  }

  if (!showInstall) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 mx-auto max-w-md">
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3 shadow-lg">
        <p className="text-sm">FitTrack installieren?</p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowInstall(false)}>
            Später
          </Button>
          <Button size="sm" onClick={handleInstall}>
            <Download className="mr-1 h-3 w-3" />
            Installieren
          </Button>
        </div>
      </div>
    </div>
  );
}
