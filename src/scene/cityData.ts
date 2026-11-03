import { mulberry32 } from "../core/rng";
import { LAYOUT, SKY_PLATFORMS, OBS_DECK } from "../core/layout";
import { safePoints } from "../core/paths";
import { clearColliders, registerBox, registerFootprint } from "../core/collision";
import { roofInfo, type Arch } from "./archetypes";

export interface Bld {
  kind: Arch;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  rot: number;
  tint: number;
}
export interface Prop {
  kind: "mech" | "antenna" | "pad";
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
}
export interface Blob {
  x: number;
  y: number;
  z: number;
  s: number;
  c: number;
}
export interface TreeI {
  x: number;
  y: number;
  z: number;
  s: number;
  c: number;
}
export interface BoxI {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
}

export interface CityData {
  downtown: Bld[];
  downtownProps: Prop[];
  bridges: BoxI[];
  downtownBeacons: number[]; // x,y,z triplets
  neon: Bld[];
  neonBlocks: { x: number; z: number }[];
  sky: Bld[];
  skyTrees: TreeI[];
  green: Bld[];
  foliage: Blob[];
  trees: TreeI[];
  hills: { x: number; z: number; r: number; h: number }[];
  ugBuildings: Bld[];
  skyline: Bld[];
  skylineBeacons: number[];
  safe: [number, number, number][];
}

export function hillHeight(hills: CityData["hills"], x: number, z: number) {
  let h = 0;
  for (const k of hills) {
    const d = Math.hypot(x - k.x, z - k.z) / k.r;
    if (d < 1) h = Math.max(h, k.h * Math.sqrt(1 - d * d));
  }
  return h;
}

