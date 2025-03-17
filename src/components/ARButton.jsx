// src/components/ARButton.jsx
import React from 'react';

export function ARButton({ onClick, isARMode }) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-full ${isARMode ? 'bg-blue-600' : 'bg-slate-800'} shadow-lg transition-colors hover:bg-blue-700`}
      aria-label="Toggle AR mode"
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <path d="M12 20v-6M8 10V4M16 10V4M3 8h18M3 16h18M4 20h16a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1z"></path>
      </svg>
    </button>
  );
}