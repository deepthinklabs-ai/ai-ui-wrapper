/**
 * Cable Box 3D Scene Component
 *
 * Top-down 3D view of AI characters in The Cable Box.
 * Optimized for low-end PCs with simple geometry.
 */

"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrthographicCamera, Text } from "@react-three/drei";
import type { Character } from "@/types/cablebox";
import * as THREE from "three";

type CableBoxSceneProps = {
  characters: Character[];
  onCharacterClick?: (characterId: string) => void;
};

/**
 * Individual character in the scene
 */
function CharacterMesh({
  character,
  onClick,
}: {
  character: Character;
  onClick?: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const textRef = useRef<any>(null);

  // Subtle floating animation when thinking
  useFrame((state) => {
    if (meshRef.current && character.isThinking) {
      meshRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
    } else if (meshRef.current) {
      meshRef.current.position.y = 0.5;
    }

    // Make text always face camera
    if (textRef.current) {
      textRef.current.quaternion.copy(state.camera.quaternion);
    }
  });

  return (
    <group position={[character.position.x, 0, character.position.z]}>
      {/* Character body - simple cylinder */}
      <mesh
        ref={meshRef}
        position={[0, 0.5, 0]}
        onClick={onClick}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "default")}
      >
        <cylinderGeometry args={[0.4, 0.4, 1, 8]} />
        <meshStandardMaterial
          color={character.color}
          emissive={character.isThinking ? character.color : "#000000"}
          emissiveIntensity={character.isThinking ? 0.3 : 0}
        />
      </mesh>

      {/* Character name */}
      <Text
        ref={textRef}
        position={[0, 1.5, 0]}
        fontSize={0.3}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {character.name}
      </Text>

      {/* Thinking indicator */}
      {character.isThinking && (
        <Text
          position={[0, 2, 0]}
          fontSize={0.4}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          ...
        </Text>
      )}

      {/* Shadow circle */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

/**
 * Ground plane with grid
 */
function Ground() {
  const gridHelper = useMemo(() => {
    return new THREE.GridHelper(30, 30, "#444444", "#222222");
  }, []);

  return (
    <>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Grid */}
      <primitive object={gridHelper} />
    </>
  );
}

/**
 * Main 3D scene
 */
export default function CableBoxScene({ characters, onCharacterClick }: CableBoxSceneProps) {
  return (
    <div className="w-full h-full bg-slate-950">
      <Canvas
        shadows={false} // Disable shadows for performance
        gl={{
          antialias: true,
          powerPreference: "low-power", // Optimize for low-end devices
        }}
      >
        {/* Top-down camera */}
        <OrthographicCamera
          makeDefault
          position={[0, 20, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          zoom={30}
        />

        {/* Lighting - simple setup for performance */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={0.4} />

        {/* Ground */}
        <Ground />

        {/* Characters */}
        {characters.map((character) => (
          <CharacterMesh
            key={character.id}
            character={character}
            onClick={() => onCharacterClick?.(character.id)}
          />
        ))}
      </Canvas>
    </div>
  );
}
