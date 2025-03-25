import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Texture,
  Skeleton,
  Bone,
  SkinnedMesh,
  Scalar,
} from "@babylonjs/core";
import { WebXRDefaultExperience } from "@babylonjs/core/XR/webXRDefaultExperience";

// Helper function for date formatting (same as in the Three.js version)
const formatDate = (dateString) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (error) {
    return "Invalid Date";
  }
};

// Helper function to generate unique IDs (same as in the Three.js version)
const generateUniqueId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
};

// --- Constants ---
const PAGE_WIDTH = 2.6;
const PAGE_HEIGHT = 1.92;
const PAGE_DEPTH = 0.003;
const PAGE_SEGMENTS = 160;
const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS;
const COVER_SPINE_RADIUS = 0.2;

const BabylonBook = ({
  events,
  onEventClick,
  autoPlay = false,
  autoPlaySpeed = 3000,
  splitImages = false,
}) => {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const bookRootRef = useRef(null);
  const xrHelperRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(autoPlay);
  const [autoPlayInterval, setAutoPlayInterval] = useState(autoPlaySpeed);
  const autoPlayTimerRef = useRef(null);
  const pageMeshesRef = useRef([]);
  const [bookInitialized, setBookInitialized] = useState(false);

  // --- Utility Functions ---
  const createPageGeometry = (scene) => {
    const pageGeometry = MeshBuilder.CreateBox(
      "pageGeometry",
      {
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        depth: PAGE_DEPTH,
        sideOrientation: BABYLON.Mesh.DOUBLESIDE, // Important for seeing both sides
        segments: { width: PAGE_SEGMENTS, height: 2 }, // Use segments for width
      },
      scene
    );

    // Translate the geometry so the spine is at x=0
    pageGeometry.translate(PAGE_WIDTH / 2, 0, 0);

    // Create skinning attributes (similar to Three.js)
    const positions = pageGeometry.getVerticesData(
      BABYLON.VertexBuffer.PositionKind
    );
    if (!positions) return null;

    const skinIndices = [];
    const skinWeights = [];

    for (let i = 0; i < positions.length / 3; i++) {
      const x = positions[i * 3]; // Get x position
      const skinIndex = Math.max(
        0,
        Math.floor((x / PAGE_WIDTH) * PAGE_SEGMENTS)
      );
      const skinWeight = (x % SEGMENT_WIDTH) / SEGMENT_WIDTH;

      skinIndices.push(skinIndex, skinIndex + 1, 0, 0);
      skinWeights.push(1 - skinWeight, skinWeight, 0, 0);
    }

    pageGeometry.setVerticesData(
      BABYLON.VertexBuffer.MatricesIndicesKind,
      skinIndices,
      false,
      4
    );
    pageGeometry.setVerticesData(
      BABYLON.VertexBuffer.MatricesWeightsKind,
      skinWeights,
      false,
      4
    );

    return pageGeometry;
  };

  const createPageMaterial = (scene, textureUrl, split, isFront) => {
    const material = new StandardMaterial("pageMaterial", scene);
    const texture = new Texture(textureUrl, scene);
    texture.uScale = 1.02; // Make sure texture covers the edge.
    texture.vScale = 1;
    material.diffuseTexture = texture;
    material.backFaceCulling = false; // Render both sides of the material
    material.specularColor = new Color3(0.1, 0.1, 0.1); // Reduce shininess

    if (split) {
      texture.wrapU = Texture.CLAMP_ADDRESSMODE;
      texture.wrapV = Texture.CLAMP_ADDRESSMODE;
      texture.uScale = 0.52;
      if (isFront) {
        texture.uOffset = 0.5;
      } else {
        texture.uOffset = 0;
      }
    }

    return material;
  };

  const createPage = (scene, pageData, pageNumber, isCover, splitImages) => {
    const pageGeometry = createPageGeometry(scene);
    if (!pageGeometry) return null;

    let frontMaterial, backMaterial;

    if (isCover && splitImages) {
      const backTextureClone = new Texture(pageData.back, scene);
      backTextureClone.uScale = 0.52;
      backTextureClone.uOffset = 0;
      backMaterial = new StandardMaterial("coverBackMaterial", scene);
      backMaterial.diffuseTexture = backTextureClone;
      backMaterial.backFaceCulling = false;
    } else if (splitImages && !isCover) {
      const frontTextureClone = new Texture(pageData.front, scene);
      const backTextureClone = new Texture(pageData.back, scene);

      frontTextureClone.uScale = 0.5;
      frontTextureClone.uOffset = 0.5;

      backTextureClone.uScale = 0.52;
      backTextureClone.uOffset = 0;

      frontMaterial = new StandardMaterial("pageFrontMaterial", scene);
      frontMaterial.diffuseTexture = frontTextureClone;
      frontMaterial.backFaceCulling = false;

      backMaterial = new StandardMaterial("pageBackMaterial", scene);
      backMaterial.diffuseTexture = backTextureClone;
      backMaterial.backFaceCulling = false;
    } else {
      frontMaterial = createPageMaterial(scene, pageData.front, false, true);
      backMaterial = createPageMaterial(scene, pageData.back, false, false);
    }

    const materials = [frontMaterial, backMaterial]; //  front, back

    const pageMesh = new SkinnedMesh(
      `page${pageNumber}`,
      `page${pageNumber}`,
      scene,
      pageGeometry
    );
    pageMesh.material = materials;
    pageMesh.position.set(0, 0, -pageNumber * PAGE_DEPTH * 1.01);
    pageMesh.castShadow = true;
    pageMesh.receiveShadow = true;
    pageMesh.freezeWorldMatrix();

    // Create bones and skeleton for this page
    const bones = [];
    for (let i = 0; i <= PAGE_SEGMENTS; i++) {
      const bone = new Bone(`bone${pageNumber}-${i}`, pageMesh, scene);
      bone.position.x = i === 0 ? 0 : SEGMENT_WIDTH;
      bones.push(bone);
    }

    const skeleton = new Skeleton(
      `skeleton${pageNumber}`,
      `skeleton${pageNumber}`,
      scene
    );
    skeleton.bones = bones;
    pageMesh.skeleton = skeleton;

    // Bind the skeleton
    pageMesh.addBone(bones[0]);
    pageMesh.attachBone(bones[0], pageMesh);
    pageMesh.bind(skeleton);

    pageMeshesRef.current[pageNumber] = pageMesh; // Store the mesh for later animation

    return { mesh: pageMesh, skeleton };
  };

  // --- Effects ---

  // Initialize Babylon.js
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const engine = new Engine(canvas, true);
    engineRef.current = engine;

    const scene = new Scene(engine);
    sceneRef.current = scene;
    scene.clearColor = new Color3(0.9, 0.9, 0.9); // Light gray background
    scene.ambientColor = new Color3(1, 1, 1);

    // Camera
    const camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      Math.PI / 3,
      5,
      Vector3.Zero(),
      scene
    );
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 2;
    camera.upperRadiusLimit = 10;
    camera.wheelPrecision = 50;

    // Light
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    light.groundColor = new Color3(0.8, 0.8, 0.8);

    // Root node for pages
    bookRootRef.current = new BABYLON.TransformNode("bookRoot", scene);

    // Initial setup of the book
    const setupBook = () => {
      if (!sceneRef.current || !bookRootRef.current) return;
      const scene = sceneRef.current;

      // Clear any existing meshes
      bookRootRef.current.dispose(true);
      pageMeshesRef.current = [];

      const organizedPages = getOrganizedPages();

      organizedPages.forEach((pageData, index) => {
        const isCover = index === 0 || index === organizedPages.length - 1;
        const pageInfo = createPage(
          scene,
          pageData,
          index,
          isCover,
          splitImages
        );
        if (pageInfo) {
          pageInfo.mesh.parent = bookRootRef.current;
        }
      });
      setBookInitialized(true);
    };

    setupBook();

    // Handle window resize
    const handleResize = () => {
      engine.resize();
    };
    window.addEventListener("resize", handleResize);

    // Run the render loop
    engine.runRenderLoop(() => {
      if (scene) {
        scene.render();
      }
    });

    // WebXR
    const initXR = async () => {
      if (!sceneRef.current) return;
      try {
        const xr = await sceneRef.current.createDefaultXRExperienceAsync({
          floorMeshes: [],
          disableTeleportation: true,
        });
        xrHelperRef.current = xr;

        // Optional: Customize XR experience (e.g., input)
        xr.input.onControllerAddedObservable.add((controller) => {
          controller.onMotionControllerInitializedObservable.add(() => {
            const xrInput = controller.motionController;
            if (xrInput && xrInput.getComponent("a-button")) {
              xrInput
                .getComponent("a-button")
                .onButtonStateChangedObservable.add((component) => {
                  if (component.pressed) {
                    // Turn page when A button is pressed
                    setCurrentPage((p) => p + 1);
                  }
                });
            }
          });
        });
      } catch (error) {
        console.error("Failed to initialize WebXR:", error);
      }
    };
    initXR();

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      engine.dispose();
      engineRef.current = null;
      sceneRef.current?.dispose();
      sceneRef.current = null;
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      if (xrHelperRef.current) {
        xrHelperRef.current.dispose();
        xrHelperRef.current = null;
      }
    };
  }, [events, splitImages]); // Removed autoPlay, autoPlaySpeed

  // Auto-play functionality
  useEffect(() => {
    if (isAutoPlaying && sceneRef.current) {
      // Clear any existing timer
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }

      // Set up new timer for page turning
      autoPlayTimerRef.current = setInterval(() => {
        setCurrentPage((currentPage) => {
          // Check if we're at the last page
          if (currentPage >= getTotalPages()) {
            // Reset to first page
            return 0;
          }
          // Otherwise, go to next page
          return currentPage + 1;
        });
      }, autoPlayInterval);
    } else if (autoPlayTimerRef.current) {
      // Clean up timer if auto-play is turned off
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }

    // Clean up on unmount
    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    };
  }, [isAutoPlaying, autoPlayInterval, getTotalPages]);

  // Page turning animation
  useEffect(() => {
    if (sceneRef.current && bookInitialized) {
      const numPages = getTotalPages();
      pageMeshesRef.current.forEach((pageMesh, index) => {
        const targetRotation = currentPage > index ? -Math.PI / 2 : Math.PI / 2;
        const bones = pageMesh.skeleton?.bones;
        if (bones) {
          bones.forEach((bone, boneIndex) => {
            let rotationY = targetRotation;
            let rotationX = 0;

            // Apply some easing
            const animationSpeed = 0.1; // Adjust for animation speed
            bone.rotation.y = Scalar.Lerp(
              bone.rotation.y,
              rotationY,
              animationSpeed
            );

            // Apply a fold
            const foldIntensity =
              boneIndex > 8
                ? Math.sin(boneIndex * Math.PI * (1 / bones.length) - 0.5)
                : 0;
            rotationX = 0.2 * Math.sign(targetRotation) * foldIntensity;
            bone.rotation.x = Scalar.Lerp(
              bone.rotation.x,
              rotationX,
              animationSpeed
            );
          });
        }
      });
    }
  }, [currentPage, bookInitialized, getTotalPages]);

  // --- UI and Rendering ---

  const getOrganizedPages = useCallback(() => {
    if (!splitImages) {
      return events
        .map((event, index) => ({
          ...event,
          number: index,
        }))
        .slice(0, -1);
    }

    const organizedPages = [];

    if (events.length > 0 && events[0].isCover) {
      const nextPage = events.length > 1 ? events[1] : null;

      organizedPages.push({
        ...events[0],
        back: nextPage ? nextPage.front : events[0].back,
        number: 0,
      });
    }

    const startIndex = events[0].isCover ? 1 : 0;

    for (let i = startIndex; i < events.length; i++) {
      const currentPageData = events[i];
      const nextPage = i + 1 < events.length ? events[i + 1] : null;

      organizedPages.push({
        ...currentPageData,
        back: nextPage ? nextPage.front : currentPageData.back,
        number: organizedPages.length,
      });
    }

    return organizedPages.slice(0, -1);
  }, [events, splitImages]);

  const getTotalPages = useCallback(() => {
    return getOrganizedPages().length;
  }, [getOrganizedPages]);

  // Clean up
  useEffect(() => {
    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full touch-none"
        style={{ touchAction: "none" }} // Prevent default touch behavior
      />
      {/* <div>
        <p>Current Page: {currentPage}</p>
        <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))}>Previous</button>
        <button onClick={() => setCurrentPage(p => Math.min(getTotalPages() - 1, p + 1))}>Next</button>
        <button onClick={() => setIsAutoPlaying(p => !p)}>
          {isAutoPlaying ? 'Stop AutoPlay' : 'Start AutoPlay'}
        </button>
      </div> */}
    </div>
  );
};

