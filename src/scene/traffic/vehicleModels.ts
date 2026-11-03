import { BoxGeometry, BufferGeometry, ConeGeometry, Float32BufferAttribute } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const B = (w: number, h: number, d: number, x: number, y: number, z: number) => {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
};
const tinted = (g: BufferGeometry, r: number, gg: number, b: number) => {
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = r;
    a[i * 3 + 1] = gg;
    a[i * 3 + 2] = b;
  }
  g.setAttribute("color", new Float32BufferAttribute(a, 3));
  return g;
};
/** Exhaust flame cone pointing toward -Z, base at the given point. */
const flame = (x: number, y: number, z: number, r: number, len: number) => {
  const g = new ConeGeometry(r, len, 10, 1, true);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -len / 2);
  const p = g.attributes.position;
  const k = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) k[i] = Math.min(1, Math.max(0, -p.getZ(i) / len));
  g.translate(x, y, z);
  g.setAttribute("aK", new Float32BufferAttribute(k, 1));
  g.setAttribute("aBaseZ", new Float32BufferAttribute(new Float32Array(p.count).fill(z), 1));
  g.deleteAttribute("uv");
  return g;
};
const merge = (parts: BufferGeometry[]) => mergeGeometries(parts, false)!;

export interface VehicleModel {
  body: BufferGeometry;
  lights: BufferGeometry;
  flames: BufferGeometry | null;
  length: number;
}

export type VehicleKind = "car" | "wedge" | "pod" | "train" | "tram" | "cart";

const WHITE = [4, 4.2, 4.6] as const;
const RED = [4.5, 0.25, 0.3] as const;
const WARM = [3.2, 2.4, 1.2] as const;

export function buildVehicle(kind: VehicleKind): VehicleModel {
  switch (kind) {
    case "car": {
      const body = merge([B(1.9, 0.5, 4.4, 0, 0.35, 0), B(1.5, 0.5, 2.2, 0, 0.8, -0.25), B(2.0, 0.08, 0.7, 0, 1.1, -1.9), B(0.16, 0.22, 3.6, 0.98, 0.15, 0), B(0.16, 0.22, 3.6, -0.98, 0.15, 0)]);
      const lights = merge([
        tinted(B(0.5, 0.16, 0.1, 0.55, 0.45, 2.2), ...WHITE),
        tinted(B(0.5, 0.16, 0.1, -0.55, 0.45, 2.2), ...WHITE),
        tinted(B(1.6, 0.12, 0.1, 0, 0.5, -2.2), ...RED),
        tinted(B(1.7, 0.05, 3.2, 0, 0.08, 0), 0.2, 2.2, 3.2),
        tinted(B(1.2, 0.3, 0.05, 0, 0.85, 0.88), 0.4, 0.8, 1.2),
      ]);
      return { body, lights, flames: merge([flame(0.62, 0.35, -2.2, 0.26, 2.2), flame(-0.62, 0.35, -2.2, 0.26, 2.2)]), length: 4.4 };
    }
    case "wedge": {
      const body = merge([B(1.8, 0.35, 4.9, 0, 0.3, 0), B(1.1, 0.35, 1.7, 0, 0.62, -0.3), B(2.5, 0.08, 0.8, 0, 0.9, -2.1), B(0.1, 0.35, 0.6, 1.1, 0.7, -2.1), B(0.1, 0.35, 0.6, -1.1, 0.7, -2.1)]);
      const lights = merge([
        tinted(B(1.4, 0.07, 0.1, 0, 0.38, 2.45), ...WHITE),
        tinted(B(2.2, 0.06, 0.08, 0, 0.78, -2.5), ...RED),
        tinted(B(1.5, 0.05, 3.6, 0, 0.1, 0), 3.2, 0.3, 2.6),
      ]);
      return { body, lights, flames: merge([flame(0, 0.3, -2.45, 0.38, 3.0)]), length: 4.9 };
    }
    case "pod": {
      const body = merge([B(2.6, 2.0, 7.6, 0, 1.3, 0), B(2.2, 0.35, 6.8, 0, 2.4, 0)]);
      const lights = merge([
        tinted(B(0.06, 0.7, 6.2, 1.32, 1.7, 0), ...WARM),
        tinted(B(0.06, 0.7, 6.2, -1.32, 1.7, 0), ...WARM),
        tinted(B(1.8, 0.2, 0.08, 0, 1.3, 3.82), ...WHITE),
        tinted(B(1.8, 0.2, 0.08, 0, 1.3, -3.82), ...RED),
        tinted(B(2.0, 0.06, 6.8, 0, 0.2, 0), 0.3, 2.4, 2.0),
      ]);
      return { body, lights, flames: merge([flame(0.9, 0.5, -3.8, 0.3, 2.0), flame(-0.9, 0.5, -3.8, 0.3, 2.0)]), length: 7.6 };
    }
    case "train":
    case "tram": {
      const L = kind === "train" ? 11 : 9;
      const H = kind === "train" ? 2.8 : 2.5;
      const body = merge([B(3.0, H, L, 0, H / 2 + 0.2, 0), B(2.4, 0.3, L - 1, 0, H + 0.45, 0)]);
      const lights = merge([
        tinted(B(0.06, 0.8, L - 1.6, 1.52, H * 0.62, 0), ...WARM),
        tinted(B(0.06, 0.8, L - 1.6, -1.52, H * 0.62, 0), ...WARM),
        tinted(B(2.0, 0.22, 0.08, 0, H * 0.5, L / 2 + 0.02), ...WHITE),
        tinted(B(2.0, 0.22, 0.08, 0, H * 0.5, -L / 2 - 0.02), ...RED),
        tinted(B(2.9, 0.1, 0.08, 0, 0.35, 0), 0.2, 2.6, 3.2),
      ]);
      return { body, lights, flames: null, length: L };
    }
    case "cart": {
      const body = merge([B(2.0, 0.9, 3.2, 0, 0.7, 0), B(1.4, 0.7, 1.3, 0, 1.4, 0.5), B(1.8, 0.2, 1.6, 0, 1.2, -1.0)]);
      const lights = merge([tinted(B(1.2, 0.14, 0.08, 0, 0.9, 1.62), ...WHITE), tinted(B(0.35, 0.3, 0.35, 0, 1.9, 0.3), 5, 2.4, 0.2), tinted(B(1.4, 0.1, 0.08, 0, 0.9, -1.62), ...RED)]);
      return { body, lights, flames: null, length: 3.2 };
    }
  }
}
