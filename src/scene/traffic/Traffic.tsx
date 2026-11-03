import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  DoubleSide,
  Uint32BufferAttribute,
  Vector3,
} from "three";
import { useStore } from "../../core/store";
import { QUALITY } from "../../core/quality";
import { mulberry32, smoothstep } from "../../core/rng";
import { makeFlameMaterial, makeGlowMaterial } from "../materials";
import { buildVehicle, type VehicleKind, type VehicleModel } from "./vehicleModels";
import { airRoutes, railRoutes, Path, type RailRoute } from "./routes";
import { InstancedBoxes, type BoxItem } from "../city/common";
import { LAYOUT } from "../../core/layout";

const UP = new Vector3(0, 1, 0);
const CAR_COLORS = ["#1c2a44", "#e8eef5", "#c0c8d4", "#7a1f2e", "#14403a", "#3b2a5e", "#d9a441", "#2b2f38", "#2f6fb0"];
const TRAIN_COLORS = ["#dfe8f2", "#c9d6e6", "#e6edf5"];
const TRAM_COLORS = ["#e9f5e6", "#cfe8d2"];
const CART_COLORS = ["#d9a441", "#e0b050"];
const PALETTE: Record<VehicleKind, string[]> = { car: CAR_COLORS, wedge: CAR_COLORS, pod: ["#dfe8f2", "#b8c6d8", "#e8e2d0"], train: TRAIN_COLORS, tram: TRAM_COLORS, cart: CART_COLORS };

// ----------------------------------------------------------------------------------------------
// Fleet: three instanced meshes per vehicle kind (body / lights / thruster flames) sharing matrices
// ----------------------------------------------------------------------------------------------
class Fleet {
  body: InstancedMesh;
  lights: InstancedMesh;
  flames: InstancedMesh | null;
  count = 0;
  model: VehicleModel;
  constructor(
    public kind: VehicleKind,
    cap: number,
    bodyMat: MeshStandardMaterial,
    lightMat: Mesh["material"],
    flameMat: Mesh["material"],
  ) {
    this.model = buildVehicle(kind);
    cap = Math.max(1, cap);
    this.body = new InstancedMesh(this.model.body, bodyMat, cap);
    this.lights = new InstancedMesh(this.model.lights, lightMat, cap);
    this.flames = this.model.flames ? new InstancedMesh(this.model.flames, flameMat, cap) : null;
    for (const m of this.meshes()) {
      m.frustumCulled = false;
      m.count = 0;
    }
    this.body.castShadow = true;
  }
  meshes() {
    return this.flames ? [this.body, this.lights, this.flames] : [this.body, this.lights];
  }
  alloc(color: Color) {
    const i = this.count++;
    this.body.setColorAt(i, color);
    for (const m of this.meshes()) m.count = this.count;
    return i;
  }
  set(i: number, m: Matrix4) {
    this.body.setMatrixAt(i, m);
    this.lights.setMatrixAt(i, m);
    this.flames?.setMatrixAt(i, m);
  }
  flush() {
    for (const m of this.meshes()) m.instanceMatrix.needsUpdate = true;
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
  }
  dispose() {
    for (const m of this.meshes()) m.dispose();
    this.model.body.dispose();
    this.model.lights.dispose();
    this.model.flames?.dispose();
  }
}

const _m = new Matrix4();
const _r = new Vector3();
const _u = new Vector3();
const _r2 = new Vector3();
const _u2 = new Vector3();
function place(f: Fleet, i: number, pos: Vector3, fwd: Vector3, bank: number, scale: number) {
  _r.crossVectors(UP, fwd);
  if (_r.lengthSq() < 1e-6) _r.set(1, 0, 0);
  _r.normalize();
  _u.crossVectors(fwd, _r);
  if (bank !== 0) {
    const c = Math.cos(bank);
    const s = Math.sin(bank);
    _r2.copy(_r).multiplyScalar(c).addScaledVector(_u, s);
    _u2.copy(_u).multiplyScalar(c).addScaledVector(_r, -s);
    _r.copy(_r2);
    _u.copy(_u2);
  }
  _m.makeBasis(_r.multiplyScalar(scale), _u.multiplyScalar(scale), _r2.copy(fwd).multiplyScalar(scale));
  _m.setPosition(pos);
  f.set(i, _m);
}

