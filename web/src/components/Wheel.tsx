'use client';

import React, { useRef, useState } from 'react';

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
              deposit: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0l6-6m-6 6l-6-6" />
                </svg>
              ),
              withdraw: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                </svg>
              ),
              send: (
                <svg className="w-5 h-5 transform -rotate-45 translate-x-0.5 -translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              ),
              create: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="4" y="4" width="16" height="16" rx="3" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="2" />
                  <path d="M12 8v2M12 14v2M8 12h2M14 12h2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ),
              receive: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              ),
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
                      : 'bg-linear-to-b from-white to-amber-50/20 border-amber-100/70 text-[#FF5E00] hover:border-orange-200'
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
              <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}