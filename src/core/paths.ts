import { CatmullRomCurve3, Vector3 } from "three";
import { smoothstep } from "./rng";
import { DISTRICTS, LANDMARKS, OVERVIEW, orbitPosition } from "./data";

type V3 = [number, number, number];
export interface Way {
  p: V3;
  t: V3;
}

// ---- Intro: fly down the boulevard into the canyon of Downtown -----
export const INTRO_DURATION = 13;
const INTRO: Way[] = [
  { p: [-30, 38, 1500], t: [0, 220, 0] },
  { p: [-30, 40, 1000], t: [0, 225, 0] },
  { p: [-30, 46, 650], t: [0, 240, 0] },
  { p: [-30, 56, 420], t: [0, 260, 0] },
  { p: [-30, 66, 270], t: [0, 268, 0] },
  { p: [-30, 80, 190], t: [0, 270, 0] },
];
const mk = (ways: Way[], idx: 0 | 1) =>
  new CatmullRomCurve3(
    ways.map((w) => new Vector3(...(idx === 0 ? w.p : w.t))),
    false,
    "centripetal",
  );
const introP = mk(INTRO, 0);
const introT = mk(INTRO, 1);
export function evalIntro(t01: number, pos: Vector3, target: Vector3) {
  const e = smoothstep(0, 1, t01);
  introP.getPointAt(e, pos);
  introT.getPointAt(e, target);
}

// ---- Story: scroll driven path, one keyframe per section -----
interface StoryWay extends Way {
  section?: number;
}
const STORY_WAYS: StoryWay[] = [
  { p: [-30, 80, 190], t: [0, 270, 0], section: 0 },
  { p: [-30, 140, 360], t: [0, 230, 0] },
  { p: [-150, 260, 560], t: [0, 210, 0], section: 1 },
  { p: [-340, 190, 330], t: [-120, 180, 20] },
  { p: [-330, 175, 150], t: [-210, 150, -170], section: 2 },
  { p: [-260, 230, -110], t: [-170, 215, -300] },
  { p: [-100, 250, -230], t: [-160, 225, -360], section: 3 },
  { p: [150, 390, -250], t: [60, 250, 0] },
  { p: [300, 300, 0], t: [400, 60, 40] },
  { p: [420, 230, 300], t: [400, 40, 80] },
  { p: [400, 60, 250], t: [400, 20, 60] },
  { p: [400, 12, 185], t: [400, 18, 40], section: 4 },
  { p: [380, 100, 270], t: [200, 80, 300] },
  { p: [150, 170, 300], t: [-200, 100, 200] },
  { p: [-200, 160, 260], t: [-420, 40, 100] },
  { p: [-380, 120, 140], t: [-420, 0, 100] },
  { p: [-380, 40, 100], t: [-420, -50, 100] },
  { p: [-380, -20, 100], t: [-420, -55, 100] },
  { p: [-375, -60, 150], t: [-420, -45, 100], section: 5 },
  { p: [-380, -20, 100], t: [-420, -20, 100] },
  { p: [-380, 60, 100], t: [-200, 60, 250] },
  { p: [-300, 170, 250], t: [0, 80, 400] },
  { p: [60, 150, 400], t: [200, 40, 470] },
  { p: [110, 40, 340], t: [200, 35, 470], section: 6 },
  { p: [0, 200, 520], t: [100, 40, 200] },
  { p: [...OVERVIEW.pos], t: [...OVERVIEW.target], section: 7 },
];
const storyP = mk(STORY_WAYS, 0);
const storyT = mk(STORY_WAYS, 1);
const secIdx: number[] = [];
STORY_WAYS.forEach((w, i) => {
  if (w.section !== undefined) secIdx[w.section] = i;
});
export const STORY_SECTIONS = secIdx.length;
const lastW = STORY_WAYS.length - 1;

