// src/components/Experience.jsx
import { Environment, OrbitControls } from "@react-three/drei";
import { useXR } from "@react-three/xr";
import { Book } from "./Book";
import { ARBook } from "./Placement";

export const Experience = ({ projectData, autoPlay = false, isARMode = false }) => {
  // Get XR state directly from the hook
  const { isPresenting } = useXR();
  
  // Use either the XR state or the prop based on what's available
  const showARContent = isPresenting || isARMode;
  
  return (
    <>
      {showARContent ? (
        <ARBook 
          projectData={projectData} 
          autoPlay={autoPlay} 
        />
      ) : (
        <>
          <Book 
            position={[0, 0, 0]} 
            rotation={[-Math.PI / 10, 0, 0]}
            projectData={projectData}
            autoPlay={autoPlay}
          />
          <OrbitControls
            enableRotate={false}
            enablePan={false}
            enableZoom={false}
          />
        </>
      )}
      
      {/* Common elements for both modes */}
      <Environment preset="city" />
      <directionalLight
        position={[2, 6, 4]}
        intensity={0.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
      />
      
      {/* Only add floor shadow when not in AR mode */}
      {!showARContent && (
        <mesh position-y={-1.5} rotation-x={-Math.PI / 8} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <shadowMaterial transparent opacity={0.1} />
        </mesh>
      )}
    </>
  );
};