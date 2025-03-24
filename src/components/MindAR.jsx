import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Experience } from "./Experience";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
// Import MindAR directly instead of loading via CDN
// @ts-ignore
import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";
import { UI, pageAtom, projectDataAtom, initializePages } from "./UI"; // Adjust the path as needed
import { useAtom } from "jotai";

// Simple test component without Html element (which can cause issues)
const DebugTestMesh = () => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible((prev) => !prev);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <mesh visible={visible} position={[0, 0, 1]} scale={0.5}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="red" />
    </mesh>
  );
};

const MindARComponent = ({ projectData, targetPath = "./targets1.mind" }) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const textureRef = useRef(null);
  const rendererRef = useRef(null);
  const mindarInstanceRef = useRef(null);
  const [arReady, setARReady] = useState(false);
  const [mindARLoaded, setMindARLoaded] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [targetFileChecked, setTargetFileChecked] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [projectDataReady, setProjectDataReady] = useState(false);
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const [loadingStage, setLoadingStage] = useState("initializing");
  const [rootInstance, setRootInstance] = useState(null);
  const [cameraStreamRef, setCameraStreamRef] = useState(null);
  const r3fCanvasRef = useRef(null);
  const planeRef = useRef(null);

  // Check if project data is ready
  useEffect(() => {
    if (projectData) {
      console.log("📚 Project data is ready");
      setProjectDataReady(true);
      setLoadingStage("projectReady");
    } else {
      console.log("⏳ Waiting for project data...");
      setLoadingStage("waitingForData");
    }
  }, [projectData]);

  // Check for target file availability with retry logic
  useEffect(() => {
    if (!targetPath) return;

    const checkTargetFile = async () => {
      try {
        setLoadingStage("checkingTarget");
        console.log(`🔍 Checking target file at: ${targetPath}`);

        // Add retry logic for target file fetch
        let retries = 0;
        const maxRetries = 3;
        let success = false;

        while (retries < maxRetries && !success) {
          try {
            const response = await fetch(targetPath, {
              cache: "no-cache",
              headers: { "Cache-Control": "no-cache" },
            });

            if (response.ok) {
              success = true;
              console.log("✅ Target file found");
              setTargetFileChecked(true);
              setLoadingStage((prev) =>
                prev === "checkingTarget" ? "targetReady" : prev
              );
              break;
            } else {
              throw new Error(`Status: ${response.status}`);
            }
          } catch (fetchError) {
            retries++;
            console.warn(
              `Target file check attempt ${retries}/${maxRetries} failed: ${fetchError.message}`
            );
            if (retries < maxRetries) {
              await new Promise((r) =>
                setTimeout(r, 1000 * Math.pow(2, retries - 1))
              );
            }
          }
        }

        if (!success) {
          throw new Error(`Failed after ${maxRetries} attempts`);
        }
      } catch (error) {
        console.error(`❌ Error accessing target file: ${error.message}`);
        setErrorMessage(
          `Target file not accessible. Check if the file exists at: ${targetPath}`
        );
        setLoadingStage("error");
      }
    };

    checkTargetFile();
  }, [targetPath, recoveryAttempt]);

  // Check WebGL compatibility
  useEffect(() => {
    const checkWebGL = () => {
      try {
        setLoadingStage("checkingWebGL");
        const canvas = document.createElement("canvas");

        const contextOptions = {
          powerPreference: "default",
          failIfMajorPerformanceCaveat: false,
          antialias: false,
          alpha: true,
          depth: true,
          stencil: false,
          desynchronized: true,
          premultipliedAlpha: false,
        };

        const gl =
          canvas.getContext("webgl2", contextOptions) ||
          canvas.getContext("webgl", contextOptions) ||
          canvas.getContext("experimental-webgl", contextOptions);

        if (!gl) {
          setErrorMessage(
            "WebGL not supported in your browser. Try a different browser or update your graphics drivers."
          );
          setLoadingStage("error");
          return false;
        }

        setLoadingStage((prev) =>
          prev === "checkingWebGL" ? "webGLReady" : prev
        );
        return true;
      } catch (error) {
        console.error("WebGL check error:", error);
        setErrorMessage("WebGL error: " + error.message);
        setLoadingStage("error");
        return false;
      }
    };

    if (!checkWebGL()) {
      console.error("❌ WebGL check failed");
    } else {
      console.log("✅ WebGL supported");
    }
  }, [recoveryAttempt]);

  // Initialize AR experience - Check prerequisites
  useEffect(() => {
    if (recoveryAttempt > 0) {
      setErrorMessage(null);
      setContextLost(false);
    }

    const prerequisites = {
      mindARLoaded: mindARLoaded,
      targetFileChecked: targetFileChecked,
      projectDataReady: !!projectData,
      containerReady: !!containerRef.current,
      threeAvailable: !!THREE,
      contextLost: contextLost,
    };

    const allPrerequisitesMet = Object.values(prerequisites).every(
      (value, index) =>
        index === Object.values(prerequisites).length - 1 ? !value : value
    );

    if (!allPrerequisitesMet) {
      console.log("Prerequisites not met:");
      Object.entries(prerequisites).forEach(([key, value]) => {
        if (
          (key === "contextLost" && value) ||
          (key !== "contextLost" && !value)
        ) {
          console.log(`⏳ ${key} check failed`);
        }
      });
      return;
    }

    console.log("🚀 All prerequisites met, proceeding with AR initialization");
    setLoadingStage("initializingAR");
  }, [
    mindARLoaded,
    targetFileChecked,
    projectDataReady,
    containerRef,
    contextLost,
    recoveryAttempt,
  ]);

  // Initialize AR with enhanced error handling and WebGL context recovery
  useEffect(() => {
    if (loadingStage !== "initializingAR") return;

    const cleanupFunctions = [];

    const initializeAR = async () => {
      console.log(
        "Starting AR initialization attempt #" + (recoveryAttempt + 1)
      );

      let mindarThree = null;
      let cameraStream = null;
      let root = null;
      let plane = null;

      try {
        // Check if camera is available
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(
          (device) => device.kind === "videoinput"
        );

        if (cameras.length === 0) {
          throw new Error("No camera found on this device");
        }

        console.log(`📷 Found ${cameras.length} camera(s)`);

        // Request camera access with fallback options
        try {
          cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch (cameraError) {
          console.warn("⚠️ Failed to access environment camera:", cameraError);

          try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } catch (fallbackError) {
            throw new Error(`Camera access denied: ${fallbackError.message}`);
          }
        }

        setCameraStreamRef(cameraStream);
        cleanupFunctions.push(() => {
          if (cameraStream) {
            cameraStream.getTracks().forEach((track) => track.stop());
          }
        });

        console.log("✅ Camera access granted");
        setLoadingStage("cameraReady");

        // Create MindAR with optimized settings
        const mindarOptions = {
          container: containerRef.current,
          imageTargetSrc: targetPath,
          uiScanning: true,
          maxTrack: 1,
          filterMinCF: 0.1,
          filterBeta: 10,
          warmupTolerance: 5,
          missTolerance: 5,
          useSmoothing: true,
        };

        try {
          console.log("Creating MindAR instance with options:", mindarOptions);
          mindarThree = new MindARThree(mindarOptions);
          if (
            mindarThree.renderer &&
            typeof mindarThree.renderer.outputEncoding !== "undefined"
          ) {
            // Override the property descriptor to redirect to outputColorSpace
            Object.defineProperty(mindarThree.renderer, "outputEncoding", {
              get: function () {
                return this.outputColorSpace === THREE.SRGBColorSpace
                  ? THREE.sRGBEncoding
                  : THREE.LinearEncoding;
              },
              set: function (value) {
                this.outputColorSpace =
                  value === THREE.sRGBEncoding
                    ? THREE.SRGBColorSpace
                    : THREE.LinearColorSpace;
              },
            });
          }
          mindarInstanceRef.current = mindarThree;
        } catch (constructorError) {
          console.error("Error constructing MindAR:", constructorError);
          throw new Error(
            `Failed to create MindAR instance: ${constructorError.message}`
          );
        }

        const { renderer, scene, camera } = mindarThree;
        rendererRef.current = renderer;

        // Fix: Use outputColorSpace instead of outputEncoding
        if (renderer) {
          renderer.outputColorSpace = THREE.SRGBColorSpace;
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
          renderer.setClearColor(0x000000, 0);
        }
        

        // Improve WebGL context handling
        const canvas = renderer.domElement;

        // Listen for context lost event with better recovery
        const handleContextLost = (event) => {
          event.preventDefault();
          console.warn("⚠️ WebGL context lost");
          setContextLost(true);
          setLoadingStage("contextLost");

          // Stop rendering and clean up
          if (mindarThree && mindarThree.renderer) {
            mindarThree.renderer.setAnimationLoop(null);
          }
          if (cameraStreamRef) {
            cameraStreamRef
              .getTracks()
              .forEach((track) => (track.enabled = false));
          }

          // Attempt recovery after a delay
          setTimeout(() => {
            setRecoveryAttempt((prev) => prev + 1); // Trigger full reinitialization
          }, 3000);
        };

        const handleContextRestored = () => {
          console.log("✅ WebGL context restored");
          setContextLost(false);
        };

        canvas.addEventListener("webglcontextlost", handleContextLost);
        canvas.addEventListener("webglcontextrestored", handleContextRestored);

        cleanupFunctions.push(() => {
          canvas.removeEventListener("webglcontextlost", handleContextLost);
          canvas.removeEventListener(
            "webglcontextrestored",
            handleContextRestored
          );
        });

        // Start AR with timeout safeguard
        console.log("Starting MindAR...");
        try {
          await Promise.race([
            mindarThree.start(),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Camera start timeout (15s)")),
                15000
              )
            ),
          ]);
        } catch (startError) {
          // If it's a timeout, try a more conservative approach
          if (startError.message.includes("timeout")) {
            console.warn(
              "⚠️ Timeout starting MindAR, trying with lower resolution..."
            );

            // Stop previous camera stream
            if (cameraStream) {
              cameraStream.getTracks().forEach((track) => track.stop());
            }

            // Try with lower resolution
            cameraStream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: "environment",
                width: { ideal: 640 },
                height: { ideal: 480 },
              },
              audio: false,
            });

            setCameraStreamRef(cameraStream);

            // Try starting again with a longer timeout
            await Promise.race([
              mindarThree.start(),
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error("Final camera start timeout (20s)")),
                  20000
                )
              ),
            ]);
          } else {
            throw startError;
          }
        }

        console.log("✅ MindAR started successfully");
        setLoadingStage("arStarted");

        // Create anchor for AR content
        const anchor = mindarThree.addAnchor(0);

        // Create a plane with proper dimensions and material
        plane = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide,
            color: 0xffffff,
            depthTest: false,
            depthWrite: false,
          })
        );

        // Position the plane better
        plane.position.z = 0.1;
        plane.scale.set(1.5, 1.5, 1.5);

        // Store the plane reference and add it to the anchor
        planeRef.current = plane;
        anchor.group.add(plane);

        // Add visual indicator when target is found
        const targetFoundIndicator = new THREE.Mesh(
          new THREE.RingGeometry(0.6, 0.65, 32),
          new THREE.MeshBasicMaterial({
            color: "#3333cc",
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
          })
        );
        targetFoundIndicator.position.z = -0.05;
        targetFoundIndicator.visible = false;
        anchor.group.add(targetFoundIndicator);

        anchor.onTargetFound = () => {
          console.log("🎯 Target found!");
          targetFoundIndicator.visible = true;

          // Force multiple renders
          for (let i = 0; i < 10; i++) {
            setTimeout(() => {
              if (window.renderR3F) window.renderR3F();
              if (textureRef.current) textureRef.current.needsUpdate = true;
              if (plane && plane.material) {
                plane.material.needsUpdate = true;
              }
            }, i * 100);
          }

          setTimeout(() => {
            targetFoundIndicator.visible = false;
          }, 2000);
        };

        // Setup R3F with a simplified approach
        console.log("Setting up 3D scene...");

        // Create the R3F canvas container with better sizing
        const r3fContainer = document.createElement("div");
        r3fContainer.style.position = "absolute";
        r3fContainer.style.opacity = "1";
        r3fContainer.style.pointerEvents = "none";
        r3fContainer.style.width = "100vw";
        r3fContainer.style.height = "100vh";
        r3fContainer.style.overflow = "hidden";
        r3fContainer.style.zIndex = "-1";
        r3fContainer.style.left = "-99999px"; // FIX: Move offscreen to prevent scrolling
        r3fContainer.style.top = "-99999px"; // FIX: Move offscreen to prevent scrolling
        r3fContainer.style.backgroundColor = "#000000";
        document.body.appendChild(r3fContainer);

        // Create the R3F canvas with fixed size
        const r3fCanvas = document.createElement("canvas");
        r3fCanvas.width = 1024;
        r3fCanvas.height = 1024;
        r3fCanvas.style.backgroundColor = "#000000";
        r3fContainer.appendChild(r3fCanvas);
        r3fCanvasRef.current = r3fCanvas;
        canvasRef.current = r3fCanvas;

        // Wait to ensure the canvas is in the DOM
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Create texture for the plane
        const texture = new THREE.CanvasTexture(r3fCanvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        textureRef.current = texture;

        // Apply the texture to the plane
        if (plane && plane.material) {
          plane.material.map = texture;
          plane.material.needsUpdate = true;
        }

        // Create the React root
        root = createRoot(r3fContainer);
        setRootInstance(root);

        // Simplified R3F Canvas setup
        const r3fScene = (
          <Canvas
            frameloop="demand"
            gl={{
              canvas: r3fCanvas,
              antialias: true,
              alpha: true,
              depth: true,
              stencil: false,
              powerPreference: "high-performance",
              preserveDrawingBuffer: true,
            }}
            dpr={window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio}
            orthographic
            camera={{
              position: [0, 0, 10],
              zoom: 2,
              near: 0.01,
              far: 1000,
              left: -5,
              right: 5,
              top: 5,
              bottom: -5,
            }}
            onCreated={({ gl, scene, camera }) => {
              console.log(
                "🎨 R3F Canvas created in AR mode with enhanced rendering"
              );
              gl.setClearColor("#000000", 0);
              gl.setClearAlpha(0);

              // Improved rendering function with better sync
              const renderR3F = () => {
                gl.render(scene, camera);
                if (textureRef.current) {
                  textureRef.current.needsUpdate = true;
                }
              };

              // Store for external access
              window.renderR3F = renderR3F;

              // More frequent rendering for smoother transitions
              const renderInterval = setInterval(renderR3F, 16);
              window.r3fRenderInterval = renderInterval;
              cleanupFunctions.push(() => clearInterval(renderInterval));

              // Add an additional high-priority render cycle
              const priorityRenderInterval = setInterval(() => {
                // Check if a page transition is happening
                const currentPage = window.currentPageState;
                const transitioning = window.pageTransitioning;

                if (transitioning) {
                  for (let i = 0; i < 3; i++) {
                    renderR3F();
                  }
                }
              }, 8);

              cleanupFunctions.push(() =>
                clearInterval(priorityRenderInterval)
              );
            }}
          >
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 5, 5]} intensity={1} />
            {projectData && (
              <group position={[0, 0, 1]} scale={2}>
                <Experience
                  projectData={projectData}
                  autoPlay={false}
                  isARMode={true}
                  debug={true}
                  onPageTransitionStart={() => {
                    window.pageTransitioning = true;
                    // Force multiple renders
                    if (window.renderR3F) {
                      for (let i = 0; i < 5; i++) {
                        setTimeout(() => window.renderR3F(), i * 5);
                      }
                    }
                  }}
                  onPageTransitionEnd={() => {
                    window.pageTransitioning = false;
                    // Force final renders to ensure everything is displayed correctly
                    if (window.renderR3F) {
                      for (let i = 0; i < 5; i++) {
                        setTimeout(() => window.renderR3F(), i * 20);
                      }
                    }
                  }}
                />
              </group>
            )}
          </Canvas>
        );

        // Render the R3F scene
        try {
          root.render(r3fScene);
          console.log("🎨 R3F scene rendered successfully");

          // Force texture updates
          if (textureRef.current) {
            textureRef.current.needsUpdate = true;
          }
          if (plane?.material) {
            plane.material.needsUpdate = true;
          }
        } catch (err) {
          console.error("❌ Error rendering R3F scene:", err);

          // Fallback scene
          try {
            const fallbackScene = (
              <Canvas>
                <color attach="background" args={["#000000"]} />
                <mesh position={[0, 0, 2]}>
                  <boxGeometry />
                  <meshBasicMaterial color="red" />
                </mesh>
              </Canvas>
            );
            root.render(fallbackScene);
            console.log("🔄 Rendered fallback scene instead");
          } catch (fallbackErr) {
            console.error("❌ Fallback scene failed:", fallbackErr);
          }
        }

        // Remove the standalone fallback rendering block that was outside the catch
        console.log("✅ 3D scene setup complete");
        setARReady(true);
        setLoadingStage("complete");

        // Improved render loop
        const renderLoop = () => {
          try {
            // Force canvas redraw
            if (r3fCanvasRef.current) {
              r3fCanvasRef.current.dispatchEvent(new Event("update"));
            }

            // Update texture
            if (textureRef.current) {
              textureRef.current.needsUpdate = true;
            }

            // Update material
            if (plane && plane.material) {
              plane.material.needsUpdate = true;
            }

            // Render AR scene
            if (mindarThree && mindarThree.renderer) {
              mindarThree.renderer.render(
                mindarThree.scene,
                mindarThree.camera
              );
            }
          } catch (renderError) {
            console.error("Render error:", renderError);
          }

          // if (r3fCanvasRef.current) {
          //   console.log("R3F Canvas is present:", r3fCanvasRef.current);
          // } else {
          //   console.warn("R3F Canvas not found!");
          // }

          // console.log("Render loop executing, texture update: ", textureRef.current ? "yes" :"no")
        };

        // Start the renderer animation loop
        if (mindarThree && mindarThree.renderer) {
          mindarThree.renderer.setAnimationLoop(renderLoop);
        }

        // Add additional continuous rendering
        const continuousRenderInterval = setInterval(renderLoop, 16);
        cleanupFunctions.push(() => clearInterval(continuousRenderInterval));

        // Add cleanup function for the R3F resources
        cleanupFunctions.push(() => {
          if (r3fContainer && r3fContainer.parentNode) {
            r3fContainer.parentNode.removeChild(r3fContainer);
          }

          if (root) {
            try {
              root.unmount();
            } catch (e) {
              console.warn("Error unmounting R3F root:", e);
            }
          }
        });
      } catch (error) {
        console.error("❌ AR initialization error:", error);

        // Clean up any partial initialization
        cleanupFunctions.forEach((fn) => fn());

        // Provide helpful error messages based on error type
        let userMessage = `AR initialization failed: ${error.message}`;

        if (error.message.includes("camera")) {
          userMessage =
            "Camera access denied. Please allow camera access and try again.";
        } else if (error.message.includes("timeout")) {
          userMessage =
            "Camera startup timed out. Try closing other applications using your camera.";
        } else if (
          error.message.includes("WebGL") ||
          error.message.includes("context")
        ) {
          userMessage =
            "Graphics error. Try closing other graphics-intensive apps or reloading the page.";
        }

        setErrorMessage(userMessage);
        setLoadingStage("error");
      }
    };

    // Start the initialization process
    initializeAR();

    // Cleanup function
    return () => {
      cleanupFunctions.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.warn("Cleanup error:", e);
        }
      });

      // Reset refs
      textureRef.current = null;
      canvasRef.current = null;
      r3fCanvasRef.current = null;
      mindarInstanceRef.current = null;
      rendererRef.current = null;
      planeRef.current = null;
    };
  }, [loadingStage, projectData, targetPath, recoveryAttempt]);

  // Handle component unmount cleanly
  useEffect(() => {
    return () => {
      // Stop camera tracks
      if (cameraStreamRef) {
        try {
          cameraStreamRef.getTracks().forEach((track) => track.stop());
        } catch (e) {
          console.warn("Error stopping camera:", e);
        }
      }

      // Stop MindAR
      if (mindarInstanceRef.current) {
        try {
          mindarInstanceRef.current.stop();
        } catch (e) {
          console.warn("Error stopping MindAR on unmount:", e);
        }
      }

      // Unmount R3F root
      if (rootInstance) {
        try {
          rootInstance.unmount();
        } catch (e) {
          console.warn("Error unmounting R3F root on unmount:", e);
        }
      }
    };
  }, [cameraStreamRef, mindarInstanceRef, rootInstance]);

  // Frequent texture updates
  useEffect(() => {
    if (!arReady) return;

    const textureUpdateInterval = setInterval(() => {
      // Update texture and material
      if (textureRef.current) {
        textureRef.current.needsUpdate = true;
      }

      // Update plane material
      if (planeRef.current && planeRef.current.material) {
        planeRef.current.material.needsUpdate = true;
      }
    }, 16);
    
    return () => clearInterval(textureUpdateInterval);
  }, [arReady]);


  // Create a descriptive loading message based on current stage
  const getLoadingMessage = () => {
    switch (loadingStage) {
      case "initializing":
        return "Initializing AR experience...";
      case "waitingForData":
        return "Loading book content...";
      case "projectReady":
        return "Book content loaded";
      case "checkingTarget":
        return "Checking target image...";
      case "targetReady":
        return "Target image ready";
      case "checkingWebGL":
        return "Checking graphics capabilities...";
      case "webGLReady":
        return "Graphics ready";
      case "initializingAR":
        return "Initializing AR system...";
      case "cameraReady":
        return "Camera ready. Starting AR...";
      case "arStarted":
        return "Setting up 3D environment...";
      case "contextLost":
        return "Graphics context lost. Recovering...";
      case "error":
        return errorMessage || "An error occurred";
      case "complete":
        return "Please point your camera at the target image";
      default:
        return "Loading...";
    }
  };
  
  // Show progress based on loading stage
  const getProgressPercentage = () => {
    const stages = [
      "initializing",
      "waitingForData",
      "projectReady",
      "checkingTarget",
      "targetReady",
      "checkingWebGL",
      "webGLReady",
      "initializingAR",
      "cameraReady",
      "arStarted",
      "complete",
    ];

    const currentIndex = stages.indexOf(loadingStage);
    if (
      currentIndex === -1 ||
      loadingStage === "error" ||
      loadingStage === "contextLost"
    )
      return 0;
    return Math.round((currentIndex / (stages.length - 1)) * 100);
  };

  return (
    <>
      <div
        className="bg-black"
        ref={containerRef}
        style={{
          width: "100%",
          height: "100vh", // FIX: Use 100vh instead of 100% to avoid scroll issues
          position: "fixed", // FIX: Use fixed positioning to prevent scrolling
          top: 0,
          left: 0,
          overflow: "hidden",
          zIndex: 5,
          background: "#000000",
        }}
      />

      {/* Debug info overlay - only visible during development */}
      {arReady && (
        <div
          style={{
            position: "fixed",
            top: "10px",
            left: "10px",
            background: "rgba(0,0,0,0.7)",
            color: "white",
            padding: "10px",
            borderRadius: "5px",
            fontSize: "12px",
            zIndex: 1000,
          }}
        >
          {projectData && <UI albumId={projectData || ""} />}
          AR Active - Point at target
        </div>
      )}

      {!arReady && (
        <div
          style={{
            position: "fixed", // FIX: Use fixed positioning
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            color: "white",
            background: "rgba(0,0,0,0.9)",
            padding: "20px",
            borderRadius: "10px",
            width: "80%",
            maxWidth: "400px",
            zIndex: 1000,
          }}
        >
          <h3>Loading AR Experience</h3>
          {loadingStage === "error" ? (
            <div>
              <p>{errorMessage}</p>
              <p style={{ fontSize: "14px", opacity: 0.8, marginTop: "10px" }}>
                {contextLost
                  ? "Error code: WebGL context lost"
                  : "Error initializing AR"}
              </p>
            </div>
          ) : (
            <div>
              <p>{getLoadingMessage()}</p>

              {loadingStage !== "complete" &&
                loadingStage !== "error" &&
                loadingStage !== "contextLost" && (
                  <div style={{ marginTop: "15px" }}>
                    <div
                      style={{
                        width: "100%",
                        height: "10px",
                        backgroundColor: "rgba(255,255,255,0.2)",
                        borderRadius: "5px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${getProgressPercentage()}%`,
                          height: "100%",
                          backgroundColor: "#4285f4",
                          transition: "width 0.3s ease-in-out",
                        }}
                      />
                    </div>
                    <p style={{ fontSize: "12px", marginTop: "5px" }}>
                      {getProgressPercentage()}%
                    </p>
                  </div>
                )}

              {loadingStage === "contextLost" && (
                <div
                  style={{
                    marginTop: "10px",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      border: "3px solid rgba(255,255,255,0.3)",
                      borderTop: "3px solid white",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  ></div>
                </div>
              )}
              <style>
                {`
                  @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                  }
                  `}
              </style>
            </div>
          )}
          {(loadingStage === "error" || loadingStage === "contextLost") &&
            recoveryAttempt > 2 && (
              <button
                onClick={() => window.location.reload()}
                style={{
                  marginTop: "15px",
                  padding: "8px 16px",
                  background: "#4285f4",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Reload Page
              </button>
            )}
          {loadingStage === "error" && (
            <button
              onClick={() => setRecoveryAttempt((prev) => prev + 1)}
              style={{
                marginTop: "15px",
                padding: "8px 16px",
                background: "#4285f4",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                marginLeft: "10px",
              }}
            >
              Try Again
            </button>
          )}
        </div>
      )}
    </>
  );
};

export default MindARComponent;
