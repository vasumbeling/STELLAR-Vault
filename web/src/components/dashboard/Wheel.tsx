'use client';

import React, { useRef, useState } from 'react';
import { 
  DepositIcon, 
  WithdrawIcon, 
  CreateIcon, 
  ShieldEmblemIcon 
} from '@/app/icons';

type Tab = 'home' | 'vaults' | 'activity' | 'profile';
type Panel = 'deposit' | 'withdraw' | 'receive' | 'send' | 'create' | null;

interface WheelProps {
  activeTab: Tab;
  panel: Panel;
  setActiveTab: (tab: any) => void;
  setPanel: (panel: Panel) => void;
}

// Vault wheel only surfaces vault-native actions. Send/Receive live in the
// Wallet zone instead, so they're intentionally excluded here.
const SLOTS = [
  { angle: 0,    tab: 'home', panel: 'deposit'  as Panel, label: "Deposit",  desc: "Securely add funds to your wallet and keep it in USDC value." },
  { angle: -120, tab: 'home', panel: 'withdraw' as Panel, label: "Withdraw", desc: "Instantly pull assets back from your wallet." },
  { angle: -240, tab: 'home', panel: 'create'   as Panel, label: "Vault",    desc: "Create a new customized multi-sig secure vault (savings account)." },
];

const GLOBAL_PARTICLES = [
  { angle: -15,  radius: 46, size: 'w-1.5 h-1.5', delay: '0.1s' },
  { angle: -35,  radius: 54, size: 'w-1 h-1',     delay: '0.5s' },
  { angle: -85,  radius: 44, size: 'w-2 h-2',     delay: '0.3s' },
  { angle: -110, radius: 52, size: 'w-1 h-1',     delay: '0.7s' },
  { angle: -155, radius: 46, size: 'w-1.5 h-1.5', delay: '0s'   },
  { angle: -180, radius: 55, size: 'w-1 h-1',     delay: '0.4s' },
  { angle: -225, radius: 45, size: 'w-2 h-2',     delay: '0.2s' },
  { angle: -250, radius: 53, size: 'w-1 h-1',     delay: '0.8s' },
  { angle: -295, radius: 47, size: 'w-1.5 h-1.5', delay: '0.6s' },
  { angle: -330, radius: 54, size: 'w-1 h-1',     delay: '0.9s' },
];

function getClosestSlot(currentRotation: number) {
  let normalized = ((currentRotation % 360) + 360) % 360;
  if (normalized > 180) normalized -= 360;

  return SLOTS.reduce((closest, slot) => {
    const diffA = Math.abs(normalized - slot.angle);
    const diffB = Math.abs((normalized > 0 ? normalized - 360 : normalized + 360) - slot.angle);
    const minDiffCurrent = Math.min(diffA, diffB);

    const closestDiffA = Math.abs(normalized - closest.angle);
    const closestDiffB = Math.abs((normalized > 0 ? normalized - 360 : normalized + 360) - closest.angle);
    const minDiffClosest = Math.min(closestDiffA, closestDiffB);

    return minDiffCurrent < minDiffClosest ? slot : closest;
  }, SLOTS[0]);
}

