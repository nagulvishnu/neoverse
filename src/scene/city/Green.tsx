import { useEffect, useMemo } from "react";
import {
  Color,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  DoubleSide,
  Euler,
} from "three";
import { LAYOUT } from "../../core/layout";
import { useStore } from "../../core/store";
import { QUALITY } from "../../core/quality";
import { mulberry32 } from "../../core/rng";
import { getCity, hillHeight, type TreeI } from "../cityData";
import { BuildingSet } from "./BuildingSet";
import { Beacons, InstancedBoxes, Trees, type BoxItem } from "./common";
import { LandmarkMarker } from "./Landmark";
import { Spin, useGlow, useStd } from "./props";
import { STYLES, FACADES } from "../styles";
import { makeEnergyMaterial, makeGlowMaterial, makeWaterMaterial, makeWaterfallMaterial, U } from "../materials";

const FOLIAGE = ["#2f8f4a", "#3fae5a", "#58c46c", "#1f6e47"].map((c) => new Color(c));

function Foliage() {
  const city = getCity();
  const q = useStore((s) => s.quality);
  const mult = QUALITY[q].foliage;
  const built = useMemo(() => {
    const items = city.foliage.filter((_, i) => (i % 100) / 100 < mult);
    const geo = new IcosahedronGeometry(1, 1);
    const mat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.uTime;
      sh.uniforms.uNight = U.uNight;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float ph = instanceMatrix[3].x * 0.2 + instanceMatrix[3].y * 0.3 + instanceMatrix[3].z * 0.17;
            transformed.x += sin(uTime * 1.2 + ph) * 0.12 * (position.y + 1.0);
            transformed.z += cos(uTime * 1.0 + ph) * 0.12 * (position.y + 1.0);
          #endif`,
        );
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uNight;")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * vec3(0.1, 0.8, 0.6) * uNight * 0.12;");
    };
    mat.customProgramCacheKey = () => "foliage";
    const mesh = new InstancedMesh(geo, mat, Math.max(1, items.length));
    mesh.count = items.length;
    const m = new Matrix4();
    const qn = new Quaternion();
    const e = new Euler();
    items.forEach((b, i) => {
      e.set(i * 0.7, i * 1.3, 0);
      qn.setFromEuler(e);
      m.compose(new Vector3(b.x, b.y, b.z), qn, new Vector3(b.s, b.s * 0.75, b.s));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, FOLIAGE[b.c % 4]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (items.length) mesh.computeBoundingSphere();
    mesh.castShadow = true;
    return { mesh, geo, mat };
  }, [city, mult]);
  useEffect(
    () => () => {
      built.mesh.dispose();
      built.geo.dispose();
      built.mat.dispose();
    },
    [built],
  );
  return <primitive object={built.mesh} />;
}

function Hills() {
  const city = getCity();
  const built = useMemo(() => {
    const geo = new SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const mat = new MeshStandardMaterial({ color: "#1e4a1d", roughness: 0.95 });
    const mesh = new InstancedMesh(geo, mat, Math.max(1, city.hills.length));
    mesh.count = city.hills.length;
    const m = new Matrix4();
    city.hills.forEach((h, i) => {
      m.compose(new Vector3(h.x, 0, h.z), new Quaternion(), new Vector3(h.r, h.h, h.r));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.receiveShadow = true;
    return { mesh, geo, mat };
  }, [city]);
  useEffect(
    () => () => {
      built.mesh.dispose();
      built.geo.dispose();
      built.mat.dispose();
    },
    [built],
  );
  return <primitive object={built.mesh} />;
}

function Solar() {
  const panel = useMemo(() => new MeshStandardMaterial({ color: "#14284d", metalness: 0.9, roughness: 0.16 }), []);
  const pole = useStd("#59636f", 0.7, 0.4);
  const items = useMemo(() => {
    const out: { x: number; z: number }[] = [];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) out.push({ x: 262 + i * 11, z: 495 + j * 15 });
    return out;
  }, []);
  const poles = useMemo<BoxItem[]>(() => items.map((p) => ({ x: p.x, y: 0, z: p.z, sx: 0.4, sy: 1.8, sz: 0.4 })), [items]);
  useEffect(() => () => panel.dispose(), [panel]);
  return (
    <group>
      {items.map((p, i) => (
        <mesh key={i} position={[p.x, 2.4, p.z]} rotation={[-0.5, 0, 0]} material={panel} castShadow>
          <boxGeometry args={[9, 0.2, 6]} />
        </mesh>
      ))}
      <InstancedBoxes items={poles} material={pole} />
    </group>
  );
}

function Turbine({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  const white = useStd("#eef2f5", 0.2, 0.4);
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 24, 0]} material={white} castShadow>
        <cylinderGeometry args={[0.7, 1.4, 48, 10]} />
      </mesh>
      <mesh position={[0, 48, 0]} material={white}>
        <boxGeometry args={[2, 2, 5]} />
      </mesh>
      <Spin axis="z" speed={1.3 - (x % 3) * 0.2} position={[0, 48, -3]}>
        {[0, 1, 2].map((k) => (
          <group key={k} rotation={[0, 0, (k * Math.PI * 2) / 3]}>
            <mesh position={[0, 10, 0]} material={white} castShadow>
              <boxGeometry args={[1.1, 20, 0.3]} />
            </mesh>
          </group>
        ))}
      </Spin>
      <Beacons points={[0, 50.5, 0]} color="#ff4040" size={1.2} />
    </group>
  );
}

