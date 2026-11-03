import { useMemo } from "react";
import { Color } from "three";
import { LAYOUT } from "../../core/layout";
import { mulberry32 } from "../../core/rng";
import { getCity, type Bld } from "../cityData";
import { BuildingSet } from "./BuildingSet";
import { Beacons, InstancedBoxes, SignSet, Trees, type BoxItem, type SignItem } from "./common";
import { CentralTower } from "./CentralTower";
import { NexusHub } from "./NexusHub";
import { Spin, StreetLamps, useGlow, useStd } from "./props";
import { STYLES, FACADES, NEON_COLORS } from "../styles";
import { makeEnergyMaterial } from "../materials";
import { useEffect } from "react";

const XS = [-210, -150, -90, -30, 30, 90, 150, 210];
const MIDS = [-180, -120, -60, 0, 60, 120, 180];

function Plaza({ x, z }: { x: number; z: number }) {
  const ring = useGlow("#5ef2ff", 3, 0.5, true);
  const ring2 = useGlow("#ff4fd8", 2.4, 0.4);
  const stone = useStd("#2a3340", 0.5, 0.35);
  const bench = useStd("#8e9aab", 0.6, 0.4);
  const orb = useMemo(() => makeEnergyMaterial("#5ef2ff", "sphere", 1), []);
  useEffect(() => () => orb.dispose(), [orb]);
  const benches = useMemo<BoxItem[]>(() => {
    const out: BoxItem[] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      out.push({ x: x + Math.cos(a) * 11, y: 0, z: z + Math.sin(a) * 11, sx: 3.2, sy: 0.6, sz: 0.9, ry: -a + Math.PI / 2 });
    }
    return out;
  }, [x, z]);
  const trees = useMemo(
    () =>
      Array.from({ length: 10 }, (_, k) => {
        const a = (k / 10) * Math.PI * 2 + 0.5;
        return { x: x + Math.cos(a) * 17.5, y: 0, z: z + Math.sin(a) * 17.5, s: 1.0 + (k % 3) * 0.15, c: k % 4 };
      }),
    [x, z],
  );
  return (
    <group>
      <mesh position={[x, 0.15, z]} material={stone} receiveShadow>
        <cylinderGeometry args={[19, 19, 0.3, 48]} />
      </mesh>
      <mesh position={[x, 0.35, z]} rotation={[Math.PI / 2, 0, 0]} material={ring}>
        <torusGeometry args={[18.4, 0.22, 6, 64]} />
      </mesh>
      <mesh position={[x, 0.35, z]} rotation={[Math.PI / 2, 0, 0]} material={ring2}>
        <torusGeometry args={[7, 0.18, 6, 48]} />
      </mesh>
      <mesh position={[x, 9, z]} material={orb}>
        <sphereGeometry args={[3.4, 28, 20]} />
      </mesh>
      <Spin speed={0.9} position={[x, 9, z]}>
        <mesh rotation={[Math.PI / 2.4, 0, 0]} material={ring2}>
          <torusGeometry args={[5.4, 0.1, 6, 48]} />
        </mesh>
        <mesh rotation={[-Math.PI / 3, 0.4, 0]} material={ring}>
          <torusGeometry args={[6.4, 0.1, 6, 48]} />
        </mesh>
      </Spin>
      <InstancedBoxes items={benches} material={bench} />
      <Trees items={trees} />
    </group>
  );
}

