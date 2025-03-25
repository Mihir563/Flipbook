import React, { useRef, useEffect } from "react";
import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders";
import "@babylonjs/inspector";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";


const Flipbook = () => {
  const sceneRef = useRef(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // 📝 Create book cover
    const bookCover = BABYLON.MeshBuilder.CreateBox(
      "cover",
      { width: 2.8, height: 1.92, depth: 0.1 },
      scene
    );
    bookCover.position.y = 1;

    // 📄 Create book pages
    const pages = [];
    for (let i = 0; i < 10; i++) {
      const page = BABYLON.MeshBuilder.CreatePlane(
        `page-${i}`,
        { width: 2.6, height: 1.92 },
        scene
      );
      page.position.z = -i * 0.005;
      pages.push(page);
    }

    // 🦴 Add Bones for Page Animation
    const skeleton = new BABYLON.Skeleton("flipbook-skeleton", "", scene);
    const bones = pages.map((_, i) => {
      const bone = new BABYLON.Bone(`bone-${i}`, skeleton);
      bone.setPosition(new BABYLON.Vector3(0, 0, -i * 0.005));
      return bone;
    });

    // Bind bones to pages
    pages.forEach((page, i) => page.attachToBone(bones[i], bookCover));

    // 📜 Texture Loading (Replace with API Images)
    const material = new BABYLON.StandardMaterial("pageMaterial", scene);
    material.diffuseTexture = new BABYLON.Texture("/page-image.jpg", scene);
    pages.forEach((page) => (page.material = material));

    // 📖 Page Turn Animation
    let currentPage = 0;
    const turnPage = () => {
      if (currentPage >= pages.length) return;
      BABYLON.Animation.CreateAndStartAnimation(
        "pageFlip",
        pages[currentPage],
        "rotation.y",
        30,
        30,
        0,
        Math.PI / 2,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      currentPage++;
    };

    // 🤖 Enable WebXR interactions
    scene.onPointerDown = () => turnPage();
  }, []);

  return <scene ref={sceneRef} />;
};
