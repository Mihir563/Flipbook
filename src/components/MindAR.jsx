import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Experience } from "./Experience";
import { Canvas } from "@react-three/fiber";

const MindARComponent = ({ projectData, targetPath = "./target.mind" }) => {

    useEffect(() => {
        // Check if Three.js is already loaded globally
        if (window.THREE) {
            console.log("THREE.js already loaded globally, preventing duplicate loading");
            // Use the existing instance instead of loading a new one
            const existingThreeScripts = document.querySelectorAll('script[src*="three"]');
            existingThreeScripts.forEach(script => {
                script.setAttribute('data-already-loaded', 'true');
            });
        }
    }, []);
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const textureRef = useRef(null);
    const rendererRef = useRef(null);
    const mindarInstanceRef = useRef(null);
    const [arReady, setARReady] = useState(false);
    const [mindARLoaded, setMindARLoaded] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [targetFileChecked, setTargetFileChecked] = useState(false);
    const [contextLost, setContextLost] = useState(false);
    const [projectDataReady, setProjectDataReady] = useState(false);
    const [recoveryAttempt, setRecoveryAttempt] = useState(0);
    const [loadingStage, setLoadingStage] = useState("initializing");
    const [rootInstance, setRootInstance] = useState(null);
    const [cameraStreamRef, setCameraStreamRef] = useState(null);
    

    // Add this helper function at the top level of your component
    const isKernelRegistered = (kernelName) => {
        return window.tf &&
            window.tf.backend &&
            window.tf.backend.webgl &&
            window.tf.backend.webgl.kernelRegistry &&
            window.tf.backend.webgl.kernelRegistry.has(kernelName);
    };

    isKernelRegistered('conv2d');
    if (window.tf) {
        // If TensorFlow.js is already loaded, clear registered kernels to prevent warnings
        try {
            window.tf.ENV.set('DEBUG', false); // Disable TF debug
            if (window.tf.backend && window.tf.backend.webgl) {
                console.log("Preventing kernel registration conflicts");
                window.tf._noBackendsRegistered = true; // Prevent re-registration
            }
        } catch (e) {
            console.warn("Could not configure TensorFlow:", e);
        }
    }

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
                            cache: 'no-cache',  // Avoid cached responses
                            headers: { 'Cache-Control': 'no-cache' }
                        });

                        if (response.ok) {
                            success = true;
                            console.log("✅ Target file found");
                            setTargetFileChecked(true);
                            setLoadingStage(prev => prev === "checkingTarget" ? "targetReady" : prev);
                            break;
                        } else {
                            throw new Error(`Status: ${response.status}`);
                        }
                    } catch (fetchError) {
                        retries++;
                        console.warn(`Target file check attempt ${retries}/${maxRetries} failed: ${fetchError.message}`);
                        if (retries < maxRetries) {
                            // Wait before retrying with exponential backoff
                            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries - 1)));
                        }
                    }
                }

                if (!success) {
                    throw new Error(`Failed after ${maxRetries} attempts`);
                }
            } catch (error) {
                console.error(`❌ Error accessing target file: ${error.message}`);
                setErrorMessage(`Target file not accessible. Check if the file exists at: ${targetPath}`);
                setLoadingStage("error");
            }
        };

        checkTargetFile();
    }, [targetPath, recoveryAttempt]);

    // Check WebGL compatibility with more detailed diagnostics
    useEffect(() => {
        const checkWebGL = () => {
            try {
                setLoadingStage("checkingWebGL");
                const canvas = document.createElement('canvas');

                // Check for WebGL 2 first, then fall back to WebGL 1
                let contextOptions = {
                    powerPreference: 'default', // Less demanding than 'high-performance'
                    failIfMajorPerformanceCaveat: false,
                    antialias: false, // Disable for better performance
                    alpha: true,
                    depth: true,
                    stencil: false, // Disable if not needed
                    desynchronized: true // Can improve performance
                };

                let gl = canvas.getContext('webgl2', contextOptions) ||
                    canvas.getContext('webgl', contextOptions) ||
                    canvas.getContext('experimental-webgl', contextOptions);

                if (!gl) {
                    setErrorMessage("WebGL not supported in your browser. Try a different browser or update your graphics drivers.");
                    setLoadingStage("error");
                    return false;
                }

                // Get supported extensions first, BEFORE trying to use them
                const supportedExtensions = gl.getSupportedExtensions() || [];
                console.log(`📊 Supported WebGL extensions: ${supportedExtensions.length}`);

                const extensions = ['OES_texture_float', 'OES_element_index_uint'];
                for (const ext of extensions) {
                    try {
                        gl.getExtension(ext);
                    } catch (e) {
                        console.warn(`Could not enable extension ${ext}`);
                    }
                }

                // Lower WebGL requirements if extensions aren't available
                if (!supportedExtensions.includes('OES_texture_float')) {
                    contextOptions.precision = 'mediump'; // Use medium precision as fallback
                }

                if (!supportedExtensions.includes('OES_element_index_uint')) {
                    contextOptions.failIfMajorPerformanceCaveat = true;
                }

                // Check max texture size
                const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
                console.log(`📊 Max texture size: ${maxTextureSize}`);

                // Check for essential extensions
                const requiredExtensions = [
                    'OES_texture_float',
                    'OES_element_index_uint'
                ];

                const missingExtensions = requiredExtensions.filter(
                    ext => !supportedExtensions.includes(ext)
                );

                if (missingExtensions.length > 0) {
                    console.warn(`⚠️ Missing some WebGL extensions: ${missingExtensions.join(', ')}`);
                }

                // Additional diagnostics
                const parameters = {
                    'MAX_VARYING_VECTORS': gl.getParameter(gl.MAX_VARYING_VECTORS),
                    'MAX_VERTEX_ATTRIBS': gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
                    'MAX_VERTEX_UNIFORM_VECTORS': gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
                    'MAX_FRAGMENT_UNIFORM_VECTORS': gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
                    'MAX_RENDERBUFFER_SIZE': gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)
                };

                console.log("📊 WebGL capabilities:", parameters);

                // Check if running in low power mode 
                const hasLimitedFeatures = supportedExtensions.length < 15; // Rough estimate
                if (hasLimitedFeatures) {
                    console.warn("⚠️ Limited WebGL features detected. Device might be in power saving mode.");
                }

                setLoadingStage(prev => prev === "checkingWebGL" ? "webGLReady" : prev);
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

    // Load MindAR script with enhanced retry mechanism
    useEffect(() => {
        // Replace the loadMindAR function in your useEffect
        // Replace the loadMindAR function in your useEffect with this improved version
        const loadMindAR = async () => {
            try {
                // Check if MindAR is already properly loaded
                // Consistent property usage - decide whether it's Image or IMAGE
                if (window.MINDAR && window.MINDAR.Image && typeof window.MINDAR.Image === 'function') {
                    console.log("✅ MindAR Already Loaded and initialized");
                    setMindARLoaded(true);
                    setLoadingStage(prev => prev === "loadingMindAR" ? "mindARReady" : prev);
                    return;
                }

                setLoadingStage("loadingMindAR");
                console.log("🔄 Loading MindAR...");

                // First ensure THREE.js is loaded completely
                await new Promise((resolve) => {
                    if (window.THREE) {
                        console.log("✅ THREE.js already loaded");
                        resolve();
                        return;
                    }

                    console.log("🔄 Loading THREE.js...");
                    const script = document.createElement("script");
                    script.src = "https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.min.js";
                    script.async = true;
                    script.onload = () => {
                        console.log("✅ THREE.js loaded");
                        // Add a small delay to ensure THREE is fully initialized
                        setTimeout(resolve, 500);
                    };
                    document.head.appendChild(script);
                });

                // Clear any existing MindAR scripts to prevent conflicts
                const existingScripts = document.querySelectorAll('script[src*="mind-ar"]');
                existingScripts.forEach(script => script.remove());

                // Use a CDN with specified version known to work properly
                const mindARScript = document.createElement("script");
                mindARScript.src = "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js";
                mindARScript.async = false;
                mindARScript.crossOrigin = "anonymous";
                mindARScript.type = "text/javascript";

                // Wait for the script to fully load and initialize
                await new Promise((resolve, reject) => {
                    const timeoutId = setTimeout(() => {
                        reject(new Error("Script load timeout"));
                    }, 20000);

                    mindARScript.onload = () => {
                        clearTimeout(timeoutId);
                        // Give more time for the library to initialize and validate Image constructor
                        setTimeout(() => {
                            if (window.MINDAR && window.MINDAR.IMAGE && typeof window.MINDAR.IMAGE.MindARThree === 'function') {
                                console.log("✅ MindAR fully loaded and initialized");
                                setMindARLoaded(true);
                                setLoadingStage("mindARReady");
                                resolve();
                            } else {
                                // More specific error message with debug info
                                const debug = {
                                    MINDAR_exists: !!window.MINDAR,
                                    Image_property: window.MINDAR ? !!window.MINDAR.Image : false,
                                    Image_type: window.MINDAR && window.MINDAR.IMAGE ? typeof window.MINDAR.Image : 'undefined'
                                };
                                console.error("⚠️ MINDAR object loaded but Image constructor not available", debug);
                                reject(new Error(`MindAR loaded but Image constructor not found. Debug: ${JSON.stringify(debug)}`));
                            }
                        }, 3000); // Increased timeout to 3 seconds for better initialization
                    };

                    mindARScript.onerror = (error) => {
                        clearTimeout(timeoutId);
                        reject(new Error(`Failed to load MindAR: ${error}`));
                    };

                    document.head.appendChild(mindARScript);
                });
            } catch (error) {
                console.error("Failed to load MindAR:", error);
                setErrorMessage(`Error loading AR components: ${error.message}. Please reload and try again.`);
                setLoadingStage("error");
                throw error; // Rethrow to be caught by the retry mechanism
            }
        };

        loadMindAR();
    }, [recoveryAttempt]);


    // Initialize AR experience - Check prerequisites
    useEffect(() => {
        // Reset errors when attempting to initialize again
        if (recoveryAttempt > 0) {
            setErrorMessage(null);
            setContextLost(false);
        }

        // Enhanced prerequisites check with better logging
        // Enhance the prerequisites check
        const prerequisites = {
            mindARLoaded: !!window.MINDAR, // Check the actual object not just a state
            targetFileChecked: targetFileChecked,
            projectDataReady: !!projectData, // Check the actual data
            containerReady: !!containerRef.current,
            threeAvailable: !!window.THREE,
            mindarAvailable: !!window.MINDAR,
            contextLost: contextLost
        };

        // Check if all prerequisites are met
        const allPrerequisitesMet = Object.values(prerequisites).every(
            (value, index) => index === Object.values(prerequisites).length - 1 ? !value : value
        );

        if (!allPrerequisitesMet) {
            console.log("Prerequisites not met:");
            Object.entries(prerequisites).forEach(([key, value]) => {
                if ((key === 'contextLost' && value) || (key !== 'contextLost' && !value)) {
                    console.log(`⏳ ${key} check failed`);
                }
            });
            return;
        }

        console.log("🚀 All prerequisites met, proceeding with AR initialization");
        setLoadingStage("initializingAR");
    }, [mindARLoaded, targetFileChecked, projectDataReady, containerRef, contextLost, recoveryAttempt]);

    // Initialize AR with enhanced error handling and WebGL context recovery
    useEffect(() => {
        if (loadingStage !== "initializingAR") return;

        // Store cleanup functions in a ref for proper cleanup
        const cleanupFunctions = [];

        const initializeAR = async () => {
            console.log("Starting AR initialization attempt #" + (recoveryAttempt + 1));

            // Make sure THREE is defined before using it
            const ensureThreeJsAvailable = async () => {
                if (!window.THREE) {
                    console.warn("THREE.js not available during initialization, loading again...");
                    await new Promise((resolve) => {
                        const script = document.createElement("script");
                        script.src = "https://cdn.jsdelivr.net/npm/three@0.136.0/build/three.min.js";
                        script.async = false;
                        script.onload = () => {
                            console.log("THREE.js loaded during initialization");
                            resolve();
                        };
                        document.head.appendChild(script);
                    });
                }
            };

            await ensureThreeJsAvailable();

            let mindarThree = null;
            let cameraStream = null;
            let root = null;

            try {
                // Check for low memory conditions before starting
                const memoryInfo = performance?.memory;
                if (memoryInfo && memoryInfo.jsHeapSizeLimit < 2000000000) { // < 2GB
                    console.warn("⚠️ Running with limited memory:",
                        Math.round(memoryInfo.jsHeapSizeLimit / 1000000) + "MB available");
                }

                // First check if camera is available
                const devices = await navigator.mediaDevices.enumerateDevices();
                const cameras = devices.filter(device => device.kind === 'videoinput');

                if (cameras.length === 0) {
                    throw new Error('No camera found on this device');
                }

                console.log(`📷 Found ${cameras.length} camera(s)`);

                // Request camera access with fallback options
                try {
                    // Try environment camera first (rear camera on mobile)
                    cameraStream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            facingMode: 'environment',
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        },
                        audio: false
                    });
                } catch (cameraError) {
                    console.warn("⚠️ Failed to access environment camera:", cameraError);

                    // Fallback to any available camera
                    try {
                        cameraStream = await navigator.mediaDevices.getUserMedia({
                            video: true,
                            audio: false
                        });
                    } catch (fallbackError) {
                        throw new Error(`Camera access denied: ${fallbackError.message}`);
                    }
                }

                setCameraStreamRef(cameraStream);
                cleanupFunctions.push(() => {
                    if (cameraStream) {
                        cameraStream.getTracks().forEach(track => track.stop());
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
                    useSmoothing: true       // Enable pose smoothing
                };

                try {
                    console.log("Creating MindAR instance with options:", mindarOptions);
                    console.log("MindAR constructor type:", typeof window.MINDAR.IMAGE);
                    mindarThree = new window.MINDAR.IMAGE.MindARThree(mindarOptions);
                } catch (constructorError) {
                    console.error("Error constructing MindAR:", constructorError);
                    console.log("MindAR state:", {
                        exists: !!window.MINDAR,
                        properties: window.MINDAR ? Object.keys(window.MINDAR) : [],
                        Image: window.MINDAR ? window.MINDAR.IMAGE.MindARThree : undefined,
                        IMAGE: window.MINDAR ? window.MINDAR.IMAGE : undefined
                    });
                    throw new Error(`Failed to create MindAR instance: ${constructorError.message}`);
                }

                const { renderer, scene, camera } = mindarThree;
                rendererRef.current = renderer;

                // Configure renderer for better performance and stability
                if (renderer) {
                    // Use LinearSRGBColorSpace instead of LinearEncoding
                    renderer.outputColorSpace = window.THREE.LinearSRGBColorSpace; // Modern replacement for outputEncoding
                    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

                    // Set proper encoding for textures
                    if (textureRef.current) {
                        textureRef.current.colorSpace = window.THREE.LinearSRGBColorSpace; // Modern replacement for encoding
                    }
                }
                // Improve WebGL context handling
                const canvas = renderer.domElement;

                // Listen for context lost event with better recovery
                // Replace the handleContextLost function with this improved version
                const handleContextLost = (event) => {
                    event.preventDefault();
                    console.warn("⚠️ WebGL context lost");
                    setContextLost(true);
                    setLoadingStage("contextLost");

                    // Stop everything cleanly
                    if (mindarThree && mindarThree.renderer) {
                        try {
                            mindarThree.renderer.setAnimationLoop(null);
                        } catch (e) {
                            console.warn("Error stopping render loop:", e);
                        }
                    }

                    if (cameraStream) {
                        try {
                            cameraStream.getTracks().forEach(track => {
                                track.enabled = false;
                            });
                        } catch (e) {
                            console.warn("Error disabling camera:", e);
                        }
                    }

                    // Schedule recovery with shorter timeout
                    setTimeout(() => {
                        try {
                            // Try to restore context directly
                            if (canvas && canvas.getContext) {
                                const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
                                if (gl) {
                                    console.log("✅ WebGL context restored directly");
                                    setContextLost(false);
                                    return;
                                }
                            }
                        } catch (e) {
                            console.warn("Could not restore context directly:", e);
                        }

                        // Force a full recovery
                        setRecoveryAttempt(prev => prev + 1);
                    }, 3000); // Shorter timeout (3 seconds)
                };
                // Handle context restored event
                const handleContextRestored = () => {
                    console.log("✅ WebGL context restored");
                    setContextLost(false);

                    // Restart the AR experience
                    if (recoveryAttempt > 0) {
                        setRecoveryAttempt(prev => prev + 1);
                    }
                };

                canvas.addEventListener('webglcontextlost', handleContextLost);
                canvas.addEventListener('webglcontextrestored', handleContextRestored);

                cleanupFunctions.push(() => {
                    canvas.removeEventListener('webglcontextlost', handleContextLost);
                    canvas.removeEventListener('webglcontextrestored', handleContextRestored);
                });

                // Start AR with timeout safeguard and better error handling
                console.log("Starting MindAR...");
                try {
                    await Promise.race([
                        mindarThree.start(),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error("Camera start timeout (15s)")), 15000)
                        )
                    ]);
                } catch (startError) {
                    // If it's a timeout, try a more conservative approach
                    if (startError.message.includes("timeout")) {
                        console.warn("⚠️ Timeout starting MindAR, trying with lower resolution...");

                        // Stop previous camera stream
                        if (cameraStream) {
                            cameraStream.getTracks().forEach(track => track.stop());
                        }

                        // Try with lower resolution
                        cameraStream = await navigator.mediaDevices.getUserMedia({
                            video: {
                                facingMode: 'environment',
                                width: { ideal: 640 },  // Lower resolution
                                height: { ideal: 480 }
                            },
                            audio: false
                        });

                        setCameraStreamRef(cameraStream);

                        // Try starting again with a longer timeout
                        await Promise.race([
                            mindarThree.start(),
                            new Promise((_, reject) =>
                                setTimeout(() => reject(new Error("Final camera start timeout (20s)")), 20000)
                            )
                        ]);
                    } else {
                        throw startError; // Re-throw if it's not a timeout issue
                    }
                }

                console.log("✅ MindAR started successfully");
                setLoadingStage("arStarted");

                // Setup R3F with staged approach to avoid GPU pressure
                console.log("Setting up 3D scene...");

                // 1. Small delay to allow MindAR to stabilize
                await new Promise(resolve => setTimeout(resolve, 500));

                // 2. Create canvas for React Three Fiber
                const r3fCanvas = document.createElement("canvas");
                r3fCanvas.width = 1024;  // Fixed size for better performance
                r3fCanvas.height = 1024;
                canvasRef.current = r3fCanvas;
                r3fCanvas.style.display = "none";
                document.body.appendChild(r3fCanvas);

                cleanupFunctions.push(() => {
                    if (r3fCanvas && r3fCanvas.parentNode) {
                        r3fCanvas.parentNode.removeChild(r3fCanvas);
                    }
                });

                // 3. Setup R3F with lower resource usage
                root = createRoot(r3fCanvas);
                setRootInstance(root);

                cleanupFunctions.push(() => {
                    if (root) {
                        try {
                            root.unmount();
                        } catch (e) {
                            console.warn("Error unmounting R3F root:", e);
                        }
                    }
                });

                root.render(
                    <Canvas
                        frameloop="always"
                        gl={{
                            antialias: false,
                            alpha: true,
                            depth: true,
                            stencil: false,
                            powerPreference: 'default',
                            precision: 'mediump'
                        }}
                        dpr={[1, 1.5]}
                    >
                        <Experience
                            projectData={projectData}
                            autoPlay={true}
                            isARMode={true} 
                        />
                    </Canvas>
                );

                // 4. Give time for the R3F canvas to initialize
                await new Promise(resolve => setTimeout(resolve, 800));

                // 5. Create texture with the R3F content - with error handling
                try {
                    // Create and configure texture from R3F canvas
                    textureRef.current = new window.THREE.CanvasTexture(r3fCanvas);
                    textureRef.current.minFilter = window.THREE.LinearFilter;
                    textureRef.current.magFilter = window.THREE.LinearFilter;
                    textureRef.current.encoding = window.THREE.LinearSRGBColorSpace; // Use linear encoding for better compatibility
                    textureRef.current.needsUpdate = true;

                    const material = new window.THREE.MeshBasicMaterial({
                        map: textureRef.current,
                        transparent: true,
                        side: window.THREE.DoubleSide
                        // Don't try to override onBuild method, it's been removed
                    });

                    // Inside initializeAR function where the plane is created:
                    const plane = new window.THREE.Mesh(
                        new window.THREE.PlaneGeometry(2, 2), // Increased size
                        material
                    );

                    // Adjust plane scale and position
                    plane.scale.set(0.8, 0.8, 0.8);
                    plane.position.set(0, 0, -0.1); // Move slightly forward
                    // Fix for onBeforeRender error - explicitly add the method
                    plane.onBeforeRender = function () {
                        if (this.material.map) {
                            this.material.map.needsUpdate = true;
                        }
                    };

                    // Make sure any future objects will have this method too
                    // This helps MindAR properly handle the object
                    const ensureRenderMethods = (object) => {
                        if (object && typeof object.onBeforeRender !== 'function') {
                            object.onBeforeRender = function () { };
                        }

                        if (object && typeof object.onAfterRender !== 'function') {
                            object.onAfterRender = function () { };
                        }

                        if (object.children && object.children.length > 0) {
                            object.children.forEach(ensureRenderMethods);
                        }
                    };

                    ensureRenderMethods(plane);

                    // Add to the AR scene
                    const anchor = mindarThree.addAnchor(0);
                    anchor.group.add(plane);

                    // Make sure the anchor group also has the required methods
                    ensureRenderMethods(anchor.group);

                    // Add visual indicator when target is found
                    const targetFoundIndicator = new window.THREE.Mesh(
                        new window.THREE.RingGeometry(0.6, 0.65, 32),
                        new window.THREE.MeshBasicMaterial({
                            color: 0x00ff00,
                            transparent: true,
                            opacity: 0.5,
                            side: window.THREE.DoubleSide
                        })
                    );
                    targetFoundIndicator.position.z = -0.1;
                    targetFoundIndicator.visible = false;
                    ensureRenderMethods(targetFoundIndicator); // Apply method to indicator too
                    anchor.group.add(targetFoundIndicator);

                    // Flash the indicator when target is found
                    anchor.onTargetFound = () => {
                        console.log("🎯 Target found!");
                        targetFoundIndicator.visible = true;
                        setTimeout(() => {
                            targetFoundIndicator.visible = false;
                        }, 2000);
                    };
                    
                } catch (textureError) {
                    console.error("Error setting up 3D texture:", textureError);
                    // Continue anyway - AR might work without the texture
                }

                console.log("✅ 3D scene setup complete");
                setARReady(true);
                setLoadingStage("complete");

                // Use a more efficient render loop with frame skipping
                let lastFrame = 0;
                let frameCount = 0;
                // Replace the existing renderLoop function with this improved version
                // Make this change in the renderLoop function inside the initializeAR function

                // Replace the existing renderLoop function with this fixed version
                const renderLoop = (timestamp) => {
                    if (!textureRef.current || !canvasRef.current) return;

                    if (rootInstance && canvasRef.current) {
                        canvasRef.current.dispatchEvent(new Event('update'));
                    }

                    if (textureRef.current) {
                        textureRef.current.needsUpdate = true;
                    }

                    frameCount++;

                    const frameSkip = memoryInfo && memoryInfo.jsHeapSizeLimit < 2000000000 ? 3 : 2;
                    if (frameCount % frameSkip === 0 && timestamp - lastFrame > 20) {
                        textureRef.current.needsUpdate = true;
                        lastFrame = timestamp;
                    }

                    try {
                        if (scene && camera) {
                            // Render the scene
                            renderer.render(scene, camera);
                        }
                    } catch (renderError) {
                        console.error("Render error:", renderError);
                        if (renderError.message.includes('WebGL') || renderError.message.includes('context')) {
                            setContextLost(true);
                            renderer.setAnimationLoop(null);
                            return;
                        }
                    }

                    requestAnimationFrame(renderLoop); // Ensures smooth updates
                };


                renderer.setAnimationLoop(renderLoop);;

            } catch (error) {
                console.error("❌ AR initialization error:", error);

                // Clean up any partial initialization
                cleanupFunctions.forEach(fn => fn());

                // Provide more helpful error messages based on error type
                let userMessage = `AR initialization failed: ${error.message}`;

                if (error.message.includes("camera")) {
                    userMessage = "Camera access denied. Please allow camera access and try again.";
                } else if (error.message.includes("timeout")) {
                    userMessage = "Camera startup timed out. Try closing other applications using your camera.";
                } else if (error.message.includes("WebGL") || error.message.includes("context")) {
                    userMessage = "Graphics error. Try closing other graphics-intensive apps or reloading the page.";
                }

                setErrorMessage(userMessage);
                setLoadingStage("error");
            }
        };

        // Start the initialization process
        initializeAR();

        // Cleanup function - run all collected cleanup functions
        return () => {
            cleanupFunctions.forEach(fn => {
                try {
                    fn();
                } catch (e) {
                    console.warn("Cleanup error:", e);
                }
            });

            // Reset refs
            textureRef.current = null;
            canvasRef.current = null;
            mindarInstanceRef.current = null;
            rendererRef.current = null;
        };
    }, [loadingStage, projectData, targetPath, recoveryAttempt]);

    // Handle component unmount cleanly
    useEffect(() => {
        return () => {
            // Stop camera tracks
            if (cameraStreamRef) {
                cameraStreamRef.getTracks().forEach(track => track.stop());
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
    }, [cameraStreamRef, rootInstance]);

    // Monitor for memory leaks
    useEffect(() => {
        const memoryMonitor = setInterval(() => {
            if (performance && performance.memory) {
                const usedHeap = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
                const totalHeap = Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024));
                const usagePercent = Math.round((usedHeap / totalHeap) * 100);

                if (usagePercent > 80) {
                    console.warn(`⚠️ High memory usage: ${usagePercent}% (${usedHeap}MB / ${totalHeap}MB)`);
                }
            }
        }, 10000);

        return () => clearInterval(memoryMonitor);
    }, []);

    // Create a more descriptive loading message based on current stage
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
            case "loadingMindAR":
                return "Loading AR library...";
            case "mindARReady":
                return "AR library loaded";
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
            "loadingMindAR",
            "mindARReady",
            "checkingWebGL",
            "webGLReady",
            "initializingAR",
            "cameraReady",
            "arStarted",
            "complete"
        ];

        const currentIndex = stages.indexOf(loadingStage);
        if (currentIndex === -1 || loadingStage === "error" || loadingStage === "contextLost") return 0;
        return Math.round((currentIndex / (stages.length - 1)) * 100);
    };

    return (
        <>
            <div
                ref={containerRef}
                style={{
                    width: "100%",
                    height: "100%",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    overflow: "hidden",
                    zIndex: 5, // Ensure visibility
                    background: arReady ? "transparent" : "rgba(0, 0, 0, 0.2)" // Helps see if container is rendering
                }}
            />

            {/* Debug info overlay - only visible during development */}
            {arReady && (
                <div style={{
                    position: "fixed",
                    top: "10px",
                    left: "10px",
                    background: "rgba(0,0,0,0.7)",
                    color: "white",
                    padding: "10px",
                    borderRadius: "5px",
                    fontSize: "12px",
                    zIndex: 1000
                }}>
                    AR Active - Point at target
                </div>
            )}

            {!arReady && (
                <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    textAlign: "center",
                    color: "white",
                    background: "rgba(0,0,0,0.7)",
                    padding: "20px",
                    borderRadius: "10px",
                    width: "80%",
                    maxWidth: "400px",
                    zIndex: 1000
                }}>
                    <h3>Loading AR Experience</h3>
                    {loadingStage === "error" ? (
                        <div>
                            <p>{errorMessage}</p>
                            <p style={{ fontSize: "14px", opacity: 0.8, marginTop: "10px" }}>
                                {contextLost ? "Error code: WebGL context lost" : "Error initializing AR"}
                            </p>
                        </div>
                    ) : (
                        <div>
                            <p>{getLoadingMessage()}</p>

                            {loadingStage !== "complete" && loadingStage !== "error" && loadingStage !== "contextLost" && (
                                <div style={{ marginTop: "15px" }}>
                                    <div style={{
                                        width: "100%",
                                        height: "10px",
                                        backgroundColor: "rgba(255,255,255,0.2)",
                                        borderRadius: "5px",
                                        overflow: "hidden"
                                    }}>
                                        <div style={{
                                            width: `${getProgressPercentage()}%`,
                                            height: "100%",
                                            backgroundColor: "#4285f4",
                                            transition: "width 0.3s ease-in-out"
                                        }} />
                                    </div>
                                    <p style={{ fontSize: "12px", marginTop: "5px" }}>{getProgressPercentage()}%</p>
                                </div>
                            )}

                            {loadingStage === "contextLost" && (
                                <div style={{ marginTop: "10px", display: "flex", justifyContent: "center" }}>
                                    <div style={{
                                        width: "30px",
                                        height: "30px",
                                        border: "3px solid rgba(255,255,255,0.3)",
                                        borderTop: "3px solid white",
                                        borderRadius: "50%",
                                        animation: "spin 1s linear infinite"
                                    }}></div>
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
                    {(loadingStage === "error" || loadingStage === "contextLost") && recoveryAttempt > 2 && (
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                marginTop: "15px",
                                padding: "8px 16px",
                                background: "#4285f4",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer"
                            }}
                        >
                            Reload Page
                        </button>
                    )}
                    {loadingStage === "error" && (
                        <button
                            onClick={() => setRecoveryAttempt(prev => prev + 1)}
                            style={{
                                marginTop: "15px",
                                padding: "8px 16px",
                                background: "#4285f4",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                marginLeft: "10px"
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