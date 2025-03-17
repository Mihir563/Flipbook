// src/components/XRProvider.jsx
import React from 'react';
import { useThree } from '@react-three/fiber';
import { XR as ThreeXR } from '@react-three/xr';
import { ErrorBoundary } from 'react-error-boundary';

const ErrorFallback = ({ error }) => {
  console.error("XR Error:", error);
  return null;
};

// This component ensures XR has access to the Three.js context
const XRInternal = ({ children }) => {
  // Use the Three.js context first
  const three = useThree();
  
  // Now that we have Three.js context, we can render XR
  return <ThreeXR>{children}</ThreeXR>;
};

export function XRProvider({ children }) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      {/* We're not rendering ThreeXR here directly - it will be rendered by XRInternal */}
      {children}
    </ErrorBoundary>
  );
}