import { atom, useAtom } from "jotai";
import { useEffect, useState } from "react";
import { pageAtom, pages } from "./UI"; // Import both pageAtom and pages from UI

// Define autoplay atoms if not already defined
export const autoPlayAtom = atom(false);
export const autoPlaySpeedAtom = atom(5000);

export const AutoPlayControls = () => {
  const [isAutoPlaying, setIsAutoPlaying] = useAtom(autoPlayAtom);
  const [autoPlaySpeed, setAutoPlaySpeed] = useAtom(autoPlaySpeedAtom);
  const [page, setPage] = useAtom(pageAtom);
  const [expanded, setExpanded] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [screenSize, setScreenSize] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: false
  });

  // Check window size for responsive layout
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setScreenSize({
        isMobile: width < 640,
        isTablet: width >= 640 && width < 1024,
        isDesktop: width >= 1024
      });
    };

    checkScreenSize();
    
    const handleResize = () => {
      checkScreenSize();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle controls visibility with CSS transition timing
  useEffect(() => {
    if (expanded) {
      setControlsVisible(true);
    } else {
      const timer = setTimeout(() => {
        setControlsVisible(false);
      }, 300); // Match this with CSS transition duration
      return () => clearTimeout(timer);
    }
  }, [expanded]);

  // Handle autoplay functionality - fixed to use the imported pages variable
  useEffect(() => {
    let autoPlayInterval;
    
    if (isAutoPlaying && pages && pages.length > 0) {
      autoPlayInterval = setInterval(() => {
        setPage(prevPage => {
          // If at the last page, loop back to first page
          if (prevPage >= pages.length - 1) {
            return 0; // Loop back to first page
          }
          return prevPage + 1;
        });
      }, autoPlaySpeed);
    }
    
    return () => {
      if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
      }
    };
  }, [isAutoPlaying, autoPlaySpeed, setPage, pages?.length]);

  const toggleAutoPlay = () => {
    setIsAutoPlaying(!isAutoPlaying);
    setExpanded(true);
  };

  // Function to handle speed preset selection - fixed to properly update the UI
  const selectSpeed = (speed) => {
    setAutoPlaySpeed(speed);
  };

  const iconSize = screenSize.isMobile ? 18 : 20;

  return (
    <div className="relative z-30 pointer-events-auto">
      {/* Panel Container */}
      {controlsVisible && (
        <div 
          className={`absolute top-full right-0 mt-2 ${screenSize.isMobile ? 'w-64' : 'w-72'} 
                     transition-all duration-300 ${expanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}
        >
          <div className="bg-black/70 backdrop-blur-md border border-white/20 rounded-xl shadow-lg overflow-hidden">
            {/* Control header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-white/10 bg-gradient-to-r from-purple-900/40 to-indigo-900/40">
              <span className="text-white text-sm font-medium">Auto Play</span>
              <div className="flex gap-2">
                <button 
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-full transition-colors"
                  onClick={() => setExpanded(false)}
                >
                  {isAutoPlaying ? "Hide" : "Close"}
                </button>
                <button 
                  className={`text-xs ${isAutoPlaying ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"} text-white px-3 py-1 rounded-full transition-colors`}
                  onClick={toggleAutoPlay}
                >
                  {isAutoPlaying ? "Stop" : "Start"}
                </button>
              </div>
            </div>
            
            {/* Controls content */}
            <div className="p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-white/80">Speed</span>
                <span 
                  className="text-xs font-medium text-white bg-white/10 rounded-full px-3 py-1 min-w-16 text-center transition-transform duration-200"
                >
                  {(autoPlaySpeed / 1000).toFixed(1)}s
                </span>
              </div>
              
              <input
                type="range"
                min="1000"
                max="10000"
                step="500"
                value={autoPlaySpeed}
                onChange={(e) => setAutoPlaySpeed(parseInt(e.target.value))}
                className="w-full h-2 mt-1 mb-3 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-indigo-600/50 to-purple-600/50 accent-purple-500"
              />
              
              {/* Speed presets - fixed the selection highlighting */}
              <div className="flex justify-between mt-3 gap-1">
                <button 
                  onClick={() => selectSpeed(2000)}
                  className={`text-xs px-3 py-1 rounded-full transition-all duration-300 flex-1 ${
                    autoPlaySpeed === 2000 
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  Fast
                </button>
                <button 
                  onClick={() => selectSpeed(5000)}
                  className={`text-xs px-3 py-1 rounded-full transition-all duration-300 flex-1 ${
                    autoPlaySpeed === 5000 
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  Medium
                </button>
                <button 
                  onClick={() => selectSpeed(8000)}
                  className={`text-xs px-3 py-1 rounded-full transition-all duration-300 flex-1 ${
                    autoPlaySpeed === 8000 
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  Slow
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating action button for autoplay */}
      <button
        onClick={toggleAutoPlay}
        className={`flex items-center justify-center gap-2 rounded-full px-4 py-2 shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 ${
          isAutoPlaying 
            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white' 
            : 'bg-black/50 backdrop-blur-sm border border-white/20 text-white hover:bg-black/70'
        }`}
      >
        {isAutoPlaying ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
            <span className={`font-medium ${screenSize.isMobile ? 'text-xs' : 'text-sm'}`}>
              Playing
            </span>
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <span className={`font-medium ${screenSize.isMobile ? 'text-xs' : 'text-sm'}`}>
              Auto Play
            </span>
          </>
        )}
      </button>
    </div>
  );
};