// ----------------------------------------------------------------------------------------------
// Traffic signals
// ----------------------------------------------------------------------------------------------
type Sig = 0 | 1 | 2; // green, yellow, red
function signal(group: "x" | "z", t: number, phase: number): Sig {
  const T = 18;
  const c = (((t + phase) % T) + T) % T;
  if (group === "z") return c < 6 ? 0 : c < 7 ? 1 : 2;
  return c >= 9 && c < 15 ? 0 : c >= 15 && c < 16 ? 1 : 2;
}
const SIG_COLORS = [new Color(0.2, 2.8, 0.7), new Color(3, 2, 0.2), new Color(3.2, 0.2, 0.25)];

interface GridCfg {
  name: string;
  xs: number[];
  zs: number[];
  streetHalf: number;
  laneOff: number;
  stopDist: number;
  cruise: number;
  perLane: number;
  phase: number;
}
const GRIDS: GridCfg[] = [
  {
    name: "downtown",
    xs: [-210, -150, -90, -30, 30, 90, 150, 210],
    zs: [-210, -150, -90, -30, 30, 90, 150, 210],
    streetHalf: LAYOUT.downtown.streetHalf,
    laneOff: 3.8,
    stopDist: 11,
    cruise: 13,
    perLane: 4,
    phase: 0,
  },
  {
    name: "neon",
    xs: [280, 320, 360, 400, 440, 480, 520],
    zs: [-80, -40, 0, 40, 80, 120, 160],
    streetHalf: LAYOUT.neon.streetHalf,
    laneOff: 2.1,
    stopDist: 8,
    cruise: 8.5,
    perLane: 3,
    phase: 5,
  },
];

interface GAgent {
  p: number;
  v: number;
  len: number;
  cruise: number;
  hidden: boolean;
  fi: number;
  kind: VehicleKind;
  phase: number;
}
interface Lane {
  grid: GridCfg;
  axis: "x" | "z";
  dir: 1 | -1;
  fixed: number;
  start: number;
  L: number;
  stopsP: number[];
  agents: GAgent[];
}

function buildLanes(g: GridCfg, mult: number, rng: () => number): Lane[] {
  const lanes: Lane[] = [];
  const mk = (axis: "x" | "z", dir: 1 | -1, fixed: number, cross: number[]) => {
    const min = Math.min(...cross) - 40;
    const max = Math.max(...cross) + 40;
    const start = dir === 1 ? min : max;
    const stopsP = cross.map((c) => (dir === 1 ? c - g.stopDist - start : start - c - g.stopDist)).sort((a, b) => a - b);
    lanes.push({ grid: g, axis, dir, fixed, start, L: max - min, stopsP, agents: [] });
  };
  for (const x of g.xs) {
    mk("z", 1, x + g.laneOff, g.zs);
    mk("z", -1, x - g.laneOff, g.zs);
  }
  for (const z of g.zs) {
    mk("x", 1, z - g.laneOff, g.xs);
    mk("x", -1, z + g.laneOff, g.xs);
  }
  void rng;
  void mult;
  return lanes;
}

interface AirAgent {
  route: number;
  s: number;
  speed: number;
  lat: number;
  phase: number;
  fi: number;
  kind: VehicleKind;
}
interface Train {
  route: RailRoute;
  s: number;
  v: number;
  dwell: number;
  nextStop: number;
  cars: { fi: number }[];
  total: number;
  carLen: number;
  kind: VehicleKind;
}

