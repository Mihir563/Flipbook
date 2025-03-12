import { atom, useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import AudioPlayer from "./AudioPlayer";
import { FullscreenButton } from './FullScreen';
import { AutoPlayControls } from "./AutoPlay";

export const pageAtom = atom(0);
// Add a new atom to track the display mode
export const splitImageModeAtom = atom(false);
// Add a loading state atom
export const loadingAtom = atom(true);
// Add an error state atom
export const errorAtom = atom(null);

// Create pages from the image URLs in the data
export const createPagesFromData = (data, splitImageMode = false) => {
  const imageUrls = [];

  // Extract all image URLs from the data
  if (data && typeof data.ImagesServer === "object" && data.ImagesServer !== null) {
    for (const key in data.ImagesServer) {
      if (Object.prototype.hasOwnProperty.call(data.ImagesServer, key)) {
        imageUrls.push(data.ImagesServer[key]);
      }
    }
  }

  // Need at least one image for the book
  if (imageUrls.length === 0) {
    imageUrls.push("https://via.placeholder.com/800x600?text=No+Images");
  }

  // Create pages array with front and back references
  const bookPages = [];

  if (splitImageMode) {
    // First page (cover) - should NOT be split
    bookPages.push({
      front: imageUrls[0],
      back: imageUrls.length > 1 ? imageUrls[1] : imageUrls[0],
      isSplitImage: false,
      isCover: true,
    });

    // Middle pages: Split images - start from index 1 to include all pages
    for (let i = 1; i < imageUrls.length - 1; i++) {
      bookPages.push({
        front: imageUrls[i],
        back: imageUrls[i],
        isSplitImage: true,
        frontIndex: 0,
        backIndex: 1,
      });
    }

    // Last page (back cover) - should NOT be split
    if (imageUrls.length > 1) {
      bookPages.push({
        front: imageUrls[imageUrls.length - 1],
        back: imageUrls[imageUrls.length - 1],
        isSplitImage: false,
        isCover: true,
      });
    }
  } else {
    // Original mode: different images on front and back
    // First page (cover)
    bookPages.push({
      front: imageUrls[0],
      back: imageUrls.length > 1 ? imageUrls[1] : imageUrls[0],
      isSplitImage: false,
      isCover: true,
    });

    // Middle pages
    for (let i = 2; i < imageUrls.length - 1; i += 2) {
      bookPages.push({
        front: imageUrls[i],
        back: i + 1 < imageUrls.length ? imageUrls[i + 1] : imageUrls[i],
        isSplitImage: false,
      });
    }

    // Only add back cover if we have enough images
    if (imageUrls.length > 2) {
      // Last page (back cover)
      bookPages.push({
        front: imageUrls[imageUrls.length - 1],
        back: imageUrls[0], // Use first image as back cover or could use a specific back cover image
        isSplitImage: false,
        isCover: true,
      });
    }
  }
  return bookPages;
};

// Export pages array that will be updated when data is fetched
export let pages = [];

// Initialize pages with project data
export const initializePages = (data, splitMode = true) => {
  pages = createPagesFromData(data, splitMode);
  return pages;
};

// Create a data atom to store the fetched project data
export const projectDataAtom = atom(null);

export const UI = ({ albumId }) => {
  const [page, setPage] = useAtom(pageAtom);
  const [splitImageMode, setSplitImageMode] = useAtom(splitImageModeAtom);
  const [projectData, setProjectData] = useAtom(projectDataAtom);
  const [loading, setLoading] = useAtom(loadingAtom);
  const [error, setError] = useAtom(errorAtom);
  const [title, setTitle] = useState("Photo Album");
  const [audioUrl, setAudioUrl] = useState("");
  const [screenSize, setScreenSize] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: false
  });

  // Check window size for responsive layout with more breakpoints
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setScreenSize({
        isMobile: width < 640,
        isTablet: width >= 640 && width < 1024,
        isDesktop: width >= 1024
      });
    };

    // Initial check
    checkScreenSize();

    // Add event listener with debounce
    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(checkScreenSize, 150);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Fetch data when component mounts or albumId changes
  useEffect(() => {
    const fetchData = async () => {
      if (!albumId || albumId.trim() === "") return;

      setLoading(true);
      setError(null);

      try {
        // Use the provided API endpoint with the albumId
        const response = await axios.get(
          `https://studio.codnix.com/creation/ealbum/${albumId}.json`
        );
        setProjectData(response.data);
        console.log(response.data)

        // Determine split image mode based on SingleSided property
        const shouldUseSplitMode =
          response.data.SingleSided === undefined ||
          response.data.SingleSided === false;
        setSplitImageMode(shouldUseSplitMode);

        // Initialize pages with the fetched data
        initializePages(response.data, shouldUseSplitMode);

        // Set the title from project data if available
        if (response.data && response.data.ProjectTitle) {
          setTitle(response.data.ProjectTitle);
        }
        if (response.data && response.data.MusicServer) {
          setAudioUrl(response.data.MusicServer);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching project data:", err);
        setError("Failed to load album data. Please try again later.");
        setLoading(false);
      }
    };

    fetchData();
  }, [albumId, setProjectData, setLoading, setError, setSplitImageMode]);

  // Function to navigate pages with keyboard support
  const handleKeyNavigation = (e) => {
    if (e.key === "ArrowLeft" && page > 0) {
      setPage(page - 1);
    } else if (e.key === "ArrowRight" && page < pages.length - 1) {
      setPage(page + 1);
    }
  };

  // Add keyboard navigation
  useEffect(() => {
    window.addEventListener("keydown", handleKeyNavigation);
    return () => window.removeEventListener("keydown", handleKeyNavigation);
  }, [page, pages.length]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-30">
        <div className="text-white flex flex-col items-center px-4 py-6 rounded-lg ">
          <div className="w-8 h-8 sm:w-12 sm:h-12 border-4 border-t-blue-500 border-blue-200/30 rounded-full animate-spin mb-3"></div>
          <span className="text-sm sm:text-base md:text-lg">Loading album...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-30 p-4">
        <div className="text-white text-sm sm:text-base bg-red-500/50 p-3 sm:p-4 rounded-lg max-w-xs sm:max-w-md text-center">
          <div className="text-2xl sm:text-3xl mb-2">⚠️</div>
          {error}
          <button
            className="mt-3 bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-md text-sm sm:text-base block mx-auto"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <main className="pointer-events-none select-none z-10 fixed inset-0 flex justify-between flex-col">
        
       {/* Top header with title and audio player */}
<div className={`w-full bg-gradient-to-b from-black/60 to-transparent 
                ${screenSize.isMobile ? 'px-2 py-2' : screenSize.isTablet ? 'px-4 py-3' : 'px-6 py-4'}`}>
  <div className="flex items-center justify-between gap-2">
    {/* Title */}
    <h1
      className={`bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent 
        font-bold rounded-lg max-w-full 
        ${screenSize.isMobile ? 'text-lg text-center w-full py-1' : 
          screenSize.isTablet ? 'text-xl py-1 px-2' : 'text-2xl py-2 px-3'}`}
    >
      {title}
    </h1>

    {/* Icons and Audio */}
    <div className="flex items-center gap-2">
      {audioUrl && <AudioPlayer audioUrl={audioUrl} />}
      <FullscreenButton />
      <AutoPlayControls />
    </div>
  </div>
</div>

        {/* Add page navigation controls */}
        <div className={`w-full ${screenSize.isMobile ? 'py-3' : 'py-4'} 
                        bg-gradient-to-t from-black/60 to-transparent`}>
          <div className="flex justify-center gap-3 sm:gap-4 items-center -mb-3">
            <button
              className="pointer-events-auto text-white bg-black/50 hover:bg-black/70 
                        border border-white/20 px-3 sm:px-4 py-1 sm:py-2 rounded-lg text-xs sm:text-sm 
                        transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => page > 0 && setPage(page - 1)}
              disabled={page === 0}
            >
              ← Prev
            </button>
            
            <div className="pointer-events-auto flex items-center">
              <span className="text-white bg-black/30 px-3 sm:px-4 py-1 sm:py-2 rounded-lg text-xs sm:text-sm border border-white/10">
                {page + 1} / {pages.length}
              </span>
            </div>
            
            <button
              className="pointer-events-auto text-white bg-black/50 hover:bg-black/70 
                        border border-white/20 px-3 sm:px-4 py-1 sm:py-2 rounded-lg text-xs sm:text-sm 
                        transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => page < pages.length - 1 && setPage(page + 1)}
              disabled={page === pages.length - 1}
            >
              Next →
            </button>
          </div>
        </div>
      </main>
    </>
  );
};
