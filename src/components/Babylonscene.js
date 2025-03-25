import { Engine, Scene } from "react-babylonjs";
import * as BABYLON from "@babylonjs/core";
import { useEffect, useRef } from "react";

const BabylonScene = () => {
    const sceneRef = useRef(null);

    useEffect(() => {
        const scene = sceneRef.current;
        if (!scene) return;

        const xrHelper = scene.createDefaultXRExperienceAsync({
            uiOptions: { sessionMode: "immersive-ar" },
        });

        return () => xrHelper.then(helper => helper.dispose());
    }, []);

    return (
        <Engine antialias adaptToDeviceRatio canvasId="babylon-canvas">
            <Scene ref={sceneRef}>
                <arcRotateCamera name="camera" alpha={Math.PI / 2} beta={Math.PI / 3} radius={5} />
                <hemisphericLight name="light" intensity={0.7} direction={new BABYLON.Vector3(1, 1, 0)} />
                <Flipbook />
            </Scene>
        </Engine>
    );
};
