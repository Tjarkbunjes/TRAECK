'use client';

import { Suspense, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { lookupBarcode } from '@/lib/food-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ScanBarcode, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { FoodProduct } from '@/lib/types';
import Link from 'next/link';

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted-foreground">loading...</div>}>
      <ScanPageInner />
    </Suspense>
  );
}

function ScanPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');

  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<FoodProduct | null>(null);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);

  const handleScan = useCallback(async (barcode: string) => {
    if (loading) return;
    setScanning(false);
    setLoading(true);
    setScannedBarcode(barcode);
    if ('vibrate' in navigator) navigator.vibrate(50);

    const result = await lookupBarcode(barcode);

    if (result) {
      setProduct(result);
      toast.success(`${result.name} found.`);
    } else {
      toast.error('product not found.');
      setProduct(null);
    }
    setLoading(false);
  }, [loading]);

  function handleUseProduct() {
    if (!product) return;
    const prefill = encodeURIComponent(JSON.stringify(product));
    router.push(`/food/add?date=${date}&prefill=${prefill}`);
  }

  function handleManualEntry() {
    const data = scannedBarcode ? JSON.stringify({ barcode: scannedBarcode, name: '' }) : '';
    const prefill = data ? `&prefill=${encodeURIComponent(data)}` : '';
    router.push(`/food/add?date=${date}${prefill}`);
  }

  function handleRescan() {
    setProduct(null);
    setScannedBarcode(null);
    setScanning(true);
  }

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/food"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-xl font-bold">scan barcode</h1>
      </div>

      {scanning && <BarcodeScanner onScan={handleScan} scanning={scanning} />}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">looking up product...</p>
          <p className="text-xs text-muted-foreground font-mono">barcode: {scannedBarcode}</p>
        </div>
      )}

      {!scanning && !loading && product && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              {product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-16 h-16 object-contain rounded"
                />
              )}
              <CardTitle className="text-lg">{product.name}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(product.calories_per_100g === 0 ||
              (product.protein_per_100g === 0 && product.carbs_per_100g === 0 && product.fat_per_100g === 0)) && (
              <p className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded p-2">
                nutrition data may be incomplete — please verify
              </p>
            )}
            <p className="text-xs text-muted-foreground">nutrition per 100g:</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-xl font-bold font-mono">{Math.round(product.calories_per_100g)}</p>
                <p className="text-xs text-muted-foreground">kcal</p>
              </div>
              <div>
                <p className="text-xl font-bold font-mono text-[#004AC2]">{Math.round(product.protein_per_100g)}</p>
                <p className="text-xs text-muted-foreground">protein</p>
              </div>
              <div>
                <p className="text-xl font-bold font-mono text-[#0096FF]">{Math.round(product.carbs_per_100g)}</p>
                <p className="text-xs text-muted-foreground">carbs</p>
                <p className="text-[10px] text-muted-foreground">sugar: {Math.round(product.sugar_per_100g || 0)}g</p>
              </div>
              <div>
                <p className="text-xl font-bold font-mono text-[#2DCAEF]">{Math.round(product.fat_per_100g)}</p>
                <p className="text-xs text-muted-foreground">fat</p>
                <p className="text-[10px] text-muted-foreground">sat: {Math.round(product.saturated_fat_per_100g || 0)}g</p>
              </div>
            </div>
            {product.serving_size && (
              <p className="text-xs text-muted-foreground">serving size: {product.serving_size}</p>
            )}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleUseProduct} className="flex-1">
                use this
              </Button>
              <Button onClick={handleRescan} variant="outline" className="flex-1">
                scan again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!scanning && !loading && !product && scannedBarcode && (
        <Card>
          <CardContent className="p-4 text-center space-y-3">
            <p className="text-muted-foreground">
              no product found for barcode <span className="font-mono">{scannedBarcode}</span>.
            </p>
            <div className="flex gap-2">
              <Button onClick={handleManualEntry} className="flex-1">
                enter manually
              </Button>
              <Button onClick={handleRescan} variant="outline" className="flex-1">
                scan again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!scanning && !loading && (
        <p className="text-center text-xs text-muted-foreground">
          data from Open Food Facts
        </p>
      )}
    </div>
  );
}
