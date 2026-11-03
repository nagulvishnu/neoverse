import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, DoubleSide, Group, Mesh, MeshStandardMaterial, type Material } from "three";
import { makeGlowMaterial } from "../materials";
import { InstancedBoxes, type BoxItem } from "./common";

/** Rotates children continuously. */
export function Spin({ speed = 0.2, axis = "y", children, position, rotation }: { speed?: number; axis?: "x" | "y" | "z"; children: ReactNode; position?: [number, number, number]; rotation?: [number, number, number] }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation[axis] += dt * speed;
  });
  return (
    <group position={position} rotation={rotation}>
      <group ref={ref}>{children}</group>
    </group>
  );
}

/** Shared glow material hook (disposed on unmount). */
export function useGlow(color: string | number, intensity = 2.5, base = 0.45, always = false, transparentOpacity?: number) {
  const mat = useMemo(() => {
    const m = makeGlowMaterial(base, false, always);
    m.color = new Color(color).multiplyScalar(intensity);
    if (transparentOpacity !== undefined) {
      m.transparent = true;
      m.opacity = transparentOpacity;
      m.depthWrite = false;
    }
    return m;
  }, [color, intensity, base, always, transparentOpacity]);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

export function useStd(color: string, metalness = 0.6, roughness = 0.4, extra: Partial<MeshStandardMaterial> = {}) {
  const mat = useMemo(() => {
    const m = new MeshStandardMaterial({ color, metalness, roughness, ...extra });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, metalness, roughness]);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

export function useGlass(opacity = 0.32, color = "#9fd8ff") {
  const mat = useMemo(
    () => new MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.05, transparent: true, opacity, side: DoubleSide, depthWrite: false }),
    [color, opacity],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

/** A glass elevator cabin that travels between two heights beside a shaft. */
export function Elevator({ x, z, y0, y1, period = 14, color = "#5ef2ff", radius = 1.6 }: { x: number; z: number; y0: number; y1: number; period?: number; color?: string; radius?: number }) {
  const cab = useRef<Mesh>(null);
  const shaftMat = useGlass(0.12, color);
  const cabMat = useGlow(color, 1.6, 0.8, true, 0.75);
  const frame = useStd("#aab4c2", 0.8, 0.3);
  useFrame((s) => {
    if (!cab.current) return;
    const t = (s.clock.elapsedTime % period) / period;
    const k = t < 0.5 ? t * 2 : 2 - t * 2;
    const e = k * k * (3 - 2 * k);
    cab.current.position.y = y0 + (y1 - y0) * e + 2;
  });
  const h = y1 - y0 + 4;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, y0 + h / 2 - 1, 0]} material={shaftMat}>
        <cylinderGeometry args={[radius, radius, h, 16, 1, true]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos((i * Math.PI) / 2) * radius, y0 + h / 2 - 1, Math.sin((i * Math.PI) / 2) * radius]} material={frame}>
          <boxGeometry args={[0.18, h, 0.18]} />
        </mesh>
      ))}
      <mesh ref={cab} material={cabMat}>
        <cylinderGeometry args={[radius * 0.82, radius * 0.82, 3.2, 16]} />
      </mesh>
    </group>
  );
}

/** Instanced street lamps: poles + glowing heads. */
export function StreetLamps({ points, height = 8, color = "#ffd9a0" }: { points: [number, number][]; height?: number; color?: string }) {
  const poles = useMemo<BoxItem[]>(() => points.map(([x, z]) => ({ x, y: 0, z, sx: 0.22, sy: height, sz: 0.22 })), [points, height]);
  const heads = useMemo<BoxItem[]>(() => points.map(([x, z]) => ({ x, y: height, z, sx: 1.0, sy: 0.3, sz: 1.0 })), [points, height]);
  const poleMat = useStd("#2b323c", 0.7, 0.5);
  const headMat = useGlow(color, 3, 0.25);
  return (
    <>
      <InstancedBoxes items={poles} material={poleMat} />
      <InstancedBoxes items={heads} material={headMat} />
    </>
  );
}

export function disposeAll(...m: Material[]) {
  m.forEach((x) => x.dispose());
}
