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
                <svg className="w-5.5 h-5.5" fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <g id="_11._Phone">
                    <path d="M14,6a1,1,0,0,0,0-2H8A1,1,0,0,0,8,6Z"></path>
                    <path d="M21,8.84v-4A4.8,4.8,0,0,0,16.21,0H5.79A4.8,4.8,0,0,0,1,4.79V27.21A4.8,4.8,0,0,0,5.79,32H16.21A4.8,4.8,0,0,0,21,27.21v-.05A10,10,0,0,0,21,8.84ZM16.21,30H5.79A2.79,2.79,0,0,1,3,27.21V4.79A2.79,2.79,0,0,1,5.79,2H16.21A2.79,2.79,0,0,1,19,4.79V8.2A10.2,10.2,0,0,0,17,8a9.92,9.92,0,0,0-7,2.89V10a1,1,0,0,0-2,0V26a1,1,0,0,0,2,0v-.89A9.92,9.92,0,0,0,17,28a10.19,10.19,0,0,0,1.93-.19A2.79,2.79,0,0,1,16.21,30ZM17,26a8,8,0,0,1-7-4.14V14.14A8,8,0,1,1,17,26Z"></path>
                    <path d="M17,15h2a1,1,0,0,0,0-2H18a1,1,0,0,0-2,0v.18A3,3,0,0,0,17,19a1,1,0,0,1,0,2H15a1,1,0,0,0,0,2h1a1,1,0,0,0,2,0v-.18A3,3,0,0,0,17,17a1,1,0,0,1,0-2Z"></path>
                    <path d="M30,5H27.41l.3-.29a1,1,0,1,0-1.42-1.42l-2,2a1,1,0,0,0,0,1.42l2,2a1,1,0,0,0,1.42,0,1,1,0,0,0,0-1.42L27.41,7H30a1,1,0,0,0,0-2Z"></path>
                  </g>
                </svg>
              ),
