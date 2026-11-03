import { useEffect, useMemo, type ReactNode } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type Material,
  type Texture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { makeBeaconMaterial, makeSignMaterial, U } from "../materials";
import type { BoxI, TreeI } from "../cityData";

const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

/** Singleton sign atlas, generated during loading. */
let atlas: Texture | null = null;
export const setAtlas = (t: Texture) => (atlas = t);
export const getAtlas = () => atlas!;

export interface BoxItem extends BoxI {
  ry?: number;
  color?: Color | string | number;
}

/** Instanced boxes. `y` is the BASE of the box (centre = y + sy/2). */
export function InstancedBoxes({
  items,
  material,
  castShadow = false,
  receiveShadow = false,
  pointerHandlers,
}: {
  items: BoxItem[];
  material: Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
  pointerHandlers?: Record<string, unknown>;
}) {
  const geo = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const mesh = useMemo(() => {
    const m = new InstancedMesh(geo, material, Math.max(1, items.length));
    m.count = items.length;
    const mt = new Matrix4();
    const q = new Quaternion();
    const p = new Vector3();
    const s = new Vector3();
    const c = new Color();
    items.forEach((b, i) => {
      q.setFromAxisAngle(Y, b.ry ?? 0);
      p.set(b.x, b.y + b.sy / 2, b.z);
      s.set(b.sx, b.sy, b.sz);
      mt.compose(p, q, s);
      m.setMatrixAt(i, mt);
      if (b.color !== undefined) m.setColorAt(i, c.set(b.color as never));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    if (items.length) m.computeBoundingSphere();
    m.castShadow = castShadow;
    m.receiveShadow = receiveShadow;
    return m;
  }, [items, geo, material, castShadow, receiveShadow]);
  useEffect(
    () => () => {
      mesh.dispose();
    },
    [mesh],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  return <primitive object={mesh} {...pointerHandlers} />;
}

export interface SignItem {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  ry: number;
  rz?: number;
  sign: number;
  phase: number;
  tint: string | Color;
}

/** Instanced sign/hologram/billboard planes that use the shared sign atlas shader. */
export function SignSet({
  items,
  mode,
  onHover,
  onPick,
}: {
  items: SignItem[];
  mode: "sign" | "billboard" | "holo";
  onHover?: (i: number | null) => void;
  onPick?: (i: number) => void;
}) {
  const built = useMemo(() => {
    const geo = new PlaneGeometry(1, 1);
    const n = Math.max(1, items.length);
    const signA = new Float32Array(n);
    const phaseA = new Float32Array(n);
    items.forEach((it, i) => {
      signA[i] = it.sign;
      phaseA[i] = it.phase;
    });
    geo.setAttribute("aSign", new InstancedBufferAttribute(signA, 1));
    geo.setAttribute("aPhase", new InstancedBufferAttribute(phaseA, 1));
    const mat = makeSignMaterial(getAtlas(), mode);
    const mesh = new InstancedMesh(geo, mat, n);
    mesh.count = items.length;
    const mt = new Matrix4();
    const q = new Quaternion();
    const q2 = new Quaternion();
    const p = new Vector3();
    const s = new Vector3();
    const c = new Color();
    items.forEach((it, i) => {
      q.setFromAxisAngle(Y, it.ry);
      q2.setFromAxisAngle(Z, it.rz ?? 0);
      q.multiply(q2);
      p.set(it.x, it.y, it.z);
      s.set(it.sx, it.sy, 1);
      mt.compose(p, q, s);
      mesh.setMatrixAt(i, mt);
      mesh.setColorAt(i, c.set(it.tint as never));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (items.length) mesh.computeBoundingSphere();
    if (mode === "holo") mesh.renderOrder = 5;
    return { geo, mat, mesh };
  }, [items, mode]);
  useEffect(
    () => () => {
      built.mesh.dispose();
      built.geo.dispose();
      built.mat.dispose();
    },
    [built],
  );
  const handlers = onHover || onPick
    ? {
        onPointerMove: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHover?.(e.instanceId ?? null);
        },
        onPointerOut: () => onHover?.(null),
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.instanceId !== undefined) onPick?.(e.instanceId);
        },
      }
    : {};
  return <primitive object={built.mesh} {...handlers} />;
}

/** Point-sprite beacons: x,y,z triplets. */
export function Beacons({ points, color = "#ff3030", size = 1.4, blink = 1 }: { points: number[]; color?: string | string[]; size?: number; blink?: number }) {
  const built = useMemo(() => {
    const n = points.length / 3;
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(points, 3));
    const ph = new Float32Array(n);
    const col = new Float32Array(n * 3);
    const sz = new Float32Array(n);
    const cs = (Array.isArray(color) ? color : [color]).map((c) => new Color(c));
    for (let i = 0; i < n; i++) {
      ph[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const c = cs[i % cs.length];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
      sz[i] = size * (0.8 + 0.4 * ((Math.sin(i * 7.7) + 1) / 2));
    }
    geo.setAttribute("aPhase", new Float32BufferAttribute(ph, 1));
    geo.setAttribute("aColor", new Float32BufferAttribute(col, 3));
    geo.setAttribute("aSize", new Float32BufferAttribute(sz, 1));
    geo.computeBoundingSphere();
    const mat = makeBeaconMaterial(blink);
    return { geo, mat };
  }, [points, color, size, blink]);
  useEffect(
    () => () => {
      built.geo.dispose();
      built.mat.dispose();
    },
    [built],
  );
  if (!points.length) return null;
  return <points geometry={built.geo} material={built.mat} frustumCulled={false} renderOrder={6} />;
}

const TREE_COLORS = ["#2f8f4a", "#3fae5a", "#58c46c", "#1f6e47"];
const SKY_TREE_COLORS = ["#4fb872", "#7fd18a", "#d9a05b", "#5fd0a0"];

/** Instanced stylised trees (trunk + merged leaf-clump crown with wind sway). */
export function Trees({ items, palette = "park", glow = 0 }: { items: TreeI[]; palette?: "park" | "sky"; glow?: number }) {
  const built = useMemo(() => {
    const trunkGeo = new CylinderGeometry(0.16, 0.28, 1, 6);
    trunkGeo.translate(0, 0.5, 0);
    const a = new IcosahedronGeometry(1, 1);
    const b = new IcosahedronGeometry(0.68, 1);
    b.translate(0.55, -0.45, 0.3);
    const c = new IcosahedronGeometry(0.75, 1);
    c.translate(-0.5, -0.35, -0.4);
    const crownGeo = mergeGeometries([a, b, c])!;
    const trunkMat = new MeshStandardMaterial({ color: "#4a3626", roughness: 0.95 });
    const crownMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true });
    crownMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.uTime;
      sh.uniforms.uNight = U.uNight;
      sh.uniforms.uGlow = { value: glow };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float ph = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.17;
            transformed.x += sin(uTime * 1.3 + ph + position.y * 1.5) * 0.09 * (position.y + 1.0);
            transformed.z += cos(uTime * 1.1 + ph * 1.3 + position.y * 1.5) * 0.09 * (position.y + 1.0);
          #endif`,
        );
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uNight; uniform float uGlow;")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * vec3(0.1, 0.9, 0.7) * uNight * uGlow;");
    };
    crownMat.customProgramCacheKey = () => "tree";
    const n = Math.max(1, items.length);
    const trunks = new InstancedMesh(trunkGeo, trunkMat, n);
    const crowns = new InstancedMesh(crownGeo, crownMat, n);
    trunks.count = crowns.count = items.length;
    const mt = new Matrix4();
    const q = new Quaternion();
    const p = new Vector3();
    const s = new Vector3();
    const col = new Color();
    const cols = (palette === "sky" ? SKY_TREE_COLORS : TREE_COLORS).map((h) => new Color(h));
    items.forEach((t, i) => {
      q.setFromAxisAngle(Y, i * 1.7);
      p.set(t.x, t.y, t.z);
      s.set(t.s, t.s * 4, t.s);
      mt.compose(p, q, s);
      trunks.setMatrixAt(i, mt);
      p.set(t.x, t.y + t.s * 4.6, t.z);
      s.set(t.s * 2.6, t.s * 2.9, t.s * 2.6);
      mt.compose(p, q, s);
      crowns.setMatrixAt(i, mt);
      crowns.setColorAt(i, col.copy(cols[t.c % cols.length]).multiplyScalar(0.85 + 0.3 * ((i * 37) % 10) / 10));
    });
    trunks.instanceMatrix.needsUpdate = crowns.instanceMatrix.needsUpdate = true;
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    if (items.length) {
      trunks.computeBoundingSphere();
      crowns.computeBoundingSphere();
    }
    trunks.castShadow = crowns.castShadow = true;
    crowns.receiveShadow = true;
    return { trunks, crowns, trunkGeo, crownGeo, trunkMat, crownMat };
  }, [items, palette, glow]);
  useEffect(
    () => () => {
      built.trunks.dispose();
      built.crowns.dispose();
      built.trunkGeo.dispose();
      built.crownGeo.dispose();
      built.trunkMat.dispose();
      built.crownMat.dispose();
    },
    [built],
  );
  return (
    <>
      <primitive object={built.trunks} />
      <primitive object={built.crowns} />
    </>
  );
}

/** Group wrapper that disposes nothing but gives a convenient named container. */
export function District({ children, name }: { children: ReactNode; name: string }) {
  return <group name={name}>{children}</group>;
}