export default function Wheel({ activeTab, panel, setActiveTab, setPanel }: WheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragRotation, setDragRotation] = useState(0);
  const [startAngle, setStartAngle] = useState(0);
  const [startRotation, setStartRotation] = useState(0);

  const targetSlot = SLOTS.find(s => s.panel === panel) || null;
  const currentRotation = isDragging ? dragRotation : (targetSlot?.angle ?? 0);

  const getAngleFromCenter = (clientX: number, clientY: number) => {
    if (!wheelRef.current) return 0;
    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radians = Math.atan2(clientY - centerY, clientX - centerX);
    return (radians * 180) / Math.PI + 90;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!wheelRef.current) return;
    wheelRef.current.setPointerCapture(e.pointerId);
    setIsDragging(true);
    const clickAngle = getAngleFromCenter(e.clientX, e.clientY);
    setStartAngle(clickAngle);
    setStartRotation(currentRotation);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const currentAngle = getAngleFromCenter(e.clientX, e.clientY);
    let angleDiff = currentAngle - startAngle;
    if (angleDiff > 180) angleDiff -= 360;
    if (angleDiff < -180) angleDiff += 360;
    setDragRotation(startRotation + angleDiff);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    if (wheelRef.current) wheelRef.current.releasePointerCapture(e.pointerId);
    setIsDragging(false);
    const finalSlot = getClosestSlot(dragRotation);
    setActiveTab(finalSlot.tab);
    setPanel(finalSlot.panel);
  };

  const handleIconTap = (e: React.PointerEvent, slot: typeof SLOTS[0]) => {
    e.stopPropagation();
    setActiveTab(slot.tab);
    setPanel(slot.panel);
  };

  const transitionStyle = isDragging
    ? 'none'
    : 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';

  return (
    <section className="relative flex flex-col items-center justify-center select-none w-full my-6">

      {/* Dynamic Background Radial Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-linear-to-br from-orange-200/20 via-cyan-100/10 to-transparent blur-3xl pointer-events-none" />

      {/* Structural Track Ring Boundary */}
      <div
        ref={wheelRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative w-72 h-72 rounded-full bg-transparent flex items-center justify-center transition-all duration-300 ${
          isDragging
            ? 'cursor-grabbing border border-cyan-300/80 bg-cyan-50/10 shadow-[0_0_0_6px_rgba(34,211,238,0.06)]'
            : 'cursor-grab border border-amber-100/70 hover:border-amber-200'
        }`}
        style={{ touchAction: 'none' }}
      >
        {/* Faint tick marks around the track for a more "dial" feel */}
        <div className="absolute inset-0 rounded-full pointer-events-none">
          {Array.from({ length: 36 }).map((_, i) => {
            const isMajor = i % 9 === 0; // aligns roughly with 5 slot positions
            return (
              <div
                key={`tick-${i}`}
                className="absolute left-1/2 top-1/2 origin-top"
                style={{
                  height: isMajor ? '7px' : '4px',
                  width: isMajor ? '2px' : '1px',
                  transform: `rotate(${i * 10}deg) translate(-50%, 0)`,
                  backgroundColor: isMajor ? 'rgba(255,159,28,0.28)' : 'rgba(148,163,184,0.25)',
                  borderRadius: '2px',
                }}
              />
            );
          })}
        </div>

        {/* Rotatable Outer Node & Particle Frame */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ transform: `rotate(${currentRotation}deg)`, transition: transitionStyle }}
        >
          {/* Scattered Orbiting Particles */}
          {GLOBAL_PARTICLES.map((p, pIndex) => {
            const pRad = ((p.angle - 90) * Math.PI) / 180;
            const px = 50 + p.radius * Math.cos(pRad);
            const py = 50 + p.radius * Math.sin(pRad);

            const relativeAngle = ((p.angle + currentRotation) % 360 + 360) % 360;
            const isNearActiveNode = panel !== null && (relativeAngle < 35 || relativeAngle > 325);

            return (
              <div
                key={`global-p-${pIndex}`}
                className={`absolute rounded-full transition-all duration-500 pointer-events-none ${p.size} ${
                  isNearActiveNode
                    ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee] scale-125 opacity-90'
                    : 'bg-orange-400/30 opacity-25 shadow-[0_0_3px_rgba(255,159,28,0.12)]'
                }`}
                style={{
                  left: `${px}%`,
                  top: `${py}%`,
                  transform: 'translate(-50%, -50%)',
                  animation: 'pulse 2.4s infinite ease-in-out',
                  animationDelay: p.delay,
                }}
              />
            );
          })}

          {/* Action Slots */}
          {SLOTS.map((slot, i) => {
            const angleDeg = (i * (360 / SLOTS.length)) - 90;
            const angleRad = (angleDeg * Math.PI) / 180;
            const radius = 50;
            const x = 50 + radius * Math.cos(angleRad);
            const y = 50 + radius * Math.sin(angleRad);

            const isActive = panel === slot.panel;

            const icons: Record<string, React.ReactNode> = {
              deposit: <DepositIcon className="w-5.5 h-5.5" />,
              withdraw: <WithdrawIcon className="w-5.5 h-5.5" />,
              create: <CreateIcon className="w-6 h-6" />,
            };

            return (
              <div
                key={slot.panel}
                className="absolute z-30 flex flex-col items-center justify-center w-22 h-22 pointer-events-none"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {/* Action Button Circle */}
                <button
                  type="button"
                  aria-label={slot.label}
                  aria-pressed={isActive}
                  onPointerDown={(e) => handleIconTap(e, slot)}
                  className={`pointer-events-auto flex items-center justify-center rounded-full w-13 h-13 border transition-all duration-200 outline-hidden active:scale-90 hover:scale-[1.07] ${
                    isActive
                      ? 'bg-linear-to-b from-white to-cyan-50/70 border-cyan-400 text-cyan-500 shadow-[0_6px_18px_-6px_rgba(34,211,238,0.55)] ring-4 ring-cyan-100/70'
                      : 'bg-linear-to-b from-white to-amber-50/40 border-orange-200/70 text-[#FF9F1C] shadow-[0_3px_10px_-4px_rgba(180,101,11,0.25)] hover:border-orange-300 hover:shadow-[0_6px_16px_-6px_rgba(180,101,11,0.35)]'
                  }`}
                  style={{
                    transform: `rotate(${-currentRotation}deg)`,
                    transition: isDragging ? 'none' : 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.25s ease, border-color 0.25s ease',
                  }}
                >
                  {icons[slot.panel ?? '']}
                </button>

                {/* Counter-Rotated Context Label */}
                <div
                  className="w-24 text-center mt-2.5 pointer-events-none flex justify-center"
                  style={{
                    transform: `rotate(${-currentRotation}deg)`,
                    transition: isDragging ? 'none' : 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
                  }}
                >
                  <span className={`text-[10px] tracking-wider block px-2.5 py-1 rounded-full transition-all duration-300 uppercase ${
                    isActive
                      ? 'text-cyan-700 bg-cyan-50 font-bold font-mono border border-cyan-200 shadow-[0_2px_6px_-2px_rgba(34,211,238,0.4)]'
                      : 'text-slate-500 font-semibold bg-white/0'
                  }`}>
                    {slot.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Central Stationary Core Dial Hub */}
        <div className="w-32 h-32 rounded-full bg-white flex items-center justify-center z-20 shadow-[inset_0_2px_10px_rgba(255,159,28,0.06),0_14px_30px_-12px_rgba(180,101,11,0.28)] relative pointer-events-none ring-1 ring-black/5">

          {/* Central Active Tracking Index Notch */}
          <div
            className="absolute inset-1 rounded-full"
            style={{
              transform: `rotate(${-currentRotation}deg)`,
              transition: isDragging ? 'none' : 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)'
            }}
          >
            {panel !== null && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-linear-to-br from-[#FF9F1C] to-orange-500 shadow-[0_0_6px_rgba(255,159,28,0.6)]" />
            )}
          </div>

          {/* Decorative Inner Shield */}
          <div className={`w-26 h-26 rounded-full border-4 flex items-center justify-center shadow-inner transition-colors duration-300 ${
            panel !== null
              ? 'border-amber-50/60 bg-linear-to-b from-white to-amber-50/40'
              : 'border-amber-50/30 bg-linear-to-b from-white to-amber-50/20'
          }`}>
            <div className="w-9 h-9 text-[#FF9F1C] flex items-center justify-center filter drop-shadow-[0_2px_5px_rgba(255,159,28,0.18)]">
              <ShieldEmblemIcon className="w-full h-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Descriptive Panel Metadata System */}
      <div className="h-20 mt-4 max-w-xs text-center px-4 flex items-start justify-center transition-all duration-300">
        <p className={`text-xs leading-relaxed transition-all duration-500 ${
          targetSlot ? 'text-slate-500 opacity-100 translate-y-0' : 'text-slate-300 opacity-0 -translate-y-1'
        }`}>
          {targetSlot ? (
            <>
              <span className="block text-[11px] font-bold tracking-wide text-slate-700 mb-1">
                {targetSlot.label}
              </span>
              {targetSlot.desc}
            </>
          ) : (
            'Drag or select an action to manage your assets.'
          )}
        </p>
      </div>

    </section>
  );
}