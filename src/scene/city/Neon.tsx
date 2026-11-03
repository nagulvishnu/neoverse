import { useEffect, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Color } from "three";
import { LAYOUT } from "../../core/layout";
import { mulberry32 } from "../../core/rng";
import { getCity, type Bld } from "../cityData";
import { BuildingSet } from "./BuildingSet";
import { InstancedBoxes, SignSet, type BoxItem, type SignItem } from "./common";
import { LandmarkMarker } from "./Landmark";
import { Spin, useGlow, useStd } from "./props";
import { STYLES, FACADES, NEON_COLORS } from "../styles";
import { makeBeamMaterial, makeEnergyMaterial } from "../materials";
import type { MeshBasicMaterial } from "three";

const XS = [280, 320, 360, 400, 440, 480, 520];
const ZS = [-80, -40, 0, 40, 80, 120, 160];
const BX = [300, 340, 380, 420, 460, 500];
const BZ = [-60, -20, 20, 60, 100, 140];

function NeonPlaza({ x, z, color }: { x: number; z: number; color: string }) {
  const ring = useGlow(color, 3, 0.5, true);
  const disc = useStd("#1a1426", 0.6, 0.3);
  const orb = useMemo(() => makeEnergyMaterial(color, "sphere", 1.3), [color]);
  useEffect(() => () => orb.dispose(), [orb]);
  return (
    <group>
      <mesh position={[x, 0.12, z]} material={disc} receiveShadow>
        <cylinderGeometry args={[14, 14, 0.25, 40]} />
      </mesh>
      <mesh position={[x, 0.3, z]} rotation={[Math.PI / 2, 0, 0]} material={ring}>
        <torusGeometry args={[13.6, 0.2, 6, 56]} />
      </mesh>
      <mesh position={[x, 8, z]} material={orb}>
        <sphereGeometry args={[3, 28, 20]} />
      </mesh>
      <Spin speed={1.2} position={[x, 8, z]}>
        <mesh rotation={[Math.PI / 2.2, 0, 0]} material={ring}>
          <torusGeometry args={[5, 0.12, 6, 48]} />
        </mesh>
        <mesh rotation={[-Math.PI / 3, 0.6, 0]} material={ring}>
          <torusGeometry args={[6.2, 0.12, 6, 48]} />
        </mesh>
      </Spin>
    </group>
  );
}

function CyberArena() {
  const { x, z } = LAYOUT.arena;
  const city = getCity();
  void city;
  const tiers = useMemo<Bld[]>(
    () => [
      { kind: "cylinder", x, y: 0, z, w: 86, h: 15, d: 86, rot: 0, tint: 0 },
      { kind: "cylinder", x, y: 15, z, w: 78, h: 14, d: 78, rot: 0, tint: 1 },
      { kind: "cylinder", x, y: 29, z, w: 70, h: 14, d: 70, rot: 0, tint: 2 },
    ],
    [x, z],
  );
  const mats = [useGlow("#ff4fd8", 3.2, 0.5, true), useGlow("#5ef2ff", 3.2, 0.5, true), useGlow("#ffb347", 3.2, 0.5, true)];
  const roof = useGlow("#ff4fd8", 3, 0.5, true);
  const dark = useStd("#1b1530", 0.8, 0.3);
  const beamMats = useMemo(() => ["#ff4fd8", "#5ef2ff", "#ffb347", "#b06bff", "#7dff9a", "#ff4f6a"].map((c) => makeBeamMaterial(c, 1.3)), []);
  useEffect(() => () => beamMats.forEach((m) => m.dispose()), [beamMats]);
  const screens = useMemo<SignItem[]>(
    () => [
      { x: x - 38.6, y: 22, z, sx: 34, sy: 8.5, ry: -Math.PI / 2, sign: 14, phase: 0.1, tint: "#ffffff" },
      { x: x - 38.6, y: 33.5, z: z + 0, sx: 22, sy: 5.5, ry: -Math.PI / 2, sign: 0, phase: 0.6, tint: "#c8f8ff" },
    ],
    [x, z],
  );
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    mats.forEach((m: MeshBasicMaterial, i) => {
      const k = 0.55 + 0.45 * Math.sin(t * 2.2 + i * 2.1);
      m.color.set(["#ff4fd8", "#5ef2ff", "#ffb347"][i]).multiplyScalar(1.2 + 3 * k);
    });
  });
  return (
    <group name="arena">
      <BuildingSet items={tiers} style={STYLES.neon} facade={["#2a2145", "#25304f", "#3a2447"]} chunk={2000} />
      {[15, 29, 43].map((y, i) => (
        <mesh key={y} position={[x, y + 0.2, z]} rotation={[Math.PI / 2, 0, 0]} material={mats[i]}>
          <torusGeometry args={[43 - i * 4 - (i === 2 ? 0 : 0), 0.7, 8, 96]} />
        </mesh>
      ))}
      <mesh position={[x, 44.5, z]} material={dark} castShadow>
        <cylinderGeometry args={[32, 36, 3, 48]} />
      </mesh>
      <mesh position={[x, 46.2, z]} rotation={[Math.PI / 2, 0, 0]} material={roof}>
        <torusGeometry args={[31, 0.6, 8, 80]} />
      </mesh>
      {beamMats.map((m, i) => (
        <Spin key={i} speed={(i % 2 ? -1 : 1) * (0.35 + i * 0.07)} position={[x + Math.cos((i / 6) * Math.PI * 2) * 30, 46, z + Math.sin((i / 6) * Math.PI * 2) * 30]} rotation={[0, i * 1.1, 0]}>
          <group rotation={[0.42 + (i % 3) * 0.12, 0, 0]}>
            <mesh position={[0, 90, 0]} material={m} raycast={() => {}} renderOrder={3}>
              <cylinderGeometry args={[1.1, 3.6, 180, 14, 1, true]} />
            </mesh>
          </group>
        </Spin>
      ))}
      <SignSet items={screens} mode="billboard" />
      <LandmarkMarker id="cyber-arena" beamHeight={130} beamRadius={1.6} beamY={60} />
    </group>
  );
}

