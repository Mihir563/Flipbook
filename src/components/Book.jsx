import { useCursor, useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useAtom } from "jotai";
import { easing } from "maath";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bone,
  BoxGeometry,
  Color,
  Float32BufferAttribute,
  MathUtils,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  Uint16BufferAttribute,
  Vector3,
  Vector2,
} from "three";
import { degToRad } from "three/src/math/MathUtils.js";
import { pageAtom, pages, splitImageModeAtom } from "./UI";

// Reduced animation settings for a steady book
const easingFactor = 0.3;
const easingFactorFold = 0;
const insideCurveStrength = 0.158;
const outsideCurveStrength = 0;
const turningCurveStrength = 0;

const PAGE_WIDTH = 2.6;
const PAGE_HEIGHT = 1.92;
const PAGE_DEPTH = 0.003;
const PAGE_SEGMENTS = 160;
const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS;

// Add new atoms for autoplay functionality
import { atom } from "jotai";
export const autoPlayAtom = atom(false);
export const autoPlaySpeedAtom = atom(3000); // milliseconds between page turns

const pageGeometry = new BoxGeometry(
  PAGE_WIDTH,
  PAGE_HEIGHT,
  PAGE_DEPTH,
  PAGE_SEGMENTS,
  2
);

pageGeometry.translate(PAGE_WIDTH / 2, 0, 0);

const position = pageGeometry.attributes.position;
const vertex = new Vector3();
const skinIndexes = [];
const skinWeights = [];

for (let i = 0; i < position.count; i++) {
  // ALL VERTICES
  vertex.fromBufferAttribute(position, i); // get the vertex
  const x = vertex.x; // get the x position of the vertex

  const skinIndex = Math.max(0, Math.floor(x / SEGMENT_WIDTH)); // calculate the skin index
  let skinWeight = (x % SEGMENT_WIDTH) / SEGMENT_WIDTH; // calculate the skin weight

  skinIndexes.push(skinIndex, skinIndex + 1, 0, 0); // set the skin indexes
  skinWeights.push(1 - skinWeight, skinWeight, 0, 0); // set the skin weights
}

pageGeometry.setAttribute(
  "skinIndex",
  new Uint16BufferAttribute(skinIndexes, 4)
);
pageGeometry.setAttribute(
  "skinWeight",
  new Float32BufferAttribute(skinWeights, 4)
);

const whiteColor = new Color("white");
const defaultColor = new Color("white");

const pageMaterials = [
  new MeshStandardMaterial({
    color: "",
  }),
  new MeshStandardMaterial({
    color: "",
  }),
  new MeshStandardMaterial({
    color: "",
  }),
  new MeshStandardMaterial({
    color: "",
  }),
];