let cached: CityData | null = null;
export function getCity(): CityData {
  if (cached) return cached;
  clearColliders();
  const safe = safePoints();
  const nearSafe = (x: number, z: number, pad = 0, maxR = 999) => safe.some(([sx, sz, r]) => r <= maxR && Math.hypot(x - sx, z - sz) < r + pad);

  const pick = <T,>(r: () => number, arr: T[]) => arr[Math.floor(r() * arr.length) % arr.length];
  const reg = (b: Bld) => registerFootprint(b.x, b.y, b.z, b.w, b.h, b.d, b.rot);
  const round = (k: Arch) => k === "cylinder" || k === "spire";

  // ------------------------------------------------------------------ Downtown
  const rng = mulberry32(2087);
  const downtown: Bld[] = [];
  const bridges: BoxI[] = [];
  const full: { i: number; j: number; h: number; cx: number; cz: number }[] = [];
  const G = LAYOUT.downtown.grid;
  for (let i = -3; i <= 3; i++)
    for (let j = -3; j <= 3; j++) {
      if ((i === 0 && j === 0) || (i === 2 && j === -1)) continue;
      if ((i === 1 && j === 1) || (i === -1 && j === -2)) continue; // plazas
      const cx = i * G;
      const cz = j * G;
      const f = Math.max(0, 1 - Math.hypot(cx, cz) / 270);
      const m = rng();
      const lots = m < 0.4 ? 1 : m < 0.75 ? 2 : 4;
      const B = 42;
      let spec: [number, number, number, number][];
      if (lots === 1) spec = [[0, 0, B - 2, B - 2]];
      else if (lots === 2) {
        spec = rng() < 0.5
          ? [[-B / 4, 0, B / 2 - 1.5, B - 2], [B / 4, 0, B / 2 - 1.5, B - 2]]
          : [[0, -B / 4, B - 2, B / 2 - 1.5], [0, B / 4, B - 2, B / 2 - 1.5]];
      } else spec = [[-B / 4, -B / 4, 19.5, 19.5], [B / 4, -B / 4, 19.5, 19.5], [-B / 4, B / 4, 19.5, 19.5], [B / 4, B / 4, 19.5, 19.5]];
      let blockH = 0;
      for (const [ox, oz, w0, d0] of spec) {
        const base = 45 + Math.pow(f, 1.3) * 240;
        let h = base * (0.7 + rng() * 0.6) + rng() * 30;
        if (lots === 4) h *= 0.78;
        h = Math.min(h, 330);
        const r = rng();
        let kind: Arch;
        if (lots === 1 && h > 150 && r < 0.25) kind = "twin";
        else if (h > 170) kind = r < 0.3 ? "stepped" : r < 0.55 ? "tapered" : r < 0.75 ? "spire" : r < 0.9 ? "wedge" : "cylinder";
        else if (h > 90) kind = r < 0.25 ? "slab" : r < 0.45 ? "wedge" : r < 0.65 ? "tapered" : r < 0.8 ? "cylinder" : "stepped";
        else kind = r < 0.5 ? "slab" : r < 0.7 ? "wedge" : r < 0.85 ? "cylinder" : "stepped";
        let w = w0;
        let d = d0;
        if (round(kind)) w = d = Math.min(w0, d0) * 0.98;
        const b: Bld = { kind, x: cx + ox, y: 0, z: cz + oz, w, h, d, rot: 0, tint: Math.floor(rng() * 5) };
        downtown.push(b);
        reg(b);
        blockH = Math.max(blockH, h);
      }
      if (lots === 1 && !round(downtown[downtown.length - 1].kind)) full.push({ i, j, h: blockH, cx, cz });
    }
  // sky bridges between neighbouring full blocks
  const fullAt = (i: number, j: number) => full.find((f) => f.i === i && f.j === j);
  for (const a of full) {
    for (const [di, dj] of [[1, 0], [0, 1]] as const) {
      const b = fullAt(a.i + di, a.j + dj);
      if (!b || a.h < 100 || b.h < 100 || rng() < 0.35) continue;
      const y = Math.min(a.h, b.h) * (0.45 + rng() * 0.2);
      const mx = (a.cx + b.cx) / 2;
      const mz = (a.cz + b.cz) / 2;
      const bx: BoxI = di ? { x: mx, y, z: mz, sx: 22, sy: 4.5, sz: 5 } : { x: mx, y, z: mz, sx: 5, sy: 4.5, sz: 22 };
      bridges.push(bx);
      registerBox({ x0: bx.x - bx.sx / 2, x1: bx.x + bx.sx / 2, y0: y, y1: y + bx.sy, z0: bx.z - bx.sz / 2, z1: bx.z + bx.sz / 2 });
    }
  }
  // central tower (landmark) collision + hub
  registerBox({ x0: -28, x1: 28, y0: 0, y1: 450, z0: -28, z1: 28 });
  registerBox({ x0: LAYOUT.hub.x - 22, x1: LAYOUT.hub.x + 22, y0: 0, y1: 26, z0: LAYOUT.hub.z - 22, z1: LAYOUT.hub.z + 22 });

  // rooftop props + beacons
  const downtownProps: Prop[] = [];
  const downtownBeacons: number[] = [];
  for (const b of downtown) {
    if (b.h < 70) continue;
    const info = roofInfo(b.kind);
    if (info) {
      const top = b.y + b.h * info.top;
      const span = Math.min(b.w, b.d) * info.size;
      const r = rng();
      if (r < 0.55) {
        downtownProps.push({ kind: "mech", x: b.x + (rng() - 0.5) * span * 0.4, y: top, z: b.z + (rng() - 0.5) * span * 0.4, sx: span * (0.5 + rng() * 0.4), sy: 3 + rng() * 5, sz: span * (0.5 + rng() * 0.4) });
      }
      if (r > 0.3 && r < 0.8) {
        const ah = 10 + rng() * 22;
        const ax = b.x + (rng() - 0.5) * span * 0.6;
        const az = b.z + (rng() - 0.5) * span * 0.6;
        downtownProps.push({ kind: "antenna", x: ax, y: top, z: az, sx: 0.6, sy: ah, sz: 0.6 });
        downtownBeacons.push(ax, top + ah, az);
      } else if (r >= 0.8 && b.kind === "slab" && Math.min(b.w, b.d) > 28) {
        downtownProps.push({ kind: "pad", x: b.x, y: top, z: b.z, sx: span * 0.7, sy: 0.4, sz: span * 0.7 });
      }
    } else if (b.h > 150) {
      downtownBeacons.push(b.x, b.y + b.h + (b.kind === "spire" ? 0 : 0), b.z);
    }
  }

  // ------------------------------------------------------------------ Neon
  const neon: Bld[] = [];
  const neonBlocks: { x: number; z: number }[] = [];
  const NR = mulberry32(4411);
  for (let a = 0; a < 6; a++)
    for (let c = 0; c < 6; c++) {
      const cx = 300 + 40 * a;
      const cz = -60 + 40 * c;
      if ((a === 1 && c === 3) || (a === 4 && c === 1)) {
        neonBlocks.push({ x: cx, z: cz });
        continue;
      }
      const f = Math.max(0, 1 - Math.hypot(cx - LAYOUT.neon.x, cz - LAYOUT.neon.z) / 190);
      const m = NR();
      const lots = m < 0.35 ? 1 : m < 0.7 ? 2 : 4;
      const B = 30;
      let spec: [number, number, number, number][];
      if (lots === 1) spec = [[0, 0, B - 2, B - 2]];
      else if (lots === 2) spec = NR() < 0.5 ? [[-B / 4, 0, B / 2 - 1, B - 2], [B / 4, 0, B / 2 - 1, B - 2]] : [[0, -B / 4, B - 2, B / 2 - 1], [0, B / 4, B - 2, B / 2 - 1]];
      else spec = [[-B / 4, -B / 4, 13.5, 13.5], [B / 4, -B / 4, 13.5, 13.5], [-B / 4, B / 4, 13.5, 13.5], [B / 4, B / 4, 13.5, 13.5]];
      for (const [ox, oz, w0, d0] of spec) {
        const h = Math.min(92, 18 + f * 60 + NR() * 28 + (lots === 1 ? 10 : 0));
        const r = NR();
        const kind: Arch = h > 60 ? (r < 0.3 ? "stepped" : r < 0.6 ? "tapered" : r < 0.8 ? "wedge" : "slab") : r < 0.4 ? "slab" : r < 0.65 ? "wedge" : r < 0.85 ? "cylinder" : "stepped";
        let w = w0;
        let d = d0;
        if (round(kind)) w = d = Math.min(w0, d0) * 0.95;
        const b: Bld = { kind, x: cx + ox, y: 0, z: cz + oz, w, h, d, rot: 0, tint: Math.floor(NR() * 5) };
        neon.push(b);
        reg(b);
      }
    }
  // arena collision
  registerBox({ x0: LAYOUT.arena.x - 48, x1: LAYOUT.arena.x + 48, y0: 0, y1: 55, z0: LAYOUT.arena.z - 48, z1: LAYOUT.arena.z + 48 });

  // ------------------------------------------------------------------ Sky district
  const sky: Bld[] = [];
  const skyTrees: TreeI[] = [];
  const SR = mulberry32(777);
  const sc = LAYOUT.sky;
  SKY_PLATFORMS.forEach((p, pi) => {
    const towers: { x: number; z: number; r: number }[] = [];
    const n = pi === 0 ? 5 : 4;
    for (let t = 0, tries = 0; t < n && tries < 80; tries++) {
      const ang = SR() * Math.PI * 2;
      const rad = p.r * (0.25 + SR() * 0.45);
      const x = p.x + Math.cos(ang) * rad;
      const z = p.z + Math.sin(ang) * rad;
      const ringD = Math.abs(Math.hypot(x - sc.x, z - sc.z) - sc.ringR);
      if (ringD < 12 && pi !== 0) continue;
      if (pi !== 0 && Math.hypot(x - sc.x, z - sc.z) < 48 + 8) continue;
      if (nearSafe(x, z, 4, 20)) continue;
      const w = 9 + SR() * 7;
      if (towers.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + w + 3)) continue;
      const h = pi === 0 ? 38 + SR() * 26 : 36 + SR() * 62; // P0 stays below the observation deck
      const kind = pick(SR, ["tapered", "stepped", "spire", "cylinder", "wedge", "tapered"] as Arch[]);
      const ww = round(kind) ? w : w;
      const b: Bld = { kind, x, y: p.y, z, w: ww, h, d: ww, rot: SR() * 3, tint: Math.floor(SR() * 5) };
      if (round(kind)) b.rot = 0;
      sky.push(b);
      reg(b);
      towers.push({ x, z, r: ww * 0.75 });
      t++;
    }
    // residential pods on the rim
    for (let k = 0; k < 7; k++) {
      const ang = (k / 7) * Math.PI * 2 + SR() * 0.4;
      const rad = p.r * 0.84;
      const x = p.x + Math.cos(ang) * rad;
      const z = p.z + Math.sin(ang) * rad;
      if (nearSafe(x, z, 4, 20)) continue;
      if (pi !== 0 && Math.hypot(x - sc.x, z - sc.z) < 48 + 8) continue;
      if (Math.abs(Math.hypot(x - sc.x, z - sc.z) - sc.ringR) < 12 && pi !== 0) continue;
      const b: Bld = { kind: "cylinder", x, y: p.y, z, w: 6 + SR() * 3, h: 7 + SR() * 8, d: 0, rot: 0, tint: Math.floor(SR() * 5) };
      b.d = b.w;
      sky.push(b);
      reg(b);
    }
    // rooftop-garden trees on the deck
    for (let k = 0; k < 26; k++) {
      const ang = SR() * Math.PI * 2;
      const rad = p.r * (0.3 + SR() * 0.6);
      const x = p.x + Math.cos(ang) * rad;
      const z = p.z + Math.sin(ang) * rad;
      if (nearSafe(x, z, 2, 20)) continue;
      if (sky.some((b) => b.y === p.y && Math.hypot(b.x - x, b.z - z) < Math.max(b.w, b.d) * 0.8 + 2)) continue;
      if (Math.abs(Math.hypot(x - sc.x, z - sc.z) - sc.ringR) < 6) continue;
      skyTrees.push({ x, y: p.y, z, s: 1.2 + SR() * 1.6, c: Math.floor(SR() * 4) });
    }
    registerBox({ x0: p.x - p.r, x1: p.x + p.r, y0: p.y - 22, y1: p.y, z0: p.z - p.r, z1: p.z + p.r });
  });
  registerBox({ x0: OBS_DECK.x - OBS_DECK.r, x1: OBS_DECK.x + OBS_DECK.r, y0: OBS_DECK.y - 8, y1: OBS_DECK.y, z0: OBS_DECK.z - OBS_DECK.r, z1: OBS_DECK.z + OBS_DECK.r });

  // ------------------------------------------------------------------ Green district
  const green: Bld[] = [];
  const foliage: Blob[] = [];
  const GR = mulberry32(31337);
  const gc = LAYOUT.green;
  const toDown = Math.atan2(-gc.z, -gc.x); // direction from green centre toward downtown
  for (let k = 0; k < 16; k++) {
    const ang = (k / 16) * Math.PI * 2 + GR() * 0.2;
    let da = Math.abs(ang - toDown);
    da = Math.min(da, Math.PI * 2 - da);
    if (da < 0.9) continue;
    const rad = 130 + GR() * 42;
    const x = gc.x + Math.cos(ang) * rad;
    const z = gc.z + Math.sin(ang) * rad;
    if (nearSafe(x, z, 10)) continue;
    const kind = pick(GR, ["tapered", "cylinder", "stepped", "slab", "cylinder"] as Arch[]);
    const w = 18 + GR() * 8;
    const h = 70 + GR() * 90;
    const b: Bld = { kind, x, y: 0, z, w, h, d: w, rot: 0, tint: Math.floor(GR() * 5) };
    green.push(b);
    reg(b);
    // balcony terraces covered in plants
    const levels = Math.floor(h / 9);
    for (let l = 1; l <= levels; l++) {
      const y = l * 9;
      const taper = kind === "tapered" ? 1 - 0.42 * (y / h) : kind === "stepped" ? (y / h < 0.55 ? 1 : y / h < 0.83 ? 0.78 : 0.55) : 1;
      const half = (w / 2) * taper;
      const nb = 8;
      for (let q = 0; q < nb; q++) {
        let bx: number;
        let bz: number;
        if (kind === "cylinder" || kind === "spire") {
          const a2 = (q / nb) * Math.PI * 2 + l * 0.5;
          bx = x + Math.cos(a2) * half;
          bz = z + Math.sin(a2) * half;
        } else {
          const t = (q / nb) * 4;
          const side = Math.floor(t);
          const u = (t - side) * 2 - 1;
          const e = half;
          bx = x + (side === 0 ? e : side === 2 ? -e : u * e);
          bz = z + (side === 1 ? e : side === 3 ? -e : u * e);
        }
        foliage.push({ x: bx, y: y + 1, z: bz, s: 2.2 + GR() * 2.4, c: Math.floor(GR() * 4) });
      }
    }
  }
  // rolling hills
  const hills: CityData["hills"] = [];
  for (let k = 0, tries = 0; k < 9 && tries < 100; tries++) {
    const ang = GR() * Math.PI * 2;
    const rad = 30 + GR() * 130;
    const x = gc.x + Math.cos(ang) * rad;
    const z = gc.z + Math.sin(ang) * rad;
    const r = 24 + GR() * 28;
    if (Math.hypot(x - LAYOUT.lake.x, z - LAYOUT.lake.z) < LAYOUT.lake.r + r) continue;
    if (Math.hypot(x - LAYOUT.museum.x, z - LAYOUT.museum.z) < 50 + r) continue;
    if (nearSafe(x, z, r * 0.5, 20)) continue;
    if (z > 560) continue;
    hills.push({ x, z, r, h: 6 + GR() * 8 });
    k++;
  }
  // park trees
  const trees: TreeI[] = [];
  for (let t = 0, tries = 0; t < 780 && tries < 4000; tries++) {
    const ang = GR() * Math.PI * 2;
    const rad = Math.sqrt(GR()) * (gc.r - 6);
    const x = gc.x + Math.cos(ang) * rad;
    const z = gc.z + Math.sin(ang) * rad;
    if (Math.hypot(x - LAYOUT.lake.x, z - LAYOUT.lake.z) < LAYOUT.lake.r + 6) continue;
    if (Math.hypot(x - LAYOUT.museum.x, z - LAYOUT.museum.z) < 52) continue;
    if (z > 560 && Math.abs(x - 150) < 60) continue; // cliff
    if (x > 255 && x < 330 && z > 490 && z < 550) continue; // solar field
    if (green.some((b) => Math.hypot(b.x - x, b.z - z) < b.w * 0.9 + 3)) continue;
    if (nearSafe(x, z, 3, 20)) continue;
    if (nearSafe(x, z, 0, 60) && z < 380) continue;
    const pathY = gc.z + 70 * Math.sin(x * 0.018 + 1.0);
    if (Math.abs(z - pathY) < 4) continue;
    trees.push({ x, y: hillHeight(hills, x, z), z, s: 0.8 + GR() * 1.1, c: Math.floor(GR() * 4) });
    t++;
  }
  // cliff + museum + lake collisions
  registerBox({ x0: 108, x1: 192, y0: 0, y1: 48, z0: 566, z1: 608 });
  registerBox({ x0: LAYOUT.museum.x - 30, x1: LAYOUT.museum.x + 30, y0: 0, y1: 62, z0: LAYOUT.museum.z - 30, z1: LAYOUT.museum.z + 30 });

  // ------------------------------------------------------------------ Underground
  const ug = LAYOUT.ug;
  const UR = mulberry32(9090);
  const ugBuildings: Bld[] = [];
  const addUg = (b: Bld) => {
    ugBuildings.push(b);
    reg(b);
  };
  // reactor tanks
  for (let k = 0; k < 7; k++) {
    const ang = (k / 7) * Math.PI * 2 + 0.3;
    const rad = k % 2 ? 98 : 118;
    const r = 10 + UR() * 4;
    addUg({ kind: "cylinder", x: ug.x + Math.cos(ang) * rad, y: ug.floorY, z: ug.z + Math.sin(ang) * rad, w: r * 2, h: 34 + UR() * 30, d: r * 2, rot: 0, tint: 0 });
  }
  // research facility complex (landmark)
  const fx = -290;
  const fz = 60;
  addUg({ kind: "slab", x: fx, y: ug.floorY, z: fz, w: 42, h: 18, d: 30, rot: 0.3, tint: 1 });
  addUg({ kind: "stepped", x: fx + 24, y: ug.floorY, z: fz - 16, w: 22, h: 34, d: 22, rot: 0.3, tint: 2 });
  addUg({ kind: "cylinder", x: fx - 22, y: ug.floorY, z: fz + 20, w: 16, h: 28, d: 16, rot: 0, tint: 1 });
  addUg({ kind: "slab", x: fx - 12, y: ug.floorY, z: fz - 26, w: 22, h: 12, d: 12, rot: 0.3, tint: 0 });
  addUg({ kind: "spire", x: fx + 22, y: ug.floorY, z: fz + 22, w: 12, h: 36, d: 12, rot: 0, tint: 2 });
  // depot sheds
  for (let k = 0; k < 6; k++) {
    const ang = UR() * Math.PI * 2;
    const rad = 150 + UR() * 60;
    const x = ug.x + Math.cos(ang) * rad;
    const z = ug.z + Math.sin(ang) * rad;
    if (Math.abs(rad - 175) < 14 || Math.abs(rad - 205) < 14) continue;
    addUg({ kind: "slab", x, y: ug.floorY, z, w: 16 + UR() * 14, h: 9 + UR() * 10, d: 14 + UR() * 10, rot: ang, tint: 0 });
  }
  // core pillar + columns
  registerBox({ x0: ug.x - 10, x1: ug.x + 10, y0: ug.floorY, y1: ug.floorY + 82, z0: ug.z - 10, z1: ug.z + 10 });
  for (const [R, N] of [[140, 14], [228, 22]] as const)
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      registerBox({ x0: ug.x + Math.cos(a) * R - 4, x1: ug.x + Math.cos(a) * R + 4, y0: ug.floorY, y1: 0, z0: ug.z + Math.sin(a) * R - 4, z1: ug.z + Math.sin(a) * R + 4 });
    }

  // ------------------------------------------------------------------ Outer skyline
  const skyline: Bld[] = [];
  const skylineBeacons: number[] = [];
  const KR = mulberry32(555);
  const CELLS = 36;
  const R = 1250;
  for (let ci = -Math.ceil(R / CELLS); ci <= Math.ceil(R / CELLS); ci++)
    for (let cj = -Math.ceil(R / CELLS); cj <= Math.ceil(R / CELLS); cj++) {
      const x = ci * CELLS + (KR() - 0.5) * 3;
      const z = cj * CELLS + (KR() - 0.5) * 3;
      const rr = Math.hypot(x, z);
      if (rr < 255 || rr > R) continue;
      // exclusion zones
      if (Math.abs(x - LAYOUT.neon.x) < 160 && Math.abs(z - LAYOUT.neon.z) < 160) continue;
      if (Math.hypot(x - LAYOUT.arena.x, z - LAYOUT.arena.z) < 85) continue;
      if (Math.hypot(x - gc.x, z - gc.z) < gc.r + 14) continue;
      if (Math.hypot(x - ug.x, z - ug.z) < 118) continue;
      if (Math.abs(x - LAYOUT.boulevard.x) < LAYOUT.boulevard.half + 6 && z > LAYOUT.boulevard.zStart - 15) continue;
      if (nearSafe(x, z, 6)) continue;
      const dens = 0.62 - rr / 3000;
      if (KR() > dens) continue;
      let h: number;
      if (rr < 420) h = 16 + KR() * 92;
      else h = 30 + KR() * Math.min(260, (rr - 300) * 0.28 + 40);
      if (rr > 900 && KR() < 0.04) h *= 1.6;
      const r = KR();
      const kind: Arch = h > 150 ? (r < 0.3 ? "tapered" : r < 0.5 ? "stepped" : r < 0.65 ? "spire" : r < 0.8 ? "wedge" : "twin") : r < 0.4 ? "slab" : r < 0.6 ? "wedge" : r < 0.8 ? "cylinder" : "tapered";
      let w = 14 + KR() * 17;
      let d = 14 + KR() * 17;
      if (kind === "twin" && Math.min(w, d) < 24) {
        w = Math.max(w, 26);
        d = Math.max(d, 26);
      }
      if (round(kind)) w = d = Math.min(w, d);
      const b: Bld = { kind, x, y: 0, z, w, h, d, rot: 0, tint: Math.floor(KR() * 5) };
      skyline.push(b);
      if (rr < 900) reg(b);
      if (h > 170 && skylineBeacons.length < 3 * 260) skylineBeacons.push(x, h, z);
    }

  cached = { downtown, downtownProps, bridges, downtownBeacons, neon, neonBlocks, sky, skyTrees, green, foliage, trees, hills, ugBuildings, skyline, skylineBeacons, safe };
  return cached;
}
