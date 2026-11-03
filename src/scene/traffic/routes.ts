import { CatmullRomCurve3, Vector3 } from "three";
import { LAYOUT } from "../../core/layout";

/** Uniformly resampled polyline path with position/tangent lookup by arc length. */
export class Path {
  pts: Vector3[] = [];
  len = 0;
  step = 2;
  constructor(
    raw: Vector3[],
    public closed: boolean,
    spacing = 2,
  ) {
    const src = closed ? [...raw, raw[0]] : raw;
    const cum = [0];
    for (let i = 1; i < src.length; i++) cum.push(cum[i - 1] + src[i].distanceTo(src[i - 1]));
    const total = cum[cum.length - 1];
    const n = Math.max(2, Math.round(total / spacing));
    this.step = total / n;
    this.len = total;
    let seg = 1;
    for (let i = 0; i <= n; i++) {
      const d = i * this.step;
      while (seg < cum.length - 1 && cum[seg] < d) seg++;
      const t = (d - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]);
      this.pts.push(src[seg - 1].clone().lerp(src[seg], Math.min(1, Math.max(0, t))));
    }
  }
  private idx(s: number) {
    const n = this.pts.length - 1;
    if (this.closed) s = ((s % this.len) + this.len) % this.len;
    else s = Math.min(this.len, Math.max(0, s));
    const f = s / this.step;
    const i = Math.min(n - 1, Math.floor(f));
    return { i, t: f - i };
  }
  pos(s: number, out: Vector3) {
    const { i, t } = this.idx(s);
    return out.copy(this.pts[i]).lerp(this.pts[Math.min(i + 1, this.pts.length - 1)], t);
  }
  dir(s: number, out: Vector3) {
    const { i } = this.idx(s);
    const N = this.pts.length - 1; // segment count (closed paths repeat the first point at index N)
    const j = this.closed ? (i + 2) % N : Math.min(i + 2, N);
    out.copy(this.pts[j]).sub(this.pts[i]);
    if (out.lengthSq() < 1e-8) out.set(0, 0, 1);
    return out.normalize();
  }
}

const V = (x: number, y: number, z: number) => new Vector3(x, y, z);

export function circlePath(cx: number, cz: number, r: number, y: number, wobble: number, dir: 1 | -1, n = 72) {
  const p: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 * dir;
    p.push(V(cx + Math.cos(a) * r, y + Math.sin(a * 2) * wobble, cz + Math.sin(a) * r));
  }
  return new Path(p, true);
}

export function ellipsePath(cx: number, cz: number, rx: number, rz: number, y: number, dir: 1 | -1, n = 72) {
  const p: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 * dir;
    p.push(V(cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz));
  }
  return new Path(p, true);
}

export function roundedRectPath(hx: number, hz: number, r: number, y: number, dir: 1 | -1) {
  const pts: Vector3[] = [];
  const corners: [number, number, number][] = [
    [hx - r, hz - r, 0],
    [-hx + r, hz - r, Math.PI / 2],
    [-hx + r, -hz + r, Math.PI],
    [hx - r, -hz + r, Math.PI * 1.5],
  ];
  for (const [cx, cz, a0] of corners)
    for (let k = 0; k <= 10; k++) {
      const a = a0 + (k / 10) * (Math.PI / 2);
      pts.push(V(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r));
    }
  if (dir < 0) pts.reverse();
  return new Path(pts, true);
}

export function splinePath(points: [number, number, number][], closed: boolean, divisions = 400) {
  const c = new CatmullRomCurve3(points.map((p) => V(...p)), closed, "centripetal");
  return new Path(c.getPoints(divisions).slice(0, closed ? divisions : divisions + 1), closed);
}

export function linePath(a: [number, number, number], b: [number, number, number]) {
  return new Path([V(...a), V(...b)], false);
}

export interface AirRoute {
  id: string;
  path: Path;
  speed: number;
  count: number;
  open: boolean;
  lateral: number;
  types: ("car" | "wedge" | "pod")[];
}

