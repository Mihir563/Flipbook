import React from "react";
import { Box, Text } from "@react-three/drei";

// Enhanced TestComponent with better visibility and positioning
export const TestComponent = () => {
  return (
    <group position={[0, 0, 0.1]} className="r3f-test">
      {/* Larger, brighter box for better visibility */}
      <mesh position={[0, 0, 0]} scale={1.2}>
        <boxGeometry args={[0.7, 0.7, 0.7]} />
        <meshStandardMaterial
          color="#ff3060"
          emissive="#ff3060"
          emissiveIntensity={1}
          toneMapped={false} // Ensures bright colors in AR
        />
      </mesh>

      {/* Add text label for debugging */}
      <Text
        position={[0, 1, 0]}
        fontSize={0.2}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        toneMapped={false}
      >
        Test Component
      </Text>
    </group>
  );
};
