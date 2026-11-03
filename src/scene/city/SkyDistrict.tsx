import { useEffect, useMemo } from "react";
import { Euler, Vector3 } from "three";
import { LAYOUT, OBS_DECK, SKY_PLATFORMS, type Platform } from "../../core/layout";
import { getCity } from "../cityData";
import { BuildingSet } from "./BuildingSet";
import { Beacons, SignSet, Trees, type SignItem } from "./common";
import { LandmarkMarker } from "./Landmark";
import { Elevator, Spin, useGlass, useGlow, useStd } from "./props";
import { STYLES, FACADES } from "../styles";
import { makeBeamMaterial } from "../materials";

function PlatformMesh({ p }: { p: Platform }) {
  const stone = useStd("#dcdfe6", 0.5, 0.35);
  const under = useStd("#3b4452", 0.85, 0.3);
  const grass = useStd("#3e8f55", 0.0, 0.9);
  const rim = useGlow("#ffd37a", 2.6, 0.5);
  const emit = useGlow("#7ab8ff", 3, 0.7, true);
  const beam = useMemo(() => makeBeamMaterial("#7ab8ff", 0.9), []);
  useEffect(() => () => beam.dispose(), [beam]);
  return (
    <group position={[p.x, p.y, p.z]}>
      <mesh position={[0, -1.5, 0]} material={stone} castShadow receiveShadow>
        <cylinderGeometry args={[p.r, p.r, 3, 48]} />
      </mesh>
      <mesh position={[0, -13, 0]} material={under} castShadow>
        <cylinderGeometry args={[p.r, p.r * 0.32, 20, 36]} />
      </mesh>
      <mesh position={[0, 0.12, 0]} material={grass} receiveShadow>
        <cylinderGeometry args={[p.r * 0.93, p.r * 0.93, 0.25, 48]} />
      </mesh>
      <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} material={rim}>
        <torusGeometry args={[p.r - 0.4, 0.3, 6, 96]} />
      </mesh>
      <mesh position={[0, -22.5, 0]} rotation={[Math.PI / 2, 0, 0]} material={emit}>
        <torusGeometry args={[p.r * 0.32, 0.8, 8, 40]} />
      </mesh>
      <Spin speed={0.4} position={[0, -21, 0]}>
        <mesh rotation={[Math.PI / 2.2, 0, 0]} material={emit}>
          <torusGeometry args={[p.r * 0.2, 0.25, 6, 32]} />
        </mesh>
      </Spin>
      <mesh position={[0, -42, 0]} rotation={[Math.PI, 0, 0]} material={beam} raycast={() => {}} renderOrder={3}>
        <cylinderGeometry args={[p.r * 0.14, p.r * 0.34, 38, 20, 1, true]} />
      </mesh>
    </group>
  );
}

function Bridge({ a, b }: { a: Platform; b: Platform }) {
  const metal = useStd("#cfd6e0", 0.8, 0.25);
  const glow = useGlow("#ffd37a", 2.4, 0.5);
  const geo = useMemo(() => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const dist = Math.hypot(dx, dz);
    const ux = dx / dist;
    const uz = dz / dist;
    const p0 = new Vector3(a.x + ux * (a.r - 3), a.y - 0.3, a.z + uz * (a.r - 3));
    const p1 = new Vector3(b.x - ux * (b.r - 3), b.y - 0.3, b.z - uz * (b.r - 3));
    const mid = p0.clone().add(p1).multiplyScalar(0.5);
    const len = p0.distanceTo(p1);
    const yaw = Math.atan2(dx, dz);
    const pitch = -Math.atan2(p1.y - p0.y, Math.hypot(p1.x - p0.x, p1.z - p0.z));
    return { mid, len, rot: new Euler(pitch, yaw, 0, "YXZ") };
  }, [a, b]);
  return (
    <group position={geo.mid} rotation={geo.rot}>
      <mesh material={metal} castShadow>
        <boxGeometry args={[6, 1, geo.len]} />
      </mesh>
      <mesh position={[3.1, 0.9, 0]} material={glow}>
        <boxGeometry args={[0.2, 0.2, geo.len]} />
      </mesh>
      <mesh position={[-3.1, 0.9, 0]} material={glow}>
        <boxGeometry args={[0.2, 0.2, geo.len]} />
      </mesh>
    </group>
  );
}

function ObservationDeck() {
  const { x, y, z, r } = OBS_DECK;
  const metal = useStd("#e2e6ee", 0.85, 0.2);
  const glass = useGlass(0.28, "#a6d0ff");
  const rim = useGlow("#ffd37a", 3, 0.5, true);
  const glow2 = useGlow("#5ef2ff", 2.6, 0.6, true);
  const stem = 215;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, (y - 3 + stem) / 2, 0]} material={metal} castShadow>
        <cylinderGeometry args={[3.2, 4.2, y - 3 - stem, 20]} />
      </mesh>
      <mesh position={[0, y - 1.25, 0]} material={metal} castShadow receiveShadow>
        <cylinderGeometry args={[r, r * 0.8, 2.5, 56]} />
      </mesh>
      <mesh position={[0, y + 0.1, 0]} rotation={[Math.PI / 2, 0, 0]} material={rim}>
        <torusGeometry args={[r - 0.3, 0.3, 6, 96]} />
      </mesh>
      <mesh position={[0, y + 0.6, 0]} material={glass}>
        <cylinderGeometry args={[r - 0.4, r - 0.4, 1.2, 64, 1, true]} />
      </mesh>
      <mesh position={[0, y + 0.1, 0]} material={glass}>
        <sphereGeometry args={[13, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, y - 3.3, 0]} rotation={[Math.PI / 2, 0, 0]} material={glow2}>
        <torusGeometry args={[r * 0.8, 0.35, 6, 80]} />
      </mesh>
      <mesh position={[0, y + 30, 0]} material={metal}>
        <cylinderGeometry args={[0.2, 0.7, 60, 8]} />
      </mesh>
      <Beacons points={[0, y + 60, 0]} color="#ff4040" size={2.2} />
      <Elevator x={7.5} z={0} y0={stem + 1} y1={y - 3} period={26} color="#ffd37a" radius={1.8} />
      <LandmarkMarker id="observation-deck" beamHeight={110} beamRadius={1.2} beamY={y + 60} />
    </group>
  );
}

export function SkyDistrict() {
  const city = getCity();
  const bridges = useMemo(() => {
    const p0 = SKY_PLATFORMS[0];
    return SKY_PLATFORMS.slice(1).map((p) => ({ a: p0, b: p }));
  }, []);
  const signs = useMemo<SignItem[]>(
    () => [
      { x: LAYOUT.sky.x, y: 232, z: LAYOUT.sky.z - 46.5, sx: 20, sy: 5, ry: Math.PI, sign: 6, phase: 0.3, tint: "#ffd37a" },
    ],
    [],
  );
  const beacons = useMemo(() => city.sky.filter((b) => b.h > 60).flatMap((b) => [b.x, b.y + b.h + 2, b.z]), [city]);
  return (
    <group name="sky-district">
      {SKY_PLATFORMS.map((p) => (
        <PlatformMesh key={p.id} p={p} />
      ))}
      {bridges.map((b) => (
        <Bridge key={b.b.id} a={b.a} b={b.b} />
      ))}
      <BuildingSet items={city.sky} style={STYLES.sky} facade={FACADES.sky} chunk={400} />
      <Trees items={city.skyTrees} palette="sky" />
      <Beacons points={beacons} color="#ffd9a0" size={1.4} blink={0} />
      <SignSet items={signs} mode="holo" />
      <ObservationDeck />
    </group>
  );
}
