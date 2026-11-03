import { Vector3 } from "three";
import { LAYOUT } from "./layout";

// Lightweight spatial-hash AABB registry used by free camera and flying vehicle.
export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

const CELL = 48;
const grid = new Map<string, Box[]>();
let count = 0;

const key = (i: number, j: number) => i + "," + j;

export function clearColliders() {
  grid.clear();
  count = 0;
}

export function registerBox(b: Box) {
  count++;
  const i0 = Math.floor(b.x0 / CELL);
  const i1 = Math.floor(b.x1 / CELL);
  const j0 = Math.floor(b.z0 / CELL);
  const j1 = Math.floor(b.z1 / CELL);
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) {
      const k = key(i, j);
      let arr = grid.get(k);
      if (!arr) grid.set(k, (arr = []));
      arr.push(b);
    }
}

/** Register a (possibly rotated) rectangular footprint building by its conservative AABB. */
export function registerFootprint(x: number, y0: number, z: number, w: number, h: number, d: number, rot: number) {
  const c = Math.abs(Math.cos(rot));
  const s = Math.abs(Math.sin(rot));
  const hx = (w * c + d * s) / 2;
  const hz = (w * s + d * c) / 2;
  registerBox({ x0: x - hx, x1: x + hx, y0, y1: y0 + h, z0: z - hz, z1: z + hz });
}

export const colliderCount = () => count;

/** Pushes sphere (p, r) out of any overlapping box along the axis of least penetration. Returns true if it hit. */
export function resolveSphere(p: Vector3, r: number): boolean {
  let hit = false;
  const i = Math.floor(p.x / CELL);
  const j = Math.floor(p.z / CELL);
  for (let a = i - 1; a <= i + 1; a++)
    for (let b = j - 1; b <= j + 1; b++) {
      const arr = grid.get(key(a, b));
      if (!arr) continue;
      for (let n = 0; n < arr.length; n++) {
        const bx = arr[n];
        const cx = Math.max(bx.x0, Math.min(p.x, bx.x1));
        const cy = Math.max(bx.y0, Math.min(p.y, bx.y1));
        const cz = Math.max(bx.z0, Math.min(p.z, bx.z1));
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dz = p.z - cz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const k = (r - d) / d;
          p.x += dx * k;
          p.y += dy * k;
          p.z += dz * k;
        } else {
          // centre inside the box: push out along the nearest face
          const px = Math.min(p.x - bx.x0, bx.x1 - p.x);
          const py = Math.min(p.y - bx.y0, bx.y1 - p.y);
          const pz = Math.min(p.z - bx.z0, bx.z1 - p.z);
          if (px <= py && px <= pz) p.x = p.x - bx.x0 < bx.x1 - p.x ? bx.x0 - r : bx.x1 + r;
          else if (py <= pz) p.y = p.y - bx.y0 < bx.y1 - p.y ? bx.y0 - r : bx.y1 + r;
          else p.z = p.z - bx.z0 < bx.z1 - p.z ? bx.z0 - r : bx.z1 + r;
        }
      }
    }
  return hit;
}

const { ug } = LAYOUT;
export function isUnderground(x: number, y: number, z: number) {
  return y < -0.5 && Math.hypot(x - ug.x, z - ug.z) < ug.cavR + 5;
}

/**
 * Keeps a body inside the world: above ground, inside the cavern when below ground,
 * and inside world boundaries. Returns true if a boundary was touched.
 */
export function constrainToWorld(prev: Vector3, p: Vector3, r: number): boolean {
  let hit = false;
  const dShaft = Math.hypot(p.x - ug.x, p.z - ug.z);
  const wasUnder = prev.y < 0;
  if (dShaft < ug.shaftR - r) {
    if (p.y < ug.floorY + r) {
      p.y = ug.floorY + r;
      hit = true;
    }
  } else if (wasUnder) {
    if (p.y < ug.floorY + r) {
      p.y = ug.floorY + r;
      hit = true;
    }
    if (p.y > -r) {
      p.y = -r;
      hit = true;
    }
    if (dShaft > ug.cavR - r) {
      const k = (ug.cavR - r) / dShaft;
      p.x = ug.x + (p.x - ug.x) * k;
      p.z = ug.z + (p.z - ug.z) * k;
      hit = true;
    }
  } else if (p.y < r) {
    p.y = r;
    hit = true;
  }
  const wr = LAYOUT.world.radius;
  const d = Math.hypot(p.x, p.z);
  if (d > wr) {
    p.x *= wr / d;
    p.z *= wr / d;
    hit = true;
  }
  if (p.y > LAYOUT.world.maxY) {
    p.y = LAYOUT.world.maxY;
    hit = true;
  }
  return hit;
}
