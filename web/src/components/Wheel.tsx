'use client';

import React, { useRef, useState } from 'react';

type Tab = 'home' | 'activity' | 'profile';
type Panel = 'deposit' | 'withdraw' | 'receive' | 'send' | null;

interface WheelProps {
  activeTab: Tab;
  panel: Panel;
  setActiveTab: (tab: any) => void;
  setPanel: (panel: Panel) => void;
}

const SLOTS = [
  { angle: 0, tab: 'home', panel: 'deposit' as Panel, label: "DEPOSIT" },
  { angle: -90, tab: 'home', panel: 'withdraw' as Panel, label: "WITHDRAW" },
  { angle: -180, tab: 'home', panel: 'send' as Panel, label: "SEND" },
  { angle: 90, tab: 'home', panel: 'receive' as Panel, label: "RECEIVE" },
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

  const targetSlot = SLOTS.find(s => s.tab === activeTab && s.panel === panel) || SLOTS[0];
  const currentRotation = isDragging ? dragRotation : targetSlot.angle;
  const currentActionLabel = isDragging ? getClosestSlot(dragRotation).label : targetSlot.label;

  const activeClasses = "w-13 h-13 bg-[#9AFAFA] text-[#0F4F53] shadow-lg shadow-cyan-300/20 ring-[5px] ring-cyan-200/80 z-20";
  const inactiveClasses = "w-13 h-13 bg-[#FF5E00] text-white";

  const isDeposit = activeTab === "home" && panel === "deposit";
  const isWithdraw = activeTab === "home" && panel === "withdraw";
  const isReceive = activeTab === "home" && panel === "receive";
  const isSend = activeTab === "home" && panel === "send";

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
    if (wheelRef.current) {
      wheelRef.current.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);

    const finalSlot = getClosestSlot(dragRotation);
    setActiveTab(finalSlot.tab);
    setPanel(finalSlot.panel);
  };

  const transitionStyle = isDragging 
    ? 'none' 
    : 'transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)';

  return (
    <section className="relative flex flex-col items-center justify-center pt-4 pb-10 select-none">
      
      {/* Top Indicator Arrow & Dynamic Label (Tuned Closer to Wheel via mb-3) */}
      <div className="z-20 flex flex-col items-center gap-1 pointer-events-none mb-3">        
        {/* Label text */}
        <div className="font-black text-lg tracking-widest text-[#FF5E00] uppercase font-sans">
          {currentActionLabel}
        </div>

        {/* CSS Arrow pointing UP */}
        <div 
          className="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[9px]"
          style={{ borderBottomColor: '#FF5E00' }}
        />
      </div>

      {/* Outer Circular Track */}
      <div 
        ref={wheelRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative w-76 h-76 rounded-full border-14 border-[#F9F6F0] bg-[#FAF6F0]/30 flex items-center justify-center shadow-[inset_0_4px_12px_rgba(0,0,0,0.03),0_20px_40px_rgba(243,114,44,0.04),0_10px_20px_rgba(0,0,0,0.02)] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ touchAction: 'none' }}
      >
        
        {/* Rotatable Node Wheel Frame */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{ 
            transform: `rotate(${currentRotation}deg)`,
            transition: transitionStyle
          }}
        >
          {/* 1. DEPOSIT NODE (Top Center - 0deg) */}
          <div className="absolute top-[4%] left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <div 
              className={`flex items-center justify-center rounded-full transition-[background-color,box-shadow,transform] duration-200 ${isDeposit ? activeClasses : inactiveClasses}`}
              style={{ 
                transform: `rotate(${-currentRotation}deg)`,
                transition: isDragging ? 'none' : 'transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              <svg className="w-6 h-6 stroke-current" fill="none" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="12" y1="4" x2="12" y2="20"></line>
                <polyline points="18 14 12 20 6 14"></polyline>
              </svg>
            </div>
          </div>

          {/* 2. WITHDRAW NODE (Right Center - 90deg layout position) */}
          <div className="absolute right-[4%] top-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <div 
              className={`flex items-center justify-center rounded-full transition-[background-color,box-shadow,transform] duration-200 ${isWithdraw ? activeClasses : inactiveClasses}`}
              style={{ 
                transform: `rotate(${-currentRotation}deg)`,
                transition: isDragging ? 'none' : 'transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              <svg className="w-6 h-6 stroke-current" fill="none" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <polyline points="6 10 12 4 18 10"></polyline>
              </svg>
            </div>
          </div>

          {/* 3. SEND NODE (Bottom Center - 180deg layout position) */}
          <div className="absolute bottom-[4%] left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <div 
              className={`flex items-center justify-center rounded-full transition-[background-color,box-shadow,transform] duration-200 ${isSend ? activeClasses : inactiveClasses}`}
              style={{ 
                transform: `rotate(${-currentRotation}deg)`,
                transition: isDragging ? 'none' : 'transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              <svg className="w-5 h-5 stroke-current transform rotate-[-15deg] -translate-x-px translate-y-px" fill="none" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </div>
          </div>

          {/* 4. RECEIVE NODE (Left Center - 270deg layout position) */}
          <div className="absolute left-[4%] top-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <div 
              className={`flex items-center justify-center rounded-full transition-[background-color,box-shadow,transform] duration-200 ${isReceive ? activeClasses : inactiveClasses}`}
              style={{ 
                transform: `rotate(${-currentRotation}deg)`,
                transition: isDragging ? 'none' : 'transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              <svg className="w-5 h-5 stroke-current" fill="none" strokeWidth="2.5" viewBox="0 0 24 24">
                <rect x="3" y="3" width="6" height="6" rx="0.5"></rect>
                <rect x="15" y="3" width="6" height="6" rx="0.5"></rect>
                <rect x="15" y="15" width="6" height="6" rx="0.5"></rect>
                <rect x="3" y="15" width="6" height="6" rx="0.5"></rect>
                <path d="M9 9h2v2H9V9zM13 13h2v2h-2v-2z"></path>
              </svg>
            </div>
          </div>

        </div>

        {/* Central Stationary Core Hub */}
        <div className="w-34 h-34 rounded-full bg-[#FFFBF7] flex items-center justify-center z-20 shadow-md border-2 border-[#F3EFE9] relative pointer-events-none overflow-hidden">
          <div className="absolute inset-2 border border-dashed border-orange-500/25 rounded-full"></div>
          
          {/* Cryptographic vault lock */}
          <div className="w-16 h-16 relative z-30 text-[#FF5E00] flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="w-full h-full"
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.1" />
              <line x1="12" y1="2" x2="12" y2="4" />
              <line x1="12" y1="20" x2="12" y2="22" />
              <line x1="2" y1="12" x2="4" y2="12" />
              <line x1="20" y1="12" x2="22" y2="12" />
              <circle cx="12" cy="12" r="1.2" fill="currentColor" />
            </svg>
          </div>
        </div>
      </div>

      {/* Helper text */}
      <p className="mt-5 text-slate-400 text-[10px] font-black tracking-wider uppercase pointer-events-none">
        TURN THE VAULT
      </p>

    </section>
  );
}