function Museum() {
  const { x, z } = LAYOUT.museum;
  const chrome = useStd("#e8eef5", 1, 0.06);
  const plinth = useStd("#cfd6d6", 0.4, 0.4);
  const ring = useGlow("#7dff9a", 3, 0.5, true);
  const orb = useMemo(() => makeEnergyMaterial("#7dff9a", "sphere", 0.9), []);
  useEffect(() => () => orb.dispose(), [orb]);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.6, 0]} material={plinth} receiveShadow>
        <cylinderGeometry args={[29, 31, 1.2, 56]} />
      </mesh>
      <mesh position={[0, 1.3, 0]} rotation={[Math.PI / 2, 0, 0]} material={ring}>
        <torusGeometry args={[28, 0.3, 6, 80]} />
      </mesh>
      <Spin speed={0.12} position={[0, 33, 0]}>
        <mesh material={chrome} castShadow rotation={[Math.PI / 2, 0, 0]}>
          <torusKnotGeometry args={[19, 4.8, 260, 28, 2, 3]} />
        </mesh>
      </Spin>
      <mesh position={[0, 33, 0]} material={orb}>
        <sphereGeometry args={[9, 32, 24]} />
      </mesh>
      <Spin speed={0.9} position={[0, 33, 0]}>
        <mesh rotation={[Math.PI / 2.2, 0, 0]} material={ring}>
          <torusGeometry args={[12, 0.15, 6, 60]} />
        </mesh>
      </Spin>
      <LandmarkMarker id="tech-museum" beamHeight={140} beamRadius={1.2} beamY={66} />
    </group>
  );
}

function Flora() {
  const city = getCity();
  const q = useStore((s) => s.quality);
  const mult = QUALITY[q].foliage;
  const built = useMemo(() => {
    const r = mulberry32(606);
    const n = Math.round(260 * mult);
    const geo = new SphereGeometry(1, 8, 6);
    // night-only emission: glow material gives HDR output (bloom) that fades in with the night factor
    const gm = makeGlowMaterial(0.04, false, false);
    const mesh = new InstancedMesh(geo, gm, Math.max(1, n));
    mesh.count = n;
    const m = new Matrix4();
    const cols = ["#2cffd0", "#6af0ff", "#b78bff", "#7dff9a"].map((c) => new Color(c).multiplyScalar(3.2));
    const gc = LAYOUT.green;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const rad = Math.sqrt(r()) * (i % 3 === 0 ? 50 : 170);
      const cx = i % 3 === 0 ? LAYOUT.museum.x : gc.x;
      const cz = i % 3 === 0 ? LAYOUT.museum.z : gc.z;
      const x = cx + Math.cos(a) * rad;
      const z = cz + Math.sin(a) * rad;
      if (Math.hypot(x - LAYOUT.lake.x, z - LAYOUT.lake.z) < LAYOUT.lake.r + 2) {
        mesh.count--;
        continue;
      }
      const s = 0.35 + r() * 0.7;
      m.compose(new Vector3(x, hillHeight(city.hills, x, z) + s * 0.9, z), new Quaternion(), new Vector3(s, s * 0.8, s));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, cols[i % 4]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    return { mesh, geo, gm };
  }, [city, mult]);
  useEffect(
    () => () => {
      built.mesh.dispose();
      built.geo.dispose();
      built.gm.dispose();
    },
    [built],
  );
  return <primitive object={built.mesh} />;
}

