// World layout shared by data generators, scene components, camera and vehicle systems.
// Units are metres. +Y is up.

export type DistrictId = "downtown" | "neon" | "sky" | "underground" | "green";

export const LAYOUT = {
  downtown: { x: 0, z: 0, half: 240, grid: 60, streetHalf: 8, offset: 30 },
  neon: { x: 400, z: 40, half: 140, grid: 40, streetHalf: 5, offset: 0 },
  green: { x: 200, z: 470, r: 190 },
  lake: { x: 150, z: 500, r: 62 },
  ug: { x: -420, z: 100, shaftR: 62, cavR: 240, floorY: -100 },
  sky: { x: -160, z: -360, ringR: 112 },
  arena: { x: 590, z: 40 },
  hub: { x: 120, z: -60 },
  museum: { x: 250, z: 420 },
  boulevard: { x: -30, half: 40, zStart: 245 },
  world: { radius: 1100, maxY: 700 },
} as const;

export interface Platform {
  x: number;
  y: number;
  z: number;
  r: number;
  id: string;
}

// Sky district floating platforms (y = deck surface height)
export const SKY_PLATFORMS: Platform[] = [
  { id: "P0", x: -160, y: 215, z: -360, r: 48 },
  { id: "P1", x: -260, y: 205, z: -300, r: 42 },
  { id: "P2", x: -80, y: 205, z: -290, r: 44 },
  { id: "P3", x: -250, y: 210, z: -430, r: 42 },
  { id: "P4", x: -70, y: 210, z: -440, r: 44 },
];
export const OBS_DECK = { x: -160, y: 290, z: -360, r: 36 };

export const MOBILE =
  typeof window !== "undefined" &&
  (window.matchMedia?.("(pointer: coarse)").matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent));
