import React, { useState } from 'react';

interface HpConsLogoProps {
  className?: string;
  iconSize?: string;
  light?: boolean;
  showText?: boolean;
}

export default function HpConsLogo({ 
  className = "", 
  iconSize = "w-14 h-14", 
  light = true,
  showText = false // Forced to false per user request to hide the text and make logo larger
}: HpConsLogoProps) {
  const [imgSrc, setImgSrc] = useState<string>("/logo-hung-phuoc.png");
  const [imgError, setImgError] = useState(false);

  const handleImgError = () => {
    if (imgSrc === "/logo-hung-phuoc.png") {
      // Fallback to /logo.png
      setImgSrc("/logo.png");
    } else {
      setImgError(true);
    }
  };

  return (
    <div className={`flex items-center select-none ${className}`}>
      {/* 
        Sleek, transparent or white-backed container so the logo is clearly visible
      */}
      <div 
        className={`${iconSize} shrink-0 rounded-xl flex items-center justify-center overflow-hidden transition-all duration-300 bg-white shadow-xs border border-slate-200/80`}
        title="Logo HP Cons"
      >
        {!imgError ? (
          <img 
            src={imgSrc} 
            alt="Logo HP Cons" 
            onError={handleImgError}
            className="w-full h-full object-contain p-1"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="text-[10px] font-black tracking-widest text-slate-800 flex items-center justify-center">
            HP CONS
          </div>
        )}
      </div>
    </div>
  );
}
