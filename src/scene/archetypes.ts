import { BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type Arch = "slab" | "stepped" | "tapered" | "wedge" | "twin" | "cylinder" | "spire";
export const ARCHS: Arch[] = ["slab", "stepped", "tapered", "wedge", "twin", "cylinder", "spire"];
export const isRound = (a: Arch) => a === "cylinder" || a === "spire";

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y + h / 2, z);
  return g;
};
const cyl = (r0: number, r1: number, h: number, y: number, seg: number) => {
  const g = new CylinderGeometry(r1, r0, h, seg, 1);
  g.translate(0, y + h / 2, 0);
  return g;
};

function build(kind: Arch, lod: number): BufferGeometry {
  const seg = lod ? 10 : 24;
  switch (kind) {
    case "slab":
      return box(1, 1, 1, 0, 0, 0);
    case "stepped":
      return mergeGeometries([
        box(1, 0.55, 1, 0, 0, 0),
        box(0.78, 0.28, 0.78, 0, 0.55, 0),
        box(0.55, 0.12, 0.55, 0, 0.83, 0),
        box(0.03, 0.1, 0.03, 0, 0.9, 0),
      ])!;
    case "tapered": {
      const g = new BoxGeometry(1, 1, 1);
      g.translate(0, 0.5, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++)
        if (p.getY(i) > 0.99) {
          p.setX(i, p.getX(i) * 0.58);
          p.setZ(i, p.getZ(i) * 0.58);
        }
      g.computeVertexNormals();
      return g;
    }
    case "wedge": {
      const g = new BoxGeometry(1, 1, 1);
      g.translate(0, 0.5, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.99) p.setY(i, 0.74 + 0.26 * (p.getX(i) + 0.5));
      g.computeVertexNormals();
      return g;
    }
    case "twin":
      return mergeGeometries([
        box(0.4, 1, 0.9, -0.28, 0, 0),
        box(0.4, 0.82, 0.9, 0.28, 0, 0),
        box(0.22, 0.06, 0.5, 0, 0.58, 0),
        box(0.22, 0.04, 0.5, 0, 0.74, 0),
      ])!;
    case "cylinder":
      return cyl(0.5, 0.5, 1, 0, seg);
    case "spire": {
      const top = new ConeGeometry(0.32, 0.14, seg, 1);
      top.translate(0, 0.86 + 0.07, 0);
      return mergeGeometries([cyl(0.5, 0.5, 0.7, 0, seg), cyl(0.44, 0.38, 0.16, 0.7, seg), top, cyl(0.02, 0.02, 0.12, 0.9, 6)])!;
    }
  }
}

const cache = new Map<string, BufferGeometry>();
export function archGeometry(kind: Arch, lod = 0): BufferGeometry {
  const k = kind + lod;
  let g = cache.get(k);
  if (!g) {
    g = build(kind, lod);
    cache.set(k, g);
  }
  return g;
}

/** Fraction of footprint width available on the roof & roof height fraction, for rooftop props. */
export function roofInfo(kind: Arch): { top: number; size: number } | null {
  switch (kind) {
    case "slab":
    case "cylinder":
      return { top: 1, size: 0.55 };
    case "stepped":
      return { top: 0.95, size: 0.32 };
    case "tapered":
      return { top: 1, size: 0.3 };
    default:
      return null;
  }
}