export function evalStory(t01: number, pos: Vector3, target: Vector3) {
  const n = STORY_SECTIONS;
  const centers = (i: number) => (i + 0.5) / n;
  let idx: number;
  if (t01 <= centers(0)) idx = secIdx[0];
  else if (t01 >= centers(n - 1)) idx = secIdx[n - 1];
  else {
    const i = Math.min(n - 2, Math.floor(t01 * n - 0.5));
    const local = (t01 - centers(i)) / (centers(i + 1) - centers(i));
    idx = secIdx[i] + (secIdx[i + 1] - secIdx[i]) * smoothstep(0.08, 0.92, local);
  }
  const u = idx / lastW;
  storyP.getPoint(u, pos);
  storyT.getPoint(u, target);
}

// ---- Cinematic autopilot loop -----
const CINE: (Way & { name: string })[] = [
  { name: "City overview", p: [-380, 420, 780], t: [40, 40, 60] },
  { name: "Approach", p: [-250, 300, 420], t: [0, 250, 0] },
  { name: "Flying lanes", p: [-330, 175, 150], t: [-210, 150, -170] },
  { name: "Sky District", p: [-100, 250, -230], t: [-160, 225, -360] },
  { name: "Central Tower", p: [150, 390, -250], t: [0, 250, 0] },
  { name: "Neon aerial", p: [330, 130, -140], t: [400, 30, 60] },
  { name: "Neon street", p: [420, 230, 300], t: [400, 30, 100] },
  { name: "Neon street", p: [400, 14, 185], t: [400, 18, 40] },
  { name: "Green District", p: [330, 120, 330], t: [250, 30, 420] },
  { name: "Green District", p: [60, 90, 380], t: [200, 30, 470] },
  { name: "Return", p: [-100, 200, 600], t: [0, 100, 100] },
];
const cineP = new CatmullRomCurve3(CINE.map((w) => new Vector3(...w.p)), true, "centripetal");
const cineT = new CatmullRomCurve3(CINE.map((w) => new Vector3(...w.t)), true, "centripetal");
const cineDur: number[] = [];
let cineTotal = 0;
for (let i = 0; i < CINE.length; i++) {
  const a = new Vector3(...CINE[i].p);
  const b = new Vector3(...CINE[(i + 1) % CINE.length].p);
  const d = Math.min(16, Math.max(7, a.distanceTo(b) / 60));
  cineDur.push(d);
  cineTotal += d;
}
export function evalCinematic(time: number, pos: Vector3, target: Vector3): string {
  let t = ((time % cineTotal) + cineTotal) % cineTotal;
  let i = 0;
  while (t > cineDur[i]) {
    t -= cineDur[i];
    i++;
  }
  const local = t / cineDur[i];
  // slow-in / slow-out inside each leg so shot transitions stay smooth
  const e = local * 0.6 + smoothstep(0, 1, local) * 0.4;
  const u = (i + e) / CINE.length;
  cineP.getPoint(u, pos);
  cineT.getPoint(u, target);
  return CINE[local > 0.5 ? (i + 1) % CINE.length : i].name;
}

/** XZ points (and clear radius) that scenery must keep free so cameras never start inside buildings. */
export function safePoints(): [number, number, number][] {
  const out: [number, number, number][] = [];
  const add = (p: V3, r = 45) => out.push([p[0], p[2], r]);
  INTRO.forEach((w) => add(w.p, 60));
  STORY_WAYS.forEach((w) => add(w.p, 45));
  CINE.forEach((w) => add(w.p, 45));
  add(OVERVIEW.pos, 60);
  const v = new Vector3();
  DISTRICTS.forEach((d) => {
    orbitPosition(d.orbit, v);
    add([v.x, v.y, v.z], 55);
    add(d.enter.pos, 14);
  });
  LANDMARKS.forEach((l) => {
    orbitPosition(l.orbit, v);
    add([v.x, v.y, v.z], 55);
    add(l.view.pos, 14);
  });
  return out;
}
