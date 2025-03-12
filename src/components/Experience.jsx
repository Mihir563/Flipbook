import { Environment, OrbitControls } from "@react-three/drei";
import { Book } from "./Book";

export const Experience = ({ projectData }) => {
  return (
    <>
      <Book position={[0, 0, 0]} rotation={[-Math.PI / 10, 0, 0]} />
      <OrbitControls
        enableRotate={false}
        enablePan={false}
        enableZoom={false}
      />
      <Environment preset="city"></Environment>
      <directionalLight
<<<<<<< HEAD
        position={[2, 6, 4]}
=======
        position={[2, 5, 5]}
>>>>>>> afe0522263be6c4cfefa0273cc5a342116f7e4a5
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
  );
};
