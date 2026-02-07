'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  scanning: boolean;
}

export function BarcodeScanner({ onScan, scanning }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<string>('');
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!scanning) {
      cleanup();
      return;
    }

    let mounted = true;
    let scanInterval: ReturnType<typeof setInterval> | null = null;

    async function start() {
      try {
        // ─── Step 1: Get camera stream with HD resolution ───
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false,
          });
        }

        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        // Try to enable continuous autofocus
        try {
          const videoTrack = stream.getVideoTracks()[0];
          const caps = videoTrack.getCapabilities();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const focusModes = (caps as any).focusMode as string[] | undefined;
          if (focusModes?.includes('continuous')) {
            await videoTrack.applyConstraints({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              advanced: [{ focusMode: 'continuous' } as any],
            });
          }
        } catch {
          // Autofocus not supported
        }

        // ─── Step 2: Attach stream to video element ───
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // ─── Step 3: Initialize barcode-detector (WASM polyfill) ───
        // @ts-expect-error -- barcode-detector/pure has no type declarations
        const { BarcodeDetector } = await import('barcode-detector/pure');

        const detector = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'],
        });

        if (mounted) setStarted(true);

        // ─── Step 4: Scan loop ───
        let isScanning = false;

        scanInterval = setInterval(async () => {
          if (!mounted || !videoRef.current || isScanning) return;
          const video = videoRef.current;
          if (video.readyState < video.HAVE_ENOUGH_DATA) return;

          isScanning = true;
          try {
            const barcodes = await detector.detect(video);
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              if (code && code !== lastScanRef.current) {
                lastScanRef.current = code;
                onScan(code);
              }
            }
          } catch {
            // Suppress detection errors
          } finally {
            isScanning = false;
          }
        }, 150); // ~7 scans/sec

      } catch (err) {
        console.error('[BarcodeScanner] Failed:', err);
        const msg = err instanceof Error ? err.message : String(err);

        if (mounted) {
          const lower = msg.toLowerCase();
          const isPermission = lower.includes('permission') || lower.includes('denied') || lower.includes('notallowed');
          setError(
            isPermission
              ? 'camera access denied. please allow camera access in your browser settings.'
              : `camera error: ${msg}`
          );
        }
      }
    }

    start();

    return () => {
      mounted = false;
      if (scanInterval) clearInterval(scanInterval);
      cleanup();
    };
  }, [scanning, onScan]);

  function cleanup() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    lastScanRef.current = '';
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
      <video
        ref={videoRef}
        className="w-full"
        playsInline
        muted
        autoPlay
        style={{ objectFit: 'cover' }}
      />
      {/* Scan region overlay */}
      {started && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="border-2 border-white/70 rounded-lg" style={{ width: '85%', maxWidth: 400, height: 100 }}>
            <div className="h-0.5 bg-red-500/80 animate-pulse mt-12" />
          </div>
        </div>
      )}
      {!started && scanning && !error && (
        <div className="flex items-center justify-center p-12">
          <Camera className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
