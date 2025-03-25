"use client"

import { useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { Experience } from "./Experience"
import { Canvas } from "@react-three/fiber"
import * as THREE from "three"
// Import MindAR directly instead of loading via CDN
// @ts-ignore
import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js"
import { UI } from "./UI" // Adjust the path as needed

const MindARComponent = ({ projectData, targetPath = "./targets1.mind" }) => {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const textureRef = useRef(null)
  const rendererRef = useRef(null)
  const mindarInstanceRef = useRef(null)
  const [arReady, setARReady] = useState(false)
  const [mindARLoaded, setMindARLoaded] = useState(true)
  const [errorMessage, setErrorMessage] = useState(null)
  const [targetFileChecked, setTargetFileChecked] = useState(false)
  const [contextLost, setContextLost] = useState(false)
  const [projectDataReady, setProjectDataReady] = useState(false)
  const [recoveryAttempt, setRecoveryAttempt] = useState(0)
  const [loadingStage, setLoadingStage] = useState("initializing")
  const [rootInstance, setRootInstance] = useState(null)
  const [cameraStreamRef, setCameraStreamRef] = useState(null)
  const r3fCanvasRef = useRef(null)
  const planeRef = useRef(null)
  const [isPageTransitioning, setIsPageTransitioning] = useState(false)
  const pageTransitionTimeoutRef = useRef(null)
  const renderRequestRef = useRef(null)
  const textureUpdateIntervalRef = useRef(null)

  // Check if project data is ready
  useEffect(() => {
    if (projectData) {
      console.log("📚 Project data is ready")
      setProjectDataReady(true)
      setLoadingStage("projectReady")
    } else {
      console.log("⏳ Waiting for project data...")
      setLoadingStage("waitingForData")
    }
  }, [projectData])

  // Check for target file availability with retry logic
  useEffect(() => {
    if (!targetPath) return

    const checkTargetFile = async () => {
      try {
        setLoadingStage("checkingTarget")
        console.log(`🔍 Checking target file at: ${targetPath}`)

        // Add retry logic for target file fetch
        let retries = 0
        const maxRetries = 3
        let success = false

        while (retries < maxRetries && !success) {
          try {
            const response = await fetch(targetPath, {
              cache: "no-cache",
              headers: { "Cache-Control": "no-cache" },
            })

            if (response.ok) {
              success = true
              console.log("✅ Target file found")
              setTargetFileChecked(true)
              setLoadingStage((prev) => (prev === "checkingTarget" ? "targetReady" : prev))
              break
            } else {
              throw new Error(`Status: ${response.status}`)
            }
          } catch (fetchError) {
            retries++
            console.warn(`Target file check attempt ${retries}/${maxRetries} failed: ${fetchError.message}`)
            if (retries < maxRetries) {
              await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, retries - 1)))
            }
          }
        }

        if (!success) {
          throw new Error(`Failed after ${maxRetries} attempts`)
        }
      } catch (error) {
        console.error(`❌ Error accessing target file: ${error.message}`)
        setErrorMessage(`Target file not accessible. Check if the file exists at: ${targetPath}`)
        setLoadingStage("error")
      }
    }

    checkTargetFile()
  }, [targetPath, recoveryAttempt])

  // Check WebGL compatibility
  useEffect(() => {
    const checkWebGL = () => {
      try {
        setLoadingStage("checkingWebGL")
        const canvas = document.createElement("canvas")

        const contextOptions = {
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
          antialias: true,
          alpha: true,
          depth: true,
          stencil: false,
          desynchronized: true,
          premultipliedAlpha: false,
        }

        const gl =
          canvas.getContext("webgl2", contextOptions) ||
          canvas.getContext("webgl", contextOptions) ||
          canvas.getContext("experimental-webgl", contextOptions)

        if (!gl) {
          setErrorMessage(
            "WebGL not supported in your browser. Try a different browser or update your graphics drivers.",
          )
          setLoadingStage("error")
          return false
        }

        setLoadingStage((prev) => (prev === "checkingWebGL" ? "webGLReady" : prev))
        return true
      } catch (error) {
        console.error("WebGL check error:", error)
        setErrorMessage("WebGL error: " + error.message)
        setLoadingStage("error")
        return false
      }
    }

    if (!checkWebGL()) {
      console.error("❌ WebGL check failed")
    } else {
      console.log("✅ WebGL supported")
    }
  }, [recoveryAttempt])

  // Initialize AR experience - Check prerequisites
  useEffect(() => {
    if (recoveryAttempt > 0) {
      setErrorMessage(null)
      setContextLost(false)
    }

    const prerequisites = {
      mindARLoaded: mindARLoaded,
      targetFileChecked: targetFileChecked,
      projectDataReady: !!projectData,
      containerReady: !!containerRef.current,
      threeAvailable: !!THREE,
      contextLost: contextLost,
    }

    const allPrerequisitesMet = Object.values(prerequisites).every((value, index) =>
      index === Object.values(prerequisites).length - 1 ? !value : value,
    )

    if (!allPrerequisitesMet) {
      console.log("Prerequisites not met:")
      Object.entries(prerequisites).forEach(([key, value]) => {
        if ((key === "contextLost" && value) || (key !== "contextLost" && !value)) {
          console.log(`⏳ ${key} check failed`)
        }
      })
      return
    }

    console.log("🚀 All prerequisites met, proceeding with AR initialization")
    setLoadingStage("initializingAR")
  }, [mindARLoaded, targetFileChecked, projectDataReady, containerRef, contextLost, recoveryAttempt])

  // Enhanced rendering function with triple buffering strategy
  const forceRender = () => {
    // Cancel any previous requests to avoid render queue flooding
    if (renderRequestRef.current) {
      cancelAnimationFrame(renderRequestRef.current)
    }

    // Triple buffering approach - render in three stages with precise timing
    const performRendering = (iteration = 0, maxIterations = 5) => {
      if (iteration >= maxIterations) return

      // Execute render
      if (window.renderR3F) {
        window.renderR3F()
      }

      // Update texture and materials
      if (textureRef.current) {
        textureRef.current.needsUpdate = true
      }

      if (planeRef.current && planeRef.current.material) {
        planeRef.current.material.needsUpdate = true

        // During transitions, ensure material opacity is correct
        if (isPageTransitioning) {
          planeRef.current.material.opacity = 1.0
        }
      }

      // Schedule next render in sequence with optimal timing
      renderRequestRef.current = requestAnimationFrame(() => {
        performRendering(iteration + 1, maxIterations)
      })
    }

    // Start the rendering sequence
    performRendering()
  }

  // Handle page transition state with improved synchronization
  const handlePageTransitionStart = () => {
    console.log("🔄 Page transition started")
    setIsPageTransitioning(true)
    window.pageTransitioning = true

    // Clear any existing timeout to prevent conflicts
    if (pageTransitionTimeoutRef.current) {
      clearTimeout(pageTransitionTimeoutRef.current)
    }

    // Pre-render immediately with high priority
    forceRender()

    // Accelerate texture update frequency during transitions
    clearInterval(textureUpdateIntervalRef.current)
    textureUpdateIntervalRef.current = setInterval(() => {
      if (textureRef.current) textureRef.current.needsUpdate = true
      if (planeRef.current?.material) planeRef.current.material.needsUpdate = true
    }, 8) // Much more frequent updates during transitions
  }

  const handlePageTransitionEnd = () => {
    console.log("✅ Page transition completed")

    // Keep rendering at high frequency briefly after transition
    pageTransitionTimeoutRef.current = setTimeout(() => {
      setIsPageTransitioning(false)
      window.pageTransitioning = false

      // Reset texture update interval to normal frequency
      clearInterval(textureUpdateIntervalRef.current)
      textureUpdateIntervalRef.current = setInterval(() => {
        if (textureRef.current) textureRef.current.needsUpdate = true
        if (planeRef.current?.material) planeRef.current.material.needsUpdate = true
      }, 33) // Normal update frequency

      // Final render burst to ensure clean state
      forceRender()
    }, 300)
  }

  // Initialize AR with enhanced error handling and WebGL context recovery
  useEffect(() => {
    if (loadingStage !== "initializingAR") return

    const cleanupFunctions = []

    const initializeAR = async () => {
      console.log("Starting AR initialization attempt #" + (recoveryAttempt + 1))

      let mindarThree = null
      let cameraStream = null
      let root = null
      let plane = null

      try {
        // Device orientation and screen size detection for better responsiveness
        const isPortrait = window.innerHeight > window.innerWidth
        const screenRatio = window.innerWidth / window.innerHeight
        console.log(`📱 Screen orientation: ${isPortrait ? "portrait" : "landscape"}, ratio: ${screenRatio.toFixed(2)}`)

        // Check if camera is available
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cameras = devices.filter((device) => device.kind === "videoinput")

        if (cameras.length === 0) {
          throw new Error("No camera found on this device")
        }

        console.log(`📷 Found ${cameras.length} camera(s)`)

        // Request camera access with adaptive resolution based on device capabilities
       try {
         // Use full device pixel ratio without capping
         const dpr = window.devicePixelRatio || 1;

         // Calculate optimal camera resolution based on screen size and orientation
         let idealWidth = isPortrait ? 1280 : 1920;
         let idealHeight = isPortrait ? 1920 : 1080;

         // Adjust for lower-end devices
         if (window.innerWidth < 768) {
           idealWidth = isPortrait ? 720 : 1280;
           idealHeight = isPortrait ? 1280 : 720;
         }

         cameraStream = await navigator.mediaDevices.getUserMedia({
           video: {
             facingMode: "environment",
             width: { ideal: idealWidth },
             height: { ideal: idealHeight },
           },
           audio: false,
         });
       } catch (cameraError) {
         console.warn("⚠️ Failed to access environment camera:", cameraError);

         try {
           // Fallback to any available camera with lower resolution
           cameraStream = await navigator.mediaDevices.getUserMedia({
             video: {
               width: { ideal: 720 },
               height: { ideal: 720 },
             },
             audio: false,
           });
         } catch (fallbackError) {
           throw new Error(`Camera access denied: ${fallbackError.message}`);
         }
       }

        setCameraStreamRef(cameraStream)
        cleanupFunctions.push(() => {
          if (cameraStream) {
            cameraStream.getTracks().forEach((track) => track.stop())
          }
        })

        console.log("✅ Camera access granted")
        setLoadingStage("cameraReady")

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
        }

        try {
          console.log("Creating MindAR instance with options:", mindarOptions)
          mindarThree = new MindARThree(mindarOptions)

          // Handle potential THREE.js version compatibility issues
          if (mindarThree.renderer && typeof mindarThree.renderer.outputEncoding !== "undefined") {
            Object.defineProperty(mindarThree.renderer, "outputEncoding", {
              get: function () {
                return this.outputColorSpace === THREE.SRGBColorSpace ? THREE.sRGBEncoding : THREE.LinearEncoding
              },
              set: function (value) {
                this.outputColorSpace = value === THREE.sRGBEncoding ? THREE.SRGBColorSpace : THREE.LinearColorSpace
              },
            })
          }

          mindarInstanceRef.current = mindarThree
        } catch (constructorError) {
          console.error("Error constructing MindAR:", constructorError)
          throw new Error(`Failed to create MindAR instance: ${constructorError.message}`)
        }

        const { renderer, scene, camera } = mindarThree
        rendererRef.current = renderer

        // Enhanced renderer settings with adaptive quality
        if (renderer) {
          renderer.outputColorSpace = THREE.SRGBColorSpace

          // Adaptive quality based on device performance
          const dpr = Math.min(window.devicePixelRatio, 2)
          renderer.setPixelRatio(dpr)
          renderer.setClearColor(0x000000, 0)

          // Enable antialiasing for smoother rendering
          renderer.antialias = true

          // Optimize for mobile GPUs
          renderer.powerPreference = "high-performance"
          renderer.physicallyCorrectLights = false
        }

        // Improved WebGL context handling with focused event listeners
        const canvas = renderer.domElement

        const handleContextLost = (event) => {
          event.preventDefault()
          console.warn("⚠️ WebGL context lost")
          setContextLost(true)
          setLoadingStage("contextLost")

          // Stop rendering immediately to prevent further errors
          if (mindarThree && mindarThree.renderer) {
            mindarThree.renderer.setAnimationLoop(null)
          }

          // Pause camera to conserve resources
          if (cameraStreamRef) {
            cameraStreamRef.getTracks().forEach((track) => (track.enabled = false))
          }

          // Attempt recovery after a brief delay
          setTimeout(() => {
            setRecoveryAttempt((prev) => prev + 1)
          }, 2000)
        }

        const handleContextRestored = () => {
          console.log("✅ WebGL context restored")
          setContextLost(false)
        }

        // Use capture phase for more reliable event handling
        canvas.addEventListener("webglcontextlost", handleContextLost, { capture: true })
        canvas.addEventListener("webglcontextrestored", handleContextRestored, { capture: true })

        cleanupFunctions.push(() => {
          canvas.removeEventListener("webglcontextlost", handleContextLost, { capture: true })
          canvas.removeEventListener("webglcontextrestored", handleContextRestored, { capture: true })
        })

        // Start AR with progressive timeout strategy
        console.log("Starting MindAR...")
        try {
          await Promise.race([
            mindarThree.start(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Camera start timeout (10s)")), 10000)),
          ])
        } catch (startError) {
          // If it's a timeout, try a more conservative approach
          if (startError.message.includes("timeout")) {
            console.warn("⚠️ Timeout starting MindAR, trying with lower resolution...")

            // Stop previous camera stream
            if (cameraStream) {
              cameraStream.getTracks().forEach((track) => track.stop())
            }

            // Try with significantly lower resolution
            cameraStream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: "environment",
                width: { ideal: 640 },
                height: { ideal: 480 },
              },
              audio: false,
            })

            setCameraStreamRef(cameraStream)

            // Try starting again with a longer timeout
            await Promise.race([
              mindarThree.start(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Final camera start timeout (15s)")), 15000),
              ),
            ])
          } else {
            throw startError
          }
        }

        console.log("✅ MindAR started successfully")
        setLoadingStage("arStarted")

        // Create anchor for AR content
        const anchor = mindarThree.addAnchor(0)

        // Create a plane with responsive dimensions based on device orientation
        const getPlaneScale = () => {
          // Base scale adjusted by screen aspect ratio
          const baseScale = isPortrait ? [2.0, 3.0, 1.5] : [3.2, 1.6, 1.5]

          // Further adjust based on device width
          if (window.innerWidth < 768) {
            // Smaller screens
            return isPortrait ? [1.8, 2.7, 1.5] : [2.8, 1.4, 1.5]
          }
          return baseScale
        }

        // Create plane with optimized material for better performance
        plane = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide,
            color: 0xffffff,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
          }),
        )

        // Position the plane and set initial scale
        plane.position.z = 0.1
        const [scaleX, scaleY, scaleZ] = getPlaneScale()
        plane.scale.set(scaleX, scaleY, scaleZ)

        // Store the plane reference and add it to the anchor
        planeRef.current = plane
        anchor.group.add(plane)

        // Add visual indicator with improved animation
        const targetFoundIndicator = new THREE.Mesh(
          new THREE.RingGeometry(0.6, 0.65, 16),
          new THREE.MeshBasicMaterial({
            color: "#3333cc",
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
          }),
        )
        targetFoundIndicator.position.z = -0.05
        targetFoundIndicator.visible = false
        anchor.group.add(targetFoundIndicator)

        // Handle screen orientation changes
        const handleOrientationChange = () => {
          const newIsPortrait = window.innerHeight > window.innerWidth
          const [newScaleX, newScaleY, newScaleZ] = getPlaneScale()

          // Animate scale change for smoother transition
          if (plane) {
            // Force immediate update during orientation change
            plane.scale.set(newScaleX, newScaleY, newScaleZ)

            // Force renders during orientation change
            forceRender()

            console.log(`📱 Orientation changed to: ${newIsPortrait ? "portrait" : "landscape"}`)
          }
        }

        // Add responsive handling
        window.addEventListener("resize", handleOrientationChange)
        window.addEventListener("orientationchange", handleOrientationChange)

        cleanupFunctions.push(() => {
          window.removeEventListener("resize", handleOrientationChange)
          window.removeEventListener("orientationchange", handleOrientationChange)
        })

        // Improved target found handling
        anchor.onTargetFound = () => {
          console.log("🎯 Target found!")
          targetFoundIndicator.visible = true

          // Ensure plane is visible
          if (plane) {
            plane.visible = true
          }

          // Enhanced rendering on target found - high frequency renders to ensure content is visible
          for (let i = 0; i < 20; i++) {
            setTimeout(() => {
              if (window.renderR3F) window.renderR3F()
              if (textureRef.current) textureRef.current.needsUpdate = true
              if (plane && plane.material) {
                plane.material.needsUpdate = true
              }
            }, i * 30)
          }

          setTimeout(() => {
            targetFoundIndicator.visible = false
          }, 1500)
        }

        // Handle target lost with graceful transition
        anchor.onTargetLost = () => {
          console.log("Target lost")

          // Ensure final render to freeze last good frame
          if (window.renderR3F) window.renderR3F()
          if (textureRef.current) textureRef.current.needsUpdate = true
        }

        // Setup R3F with improved offscreen rendering approach
        console.log("Setting up 3D scene with optimized offscreen rendering...")

        // Create the R3F container with proper sizing and positioning
        const r3fContainer = document.createElement("div")
        r3fContainer.style.position = "absolute"
        r3fContainer.style.opacity = "1"
        r3fContainer.style.pointerEvents = "none"
        r3fContainer.style.width = "100vw"
        r3fContainer.style.height = "100vh"
        r3fContainer.style.overflow = "hidden"
        r3fContainer.style.zIndex = "-1"
        r3fContainer.style.top = "0"
        r3fContainer.style.left = "0"
        r3fContainer.style.visibility = "hidden" // Hide but keep rendered
        r3fContainer.style.backgroundColor = "#000000"
        document.body.appendChild(r3fContainer)

        // Create the R3F canvas with optimized dimensions
        const r3fCanvas = document.createElement("canvas")
        // Use power-of-2 texture dimensions for optimal GPU performance
        r3fCanvas.width = 2048
        r3fCanvas.height = 1024
        r3fCanvas.style.backgroundColor = "#000000"
        r3fContainer.appendChild(r3fCanvas)
        r3fCanvasRef.current = r3fCanvas
        canvasRef.current = r3fCanvas

        // Wait to ensure the canvas is in the DOM
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Create texture with optimized settings
        const texture = new THREE.CanvasTexture(r3fCanvas)
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.colorSpace = THREE.SRGBColorSpace
        texture.generateMipmaps = false // Disable mipmaps for better performance
        texture.anisotropy = 1 // Minimum anisotropy for better performance
        texture.needsUpdate = true
        textureRef.current = texture

        // Apply the texture to the plane with improved material settings
        if (plane && plane.material) {
          plane.material.map = texture
          plane.material.needsUpdate = true
        }

        // Create the React root
        root = createRoot(r3fContainer)
        setRootInstance(root)

        // Simplified R3F Canvas setup with optimized settings
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
              zoom: 1,
              near: 0.01,
              far: 1000,
              left: -5,
              right: 5,
              top: 5,
              bottom: -5,
            }}
            onCreated={({ gl, scene, camera }) => {
              console.log("🎨 R3F Canvas created in AR mode with enhanced rendering")
              gl.setClearColor("#000000", 0)
              gl.setClearAlpha(0)

              // Improved rendering function with better sync
              const renderR3F = () => {
                gl.render(scene, camera)
                if (textureRef.current) {
                  textureRef.current.needsUpdate = true
                }
              }

              // Store for external access
              window.renderR3F = renderR3F

              // More frequent rendering for smoother transitions
              const renderInterval = setInterval(renderR3F, 16)
              window.r3fRenderInterval = renderInterval
              cleanupFunctions.push(() => clearInterval(renderInterval))

              // Add an additional high-priority render cycle for transitions
              const priorityRenderInterval = setInterval(() => {
                // Check if a page transition is happening
                const transitioning = window.pageTransitioning || isPageTransitioning

                if (transitioning) {
                  // Render multiple times during transitions to prevent glitching
                  for (let i = 0; i < 5; i++) {
                    renderR3F()
                  }
                }
              }, 8) // Very frequent updates during transitions

              cleanupFunctions.push(() => clearInterval(priorityRenderInterval))
            }}
          >
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 5, 5]} intensity={1} />
            {projectData && (
              <group position={[0, 0, 1]} scale={2.5}>
                <Experience
                  projectData={projectData}
                  autoPlay={false}
                  isARMode={true}
                  debug={true}
                  onPageTransitionStart={handlePageTransitionStart}
                  onPageTransitionEnd={handlePageTransitionEnd}
                />
              </group>
            )}
          </Canvas>
        )

        // Render the R3F scene
        try {
          root.render(r3fScene)
          console.log("🎨 R3F scene rendered successfully")

          // Force texture updates
          if (textureRef.current) {
            textureRef.current.needsUpdate = true
          }
          if (plane?.material) {
            plane.material.needsUpdate = true
          }
        } catch (err) {
          console.error("❌ Error rendering R3F scene:", err)

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
            )
            root.render(fallbackScene)
            console.log("🔄 Rendered fallback scene instead")
          } catch (fallbackErr) {
            console.error("❌ Fallback scene failed:", fallbackErr)
          }
        }

        // Remove the standalone fallback rendering block that was outside the catch
        console.log("✅ 3D scene setup complete")
        setARReady(true)
        setLoadingStage("complete")

        // Set up initial texture update interval
        textureUpdateIntervalRef.current = setInterval(() => {
          if (textureRef.current) textureRef.current.needsUpdate = true
          if (planeRef.current?.material) planeRef.current.material.needsUpdate = true
        }, 33) // Normal update frequency

        cleanupFunctions.push(() => {
          clearInterval(textureUpdateIntervalRef.current)
        })

        // Improved render loop with double buffering technique
        let lastRenderTime = 0
        const targetFrameTime = 1000 / 60 // Target 60fps

        const renderLoop = (timestamp) => {
          try {
            // Calculate time since last render
            const deltaTime = timestamp - lastRenderTime

            // Only render if enough time has passed or during page transitions
            if (deltaTime >= targetFrameTime || isPageTransitioning) {
              lastRenderTime = timestamp

              // Force canvas redraw
              if (r3fCanvasRef.current) {
                r3fCanvasRef.current.dispatchEvent(new Event("update"))
              }

              // Update texture
              if (textureRef.current) {
                textureRef.current.needsUpdate = true
              }

              // Update material
              if (plane && plane.material) {
                plane.material.needsUpdate = true
              }

              // Render AR scene
              if (mindarThree && mindarThree.renderer) {
                mindarThree.renderer.render(mindarThree.scene, mindarThree.camera)
              }
            }
          } catch (renderError) {
            console.error("Render error:", renderError)
          }
        }

        // Start the renderer animation loop with timestamp
        if (mindarThree && mindarThree.renderer) {
          mindarThree.renderer.setAnimationLoop(renderLoop)
        }

        // Add additional continuous rendering during transitions
        const continuousRenderInterval = setInterval(() => {
          if (isPageTransitioning) {
            // Force more frequent renders during transitions
            renderLoop(performance.now())
          }
        }, 8) // Very frequent during transitions

        cleanupFunctions.push(() => clearInterval(continuousRenderInterval))

        // Add cleanup function for the R3F resources
        cleanupFunctions.push(() => {
          if (r3fContainer && r3fContainer.parentNode) {
            r3fContainer.parentNode.removeChild(r3fContainer)
          }

          if (root) {
            try {
              root.unmount()
            } catch (e) {
              console.warn("Error unmounting R3F root:", e)
            }
          }
        })
      } catch (error) {
        console.error("❌ AR initialization error:", error)

        // Clean up any partial initialization
        cleanupFunctions.forEach((fn) => fn())

        // Provide helpful error messages based on error type
        let userMessage = `AR initialization failed: ${error.message}`

        if (error.message.includes("camera")) {
          userMessage = "Camera access denied. Please allow camera access and try again."
        } else if (error.message.includes("timeout")) {
          userMessage = "Camera startup timed out. Try closing other applications using your camera."
        } else if (error.message.includes("WebGL") || error.message.includes("context")) {
          userMessage = "Graphics error. Try closing other graphics-intensive apps or reloading the page."
        }

        setErrorMessage(userMessage)
        setLoadingStage("error")
      }
    }

    // Start the initialization process
    initializeAR()

    // Cleanup function
    return () => {
      // Clear any page transition timeout
      if (pageTransitionTimeoutRef.current) {
        clearTimeout(pageTransitionTimeoutRef.current)
      }

      // Clear render request
      if (renderRequestRef.current) {
        cancelAnimationFrame(renderRequestRef.current)
      }

      // Clear texture update interval
      if (textureUpdateIntervalRef.current) {
        clearInterval(textureUpdateIntervalRef.current)
      }

      cleanupFunctions.forEach((fn) => {
        try {
          fn()
        } catch (e) {
          console.warn("Cleanup error:", e)
        }
      })

      // Reset refs
      textureRef.current = null
      canvasRef.current = null
      r3fCanvasRef.current = null
      mindarInstanceRef.current = null
      rendererRef.current = null
      planeRef.current = null
    }
  }, [loadingStage, projectData, targetPath, recoveryAttempt, isPageTransitioning])

  // Handle component unmount cleanly
  useEffect(() => {
    return () => {
      // Clear any page transition timeout
      if (pageTransitionTimeoutRef.current) {
        clearTimeout(pageTransitionTimeoutRef.current)
      }

      // Clear render request
      if (renderRequestRef.current) {
        cancelAnimationFrame(renderRequestRef.current)
      }

      // Clear texture update interval
      if (textureUpdateIntervalRef.current) {
        clearInterval(textureUpdateIntervalRef.current)
      }

      // Stop camera tracks
      if (cameraStreamRef) {
        try {
          cameraStreamRef.getTracks().forEach((track) => track.stop())
        } catch (e) {
          console.warn("Error stopping camera:", e)
        }
      }

      // Stop MindAR
      if (mindarInstanceRef.current) {
        try {
          mindarInstanceRef.current.stop()
        } catch (e) {
          console.warn("Error stopping MindAR on unmount:", e)
        }
      }

      // Unmount R3F root
      if (rootInstance) {
        try {
          rootInstance.unmount()
        } catch (e) {
          console.warn("Error unmounting R3F root on unmount:", e)
        }
      }
    }
  }, [cameraStreamRef, mindarInstanceRef, rootInstance])

  // Create a descriptive loading message based on current stage
  const getLoadingMessage = () => {
    switch (loadingStage) {
      case "initializing":
        return "Initializing AR experience..."
      case "waitingForData":
        return "Loading book content..."
      case "projectReady":
        return "Book content loaded"
      case "checkingTarget":
        return "Checking target image..."
      case "targetReady":
        return "Target image ready"
      case "checkingWebGL":
        return "Checking graphics capabilities..."
      case "webGLReady":
        return "Graphics ready"
      case "initializingAR":
        return "Initializing AR system..."
      case "cameraReady":
        return "Camera ready. Starting AR..."
      case "arStarted":
        return "Setting up 3D environment..."
      case "contextLost":
        return "Graphics context lost. Recovering..."
      case "error":
        return errorMessage || "An error occurred"
      case "complete":
        return "Please point your camera at the target image"
      default:
        return "Loading..."
    }
  }

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
    ]

    const currentIndex = stages.indexOf(loadingStage)
    if (currentIndex === -1 || loadingStage === "error" || loadingStage === "contextLost") return 0
    return Math.round((currentIndex / (stages.length - 1)) * 100)
  }

  return (
    <>
      <div ref={containerRef} className="fixed top-0 left-0 w-full h-screen overflow-hidden z-5 bg-black" />

      {/* Debug info overlay - only visible during development */}
      {arReady && (
        <div className="fixed top-2.5 left-2.5 bg-black/70 text-white p-2.5 rounded text-xs z-[1000]">
          {projectData && <UI albumId={projectData || ""} />}
          AR Active - Point at target
        </div>
      )}

      {!arReady && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-white bg-black/90 p-5 rounded-lg w-4/5 max-w-md z-[1000]">
          <h3 className="text-lg font-medium">Loading AR Experience</h3>
          {loadingStage === "error" ? (
            <div>
              <p>{errorMessage}</p>
              <p className="text-sm opacity-80 mt-2.5">
                {contextLost ? "Error code: WebGL context lost" : "Error initializing AR"}
              </p>
            </div>
          ) : (
            <div>
              <p>{getLoadingMessage()}</p>

              {loadingStage !== "complete" && loadingStage !== "error" && loadingStage !== "contextLost" && (
                <div className="mt-4">
                  <div className="w-full h-2.5 bg-white/20 rounded-md overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${getProgressPercentage()}%` }}
                    />
                  </div>
                  <p className="text-xs mt-1.5">{getProgressPercentage()}%</p>
                </div>
              )}

              {loadingStage === "contextLost" && (
                <div className="mt-2.5 flex justify-center">
                  <div className="w-7 h-7 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
              <style jsx>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}
          {(loadingStage === "error" || loadingStage === "contextLost") && recoveryAttempt > 2 && (
            <button
              onClick={() => window.location.reload()}
              className="mt-4 py-2 px-4 bg-blue-500 text-white border-none rounded cursor-pointer"
            >
              Reload Page
            </button>
          )}
          {loadingStage === "error" && (
            <button
              onClick={() => setRecoveryAttempt((prev) => prev + 1)}
              className="mt-4 py-2 px-4 bg-blue-500 text-white border-none rounded cursor-pointer ml-2.5"
            >
              Try Again
            </button>
          )}
        </div>
      )}
    </>
  )
}

export default MindARComponent