export function airRoutes(): AirRoute[] {
  const out: AirRoute[] = [];
  const add = (id: string, path: Path, speed: number, count: number, open: boolean, types: AirRoute["types"], lateral = 0) =>
    out.push({ id, path, speed, count, open, lateral, types });
  // skyline rings around Downtown (clear of the outer skyline height cap)
  add("ringA", circlePath(0, 0, 320, 170, 10, 1), 34, 7, false, ["car", "car", "wedge"]);
  add("ringB", circlePath(0, 0, 340, 188, 8, -1), 41, 7, false, ["car", "wedge", "car"]);
  add("ringC", circlePath(0, 0, 300, 152, 6, 1), 28, 6, false, ["car", "pod", "car"]);
  // grand loop touching every district
  add(
    "grand",
    splinePath(
      [[-540, 200, 40], [-420, 210, -200], [-100, 380, -130], [240, 300, -200], [520, 200, -140], [640, 190, 60], [560, 200, 260], [360, 220, 360], [60, 220, 400], [-300, 200, 320]],
      true,
    ),
    52,
    9,
    false,
    ["wedge", "car", "car", "pod"],
  );
  // avenue lanes (z-avenues at alt 36, x-avenues at alt 28; open → fade at the ends)
  for (const x0 of [-150, -30, 90]) {
    add(`av-z+${x0}`, linePath([x0 + 3.5, 36, -300], [x0 + 3.5, 36, 300]), 22, 3, true, ["car", "car", "wedge"]);
    add(`av-z-${x0}`, linePath([x0 - 3.5, 36, 300], [x0 - 3.5, 36, -300]), 25, 3, true, ["car", "wedge", "car"]);
  }
  for (const z0 of [-90, 30, 150]) {
    add(`av-x+${z0}`, linePath([-300, 28, z0 + 3.5], [300, 28, z0 + 3.5]), 24, 3, true, ["car", "car", "pod"]);
    add(`av-x-${z0}`, linePath([300, 28, z0 - 3.5], [-300, 28, z0 - 3.5]), 21, 3, true, ["wedge", "car", "car"]);
  }
  // Neon district low lanes
  add("neon-1", linePath([240, 40, 40 + 2.5], [630, 40, 40 + 2.5]), 17, 3, true, ["car", "wedge"]);
  add("neon-2", linePath([630, 43, 40 - 2.5], [240, 43, 40 - 2.5]), 19, 3, true, ["wedge", "car"]);
  add("neon-3", linePath([400 + 2.5, 48, -120], [400 + 2.5, 48, 210]), 16, 2, true, ["car", "car"]);
  // Sky district lanes
  const s = LAYOUT.sky;
  add("sky-1", circlePath(s.x, s.z, 190, 245, 5, 1), 30, 5, false, ["wedge", "car"]);
  add("sky-2", circlePath(s.x, s.z, 215, 262, 5, -1), 34, 5, false, ["car", "wedge"]);
  add("sky-link", linePath([-160, 300, -250], [-60, 300, 330]), 38, 3, true, ["wedge", "car"]);
  add("sky-link2", linePath([-40, 306, 330], [-140, 306, -250]), 36, 3, true, ["car", "pod"]);
  return out;
}

export interface RailRoute {
  id: string;
  path: Path;
  kind: "train" | "tram" | "cart";
  trains: number;
  cars: number;
  speed: number;
  stops: number[]; // arc-length positions
  pillars: number; // spacing, 0 = none
  width: number;
  thick: number;
  glow: string;
  y: number;
}

export function railRoutes(): RailRoute[] {
  const out: RailRoute[] = [];
  const mk = (id: string, path: Path, kind: RailRoute["kind"], trains: number, cars: number, speed: number, nStops: number, pillars: number, width: number, thick: number, glow: string, y: number, phase = 0) => {
    const stops: number[] = [];
    for (let i = 0; i < nStops; i++) stops.push(((i + phase) / nStops) * path.len);
    out.push({ id, path, kind, trains, cars, speed, stops, pillars, width, thick, glow, y });
  };
  mk("maglevA", roundedRectPath(90, 90, 16, 45, 1), "train", 3, 4, 30, 4, 38, 5.2, 1.6, "#5ef2ff", 45);
  mk("maglevB", roundedRectPath(150, 150, 20, 62, -1), "train", 3, 4, 36, 4, 42, 5.2, 1.6, "#ff4fd8", 62, 0.5);
  mk("skytram", circlePath(LAYOUT.sky.x, LAYOUT.sky.z, LAYOUT.sky.ringR, 208, 0, 1, 90), "train", 2, 3, 18, 5, 0, 4.6, 1.2, "#ffd37a", 208);
  mk("greentram", ellipsePath(LAYOUT.lake.x, LAYOUT.lake.z, 100, 82, 2.4, 1, 90), "tram", 2, 2, 11, 4, 0, 3.6, 0.5, "#7dff9a", 2.4);
  mk("ug-1", circlePath(LAYOUT.ug.x, LAYOUT.ug.z, 175, -93, 0, 1, 100), "train", 2, 4, 26, 3, 0, 5, 1.2, "#37ffb5", -93);
  mk("ug-2", circlePath(LAYOUT.ug.x, LAYOUT.ug.z, 205, -93, 0, -1, 110), "cart", 4, 1, 14, 0, 0, 3.6, 0.8, "#ffb347", -93);
  return out;
}
