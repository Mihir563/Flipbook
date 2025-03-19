import { Environment, OrbitControls } from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
import { useRef, useEffect, useMemo } from "react";
import { Book } from "./Book"; 
import * as THREE from "three";

export const Experience = ({ projectData, autoPlay, isARMode = false }) => {
  const { gl, scene, camera } = useThree();
  const groupRef = useRef();

  // Ensure the Experience component is actively rendering
  useFrame(() => {
    if (groupRef.current) {
      // Make sure the group is visible and updateable
      groupRef.current.visible = true;

      // You can add small rotation animation to verify rendering is working
      // groupRef.current.rotation.y += 0.005;
    }
  });

  useEffect(() => {
    // Log to verify the component is mounting with data
    console.log("Experience mounting with project data:", !!projectData);

    // Make sure THREE is available globally for MindAR to use
    if (typeof window !== 'undefined') {
      window.THREE = THREE;
    }

    // Force an initial render to ensure content is visible
    const forceUpdate = () => {
      if (gl && gl.domElement) {
        gl.render(scene, camera);
        gl.domElement.dispatchEvent(new Event('update'));
      }
    };

    // Call initial force update and schedule several more
    forceUpdate();
    const updateTimers = [100, 500, 1000, 2000].map(
      delay => setTimeout(forceUpdate, delay)
    );

    return () => {
      updateTimers.forEach(clearTimeout);
    };
  }, [gl, scene, camera, projectData]);

  // Add AR-specific adjustments
  const bookConfig = useMemo(() => {
    if (isARMode) {
      return {
        position: [0, 0, -0.5], // Closer to camera in AR
        scale: [0.15, 0.15, 0.15], // Smaller scale for AR
        rotation: [-Math.PI / 2, 0, 0] // Flat orientation for AR target
      };
    }
    return {
      position: [0, 0, 0],
      scale: [1, 1, 1],
      rotation: [-Math.PI / 10, 0, 0]
    };
  }, [isARMode]);

  // If project data isn't available yet, render a placeholder
  if (!projectData) {
    return (
      <mesh>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshBasicMaterial color="hotpink" />
      </mesh>
    );
  }

  return (
    <>
      <Book
        ref={groupRef}
        position={bookConfig.position}
        rotation={bookConfig.rotation}
        scale={bookConfig.scale}
        autoPlay={autoPlay}
        projectData={projectData}
      />
      
      {!isARMode && (
        <>
          <OrbitControls
            enableRotate={false}
            enablePan={false}
            enableZoom={true}
          />
          <Environment preset="city" />
          <directionalLight
            position={[2, 6, 4]}
            intensity={0.5}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-bias={-0.0001}
          />
          <mesh position-y={-1.5} rotation-x={-Math.PI / 8} receiveShadow>
            <planeGeometry args={[10, 10]} />
            <shadowMaterial transparent opacity={0.1} />
          </mesh>
        </>
      )}
    </>
  );
};