const Page = ({
  number,
  front,
  back,
  page,
  opened,
  bookClosed,
  splitImages = false,
  frontIndex = 0,
  backIndex = 1,
  isCover = false,
  autoPlay = false,
  ...props
}) => {
  // Load textures directly from URLs
  const [frontTexture, backTexture] = useTexture([front, back]);
  frontTexture.colorSpace = backTexture.colorSpace = SRGBColorSpace;
  const group = useRef();
  const turnedAt = useRef(0);
  const lastOpened = useRef(opened);
  const skinnedMeshRef = useRef();
  const [isPlaying, setIsPlaying] = useState(autoPlay);

  useEffect(() => {
    if (isPlaying) {
      setIsPlaying(false);
    }
  }, [isPlaying]);
  
  const manualSkinnedMesh = useMemo(() => {
    const bones = [];
    for (let i = 0; i <= PAGE_SEGMENTS; i++) {
      let bone = new Bone();
      bones.push(bone);
      if (i === 0) {
        bone.position.x = 0;
      } else {
        bone.position.x = SEGMENT_WIDTH;
      }
      if (i > 0) {
        bones[i - 1].add(bone);
      }
    }
    const skeleton = new Skeleton(bones);

    let frontMaterial, backMaterial;

    // Front of cover is always full image
    frontMaterial = new MeshStandardMaterial({
      color: "",
      map: frontTexture,
      roughness: 0.1,
    });

    // Back of cover should be split if in split image mode
    if (isCover && splitImages) {
      const backTextureClone = backTexture.clone();

      // Set texture repeat to show only half the image for back texture
      backTextureClone.repeat.set(0.52, 1);

      // Back of cover should show left half of the image
      backTextureClone.offset.set(0, 0);

      backTextureClone.needsUpdate = true;

      backMaterial = new MeshStandardMaterial({
        color: "",
        map: backTextureClone,
        roughness: 0.1,
      });
    } else if (splitImages && !isCover) {
      // For split image mode on regular pages:
      const frontTextureClone = frontTexture.clone();
      const backTextureClone = backTexture.clone();

      // Set texture repeat to show only half the image for both textures
      frontTextureClone.repeat.set(0.5, 1);
      backTextureClone.repeat.set(0.52, 1);

      // Front (right side of page): right half of image
      frontTextureClone.offset.set(0.5, 0);
      // Back (left side of page): left half of next image
      backTextureClone.offset.set(0, 0);

      frontTextureClone.needsUpdate = true;
      backTextureClone.needsUpdate = true;

      frontMaterial = new MeshStandardMaterial({
        color: "",
        map: frontTextureClone,
        roughness: 0.1,
      });

      backMaterial = new MeshStandardMaterial({
        color: "",
        map: backTextureClone,
        roughness: 0.1,
      });
    } else {
      // / **Full Pages (No split, use full image)**
      frontMaterial = new MeshStandardMaterial({
        color: "",
        map: frontTexture,
        roughness: 0.1,
      });

      backMaterial = new MeshStandardMaterial({
        color: "",
        map: backTexture,
        roughness: 0.1,
      });

      // **Ensure full-page properties**
      frontTexture.repeat.set(1.02, 1);
      frontTexture.offset.set(0, 0);
      backTexture.repeat.set(1.02, 1);
      backTexture.offset.set(0, 0);

      frontTexture.needsUpdate = true;
      backTexture.needsUpdate = true;
    }

    const materials = [...pageMaterials, frontMaterial, backMaterial];

    const mesh = new SkinnedMesh(pageGeometry, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.add(skeleton.bones[0]);
    mesh.bind(skeleton);
    return mesh;
  }, [frontTexture, backTexture, splitImages, isCover]);

  useFrame((_, delta) => {
    if (!skinnedMeshRef.current) {
      return;
    }

    if (lastOpened.current !== opened) {
      turnedAt.current = +new Date();
      lastOpened.current = opened;
    }

    // Faster page transition for stability
    let turningTime = Math.min(200, new Date() - turnedAt.current) / 200;
    turningTime = Math.sin(turningTime * Math.PI);

    let targetRotation = opened ? -Math.PI / 2 : Math.PI / 2; // left pages angle
    if (!bookClosed) {
      // Reduced angle for stability
      targetRotation += degToRad(number * 0.4);
    }

    const bones = skinnedMeshRef.current.skeleton.bones;
    for (let i = 0; i < bones.length; i++) {
      const target = i === 0 ? group.current : bones[i];

      const insideCurveIntensity = i < 8 ? Math.sin(i * 0.2 + 0.25) : 0;
      const outsideCurveIntensity = i >= 8 ? Math.cos(i * 0.3 + 0.09) : 0;
      const turningIntensity =
        Math.sin(i * Math.PI * (1 / (bones.length - 1))) * turningTime;

      let rotationAngle =
        insideCurveStrength * insideCurveIntensity * targetRotation -
        outsideCurveStrength * outsideCurveIntensity * targetRotation +
        turningCurveStrength * turningIntensity * targetRotation;

      // Reduced fold angle for stability
      let foldRotationAngle = degToRad(Math.sign(targetRotation) * 0.2);

      if (bookClosed) {
        if (i === 0) {
          rotationAngle = targetRotation;
          foldRotationAngle = 0;
        } else {
          rotationAngle = 0;
          foldRotationAngle = 0;
        }
      }

      easing.dampAngle(
        target.rotation,
        "y",
        rotationAngle,
        easingFactor,
        delta
      );

      const foldIntensity =
        i > 8
          ? Math.sin(i * Math.PI * (1 / bones.length) - 0.5) * turningTime
          : 0;

      easing.dampAngle(
        target.rotation,
        "x",
        foldRotationAngle * foldIntensity,
        easingFactorFold,
        delta
      );
    }
  });

  const [_, setPage] = useAtom(pageAtom);
  const [hovered, setHovered] = useState(false);
  const [canClick, setCanClick] = useState(true);

  useCursor(hovered);

  return (
    <group
      {...props}
      ref={group}
      onPointerEnter={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHovered(false);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!canClick) return;

        setCanClick(false);
        setPage(opened ? number : number + 1);
        setHovered(false);

        // Increase the delay before allowing another click
        setTimeout(() => {
          setCanClick(true);
        }, 500);
      }}
    >
      <primitive
        object={manualSkinnedMesh}
        ref={skinnedMeshRef}
        position-z={-number * PAGE_DEPTH * 1.01 + page * PAGE_DEPTH * 0.01}
      />
    </group>
  );
};