// Example usage in a Next.js page
const EventManagementApp = () => {
  const [events, setEvents] = useState([]);
  const [splitImages, setSplitImages] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoPlaySpeed, setAutoPlaySpeed] = useState(3000);

  useEffect(() => {
    // Initialize with dummy data, including image URLs
    const initialEvents = [
      {
        id: generateUniqueId(),
        name: "Tech Conference 2025",
        date: "2025-05-15",
        location: "New York",
        front:
          "https://placehold.co/400x300/EEE/31343C?text=Tech+Conf+Front&font=Montserrat", // Example URL
        back: "https://placehold.co/400x300/CCC/31343C?text=Tech+Conf+Back&font=Montserrat", // Example URL
        isCover: true,
      },
      {
        id: generateUniqueId(),
        name: "Music Festival",
        date: "2025-07-20",
        location: "Los Angeles",
        front:
          "https://placehold.co/400x300/DDE/31343C?text=Music+Fest+Front&font=Montserrat", // Example URL
        back: "https://placehold.co/400x300/BCC/31343C?text=Music+Fest+Back&font=Montserrat", // Example URL
      },
      {
        id: generateUniqueId(),
        name: "Art Exhibition",
        date: "2025-04-10",
        location: "Chicago",
        front:
          "https://placehold.co/400x300/CCD/31343C?text=Art+Exhib+Front&font=Montserrat", // Example URL
        back: "https://placehold.co/400x300/ACC/31343C?text=Art+Exhib+Back&font=Montserrat", // Example URL
      },
      {
        id: generateUniqueId(),
        name: "Another Event",
        date: "2025-08-01",
        location: "Miami",
        front:
          "https://placehold.co/400x300/BBD/31343C?text=Another+Event+Front&font=Montserrat",
        back: "https://placehold.co/400x300/99C/31343C?text=Another+Event+Back&font=Montserrat",
      },
      {
        id: generateUniqueId(),
        name: "Final Page",
        date: "2025-09-15",
        location: "Seattle",
        front:
          "https://placehold.co/400x300/AAB/31343C?text=Final+Page+Front&font=Montserrat",
        back: "https://placehold.co/400x300/88B/31343C?text=Final+Page+Back&font=Montserrat",
      },
    ];
    setEvents(initialEvents);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <Head>
        <title>Babylon.js Event Book</title>
        <meta
          name="description"
          content="3D Event Book with Babylon.js and WebXR"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">
        Event Showcase (Babylon.js + WebXR)
      </h1>

      <div className="flex justify-center items-center gap-4 mb-4">
        <label className="flex items-center gap-2 text-gray-700">
          <input
            type="checkbox"
            checked={splitImages}
            onChange={(e) => setSplitImages(e.target.checked)}
            className="mr-1"
          />
          Split Images
        </label>

        <label className="flex items-center gap-2 text-gray-700">
          <input
            type="checkbox"
            checked={autoPlay}
            onChange={(e) => setAutoPlay(e.target.checked)}
            className="mr-1"
          />
          Auto Play
        </label>

        <label className="flex items-center gap-2 text-gray-700">
          Speed:
          <input
            type="number"
            value={autoPlaySpeed}
            onChange={(e) => setAutoPlaySpeed(parseInt(e.target.value, 10))}
            className="w-20 px-2 py-1 border rounded text-gray-700"
            min="1000"
            step="500"
          />
        </label>
      </div>

      <div className="w-full max-w-4xl h-[600px] bg-white rounded-lg shadow-xl overflow-hidden relative">
        <BabylonBook
          events={events}
          splitImages={splitImages}
          autoPlay={autoPlay}
          autoPlaySpeed={autoPlaySpeed}
        />
      </div>
    </div>
  );
};

export default EventManagementApp;