export function Green() {
  const city = getCity();
  const q = useStore((s) => s.quality);
  const mult = QUALITY[q].foliage;
  const trees = useMemo<TreeI[]>(() => city.trees.slice(0, Math.floor(city.trees.length * mult)), [city, mult]);
  const rock = useStd("#5d5a55", 0.1, 0.95);
  const water = useMemo(() => makeWaterMaterial(), []);
  const fall = useMemo(() => makeWaterfallMaterial(), []);
  const edge = useGlow("#2cffd0", 2.2, 0.15);
  const deckMat = useStd("#d6dccf", 0.4, 0.45);
  const deckGrass = useStd("#3e8f55", 0, 0.9);
  const trunk = useStd("#cfd6d6", 0.5, 0.4);
  const canopyMat = useMemo(() => new MeshStandardMaterial({ color: "#16305a", metalness: 0.9, roughness: 0.2, side: DoubleSide }), []);
  useEffect(
    () => () => {
      water.dispose();
      fall.dispose();
      canopyMat.dispose();
    },
    [water, fall, canopyMat],
  );
  const { lake } = LAYOUT;
  const cliff = useMemo<BoxItem[]>(
    () => [
      { x: 150, y: 0, z: 588, sx: 82, sy: 46, sz: 40 },
      { x: 118, y: 0, z: 578, sx: 26, sy: 30, sz: 26 },
      { x: 182, y: 0, z: 580, sx: 24, sy: 34, sz: 24 },
      { x: 150, y: 46, z: 592, sx: 70, sy: 6, sz: 30 },
      { x: 132, y: 0, z: 560, sx: 9, sy: 6, sz: 9 },
      { x: 172, y: 0, z: 558, sx: 11, sy: 4, sz: 8 },
    ],
    [],
  );
  const canopy = useMemo<BoxItem[]>(
    () => [
      { x: 205, y: 7, z: 360, sx: 34, sy: 0.4, sz: 12, ry: 0.4 },
      { x: 170, y: 7, z: 330, sx: 28, sy: 0.4, sz: 10, ry: -0.3 },
    ],
    [],
  );
  const posts = useMemo<BoxItem[]>(
    () => canopy.flatMap((c) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ x: c.x + a * (c.sx / 2 - 2) * Math.cos(c.ry ?? 0) - b * (c.sz / 2 - 1) * Math.sin(c.ry ?? 0), y: 0, z: c.z + a * (c.sx / 2 - 2) * -Math.sin(c.ry ?? 0) + b * (c.sz / 2 - 1) * Math.cos(c.ry ?? 0), sx: 0.6, sy: 7, sz: 0.6 }))),
    [canopy],
  );
  const deckCols = useMemo<BoxItem[]>(() => [[-14, -14], [14, -14], [-14, 14], [14, 14]].map(([a, b]) => ({ x: 120 + a, y: 0, z: 430 + b, sx: 2.4, sy: 21, sz: 2.4 })), []);
  const deckTrees = useMemo<TreeI[]>(() => Array.from({ length: 12 }, (_, k) => ({ x: 120 + Math.cos(k * 2.1) * (6 + (k % 3) * 5), y: 22.4, z: 430 + Math.sin(k * 2.1) * (6 + (k % 3) * 5), s: 0.9 + (k % 4) * 0.12, c: k % 4 })), []);

  return (
    <group name="green">
      <Hills />
      <BuildingSet items={city.green} style={STYLES.green} facade={FACADES.green} />
      <Foliage />
      <Trees items={trees} glow={1} />
      <Flora />
      {/* lake + waterfall */}
      <mesh position={[lake.x, 0.4, lake.z]} rotation={[-Math.PI / 2, 0, 0]} material={water} renderOrder={1}>
        <circleGeometry args={[lake.r, 64]} />
      </mesh>
      <mesh position={[lake.x, 0.5, lake.z]} rotation={[-Math.PI / 2, 0, 0]} material={edge}>
        <ringGeometry args={[lake.r - 0.5, lake.r + 0.4, 64]} />
      </mesh>
      <InstancedBoxes items={cliff} material={rock} castShadow receiveShadow />
      <mesh position={[150, 23, 567.6]} rotation={[0, Math.PI, 0]} material={fall} renderOrder={2}>
        <planeGeometry args={[30, 46]} />
      </mesh>
      <Beacons points={[...Array.from({ length: 36 }, (_, k) => [150 + Math.cos(k * 1.9) * 12, 1.5 + (k % 5) * 1.3, 563 + Math.sin(k * 2.7) * 4]).flat()]} color="#bfe8ff" size={3.2} blink={0} />
      {/* solar + wind */}
      <Solar />
      <InstancedBoxes items={canopy} material={canopyMat} castShadow />
      <InstancedBoxes items={posts} material={trunk} />
      <Turbine x={250} z={612} />
      <Turbine x={290} z={602} s={0.9} />
      <Turbine x={330} z={614} s={1.1} />
      <Turbine x={370} z={604} s={0.95} />
      {/* elevated garden deck */}
      <mesh position={[120, 21.2, 430]} material={deckMat} castShadow receiveShadow>
        <cylinderGeometry args={[24, 22, 2.2, 40]} />
      </mesh>
      <mesh position={[120, 22.4, 430]} material={deckGrass}>
        <cylinderGeometry args={[22, 22, 0.3, 40]} />
      </mesh>
      <InstancedBoxes items={deckCols} material={trunk} castShadow />
      <Trees items={deckTrees} glow={1} />
      <Museum />
    </group>
  );
}