// ----------------------------------------------------------------------------------------------
// Rail geometry (beam with 4 faces) + glow strip
// ----------------------------------------------------------------------------------------------
function railGeometry(path: Path, width: number, thick: number, step = 3): BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const samples: { c: Vector3; b: Vector3 }[] = [];
  const d = new Vector3();
  const total = path.closed ? path.len : path.len - step;
  for (let s = 0; s <= total + 0.001; s += step) {
    const c = path.pos(s, new Vector3());
    path.dir(s, d);
    const b = new Vector3(-d.z, 0, d.x).normalize();
    samples.push({ c, b });
  }
  if (path.closed) samples.push(samples[0]);
  const n = samples.length;
  const hw = width / 2;
  for (let f = 0; f < 4; f++)
    for (let i = 0; i < n; i++) {
      const { c, b } = samples[i];
      const tl = [c.x + b.x * hw, c.y, c.z + b.z * hw];
      const tr = [c.x - b.x * hw, c.y, c.z - b.z * hw];
      const bl = [tl[0], c.y - thick, tl[2]];
      const br = [tr[0], c.y - thick, tr[2]];
      const pair = f === 0 ? [tl, tr] : f === 1 ? [bl, br] : f === 2 ? [tl, bl] : [tr, br];
      pos.push(...pair[0], ...pair[1]);
    }
  for (let f = 0; f < 4; f++)
    for (let i = 0; i < n - 1; i++) {
      const a = (f * n + i) * 2;
      const c = (f * n + i + 1) * 2;
      idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setIndex(new Uint32BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

function RailTrack({ route }: { route: RailRoute }) {
  const built = useMemo(() => {
    const beam = railGeometry(route.path, route.width, route.thick);
    const strip = railGeometry(route.path, 0.5, 0.05);
    strip.translate(0, 0.06, 0);
    const beamMat = new MeshStandardMaterial({ color: "#6b7787", metalness: 0.8, roughness: 0.35, side: DoubleSide });
    const stripMat = makeGlowMaterial(0.7);
    stripMat.color = new Color(route.glow).multiplyScalar(2.2);
    const items: BoxItem[] = [];
    const platforms: BoxItem[] = [];
    const d = new Vector3();
    const p = new Vector3();
    if (route.pillars > 0)
      for (let s = 0; s < route.path.len; s += route.pillars) {
        route.path.pos(s, p);
        items.push({ x: p.x, y: 0, z: p.z, sx: 1.8, sy: route.y - route.thick, sz: 1.8 });
      }
    route.stops.forEach((s) => {
      route.path.pos(s, p);
      route.path.dir(s, d);
      const ry = Math.atan2(d.x, d.z);
      const off = route.width / 2 + 2.6;
      const px = p.x - d.z * off;
      const pz = p.z + d.x * off;
      platforms.push({ x: px, y: p.y - 0.8, z: pz, sx: 3.2, sy: 0.8, sz: 22, ry });
      platforms.push({ x: px, y: p.y + 3.4, z: pz, sx: 4.0, sy: 0.25, sz: 20, ry });
      platforms.push({ x: px + d.z * 0.0, y: p.y - 0.8, z: pz, sx: 0.2, sy: 0.15, sz: 22, ry, color: route.glow });
    });
    return { beam, strip, beamMat, stripMat, items, platforms };
  }, [route]);
  useEffect(
    () => () => {
      built.beam.dispose();
      built.strip.dispose();
      built.beamMat.dispose();
      built.stripMat.dispose();
    },
    [built],
  );
  const pillarMat = useMemo(() => new MeshStandardMaterial({ color: "#59636f", metalness: 0.6, roughness: 0.5 }), []);
  const platMat = useMemo(() => new MeshStandardMaterial({ color: "#8c97a6", metalness: 0.5, roughness: 0.45 }), []);
  return (
    <>
      <mesh geometry={built.beam} material={built.beamMat} castShadow receiveShadow frustumCulled={false} />
      <mesh geometry={built.strip} material={built.stripMat} frustumCulled={false} />
      {built.items.length > 0 && <InstancedBoxes items={built.items} material={pillarMat} castShadow />}
      {built.platforms.length > 0 && <InstancedBoxes items={built.platforms.map((p) => ({ ...p, color: undefined }))} material={platMat} castShadow />}
    </>
  );
}

// ----------------------------------------------------------------------------------------------
// Main traffic component
// ----------------------------------------------------------------------------------------------
export function Traffic() {
  const quality = useStore((s) => s.quality);
  const mult = QUALITY[quality].traffic;

  const sim = useMemo(() => {
    const rng = mulberry32(8080);
    const bodyMat = new MeshStandardMaterial({ color: 0xffffff, metalness: 0.85, roughness: 0.22 });
    const lightMat = makeGlowMaterial(0.6, true, false);
    const flameMat = makeFlameMaterial("#69c6ff");
    const air = airRoutes();
    const rails = railRoutes();

    // count capacity per kind
    const cap: Record<VehicleKind, number> = { car: 0, wedge: 0, pod: 0, train: 0, tram: 0, cart: 0 };
    const airAgents: AirAgent[] = [];
    const lanes: Lane[] = [];
    const trains: Train[] = [];

    air.forEach((r, ri) => {
      const n = Math.max(1, Math.round(r.count * mult));
      for (let k = 0; k < n; k++) {
        const kind = r.types[Math.floor(rng() * r.types.length)] as VehicleKind;
        airAgents.push({
          route: ri,
          s: (k / n) * r.path.len + rng() * 20,
          speed: r.speed * (0.96 + rng() * 0.08),
          lat: r.open ? 0 : k % 2 ? 5 : -5,
          phase: rng() * 6,
          fi: -1,
          kind,
        });
        cap[kind]++;
      }
    });
    for (const g of GRIDS) {
      for (const lane of buildLanes(g, mult, rng)) {
        const n = Math.max(1, Math.round(g.perLane * mult));
        for (let k = 0; k < n; k++) {
          const r = rng();
          const kind: VehicleKind = r < 0.14 ? "pod" : r < 0.3 ? "wedge" : "car";
          const len = kind === "pod" ? 7.6 : kind === "wedge" ? 4.9 : 4.4;
          lane.agents.push({ p: ((k + rng() * 0.6) / n) * lane.L, v: g.cruise * 0.5, len, cruise: g.cruise * (0.85 + rng() * 0.3), hidden: false, fi: -1, kind, phase: rng() * 6 });
          cap[kind]++;
        }
        lanes.push(lane);
      }
    }
    for (const r of rails) {
      const carLen = buildVehicle(r.kind).length + 1.2;
      for (let k = 0; k < Math.max(1, Math.round(r.trains * (mult > 0.9 ? 1 : 0.67))); k++) {
        const cars: { fi: number }[] = [];
        for (let c = 0; c < r.cars; c++) {
          cars.push({ fi: -1 });
          cap[r.kind]++;
        }
        const nTrains = Math.max(1, Math.round(r.trains * (mult > 0.9 ? 1 : 0.67)));
        trains.push({ route: r, s: (k / nTrains) * r.path.len + carLen * r.cars, v: r.speed * 0.5, dwell: 0, nextStop: 0, cars, total: carLen * r.cars, carLen, kind: r.kind });
      }
    }
    // resolve nextStop for each train
    for (const t of trains) {
      const stops = t.route.stops;
      if (!stops.length) continue;
      let best = 0;
      let bd = Infinity;
      stops.forEach((s, i) => {
        const d = (((s + t.total / 2 - t.s) % t.route.path.len) + t.route.path.len) % t.route.path.len;
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      t.nextStop = best;
    }

    const fleets = {} as Record<VehicleKind, Fleet>;
    (Object.keys(cap) as VehicleKind[]).forEach((k) => {
      fleets[k] = new Fleet(k, cap[k], bodyMat, lightMat, flameMat);
    });
    const col = new Color();
    const pickColor = (kind: VehicleKind) => {
      const pal = PALETTE[kind];
      return col.set(pal[Math.floor(rng() * pal.length)]);
    };
    airAgents.forEach((a) => (a.fi = fleets[a.kind].alloc(pickColor(a.kind))));
    lanes.forEach((l) => l.agents.forEach((a) => (a.fi = fleets[a.kind].alloc(pickColor(a.kind)))));
    trains.forEach((t) => {
      const c = pickColor(t.kind).clone();
      t.cars.forEach((car) => (car.fi = fleets[t.kind].alloc(c)));
    });

    // signal heads
    const heads: { x: number; z: number; group: "x" | "z"; gi: number }[] = [];
    GRIDS.forEach((g, gi) => {
      for (const x of g.xs)
        for (const z of g.zs)
          for (const sx of [-1, 1])
            for (const sz of [-1, 1]) heads.push({ x: x + sx * (g.streetHalf + 0.9), z: z + sz * (g.streetHalf + 0.9), group: sx * sz > 0 ? "z" : "x", gi });
    });
    const headGeo = new BoxGeometry(0.55, 1.1, 0.55);
    const headMesh = new InstancedMesh(headGeo, makeGlowMaterial(1, false, true), heads.length);
    const poleGeo = new BoxGeometry(0.22, 6, 0.22);
    poleGeo.translate(0, 3, 0);
    const poleMesh = new InstancedMesh(poleGeo, new MeshStandardMaterial({ color: "#3a424d", metalness: 0.7, roughness: 0.5 }), heads.length);
    const mt = new Matrix4();
    heads.forEach((h, i) => {
      mt.makeTranslation(h.x, 6.2, h.z);
      headMesh.setMatrixAt(i, mt);
      mt.makeTranslation(h.x, 0, h.z);
      poleMesh.setMatrixAt(i, mt);
      headMesh.setColorAt(i, SIG_COLORS[2]);
    });
    headMesh.frustumCulled = false;
    poleMesh.frustumCulled = false;
    return { fleets, air, airAgents, lanes, trains, rails, heads, headMesh, poleMesh, headGeo, poleGeo, bodyMat, lightMat, flameMat, lastSig: [-1, -1, -1, -1] as number[] };
  }, [mult]);

  useEffect(
    () => () => {
      Object.values(sim.fleets).forEach((f) => f.dispose());
      sim.headMesh.dispose();
      sim.poleMesh.dispose();
      sim.headGeo.dispose();
      sim.poleGeo.dispose();
      sim.bodyMat.dispose();
      sim.lightMat.dispose();
      sim.flameMat.dispose();
    },
    [sim],
  );

  const tmpP = useMemo(() => new Vector3(), []);
  const tmpD = useMemo(() => new Vector3(), []);
  const tmpD2 = useMemo(() => new Vector3(), []);
  const tmpL = useMemo(() => new Vector3(), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const { fleets, air, airAgents, lanes, trains } = sim;

    // ---- flying vehicles on fixed routes
    for (const a of airAgents) {
      const r = air[a.route];
      a.s += a.speed * dt;
      if (r.open && a.s > r.path.len) a.s -= r.path.len;
      else if (!r.open) a.s %= r.path.len;
      r.path.pos(a.s, tmpP);
      r.path.dir(a.s, tmpD);
      r.path.dir(a.s + 6, tmpD2);
      const bank = Math.max(-0.45, Math.min(0.45, (tmpD.x * tmpD2.z - tmpD.z * tmpD2.x) * 9));
      if (a.lat) {
        tmpL.set(-tmpD.z, 0, tmpD.x).normalize();
        tmpP.addScaledVector(tmpL, a.lat);
      }
      tmpP.y += Math.sin(t * 0.7 + a.phase) * 0.6;
      const sc = r.open ? smoothstep(0, 35, a.s) * smoothstep(0, 35, r.path.len - a.s) : 1;
      place(fleets[a.kind], a.fi, tmpP, tmpD, bank, Math.max(0.001, sc));
    }

    // ---- ground vehicles with signals and car-following
    for (const lane of lanes) {
      const ag = lane.agents;
      ag.sort((a, b) => b.p - a.p);
      const sig = signal(lane.axis, t, lane.grid.phase);
      for (let i = 0; i < ag.length; i++) {
        const a = ag[i];
        if (a.hidden) {
          const tail = ag[ag.length - 1];
          if (a === tail || tail.p > 16 || tail.hidden) {
            a.hidden = false;
            a.p = 0;
            a.v = a.cruise * 0.5;
          } else continue;
        }
        const leader = i > 0 && !ag[i - 1].hidden ? ag[i - 1] : null;
        const front = a.p + a.len / 2;
        let vt = a.cruise;
        if (sig !== 0) {
          for (const sp of lane.stopsP) {
            const d = sp - front;
            if (d > -0.3) {
              const required = (a.v * a.v) / (2 * Math.max(d, 0.05));
              if (required < 11 || d > 6) vt = Math.min(vt, Math.sqrt(2 * 7 * Math.max(d - 0.6, 0)));
              break;
            }
          }
        }
        if (leader) {
          const gap = leader.p - leader.len / 2 - front;
          vt = Math.min(vt, gap < 0.6 ? 0 : Math.sqrt(2 * 7 * Math.max(gap - 2.4, 0)));
        }
        if (a.v < vt) a.v = Math.min(vt, a.v + 6 * dt);
        else a.v = Math.max(vt, a.v - 14 * dt);
        a.p += a.v * dt;
        if (a.p > lane.L + a.len) {
          a.hidden = true;
          a.v = 0;
        }
      }
      for (const a of ag) {
        const coord = lane.start + lane.dir * a.p;
        const sc = a.hidden ? 0.001 : smoothstep(0, 10, a.p) * smoothstep(0, 10, lane.L - a.p);
        if (lane.axis === "z") {
          tmpP.set(lane.fixed, 1.0 + Math.sin(t * 2 + a.phase) * 0.05, coord);
          tmpD.set(0, 0, lane.dir);
        } else {
          tmpP.set(coord, 1.0 + Math.sin(t * 2 + a.phase) * 0.05, lane.fixed);
          tmpD.set(lane.dir, 0, 0);
        }
        place(fleets[a.kind], a.fi, tmpP, tmpD, 0, Math.max(0.001, sc));
      }
    }

    // ---- trains: station dwell, smooth braking, headway keeping
    trains.forEach((tr, ti) => {
      const r = tr.route;
      const len = r.path.len;
      let vt = r.speed;
      if (tr.dwell > 0) {
        tr.dwell -= dt;
        vt = 0;
        if (tr.dwell <= 0) tr.nextStop = (tr.nextStop + 1) % Math.max(1, r.stops.length);
      } else if (r.stops.length) {
        const target = r.stops[tr.nextStop] + tr.total / 2;
        const d = (((target - tr.s) % len) + len) % len;
        const near = d > len - 4 ? 0 : d;
        vt = Math.min(vt, Math.max(0, Math.sqrt(2 * 2.4 * near) + 0.5));
        if (near < 0.7 && tr.v < 1.2) {
          tr.dwell = 4.5;
          tr.v = 0;
        }
      }
      // headway
      const others = trains.filter((o) => o.route === r && o !== tr);
      if (others.length) {
        let best = Infinity;
        for (const o of others) {
          const gap = (((o.s - o.total - tr.s) % len) + len) % len;
          if (gap < best) best = gap;
        }
        vt = Math.min(vt, Math.sqrt(2 * 2.4 * Math.max(0, best - 18)));
      }
      if (tr.v < vt) tr.v = Math.min(vt, tr.v + 1.8 * dt);
      else tr.v = Math.max(vt, tr.v - 3.0 * dt);
      tr.s = (tr.s + tr.v * dt) % len;
      void ti;
      tr.cars.forEach((car, ci) => {
        const s = tr.s - tr.carLen * (ci + 0.5);
        r.path.pos(s, tmpP);
        r.path.dir(s, tmpD);
        place(fleets[tr.kind], car.fi, tmpP, tmpD, 0, 1);
      });
    });

    for (const k in fleets) fleets[k as VehicleKind].flush();

    // ---- signal head colours (only when phase changes)
    const heads = sim.heads;
    const states = [signal("z", t, 0), signal("x", t, 0), signal("z", t, 5), signal("x", t, 5)];
    let dirty = false;
    for (let i = 0; i < 4; i++)
      if (states[i] !== sim.lastSig[i]) {
        sim.lastSig[i] = states[i];
        dirty = true;
      }
    if (dirty) {
      heads.forEach((h, i) => {
        const s = states[h.gi * 2 + (h.group === "z" ? 0 : 1)];
        sim.headMesh.setColorAt(i, SIG_COLORS[s]);
      });
      if (sim.headMesh.instanceColor) sim.headMesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      {Object.values(sim.fleets).map((f) => (
        <group key={f.kind}>
          <primitive object={f.body} />
          <primitive object={f.lights} />
          {f.flames && <primitive object={f.flames} renderOrder={4} />}
        </group>
      ))}
      <primitive object={sim.headMesh} />
      <primitive object={sim.poleMesh} />
      {sim.rails.map((r) => (
        <RailTrack key={r.id} route={r} />
      ))}
    </group>
  );
}
