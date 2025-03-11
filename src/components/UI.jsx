import { atom, useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import AudioPlayer from "./AudioPlayer";

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
  if (data && data.ImagesServer) {
    for (const key in data.ImagesServer) {
      if (data.ImagesServer.hasOwnProperty(key)) {
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
  const [isMobile, setIsMobile] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");

  // Check window size for responsive layout
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    checkMobile();

    // Add event listener with debounce
    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(checkMobile, 100);
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

        // Determine split image mode based on SingleSided property
        // If SingleSided is true, we want full image mode (splitImageMode = false)
        // If SingleSided is not specified or false, we want split image mode (splitImageMode = true)
        const shouldUseSplitMode =
          response.data.SingleSided === undefined ||
          response.data.SingleSided === false;
        setSplitImageMode(shouldUseSplitMode);

        // Initialize pages with the fetched data
        // Now using the automatically determined split mode
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

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-30">
        <div className="text-white text-base sm:text-xl flex flex-col items-center">
          <div className="w-8 h-8 sm:w-12 sm:h-12 border-4 border-t-blue-500 border-blue-200/30 rounded-full animate-spin mb-3"></div>
          <span>Loading album...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-30 p-4">
        <div className="text-white text-sm sm:text-base md:text-xl bg-red-500/50 p-3 sm:p-4 rounded-lg max-w-md text-center">
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
        <div
          className={`w-full ${isMobile ? "p-2" : "p-4"} flex ${
            isMobile ? "flex-col gap-2" : "justify-between items-center"
          }`}
        >
          <h1
            className={`bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent 
    font-bold px-3 py-1 sm:px-4 sm:py-2 rounded-lg truncate max-w-full 
    ${isMobile ? "text-lg w-full text-center" : "text-xl md:text-2xl"}`}
          >
            {title}
          </h1>

          <div>{audioUrl && <AudioPlayer audioUrl={audioUrl} />}</div>
        </div>

        {/* Add page navigation controls for mobile at the bottom */}
        {isMobile && (
          <div className="w-full p-2 flex justify-center gap-4 mb-2">
            <button
              className="pointer-events-auto text-white bg-black/40 hover:bg-black/60 px-6 py-2 rounded-lg text-sm"
              onClick={() => page > 0 && setPage(page - 1)}
              disabled={page === 0}
            >
              ← Prev
            </button>
            <button
              className="pointer-events-auto text-white bg-black/40 hover:bg-black/60 px-6 py-2 rounded-lg text-sm"
              onClick={() => page < pages.length - 1 && setPage(page + 1)}
              disabled={page === pages.length - 1}
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </>
  );
};