export function Downtown() {
  const city = getCity();
  const D = LAYOUT.downtown;
  const mech = useStd("#59636f", 0.6, 0.5);
  const antenna = useStd("#a9b4c2", 0.9, 0.3);
  const pad = useStd("#2f3944", 0.5, 0.5);
  const bridgeMat = useStd("#9fb4c8", 0.85, 0.15);
  const stripMat = useGlow("#5ef2ff", 2.8, 0.5);

  const props = useMemo(() => {
    const m: BoxItem[] = [];
    const a: BoxItem[] = [];
    const p: BoxItem[] = [];
    for (const q of city.downtownProps) (q.kind === "mech" ? m : q.kind === "antenna" ? a : p).push(q);
    return { m, a, p };
  }, [city]);

  const strips = useMemo<BoxItem[]>(
    () =>
      city.bridges.map((b) => ({ x: b.x, y: b.y + 0.2, z: b.z, sx: b.sx > b.sz ? b.sx + 0.4 : 5.4, sy: 0.35, sz: b.sx > b.sz ? 5.4 : b.sz + 0.4 })),
    [city],
  );

  // giant billboards + holo ads
  const { billboards, holos } = useMemo(() => {
    const r = mulberry32(99);
    const cand = city.downtown.filter((b: Bld) => (b.kind === "slab" || b.kind === "wedge" || b.kind === "stepped") && b.h > 110);
    const bb: SignItem[] = [];
    for (const b of cand) {
      if (r() < 0.45 || bb.length > 20) continue;
      const side = Math.floor(r() * 4);
      const nx = side === 0 ? 1 : side === 1 ? -1 : 0;
      const nz = side === 2 ? 1 : side === 3 ? -1 : 0;
      const face = nx ? b.d : b.w;
      const sx = Math.min(face * 0.92, 34);
      const hMax = b.kind === "stepped" ? b.h * 0.5 : b.h * 0.85;
      const y = b.y + hMax * (0.45 + r() * 0.5);
      bb.push({
        x: b.x + nx * (b.w / 2 + 0.25),
        y,
        z: b.z + nz * (b.d / 2 + 0.25),
        sx,
        sy: sx / 4,
        ry: Math.atan2(nx, nz),
        sign: Math.floor(r() * 32),
        phase: r(),
        tint: new Color(NEON_COLORS[Math.floor(r() * NEON_COLORS.length)]).lerp(new Color("#ffffff"), 0.4),
      });
    }
    const hl: SignItem[] = [];
    const spots: [number, number][] = [[-30, 90], [30, -30], [90, 30], [-90, -90], [150, 90], [-150, 30], [30, 150], [-30, -150], [90, -150], [-90, 150]];
    spots.forEach(([x, z], i) =>
      hl.push({ x, y: 22 + (i % 3) * 9, z, sx: 15, sy: 3.75, ry: (i % 2 ? 0.785 : -0.785) + (i % 4 > 1 ? 1.57 : 0), sign: [0, 5, 9, 7, 29, 21, 8, 20, 26, 31][i], phase: i * 0.37, tint: NEON_COLORS[i % NEON_COLORS.length] }),
    );
    return { billboards: bb, holos: hl };
  }, [city]);

  const lamps = useMemo(() => {
    const pts: [number, number][] = [];
    const off = D.streetHalf + 0.4;
    for (const xk of XS)
      for (const m of MIDS)
        for (const dz of [-11, 11])
          for (const sd of [-1, 1]) {
            pts.push([xk + sd * off, m + dz]);
            pts.push([m + dz, xk + sd * off]);
          }
    // boulevard
    for (let z = 270; z < 1500; z += 36)
      for (const sd of [-1, 1]) pts.push([LAYOUT.boulevard.x + sd * 16, z]);
    return pts;
  }, [D.streetHalf]);

  return (
    <group name="downtown">
      <BuildingSet items={city.downtown} style={STYLES.downtown} facade={FACADES.downtown} />
      <InstancedBoxes items={props.m} material={mech} castShadow />
      <InstancedBoxes items={props.a} material={antenna} />
      <InstancedBoxes items={props.p} material={pad} />
      <InstancedBoxes items={city.bridges} material={bridgeMat} castShadow />
      <InstancedBoxes items={strips} material={stripMat} />
      <Beacons points={city.downtownBeacons} color="#ff3a3a" size={1.6} />
      <SignSet items={billboards} mode="billboard" />
      <SignSet items={holos} mode="holo" />
      <Plaza x={60} z={60} />
      <Plaza x={-60} z={-120} />
      <StreetLamps points={lamps} />
      <CentralTower />
      <NexusHub />
    </group>
  );
}
