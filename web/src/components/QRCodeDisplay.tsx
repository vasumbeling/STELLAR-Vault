'use client';

import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

export default function QRCodeDisplay({ value, size = 176, className = '' }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    let cancelled = false;

    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#1A1A1A', light: '#FFFFFF' },
    })
      .then(() => {
        if (!cancelled) setError('');
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to render QR code');
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!value) return null;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="rounded-xl border border-slate-100 bg-white p-2"
      />
      {error && <p className="mt-1 text-[9px] text-rose-500 font-light">{error}</p>}
    </div>
  );
}