withdraw: (
                <svg className="w-5.5 h-5.5" fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <g id="_17._Withdraw">
                    <path d="M31,0H1A1,1,0,0,0,0,1V13a1,1,0,0,0,1,1H6V31a1,1,0,0,0,1,1H25a1,1,0,0,0,1-1V14h5a1,1,0,0,0,1-1V1A1,1,0,0,0,31,0ZM2,2H30V4H2ZM24,30H8V10H24Zm6-18H26V10h1a1,1,0,0,0,0-2H5a1,1,0,0,0,0,2H6v2H2V6H30Z"></path>
                    <path d="M29,23a1,1,0,0,0-1,1v4a1,1,0,0,0,2,0V24A1,1,0,0,0,29,23Z"></path>
                    <path d="M3,16a1,1,0,0,0-1,1v4a1,1,0,0,0,2,0V17A1,1,0,0,0,3,16Z"></path>
                    <path d="M21,16h-.18A3,3,0,0,0,15,17a1,1,0,0,1-2,0V15a1,1,0,0,0-2,0v1a1,1,0,0,0,0,2h.18A3,3,0,0,0,17,17a1,1,0,0,1,2,0v2a1,1,0,0,0,2,0V18a1,1,0,0,0,0-2Z"></path>
                    <path d="M16,23a1,1,0,0,0-1,1v2a1,1,0,0,0,2,0V24A1,1,0,0,0,16,23Z"></path>
                  </g>
                </svg>
              ),
              send: (
                <svg className="w-5.5 h-5.5" fill="currentColor" viewBox="0 0 158 134" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#clip0_send)">
                    <path d="M6.72129 53.8326C5.22886 54.369 3.79008 55.0461 2.42414 55.8549C1.99492 56.0692 1.62306 56.3841 1.33985 56.7732C1.05664 57.1622 0.870351 57.614 0.796627 58.0907C0.728141 58.9623 1.18429 59.8347 2.14826 60.6823C2.95005 61.3417 3.81412 61.9203 4.72808 62.4099C5.42909 62.8132 6.14303 63.1944 6.85696 63.575C7.87906 64.1201 8.93607 64.6808 9.92071 65.3035C23.2735 73.7162 35.4245 81.1753 48.7508 87.2021C48.7223 87.6822 48.6907 88.1609 48.6584 88.6377C48.5679 89.9855 48.4749 91.3782 48.4729 92.7533C48.4699 94.8297 48.4618 96.9073 48.4484 98.9863C48.4141 105.578 48.3786 112.395 48.5989 119.098C48.6784 121.515 49.5403 123.243 51.0256 123.964C52.5872 124.719 54.5946 124.279 56.6783 122.719C57.4297 122.156 58.1998 121.524 59.032 120.785C62.6824 117.545 66.3277 114.298 70.0078 111.02L73.343 108.049C73.3682 108.068 73.3927 108.087 73.4153 108.107L76.4991 110.778C80.01 113.816 83.6397 116.957 87.1829 120.08C88.1921 120.967 89.2071 121.85 90.2279 122.727C93.3395 125.417 96.5596 128.198 99.4515 131.179C100.984 132.756 102.474 133.498 104.264 133.498C105.036 133.487 105.803 133.372 106.546 133.158C109.158 132.442 110.843 130.835 112.011 127.954C116.411 117.096 120.915 106.068 125.269 95.4041C128.844 86.644 132.416 77.8832 135.985 69.1212C143.674 50.3116 150.308 31.082 155.854 11.5231C156.526 9.25442 156.998 6.93056 157.266 4.57852C157.355 4.03355 157.322 3.47531 157.169 2.945C157.015 2.41468 156.745 1.92589 156.379 1.51476C155.937 1.11363 155.412 0.817045 154.841 0.646857C154.272 0.476668 153.671 0.437215 153.083 0.531243C152.306 0.62523 151.539 0.799482 150.796 1.05151L150.696 1.08216C149.028 1.58303 147.355 2.06949 145.682 2.5567C141.796 3.6879 137.778 4.85757 133.878 6.19107C105.715 15.8287 77.1517 26.3209 48.9821 37.3766C40.8575 40.564 32.5849 43.7787 24.5844 46.8861C18.6266 49.1966 12.6722 51.5121 6.72129 53.8326ZM60.3339 83.5438C61.8845 82.2395 63.3543 81.0069 64.863 79.8484C70.7773 75.3015 76.6975 70.7617 82.6228 66.2304C94.2653 57.3147 106.305 48.0953 118.081 38.9404C121.682 36.1433 125.099 32.9988 128.404 29.9637C129.539 28.9229 130.673 27.8776 131.816 26.8465C132.728 26.0243 134.254 24.6486 133.408 21.9607C133.38 21.8729 133.335 21.7918 133.275 21.7225C133.215 21.6532 133.141 21.5973 133.059 21.5582C132.976 21.5193 132.886 21.4978 132.794 21.4951C132.703 21.4924 132.612 21.5085 132.527 21.5424C132.174 21.6862 131.833 21.8131 131.504 21.9328C130.819 22.1684 130.152 22.4534 129.508 22.7856C107.655 34.7331 88.645 50.3999 70.2617 65.552C66.1042 68.9781 62.1856 72.5122 58.0409 76.2499C56.2809 77.8377 54.5032 79.432 52.7074 81.0335L11.7046 58.6697C11.9409 58.5229 12.189 58.3963 12.4463 58.2911C19.0407 55.791 25.6326 53.2819 32.2218 50.7636C48.3566 44.61 65.0432 38.2463 81.5231 32.1929C96.1997 26.8017 111.219 21.5788 125.743 16.5278C130.572 14.8487 135.401 13.1663 140.228 11.4807C142.099 10.8263 143.986 10.3144 145.986 9.77318C146.515 9.63008 147.047 9.48508 147.581 9.33807C139.534 35.016 129.269 60.2022 119.336 84.5728C114.116 97.3783 108.723 110.61 103.68 123.835C89.9733 112.724 76.6781 100.978 63.8163 89.6134C62.0792 88.077 60.3384 86.5399 58.5939 85.0022C59.187 84.5045 59.7653 84.0193 60.3319 83.5438H60.3339ZM67.952 103.131L56.1931 113.163L55.2608 91.3281L67.952 103.131Z" />
                  </g>
                  <defs>
                    <clipPath id="clip0_send">
                      <rect width="157" height="134" fill="white" transform="translate(0.777344)" />
                    </clipPath>
                  </defs>
                </svg>
              ),
              create: (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 442 442" xmlns="http://www.w3.org/2000/svg">
                  <path d="M432,0H10C4.477,0,0,4.478,0,10v422c0,5.522,4.477,10,10,10h422c5.523,0,10-4.478,10-10V10C442,4.478,437.523,0,432,0z M422,422H20V20h402V422z"></path>
                  <path d="M273.901,148.188c-0.202-0.147-0.411-0.275-0.62-0.404C258.534,137.224,240.481,131,221,131s-37.534,6.224-52.281,16.784 c-0.209,0.129-0.418,0.258-0.62,0.404c-0.22,0.16-0.424,0.332-0.627,0.506C145.359,165.108,131,191.408,131,221 c0,49.626,40.374,90,90,90s90-40.374,90-90c0-29.592-14.359-55.892-36.472-72.306C274.325,148.521,274.121,148.348,273.901,148.188 z M221,251c-16.542,0-30-13.458-30-30s13.458-30,30-30s30,13.458,30,30S237.542,251,221,251z M253.618,159.092l-11.923,16.411 C235.384,172.62,228.38,171,221,171s-14.384,1.62-20.695,4.502l-11.923-16.411C198.129,153.935,209.226,151,221,151 S243.871,153.935,253.618,159.092z M172.216,170.868l11.914,16.399C175.981,196.166,171,208.011,171,221 c0,1.903,0.117,3.777,0.325,5.625l-19.293,6.269C151.366,229.026,151,225.056,151,221C151,201.359,159.143,183.593,172.216,170.868 z M158.218,251.914l19.303-6.272c7.024,12.344,19.14,21.429,33.479,24.352v20.281C187.799,286.94,168.243,272.191,158.218,251.914z M231,290.274v-20.281c14.339-2.923,26.456-12.008,33.479-24.352l19.303,6.272C273.757,272.191,254.201,286.94,231,290.274z M291,221c0,4.056-0.366,8.026-1.032,11.895l-19.293-6.269c0.208-1.848,0.325-3.723,0.325-5.625 c0-12.989-4.981-24.834-13.13-33.733l11.914-16.399C282.857,183.593,291,201.359,291,221z"></path> <path d="M50,349.997V382c0,5.522,4.477,10,10,10h322c5.523,0,10-4.478,10-10V154.111c0-5.522-4.477-10-10-10s-10,4.478-10,10V372 H70v-22.003c9.387-3.926,16-13.202,16-23.997v-50c0-10.795-6.613-20.071-16-23.997v-62.005c9.387-3.926,16-13.203,16-23.997v-50 c0-10.795-6.613-20.071-16-23.997V70h302v50c0,5.522,4.477,10,10,10s10-4.478,10-10V60c0-5.522-4.477-10-10-10H60 c-5.523,0-10,4.478-10,10v32.003C40.613,95.929,34,105.205,34,116v50c0,10.795,6.613,20.071,16,23.997v62.005 c-9.387,3.926-16,13.203-16,23.997v50C34,336.795,40.613,346.071,50,349.997z M66,276v50c0,3.309-2.691,6-6,6s-6-2.691-6-6v-50 c0-3.309,2.691-6,6-6S66,272.691,66,276z M54,166v-50c0-3.309,2.691-6,6-6s6,2.291,6,6v50c0,3.309-2.691,6-6,6S54,169.309,54,166z"></path>
                </svg>
              ),
              receive: (
                <svg className="w-5.5 h-5.5" fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <g id="_28._Saving">
                    <path d="M31.47,17.11a5,5,0,0,0-6.53.87l-3.2,3.65A4,4,0,0,0,18,19h-.93a2.54,2.54,0,0,1-1.41-.43A9.38,9.38,0,0,0,3.84,19.74L.29,23.29a1,1,0,0,0,1.42,1.42l3.55-3.55a7.35,7.35,0,0,1,9.29-.92,4.52,4.52,0,0,0,2.52.76H18a2,2,0,0,1,2,2H13a1,1,0,0,0,0,2h8a1,1,0,0,0,.74-.35h0l4.69-5.36a3,3,0,0,1,3-.92L22.4,27.8A3,3,0,0,1,20,29H11.41a4.4,4.4,0,0,0-3.12,1.29,1,1,0,0,0,0,1.42,1,1,0,0,0,1.42,0,2.37,2.37,0,0,1,1.7-.71H20a5,5,0,0,0,4-2l7.8-10.4a1.1,1.1,0,0,0,.15-.8A1.16,1.16,0,0,0,31.47,17.11Z"></path>
                    <path d="M20,16a8,8,0,1,0-8-8A8,8,0,0,0,20,16ZM20,2a6,6,0,1,1-6,6A6,6,0,0,1,20,2Z"></path>
                    <path d="M19.29,11.54a1,1,0,0,0,1.42,0l2.83-2.83a1,1,0,0,0,0-1.42L20.71,4.46a1,1,0,0,0-1.42,0L16.46,7.29a1,1,0,0,0,0,1.42ZM20,6.59,21.41,8,20,9.41,18.59,8Z"></path>
                    <path d="M5,5H6V6A1,1,0,0,0,8,6V5H9A1,1,0,0,0,9,3H8V2A1,1,0,0,0,6,2V3H5A1,1,0,0,0,5,5Z"></path>
                  </g>
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
              <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.8613 8.36335C11.3679 7.45445 11.6213 7 12 7C12.3787 7 12.6321 7.45445 13.1387 8.36335L13.2698 8.59849C13.4138 8.85677 13.4858 8.98591 13.598 9.07112C13.7103 9.15633 13.8501 9.18796 14.1296 9.25122L14.3842 9.30881C15.3681 9.53142 15.86 9.64273 15.977 10.0191C16.0941 10.3955 15.7587 10.7876 15.088 11.572L14.9144 11.7749C14.7238 11.9978 14.6285 12.1092 14.5857 12.2471C14.5428 12.385 14.5572 12.5336 14.586 12.831L14.6122 13.1018C14.7136 14.1482 14.7644 14.6715 14.4579 14.9041C14.1515 15.1367 13.6909 14.9246 12.7697 14.5005L12.5314 14.3907C12.2696 14.2702 12.1387 14.2099 12 14.2099C11.8613 14.2099 11.7304 14.2702 11.4686 14.3907L11.2303 14.5005C10.3091 14.9246 9.84847 15.1367 9.54206 14.9041C9.23565 14.6715 9.28635 14.1482 9.38776 13.1018L9.41399 12.831C9.44281 12.5336 9.45722 12.385 9.41435 12.2471C9.37147 12.1092 9.27617 11.9978 9.08557 11.7749L8.91204 11.572C8.2413 10.7876 7.90593 10.3955 8.02297 10.0191C8.14001 9.64273 8.63194 9.53142 9.61581 9.30881L9.87035 9.25122C10.1499 9.18796 10.2897 9.15633 10.402 9.07112C10.5142 8.98591 10.5862 8.85677 10.7302 8.59849L10.8613 8.36335Z" fill="currentColor"></path>
                <path d="M3 10.4167C3 7.21907 3 5.62028 3.37752 5.08241C3.75503 4.54454 5.25832 4.02996 8.26491 3.00079L8.83772 2.80472C10.405 2.26824 11.1886 2 12 2C12.8114 2 13.595 2.26824 15.1623 2.80472L15.7351 3.00079C18.7417 4.02996 20.245 4.54454 20.6225 5.08241C21 5.62028 21 7.21907 21 10.4167C21 10.8996 21 11.4234 21 11.9914C21 14.4963 20.1632 16.4284 19 17.9041M3.19284 14C4.05026 18.2984 7.57641 20.5129 9.89856 21.5273C10.62 21.8424 10.9807 22 12 22C13.0193 22 13.38 21.8424 14.1014 21.5273C14.6796 21.2747 15.3324 20.9478 16 20.5328" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path>
              </svg>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}