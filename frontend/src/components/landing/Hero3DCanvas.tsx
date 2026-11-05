import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

function PearlescentSculpture() {
  const groupRef = useRef<THREE.Group>(null);
  const knotRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const bead1Ref = useRef<THREE.Mesh>(null);
  const bead2Ref = useRef<THREE.Mesh>(null);

  // Custom Pearlescent Frosted Glass Shader:
  // Strictly renders luminous white, silver, and ethereal emerald rim lights.
  // Never renders black or muddy shadows on transparent/white background.
  const glassShaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorBase: { value: new THREE.Color('#FFFFFF') },
        uColorEdge: { value: new THREE.Color('#A7F3D0') }, // Soft emerald light reflection (matches #047857 theme)
        uColorSilver: { value: new THREE.Color('#F1F5F9') }, // Crisp studio platinum
        uOpacity: { value: 0.8 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec2 vUv;
        varying vec3 vWorldNormal;

        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColorBase;
        uniform vec3 uColorEdge;
        uniform vec3 uColorSilver;
        uniform float uOpacity;

        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec2 vUv;
        varying vec3 vWorldNormal;

        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vViewPosition);

          // Fresnel factor: 0.0 in center (transparent), 1.0 at glancing edges
          float NdotV = max(dot(viewDir, normal), 0.0);
          float fresnel = 1.0 - NdotV;
          float fresnelPow = pow(fresnel, 2.4);

          // Prismatic dispersion along the ribbon curves
          float dispersion = sin(fresnel * 5.0 + uTime * 0.3) * 0.5 + 0.5;
          vec3 rimTone = mix(uColorSilver, uColorEdge, dispersion);

          // Studio Key & Rim Lights
          vec3 lightKey = normalize(vec3(0.6, 1.0, 0.8));
          vec3 halfKey = normalize(lightKey + viewDir);
          float specKey = pow(max(dot(normal, halfKey), 0.0), 36.0);

          vec3 lightRim = normalize(vec3(-0.8, -0.4, 0.6));
          vec3 halfRim = normalize(lightRim + viewDir);
          float specRim = pow(max(dot(normal, halfRim), 0.0), 24.0);

          // Base color composition: strictly pure white and light tones
          vec3 finalColor = mix(uColorBase, rimTone, fresnelPow * 0.7);
          finalColor += vec3(1.0) * (specKey * 0.9 + specRim * 0.4);

          // Airy alpha gradient: center is soft/transparent so text is 100% legible,
          // silhouette edges catch the light and frame the screen
          float alpha = mix(0.03, 0.38, fresnelPow) * uOpacity;

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, []);

  useFrame((state, delta) => {
    // Increment time uniform for gentle optical shimmer
    glassShaderMaterial.uniforms.uTime.value += delta;

    if (groupRef.current) {
      // Smooth cursor parallax tilt
      const targetRotX = (state.pointer.y * Math.PI) / 14;
      const targetRotY = (state.pointer.x * Math.PI) / 14;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        targetRotX,
        0.04
      );
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetRotY,
        0.04
      );
    }

    if (knotRef.current) {
      knotRef.current.rotation.x += delta * 0.08;
      knotRef.current.rotation.y += delta * 0.11;
    }

    if (ringRef.current) {
      ringRef.current.rotation.z -= delta * 0.05;
      ringRef.current.rotation.x += delta * 0.03;
    }

    if (bead1Ref.current) {
      bead1Ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.2 + 0.8;
    }
    if (bead2Ref.current) {
      bead2Ref.current.position.y = Math.cos(state.clock.elapsedTime * 0.7) * 0.2 - 0.7;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.05, 0]}>
      <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.35}>
        {/* Slender, sculptural ribbon knot with wide graceful curves */}
        <mesh ref={knotRef} scale={1.25} material={glassShaderMaterial}>
          <torusKnotGeometry args={[1.35, 0.13, 256, 32, 2, 3]} />
        </mesh>

        {/* Minimalist architectural orbital accent ring */}
        <mesh
          ref={ringRef}
          position={[0, 0, -0.3]}
          scale={2.2}
          rotation={[Math.PI / 3, 0, Math.PI / 6]}
          material={glassShaderMaterial}
        >
          <torusGeometry args={[1, 0.005, 16, 120]} />
        </mesh>

        {/* Subtle floating crystal beads */}
        <mesh
          ref={bead1Ref}
          position={[1.8, 0.8, -0.2]}
          scale={0.12}
          material={glassShaderMaterial}
        >
          <sphereGeometry args={[1, 32, 32]} />
        </mesh>
        <mesh
          ref={bead2Ref}
          position={[-1.7, -0.7, 0.1]}
          scale={0.09}
          material={glassShaderMaterial}
        >
          <sphereGeometry args={[1, 32, 32]} />
        </mesh>
      </Float>
    </group>
  );
}

export function Hero3DCanvas() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      <Canvas
        camera={{ position: [0, 0, 5.6], fov: 42 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={1.8} />
        <directionalLight position={[10, 12, 6]} intensity={2.5} color="#FFFFFF" />
        <directionalLight position={[-8, -6, -4]} intensity={1.2} color="#FFFFFF" />
        <PearlescentSculpture />
      </Canvas>
    </div>
  );
}
