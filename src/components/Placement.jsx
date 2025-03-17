import { useEffect, useState, useRef } from "react";
import { useXR, useInteraction } from "@react-three/xr";
import { Book } from "./Book";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Text } from "@react-three/drei";

export const ARBook = ({ projectData, autoPlay = false }) => {
  const [placed, setPlaced] = useState(false);
  const [placementMode, setPlacementMode] = useState(true);
  const { isPresenting, session } = useXR();
  const bookRef = useRef();
  const reticleRef = useRef();
  const placementMeshRef = useRef();
  const resetButtonRef = useRef();
  const placementPosition = useRef(new THREE.Vector3(0, 0, -1));

  // Only try to use AR features when a session exists
  const hasActiveSession = !!session;
  
  // Set up interactions
  useInteraction(placementMeshRef, 'onSelect', handlePlacement);
  useInteraction(resetButtonRef, 'onSelect', resetPlacement);
  
  // Create a cursor for AR placement
  const reticle = (
    <mesh 
      ref={reticleRef} 
      rotation-x={-Math.PI / 2}
      visible={placementMode && isPresenting && hasActiveSession}
    >
      <ringGeometry args={[0.15, 0.2, 32]} />
      <meshStandardMaterial color="#4285F4" opacity={0.5} transparent />
      <Text
        position={[0, 0, 0.1]}
        rotation-x={Math.PI / 2}
        fontSize={0.05}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        Tap to place book
      </Text>
    </mesh>
  );

  
  if (!navigator.xr) {
    console.error("WebXR not supported on this browser.");
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/90 z-40 p-4">
        <div className="bg-red-900/50 border border-red-800 rounded-lg p-4 sm:p-6 max-w-xs sm:max-w-sm md:max-w-md text-center">
          <h2 className="text-lg sm:text-xl font-bold mb-2">
            AR Mode Not Supported
          </h2>
          <p className="mb-4 text-sm sm:text-base">
            Your browser does not support WebXR, which is required for AR mode.
          </p>
        </div>
      </div>
    );
  }
  
  // Use simplified placement logic
  useFrame((state, delta) => {
    if (placementMode && reticleRef.current && hasActiveSession) {
      // Make the reticle follow the camera at a fixed distance
      const camera = state.camera;
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      
      const position = new THREE.Vector3()
        .copy(camera.position)
        .add(direction.multiplyScalar(2));
      
      position.y = 0; // Keep it at ground level
      reticleRef.current.position.copy(position);
    }
    
    // Slight floating animation when placed
    if (placed && bookRef.current) {
      bookRef.current.position.y = placementPosition.current.y + Math.sin(state.clock.elapsedTime * 0.5) * 0.02;
    }
  });
  
  // Handle placement
  function handlePlacement(e) {
    if (placementMode && reticleRef.current && hasActiveSession) {
      // Store the placement position
      placementPosition.current.copy(reticleRef.current.position);
      
      // Hide the reticle and exit placement mode
      reticleRef.current.visible = false;
      setPlacementMode(false);
      setPlaced(true);
    }
  }
  
  // Reset placement
  function resetPlacement() {
    if (reticleRef.current && hasActiveSession) {
      reticleRef.current.visible = true;
    }
    setPlacementMode(true);
    setPlaced(false);
  }
  
  // Handle exit from AR
  useEffect(() => {
    if (!isPresenting && placed) {
      setPlacementMode(true);
      setPlaced(false);
    }
  }, [isPresenting, placed]);
  
  return (
    <>
      {/* Reticle for placement */}
      {hasActiveSession && reticle}
      
      {/* Interactive area for placement */}
      {hasActiveSession && placementMode && (
        <mesh 
          ref={placementMeshRef}
          visible={false} 
          position={[0, 0, -0.5]}
        >
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
      
      {/* Book with placement controls */}
      {hasActiveSession && placed && (
        <group 
          position={placementPosition.current}
          ref={bookRef}
        >
          <Book 
            position={[0, 0, 0]} 
            rotation={[-Math.PI / 10, 0, 0]}
            projectData={projectData}
            autoPlay={autoPlay}
          />
          
          {/* Reset button */}
          <mesh 
            ref={resetButtonRef}
            position={[0, -0.5, 0]} 
            rotation-x={-Math.PI / 2}
          >
            <circleGeometry args={[0.15, 32]} />
            <meshStandardMaterial color="#F44336" />
            <Text
              position={[0, 0, 0.01]}
              rotation-x={Math.PI / 2}
              fontSize={0.05}
              color="white"
              anchorX="center"
              anchorY="middle"
            >
              Reset
            </Text>
          </mesh>
        </group>
      )}
      
      {/* Default position when not placed */}
      {hasActiveSession && isPresenting && !placed && !placementMode && (
        <Book 
          position={[0, 0, -1]} 
          rotation={[-Math.PI / 10, 0, 0]}
          projectData={projectData}
          autoPlay={autoPlay}
        />
      )}
      
      {/* Fallback for non-AR mode */}
      {!hasActiveSession && (
        <Book 
          position={[0, 0, -1]} 
          rotation={[-Math.PI / 10, 0, 0]}
          projectData={projectData}
          autoPlay={autoPlay}
        />
      )}
    </>
  );
};