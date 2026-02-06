'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  scanning: boolean;
}

export function BarcodeScanner({ onScan, scanning }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!scanning) {
      stopScanner();
      return;
    }

    let mounted = true;

    async function startScanner() {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

        if (!mounted || !scannerRef.current) return;

        const scanner = new Html5Qrcode('barcode-reader', {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
          verbose: false,
        });

        html5QrCodeRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.0,
          },
          (decodedText: string) => {
            onScan(decodedText);
          },
          () => {
            // ignore scan failures
          }
        );

        if (mounted) setStarted(true);
      } catch (err) {
        if (mounted) {
          setError(
            'camera access denied. please allow camera access in your browser settings.'
          );
        }
      }
    }

    startScanner();

    return () => {
      mounted = false;
      stopScanner();
    };
  }, [scanning, onScan]);

  async function stopScanner() {
    try {
      const scanner = html5QrCodeRef.current as { isScanning?: boolean; stop?: () => Promise<void> } | null;
      if (scanner && scanner.isScanning) {
        await scanner.stop?.();
      }
    } catch {}
    html5QrCodeRef.current = null;
    setStarted(false);
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <CameraOff className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg bg-black">
      <div id="barcode-reader" ref={scannerRef} className="w-full" />
      {!started && scanning && (
        <div className="flex items-center justify-center p-12">
          <Camera className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
