import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh } from "three";
import { LAYOUT } from "../../core/layout";
import { LandmarkMarker } from "./Landmark";
import { Spin, useGlass, useGlow, useStd } from "./props";
import { SignSet, InstancedBoxes, type SignItem, type BoxItem } from "./common";
import { makeEnergyMaterial } from "../materials";

/** Nexus Transport Hub: glass concourse dome, orbital gantry with moving pods, hologram globe, sliding doors. */
export function NexusHub() {
  const { x, z } = LAYOUT.hub;
  const podium = useStd("#8e9aab", 0.6, 0.4);
  const metal = useStd("#c3ceda", 0.9, 0.2);
  const glass = useGlass(0.3, "#9fd8ff");
  const inner = useGlow("#ffd9a0", 1.8, 0.6, true, 0.28);
  const ring = useGlow("#8ab6ff", 3, 0.5);
  const ring2 = useGlow("#5ef2ff", 3, 0.5, true);
  const doorMat = useStd("#dbe8f5", 0.5, 0.1, { transparent: true, opacity: 0.55 });
  const orb = useMemo(() => makeEnergyMaterial("#6ab6ff", "sphere", 0.8), []);
  useEffect(() => () => orb.dispose(), [orb]);

  const legs = useMemo<BoxItem[]>(() => {
    const out: BoxItem[] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      out.push({ x: Math.cos(a) * 34, y: 0, z: Math.sin(a) * 34, sx: 2.2, sy: 30, sz: 2.2 });
    }
    return out;
  }, []);
  const signs = useMemo<SignItem[]>(() => [{ x: 0, y: 17, z: 22.6, sx: 18, sy: 4.5, ry: 0, sign: 8, phase: 0.2, tint: "#8ab6ff" }], []);

  const doorL = useRef<Mesh>(null);
  const doorR = useRef<Mesh>(null);
  const pods = useRef<Group>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const open = Math.max(0, Math.min(1, Math.sin(t * 0.5) * 1.6 + 0.5));
    const k = open * open * (3 - 2 * open);
    if (doorL.current) doorL.current.position.x = -2.1 - k * 2.0;
    if (doorR.current) doorR.current.position.x = 2.1 + k * 2.0;
    if (pods.current) pods.current.rotation.y = t * 0.22;
  });

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 3, 0]} material={podium} castShadow receiveShadow>
        <boxGeometry args={[44, 6, 44]} />
      </mesh>
      <mesh position={[0, 6.1, 0]} rotation={[Math.PI / 2, 0, 0]} material={ring2}>
        <torusGeometry args={[21.5, 0.25, 6, 4]} />
      </mesh>
      <mesh position={[0, 11, 0]} material={glass}>
        <cylinderGeometry args={[19, 19, 10, 48, 1, true]} />
      </mesh>
      <mesh position={[0, 11, 0]} material={inner}>
        <cylinderGeometry args={[17.5, 17.5, 9, 32]} />
      </mesh>
      <mesh position={[0, 16, 0]} material={glass}>
        <sphereGeometry args={[19, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* orbital gantry */}
      <mesh position={[0, 30, 0]} rotation={[Math.PI / 2, 0, 0]} material={metal} castShadow>
        <torusGeometry args={[34, 1.8, 14, 72]} />
      </mesh>
      <mesh position={[0, 31.9, 0]} rotation={[Math.PI / 2, 0, 0]} material={ring}>
        <torusGeometry args={[34, 0.35, 6, 96]} />
      </mesh>
      <InstancedBoxes items={legs} material={metal} castShadow />
      <group ref={pods} position={[0, 32.6, 0]}>
        {[0, 2.1, 4.2].map((a) => (
          <mesh key={a} position={[Math.cos(a) * 34, 0, Math.sin(a) * 34]} rotation={[0, -a, 0]} material={ring2}>
            <boxGeometry args={[6, 1.2, 2]} />
          </mesh>
        ))}
      </group>
      {/* hologram route globe */}
      <mesh position={[0, 46, 0]} material={orb}>
        <sphereGeometry args={[6, 32, 24]} />
      </mesh>
      <Spin speed={0.8} position={[0, 46, 0]}>
        <mesh material={ring2} rotation={[Math.PI / 2.5, 0, 0]}>
          <torusGeometry args={[9, 0.15, 6, 64]} />
        </mesh>
        <mesh material={ring} rotation={[-Math.PI / 3, 0.5, 0]}>
          <torusGeometry args={[11, 0.15, 6, 64]} />
        </mesh>
      </Spin>
      {/* sliding doors */}
      <mesh position={[0, 4, 22.2]} material={ring2}>
        <boxGeometry args={[9.4, 0.3, 0.3]} />
      </mesh>
      <mesh ref={doorL} position={[-2.1, 3, 22.1]} material={doorMat}>
        <boxGeometry args={[4.1, 5.6, 0.25]} />
      </mesh>
      <mesh ref={doorR} position={[2.1, 3, 22.1]} material={doorMat}>
        <boxGeometry args={[4.1, 5.6, 0.25]} />
      </mesh>
      <SignSet items={signs} mode="sign" />
      <LandmarkMarker id="nexus-hub" beamHeight={150} beamRadius={1.1} />
    </group>
  );
}
