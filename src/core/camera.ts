import { CatmullRomCurve3, Vector3 } from "three";
import { LAYOUT } from "./layout";
import { isUnderground } from "./collision";
import { clamp } from "./rng";

export interface Pose {
  pos: Vector3;
  target: Vector3;
}

interface Fly {
  curve: CatmullRomCurve3 | null;
  from: Vector3;
  to: Vector3;
  t0: Vector3;
  t1: Vector3;
  t: number;
  dur: number;
  onDone?: () => void;
}

/** Imperative camera state, shared between the camera rig, vehicle controller and UI actions. */
export const camState = {
  pos: new Vector3(-30, 38, 1500),
  target: new Vector3(0, 220, 0),
  fly: null as Fly | null,
  yaw: 0,
  pitch: 0,
  vel: new Vector3(),
  orbit: { center: new Vector3(), radius: 300, az: 0, el: 0.3, tRadius: 300, tAz: 0, tEl: 0.3 },
  introT: 0,
  storyT: 0,
  storyTouched: false,
  cineTime: 0,
  cineName: "",
  fovTarget: 60,
};

export function syncFreeFromCamera() {
  const d = camState.target.clone().sub(camState.pos);
  if (d.lengthSq() < 1e-6) return;
  d.normalize();
  camState.pitch = Math.asin(clamp(d.y, -1, 1));
  camState.yaw = Math.atan2(d.x, d.z);
  camState.vel.set(0, 0, 0);
}

export function cancelFly() {
  camState.fly = null;
}

export function flyTo(pos: Vector3, target: Vector3, opts: { dur?: number; onDone?: () => void } = {}) {
  const start = camState.pos.clone();
  const dist = start.distanceTo(pos);
  const prevDone = camState.fly?.onDone;
  void prevDone; // a superseded flight never fires its completion callback
  if (dist < 0.5) {
    camState.fly = { curve: null, from: start, to: pos.clone(), t0: camState.target.clone(), t1: target.clone(), t: 0, dur: 0.6, onDone: opts.onDone };
    return;
  }
  const pts: Vector3[] = [start];
  const { ug } = LAYOUT;
  const sU = isUnderground(start.x, start.y, start.z);
  const eU = isUnderground(pos.x, pos.y, pos.z);
  const sx = ug.x + 40;
  if (sU !== eU) {
    if (!sU) pts.push(new Vector3(sx, 90, ug.z), new Vector3(sx, -40, ug.z));
    else pts.push(new Vector3(sx, -40, ug.z), new Vector3(sx, 90, ug.z));
  } else if (dist > 220 && !sU) {
    const mid = start.clone().lerp(pos, 0.5);
    mid.y += Math.min(dist * 0.12, 90);
    pts.push(mid);
  }
  pts.push(pos.clone());
  // drop consecutive duplicates (CatmullRom degenerates on zero-length segments)
  const clean = pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]) > 0.5);
  const curve = clean.length > 1 ? new CatmullRomCurve3(clean, false, "centripetal") : null;
  const len = curve ? curve.getLength() : dist;
  camState.fly = {
    curve,
    from: start,
    to: pos.clone(),
    t0: camState.target.clone(),
    t1: target.clone(),
    t: 0,
    dur: opts.dur ?? clamp(len / 230, 2.2, 5.5),
    onDone: opts.onDone,
  };
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Advance the active flight; returns true while still flying. */
export function advanceFly(dt: number): boolean {
  const f = camState.fly;
  if (!f) return false;
  f.t += dt / f.dur;
  const e = ease(Math.min(1, f.t));
  if (f.curve) f.curve.getPointAt(e, camState.pos);
  else camState.pos.lerpVectors(f.from, f.to, e);
  camState.target.lerpVectors(f.t0, f.t1, e);
  if (f.t >= 1) {
    camState.fly = null;
    camState.pos.copy(f.to);
    camState.target.copy(f.t1);
    f.onDone?.();
    return false;
  }
  return true;
}
