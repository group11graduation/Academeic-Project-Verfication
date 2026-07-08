import React from "react";

export function SkyPropertyLogo({ className = "w-16 h-16" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Sky/Cloud Icon */}
      <circle cx="50" cy="35" r="20" fill="url(#skyGradient)" opacity="0.9" />
      <path
        d="M30 45 Q35 50 40 45 Q45 50 50 45 Q55 50 60 45 Q65 50 70 45"
        stroke="white"
        strokeWidth="3"
        fill="none"
        opacity="0.8"
      />
      
      {/* Building Icon */}
      <rect x="35" y="50" width="30" height="40" fill="url(#buildingGradient)" />
      <rect x="40" y="55" width="6" height="8" fill="white" opacity="0.7" />
      <rect x="54" y="55" width="6" height="8" fill="white" opacity="0.7" />
      <rect x="40" y="68" width="6" height="8" fill="white" opacity="0.7" />
      <rect x="54" y="68" width="6" height="8" fill="white" opacity="0.7" />
      
      <defs>
        <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1E40AF" />
        </linearGradient>
        <linearGradient id="buildingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1E3A4C" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>
    </svg>
  );
}