export const Book = ({ autoPlay = false, autoPlaySpeed = 3000, ...props }) => {
  const [page, setPage] = useAtom(pageAtom);
  const [splitImageMode] = useAtom(splitImageModeAtom);
  const [delayedPage, setDelayedPage] = useState(page);
  const [isAutoPlaying, setIsAutoPlaying] = useAtom(autoPlayAtom);
  const [autoPlayInterval, setAutoPlayInterval] = useAtom(autoPlaySpeedAtom);
  const autoPlayTimerRef = useRef(null);
  const bookGroupRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  // Initialize autoPlay from props
  useEffect(() => {
    setIsAutoPlaying(autoPlay);
    setAutoPlayInterval(autoPlaySpeed);
  }, [autoPlay, autoPlaySpeed, setIsAutoPlaying, setAutoPlayInterval]);

  const { viewport, size } = useThree();

  // Enhanced responsive scaling
  const scale = useMemo(() => {
    const { width, height } = viewport;
    const { width: screenWidth } = size;
    const minDimension = Math.min(width, height);
    let baseScale = minDimension / 4;

    if (screenWidth < 480) {
      baseScale *= 0.7;
    } else if (screenWidth < 768) {
      baseScale *= 0.8;
    } else if (screenWidth < 1024) {
      baseScale *= 0.9;
    }
    
    baseScale *= 1.15;
    return Math.max(0.4, Math.min(1.8, baseScale));
  }, [viewport.width, viewport.height, size.width]);

  // Update isOpen state when page changes
  useEffect(() => {
    if (page > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [page]);

  // Animation for book opening/closing transition
  useFrame((state, delta) => {
    if (!bookGroupRef.current) return;
    
    // Center position when closed, offset when open
    const targetPositionX = isOpen ? -1.3 : 0;
    
    // Smooth transition for position
    easing.damp3(
      bookGroupRef.current.position,
      [targetPositionX, 0, 0],
      0.15,
      delta
    );
    
    // Gradually change Y-rotation when opening/closing
    const targetRotationY = isOpen ? -Math.PI / 2 : -Math.PI / 2.5;
    easing.dampAngle(
      bookGroupRef.current.rotation,
      "y",
      targetRotationY,
      0.15,
      delta
    );
    
    // Z-axis rotation (tilt) adjustment
    const targetRotationZ = isOpen ? 0.02 : 0.1;
    easing.dampAngle(
      bookGroupRef.current.rotation,
      "z",
      targetRotationZ,
      0.15,
      delta
    );
  });
  // Function to get the appropriate pages for book
  const getPagesForBook = () => {
    if (!splitImageMode) {
      return pages
        .map((pageData, index) => ({
          ...pageData,
          number: index,
        }))
        .slice(0, -1);
    }

    // For split image mode, create a new array with proper pairing
    const organizedPages = [];

    // First add the cover (front is full image, back should be part of the split)
    if (pages.length > 0 && pages[0].isCover) {
      // Get the next page to link with back of cover if available
      const nextPage = pages.length > 1 ? pages[1] : null;

      organizedPages.push({
        ...pages[0],
        // If there's a next page, use its front image for the back of the cover
        back: nextPage ? nextPage.front : pages[0].back,
        number: 0,
      });
    }

    // Then add the regular pages with proper pairing for split images
    // Start from index 1 if there's a cover, otherwise from 0
    const startIndex = pages[0].isCover ? 1 : 0;

    // Skip the page that was used for the back of the cover
    for (let i = startIndex; i < pages.length; i++) {
      // Get current page data
      const currentPage = pages[i];
      // Get next page data if available
      const nextPage = i + 1 < pages.length ? pages[i + 1] : null;

      organizedPages.push({
        ...currentPage,
        // If it's not the last page, back should be the next page's front
        back: nextPage ? nextPage.front : currentPage.back,
        number: organizedPages.length,
      });
    }

    return organizedPages.slice(0, -1);
  };

  const organizedPages = getPagesForBook();
  const totalPages = organizedPages.length;

  // Auto-play functionality
  useEffect(() => {
    if (isAutoPlaying) {
      // Clear any existing timer
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }

      // Set up new timer for page turning
      autoPlayTimerRef.current = setInterval(() => {
        setPage(currentPage => {
          // Check if we're at the last page
          if (currentPage >= totalPages) {
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
  }, [isAutoPlaying, autoPlayInterval, setPage, totalPages]);

  useEffect(() => {
    // Clear all previous timeouts when page changes
    const timeoutIds = [];
    let isTransitioning = false;

    const goToPage = () => {
      if (isTransitioning) return;

      setDelayedPage((currentDelayedPage) => {
        if (page === currentDelayedPage) {
          isTransitioning = false;
          return currentDelayedPage;
        } else {
          isTransitioning = true;
          const nextPage =
            page > currentDelayedPage
              ? currentDelayedPage + 1
              : currentDelayedPage - 1;

          const timeoutId = setTimeout(() => {
            isTransitioning = false;
            goToPage();
          }, 500); // Increased timing for more stability

          timeoutIds.push(timeoutId);
          return nextPage;
        }
      });
    };

    // Start the transition
    goToPage();

    // Cleanup function
    return () => {
      timeoutIds.forEach((id) => clearTimeout(id));
    };
  }, [page]);

  return (
    <group {...props} rotation-y={-Math.PI / 2} rotation-z={0.1} rotation-x={-0.2} scale={[scale, scale, scale]}  >
      {organizedPages.map((pageData, index) => (
        <Page
          key={index}
          front={pageData.front}
          back={pageData.back}
          page={delayedPage}
          number={pageData.number}
          opened={delayedPage > pageData.number}
          bookClosed={
            delayedPage === 0 || delayedPage === organizedPages.length
          }
          splitImages={splitImageMode}
          frontIndex={pageData.frontIndex || 0}
          backIndex={pageData.backIndex || 0}
          isCover={pageData.isCover || false}
          {...pageData}
        />
      ))}
    </group>
  );
};
