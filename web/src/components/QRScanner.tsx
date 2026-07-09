'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

type ScanStatus = 'idle' | 'starting' | 'scanning' | 'denied' | 'error' | 'found';

interface QRScannerProps {
  active: boolean;
  onScan: (value: string) => void;
  className?: string;
}

export default function QRScanner({ active, onScan, className = '' }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [status, setStatus] = useState<ScanStatus>('idle');

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStatus((s) => (s === 'found' ? s : 'idle'));
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code?.data) {
      setStatus('found');
      onScan(code.data);
      stop();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onScan, stop]);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }

    let cancelled = false;
    setStatus('starting');

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
        setStatus('scanning');
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) {
          setStatus('denied');
        } else {
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const statusLabel: Record<ScanStatus, string> = {
    idle: 'Camera Off',
    starting: 'Starting Camera…',
    scanning: 'Point Camera at QR Code',
    denied: 'Camera Access Denied',
    error: 'Camera Unavailable',
    found: 'QR Code Found!',
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="relative w-full max-w-56 aspect-square rounded-xl overflow-hidden bg-slate-900">
        <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />
        {status === 'scanning' && (
          <div className="absolute inset-6 border-2 border-[#A0F0F0] rounded-lg pointer-events-none animate-pulse" />
        )}
      </div>
      <span className="text-[9px] uppercase tracking-widest text-slate-400 font-light">
        {statusLabel[status]}
      </span>
      {status === 'denied' && (
        <p className="text-[9px] text-rose-500 font-light text-center px-4">
          Enable camera permissions in your browser settings to scan QR codes.
        </p>
      )}
      {status === 'error' && (
        <p className="text-[9px] text-rose-500 font-light text-center px-4">
          Couldn&apos;t access a camera on this device.
        </p>
      )}
    </div>
  );
}
