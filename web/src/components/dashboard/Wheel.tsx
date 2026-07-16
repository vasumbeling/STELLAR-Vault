'use client';

import React, { useRef, useState } from 'react';
import { 
  DepositIcon, 
  WithdrawIcon, 
  SendIcon, 
  CreateIcon, 
  ReceiveIcon, 
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

// Fixed slot angles ordered clockwise to accurately match the visual mockup placement geometry
const SLOTS = [
  { angle: 0,    tab: 'home', panel: 'deposit'  as Panel, label: "Deposit"  },
  { angle: -72,  tab: 'home', panel: 'withdraw' as Panel, label: "Withdraw" },
  { angle: -144, tab: 'home', panel: 'create'   as Panel, label: "Vault"     },
  { angle: -216, tab: 'home', panel: 'receive'  as Panel, label: "Receive"  },
  { angle: -288, tab: 'home', panel: 'send'     as Panel, label: "Send"     },
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

  const targetSlot = SLOTS.find(s => s.panel === panel) || SLOTS[0];
  const currentRotation = isDragging ? dragRotation : targetSlot.angle;

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
      
      {/* Outer Dotted Track Boundary */}
      <div
        ref={wheelRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative w-72 h-72 rounded-full border border-dashed border-amber-200/70 bg-transparent flex items-center justify-center transition-colors duration-200 ${
          isDragging ? 'cursor-grabbing border-cyan-200 bg-amber-50/10' : 'cursor-grab'
        }`}
        style={{ touchAction: 'none' }}
      >
        {/* Rotatable Node Wheel Structural Frame */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ transform: `rotate(${currentRotation}deg)`, transition: transitionStyle }}
        >
          {SLOTS.map((slot, i) => {
            const angleDeg = (i * 72) - 90; 
            const angleRad = (angleDeg * Math.PI) / 180;
            const radius = 50; 
            const x = 50 + radius * Math.cos(angleRad);
            const y = 50 + radius * Math.sin(angleRad);

            const isActive = panel === slot.panel;
            
            const icons: Record<string, React.ReactNode> = {
              deposit: <DepositIcon className="w-5.5 h-5.5" />,
              withdraw: <WithdrawIcon className="w-5.5 h-5.5" />,
              send: <SendIcon className="w-5.5 h-5.5" />,
              create: <CreateIcon className="w-6 h-6" />,
              receive: <ReceiveIcon className="w-5.5 h-5.5" />,
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
                {/* Multi-tone Action Button Circle with Cream & Yellow/Orange Hover Triggers */}
                <button
                  type="button"
                  onPointerDown={(e) => handleIconTap(e, slot)}
                  className={`pointer-events-auto flex items-center justify-center rounded-full w-12 h-12 shadow-sm border transition-all duration-150 outline-none active:scale-90 hover:scale-105 ${
                    isActive 
                      ? 'bg-linear-to-b from-white to-cyan-50/40 border-cyan-200 text-cyan-600 shadow-cyan-100/50' 
                      : 'bg-linear-to-b from-white to-amber-50/20 border-amber-100/70 text-[#FF9F1C] hover:border-orange-200'
                  }`}
                  style={{
                    transform: `rotate(${-currentRotation}deg)`,
                    transition: isDragging ? 'none' : 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
                  }}
                >
                  {icons[slot.panel ?? '']}
                </button>
                
                {/* Light Teal Accent Label System - Counter-rotated */}
                <div 
                  className="w-24 text-center mt-2 pointer-events-none flex justify-center"
                  style={{
                    transform: `rotate(${-currentRotation}deg)`,
                    transition: isDragging ? 'none' : 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
                  }}
                >
                  <span className={`text-[10px] tracking-wider block px-2 py-0.5 rounded-md transition-all duration-300 uppercase ${
                    isActive 
                      ? 'text-cyan-700 bg-cyan-50/80 font-bold font-mono border border-cyan-100/50' 
                      : 'text-slate-500 font-medium'
                  }`}>
                    {slot.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Central Stationary Cream Core Dial Hub */}
        <div className="w-32 h-32 rounded-full bg-white flex items-center justify-center z-20 shadow-xs shadow-amber-900/5 relative pointer-events-none">
          
          {/* Active Rotational Tracking Indicator Yellow/Orange Notch */}
          <div 
            className="absolute inset-1 rounded-full"
            style={{ 
              transform: `rotate(${-currentRotation}deg)`,
              transition: isDragging ? 'none' : 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)'
            }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#FF9F1C] rounded-full shadow-xs shadow-orange-300" />
          </div>

          {/* Inner Decorative Shield Cream & White Gradient Ring Container */}
          <div className="w-26 h-26 rounded-full border-4 border-amber-50/50 bg-linear-to-b from-white to-amber-50/30 flex items-center justify-center shadow-inner">
            {/* Core Shield Emblem Representation */}
            <div className="w-9 h-9 text-[#FF9F1C] flex items-center justify-center filter drop-shadow-[0_2px_4px_rgba(255,159,28,0.15)]">
              <ShieldEmblemIcon className="w-full h-full" />
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}