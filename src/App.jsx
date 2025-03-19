import { Loader } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useState, useEffect, useRef } from "react";
import { Experience } from "./components/Experience";
import { UI, createPagesFromData } from "./components/UI";
import MindARComponent from "./components/MindAR";  // Import the AR component
import axios from "axios";

function App() {
  const [albumId, setAlbumId] = useState("");
  const [inputAlbumId, setInputAlbumId] = useState("2800851DKU");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [albumData, setAlbumData] = useState(null);
  const [showInput, setShowInput] = useState(true);
  const [arMode, setARMode] = useState(false);  // New state for AR mode

  // Reference for canvas container
  const canvasContainerRef = useRef(null);

  // Responsive camera position based on screen size
  const [cameraPosition, setCameraPosition] = useState([0.5, 1.5, 4]);

  // Handle window resize for responsive camera and layout
  useEffect(() => {
    const handleResize = () => {
      // More detailed responsive camera positions for better adaptability
      if (window.innerWidth <= 360) {
        setCameraPosition([1.5, 1.5, 14]); // Extra small devices
      } else if (window.innerWidth <= 480) {
        setCameraPosition([1.5, 1.5, 12]); // Small mobile devices
      } else if (window.innerWidth <= 640) {
        setCameraPosition([0.5, 1.5, 10]); // Medium mobile devices
      } else if (window.innerWidth <= 768) {
        setCameraPosition([0.5, 1.5, 8]); // Tablets
      } else if (window.innerWidth <= 1024) {
        setCameraPosition([0.5, 1.5, 6]); // Small laptops
      } else if (window.innerWidth <= 1280) {
        setCameraPosition([0.5, 1.5, 5]); // Laptops & desktops
      } else {
        setCameraPosition([0.5, 1.5, 4]); // Large screens
      }
    };

    // Set initial position
    handleResize();

    // Add event listener with better debounce to prevent excessive recalculations
    let resizeTimer;
    const debouncedResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleResize, 150); // Slightly longer timeout for performance
    };

    window.addEventListener('resize', debouncedResize);

    // Clean up
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', debouncedResize);
    };
  }, []);

  // Fetch album data
  const fetchAlbumData = async (id) => {
    if (!id || id.trim() === '') return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`https://studio.codnix.com/creation/ealbum/${id}.json`);
      setAlbumData(response.data);
      setLoading(false);
      // Hide input after successful load
      setShowInput(false);
    } catch (err) {
      console.error("Error fetching album:", err);
      setError(`Failed to load album ${id}. Please check the album code and try again.`);
      setLoading(false);
    }
  };

  // Load album on initial render or albumId change
  useEffect(() => {
    if (albumId) {
      fetchAlbumData(albumId);
    }
  }, [albumId]);

  // Handle album code submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputAlbumId && inputAlbumId.trim() !== '') {
      setAlbumId(inputAlbumId.trim());
    }
  };

  // Show input field again when user presses Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowInput(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Toggle AR mode
   const toggleARMode = () => {
    // Stop the camera if exiting AR mode
    if (arMode) {
        // Stop all video tracks from the camera
        const videoTracks = document.querySelector('video')?.srcObject?.getTracks();
        if (videoTracks) {
            videoTracks.forEach(track => track.stop());
        }

        // Remove video element to fully release the camera
        document.querySelector('video')?.remove();
    }

    // Cleanup existing WebGL context
    if (canvasContainerRef.current) {
        const existingCanvas = canvasContainerRef.current.querySelector('canvas');
        if (existingCanvas) {
            existingCanvas.remove();
        }
    }

    // Wait for cleanup before switching modes
    requestAnimationFrame(() => {
        setARMode(prev => !prev);
    });

    console.log(`AR mode switched: ${!arMode}`);
};


  return (
    <div className="relative min-h-screen w-full h-full overflow-hidden bg-zinc-800 text-white "
      ref={canvasContainerRef}
    >

      {/* Album Code Input - responsive and improved UI */}
      {showInput && (
        <div className="fixed inset-0 z-50 bg-white/0 backdrop-blur-sm p-3 sm:p-4 md:p-6 flex justify-center items-center">
          <div className="w-full max-w-md bg-zinc-900/40 p-4 sm:p-6 rounded-xl shadow-lg">
            <h2 className="text-lg sm:text-xl font-bold mb-3 text-center">Enter Album Code</h2>
            <form onSubmit={handleSubmit} className="flex w-full flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={inputAlbumId}
                onChange={(e) => setInputAlbumId(e.target.value)}
                placeholder="Enter album code"
                className="flex-1 px-4 py-2 rounded-lg sm:rounded-r-none bg-slate-800 border border-slate-700 focus:border-blue-500 focus:outline-none transition-colors"
                autoFocus
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg sm:rounded-l-none font-medium transition-colors"
              >
                Load Album
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Loading Overlay - improved responsive design */}
      {loading && (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-black/90 z-40 p-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 mb-4 relative">
            <div className="absolute inset-0 border-4 border-t-blue-500 border-blue-200/30 rounded-full animate-spin"></div>
          </div>
          <div className="text-lg sm:text-xl font-medium text-center">Loading your album...</div>
          <div className="text-slate-400 mt-2 text-center text-sm sm:text-base max-w-xs sm:max-w-sm mx-auto">Please wait while we prepare your experience</div>
        </div>
      )}

      {/* Error Display - improved responsive design */}
      {error && !loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/90 z-40 p-4">
          <div className="bg-red-900/50 border border-red-800 rounded-lg p-4 sm:p-6 max-w-xs sm:max-w-sm md:max-w-md text-center">
            <div className="text-red-400 text-4xl sm:text-5xl mb-3 sm:mb-4">⚠️</div>
            <h2 className="text-lg sm:text-xl font-bold mb-2">Error Loading Album</h2>
            <p className="mb-4 text-sm sm:text-base">{error}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setShowInput(true)}
                className="bg-slate-700 hover:bg-slate-800 px-3 py-1 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors text-sm sm:text-base"
              >
                Change Album
              </button>
              <button
                onClick={() => fetchAlbumData(albumId)}
                className="bg-red-700 hover:bg-red-800 px-3 py-1 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors text-sm sm:text-base"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AR Mode Toggle Button */}
      {!loading && !error && albumData && (
        <button
          onClick={toggleARMode}
          className="fixed top-4 right-4 z-30 bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg font-medium transition-colors"
        >
          {arMode ? "Exit AR" : "View in AR"}
        </button>
      )}

      {/* 3D Canvas and UI */}
      {!loading && !error && albumData && !arMode && (
        <div className="relative inset-0 w-full h-full">
          <Canvas
            shadows
            camera={{
              position: cameraPosition,
              fov: 45,
            }}
            style={{ width: '100%', height: '100%' }}
          >
            <Suspense fallback={null}>
              <Experience projectData={albumData} autoPlay={false} />
            </Suspense>
          </Canvas>
          <UI albumId={albumId} />
        </div>
      )}

      {/* AR View */}
      {!loading && !error && albumData && arMode && (
        <MindARComponent projectData={albumData} targetPath="./targets.mind" isARMode={true} />
      )}
    </div>
  );
}

export default App;