export function Neon() {
  const city = getCity();
  const archMat = useGlow("#ffffff", 1, 0.3);
  const kioskBody = useStd("#1d1d2c", 0.8, 0.3);

  const gen = useMemo(() => {
    const r = mulberry32(2150);
    const signs: SignItem[] = [];
    for (const b of city.neon) {
      if (b.h < 12 || !(b.kind === "slab" || b.kind === "wedge" || b.kind === "stepped")) continue;
      const n = r() < 0.8 ? (r() < 0.45 ? 2 : 1) : 0;
      for (let k = 0; k < n; k++) {
        const side = Math.floor(r() * 4);
        const nx = side === 0 ? 1 : side === 1 ? -1 : 0;
        const nz = side === 2 ? 1 : side === 3 ? -1 : 0;
        const half = nx ? b.w / 2 : b.d / 2;
        const face = nx ? b.d : b.w;
        const tx = -nz;
        const tz = nx;
        const vertical = r() < 0.4;
        const maxY = b.kind === "stepped" ? b.h * 0.5 : b.h;
        const color = NEON_COLORS[Math.floor(r() * NEON_COLORS.length)];
        if (vertical) {
          const sx = Math.max(5, Math.min(maxY * 0.7, 18));
          const lat = (face / 2 - 1.2) * (r() < 0.5 ? -1 : 1);
          const y = b.y + sx / 2 + 3 + r() * Math.max(0, maxY - sx - 5);
          signs.push({ x: b.x + nx * (half + 0.25) + tx * lat, y, z: b.z + nz * (half + 0.25) + tz * lat, sx, sy: sx / 4, ry: Math.atan2(nx, nz), rz: Math.PI / 2, sign: Math.floor(r() * 32), phase: r(), tint: color });
        } else {
          const sx = Math.max(5, Math.min(face * 0.85, 15));
          const lat = (r() - 0.5) * Math.max(0, face - sx - 1);
          const y = b.y + 5 + r() * Math.max(0, Math.min(maxY - 7, 32));
          signs.push({ x: b.x + nx * (half + 0.25) + tx * lat, y, z: b.z + nz * (half + 0.25) + tz * lat, sx, sy: sx / 4, ry: Math.atan2(nx, nz), sign: Math.floor(r() * 32), phase: r(), tint: color });
        }
      }
    }
    // holographic ads at intersections
    const holos: SignItem[] = [];
    for (let i = 0; i < 16; i++) {
      const x = XS[1 + Math.floor(r() * (XS.length - 2))];
      const z = ZS[1 + Math.floor(r() * (ZS.length - 2))];
      holos.push({ x, y: 13 + r() * 10, z, sx: 13, sy: 3.25, ry: (r() < 0.5 ? 1 : -1) * 0.785 + (r() < 0.5 ? 1.57 : 0), sign: Math.floor(r() * 32), phase: r(), tint: NEON_COLORS[Math.floor(r() * NEON_COLORS.length)] });
    }
    // neon arches over street segments
    const arches: BoxItem[] = [];
    const addArch = (cx: number, cz: number, alongZ: boolean, color: string) => {
      const c = new Color(color).multiplyScalar(3);
      const half = 5.1;
      const ry = alongZ ? 0 : Math.PI / 2;
      const px = (d: number) => cx + (alongZ ? d : 0);
      const pz = (d: number) => cz + (alongZ ? 0 : d);
      arches.push({ x: px(-half), y: 0, z: pz(-half), sx: 0.4, sy: 9, sz: 0.4, color: c, ry });
      arches.push({ x: px(half), y: 0, z: pz(half), sx: 0.4, sy: 9, sz: 0.4, color: c, ry });
      arches.push({ x: cx, y: 9, z: cz, sx: alongZ ? half * 2 + 0.4 : 0.4, sy: 0.4, sz: alongZ ? 0.4 : half * 2 + 0.4, color: c, ry: 0 });
      arches.push({ x: cx, y: 7.3, z: cz, sx: alongZ ? half * 2 - 1 : 0.25, sy: 0.25, sz: alongZ ? 0.25 : half * 2 - 1, color: new Color(color).multiplyScalar(1.8), ry: 0 });
    };
    for (let i = 0; i < 26; i++) {
      const color = NEON_COLORS[Math.floor(r() * NEON_COLORS.length)];
      if (r() < 0.5) addArch(XS[Math.floor(r() * XS.length)], BZ[Math.floor(r() * BZ.length)], true, color);
      else addArch(BX[Math.floor(r() * BX.length)], ZS[Math.floor(r() * ZS.length)], false, color);
    }
    // kiosks (interactive displays) on the sidewalks
    const kiosks: { x: number; z: number; face: number; sign: number }[] = [];
    for (let i = 0; i < 24; i++) {
      const alongZ = r() < 0.5;
      const sd = r() < 0.5 ? -1 : 1;
      if (alongZ) {
        const x = XS[Math.floor(r() * XS.length)];
        kiosks.push({ x: x + sd * 3.6, z: BZ[Math.floor(r() * BZ.length)] + (r() < 0.5 ? -7 : 7), face: sd > 0 ? -Math.PI / 2 : Math.PI / 2, sign: Math.floor(r() * 32) });
      } else {
        const z = ZS[Math.floor(r() * ZS.length)];
        kiosks.push({ x: BX[Math.floor(r() * BX.length)] + (r() < 0.5 ? -7 : 7), z: z + sd * 3.6, face: sd > 0 ? Math.PI : 0, sign: Math.floor(r() * 32) });
      }
    }
    return { signs, holos, arches, kiosks };
  }, [city]);

  const [hover, setHover] = useState<number | null>(null);
  const [override, setOverride] = useState<Record<number, number>>({});
  const kioskItems = useMemo<SignItem[]>(
    () =>
      gen.kiosks.map((k, i) => ({
        x: k.x + Math.sin(k.face) * 0.28,
        y: 2.3,
        z: k.z + Math.cos(k.face) * 0.28,
        sx: 3.4,
        sy: 0.85,
        ry: k.face,
        rz: Math.PI / 2,
        sign: override[i] ?? k.sign,
        phase: i * 0.13,
        tint: hover === i ? "#ffffff" : NEON_COLORS[i % NEON_COLORS.length],
      })),
    [gen.kiosks, hover, override],
  );
  const kioskBodies = useMemo<BoxItem[]>(() => gen.kiosks.map((k) => ({ x: k.x, y: 0, z: k.z, sx: Math.abs(Math.cos(k.face)) > 0.5 ? 1.2 : 0.4, sy: 4.2, sz: Math.abs(Math.cos(k.face)) > 0.5 ? 0.4 : 1.2 })), [gen.kiosks]);

  const hoverCursor = (i: number | null) => {
    setHover(i);
    document.body.style.cursor = i === null ? "" : "pointer";
  };

  return (
    <group name="neon">
      <BuildingSet items={city.neon} style={STYLES.neon} facade={FACADES.neon} />
      <SignSet items={gen.signs} mode="sign" />
      <SignSet items={gen.holos} mode="holo" />
      <InstancedBoxes items={gen.arches} material={archMat} />
      <InstancedBoxes items={kioskBodies} material={kioskBody} />
      <SignSet items={kioskItems} mode="sign" onHover={hoverCursor} onPick={(i) => setOverride((o) => ({ ...o, [i]: ((o[i] ?? gen.kiosks[i].sign) + 1) % 32 }))} />
      <NeonPlaza x={340} z={60} color="#ff4fd8" />
      <NeonPlaza x={460} z={-20} color="#5ef2ff" />
      <CyberArena />
    </group>
  );
}

