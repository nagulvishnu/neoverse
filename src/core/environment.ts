import { Color, Vector3 } from "three";
import { clamp, damp } from "./rng";

export type TimeOfDay = "day" | "sunset" | "night";
export type Weather = "clear" | "rain" | "fog";

export interface EnvVals {
  skyTop: Color;
  skyHorizon: Color;
  sunDir: Vector3;
  sunColor: Color;
  sunIntensity: number;
  hemiSky: Color;
  hemiGround: Color;
  hemiIntensity: number;
  fogColor: Color;
  fogDensity: number;
  night: number; // 0 day .. 1 night: drives window / neon emission
  envIntensity: number;
  bloom: number;
  stars: number;
  gray: number; // overcast amount
  cloud: number;
  wet: number;
  rain: number;
}

const C = (h: string) => new Color(h);
const dir = (azDeg: number, elDeg: number) => {
  const a = (azDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  return new Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).normalize();
};

export const TIME_PRESETS: Record<TimeOfDay, EnvVals> = {
  day: {
    skyTop: C("#2f7fe0"),
    skyHorizon: C("#b9d6f2"),
    sunDir: dir(35, 52),
    sunColor: C("#fff1da"),
    sunIntensity: 3.4,
    hemiSky: C("#bcd8ff"),
    hemiGround: C("#6b6a63"),
    hemiIntensity: 1.0,
    fogColor: C("#b3cce6"),
    fogDensity: 0.00072,
    night: 0,
    envIntensity: 1.0,
    bloom: 0.3,
    stars: 0,
    gray: 0,
    cloud: 0.5,
    wet: 0,
    rain: 0,
  },
  sunset: {
    skyTop: C("#2c3a8c"),
    skyHorizon: C("#ff8a4c"),
    sunDir: dir(-70, 7),
    sunColor: C("#ff9650"),
    sunIntensity: 2.8,
    hemiSky: C("#ff9d7a"),
    hemiGround: C("#3a2c38"),
    hemiIntensity: 0.6,
    fogColor: C("#c4785c"),
    fogDensity: 0.00085,
    night: 0.55,
    envIntensity: 0.75,
    bloom: 0.65,
    stars: 0.15,
    gray: 0,
    cloud: 0.55,
    wet: 0,
    rain: 0,
  },
  night: {
    skyTop: C("#02040e"),
    skyHorizon: C("#1c1450"),
    sunDir: dir(120, 38),
    sunColor: C("#7f9cff"),
    sunIntensity: 0.55,
    hemiSky: C("#2a3a8a"),
    hemiGround: C("#0a0a14"),
    hemiIntensity: 0.42,
    fogColor: C("#140d30"),
    fogDensity: 0.00092,
    night: 1,
    envIntensity: 0.3,
    bloom: 1.05,
    stars: 1,
    gray: 0,
    cloud: 0.35,
    wet: 0,
    rain: 0,
  },
};

const GRAY = new Color("#6f7782");
const GRAY_FOG = new Color("#8d949d");

function cloneEnv(e: EnvVals): EnvVals {
  return {
    ...e,
    skyTop: e.skyTop.clone(),
    skyHorizon: e.skyHorizon.clone(),
    sunDir: e.sunDir.clone(),
    sunColor: e.sunColor.clone(),
    hemiSky: e.hemiSky.clone(),
    hemiGround: e.hemiGround.clone(),
    fogColor: e.fogColor.clone(),
  };
}

export function computeTarget(time: TimeOfDay, weather: Weather, out: EnvVals): EnvVals {
  const p = TIME_PRESETS[time];
  out.skyTop.copy(p.skyTop);
  out.skyHorizon.copy(p.skyHorizon);
  out.sunDir.copy(p.sunDir);
  out.sunColor.copy(p.sunColor);
  out.hemiSky.copy(p.hemiSky);
  out.hemiGround.copy(p.hemiGround);
  out.fogColor.copy(p.fogColor);
  out.sunIntensity = p.sunIntensity;
  out.hemiIntensity = p.hemiIntensity;
  out.fogDensity = p.fogDensity;
  out.night = p.night;
  out.envIntensity = p.envIntensity;
  out.bloom = p.bloom;
  out.stars = p.stars;
  out.cloud = p.cloud;
  out.gray = 0;
  out.wet = 0;
  out.rain = 0;
  const lum = time === "night" ? 0.35 : time === "sunset" ? 0.7 : 1;
  if (weather === "rain") {
    out.gray = 0.7;
    out.skyTop.lerp(GRAY.clone().multiplyScalar(lum * lum), 0.7);
    out.skyHorizon.lerp(GRAY.clone().multiplyScalar(lum * lum * 1.2), 0.65);
    out.fogColor.lerp(GRAY_FOG.clone().multiplyScalar(lum * lum * 0.8), 0.55);
    out.sunIntensity *= 0.3;
    out.hemiIntensity *= 0.85;
    out.fogDensity *= 1.9;
    out.envIntensity *= 0.8;
    out.cloud = 1;
    out.wet = 1;
    out.rain = 1;
    out.stars = 0;
    out.bloom *= 1.1;
  } else if (weather === "fog") {
    out.gray = 0.4;
    out.skyTop.lerp(GRAY_FOG.clone().multiplyScalar(lum * lum), 0.5);
    out.skyHorizon.lerp(GRAY_FOG.clone().multiplyScalar(lum * lum * 1.1), 0.7);
    out.fogColor.lerp(GRAY_FOG.clone().multiplyScalar(lum * lum * 0.95), 0.7);
    out.sunIntensity *= 0.45;
    out.fogDensity *= 4.4;
    out.cloud = 0.7;
    out.stars *= 0.2;
    out.bloom *= 1.25;
  }
  return out;
}

const target = cloneEnv(TIME_PRESETS.night);
/** Live, smoothly interpolated environment state (non-reactive; read in frame loops). */
export const env: EnvVals = cloneEnv(TIME_PRESETS.night);

export const live = {
  ug: 0, // 0..1 how "underground" the camera currently is
  zone: { downtown: 0, neon: 0, sky: 0, underground: 0, green: 0 } as Record<string, number>,
  envVersion: 0,
  camY: 0,
};

export function snapEnv(time: TimeOfDay, weather: Weather) {
  computeTarget(time, weather, target);
  copyEnv(target, env);
}

function copyEnv(s: EnvVals, d: EnvVals) {
  d.skyTop.copy(s.skyTop);
  d.skyHorizon.copy(s.skyHorizon);
  d.sunDir.copy(s.sunDir);
  d.sunColor.copy(s.sunColor);
  d.hemiSky.copy(s.hemiSky);
  d.hemiGround.copy(s.hemiGround);
  d.fogColor.copy(s.fogColor);
  d.sunIntensity = s.sunIntensity;
  d.hemiIntensity = s.hemiIntensity;
  d.fogDensity = s.fogDensity;
  d.night = s.night;
  d.envIntensity = s.envIntensity;
  d.bloom = s.bloom;
  d.stars = s.stars;
  d.gray = s.gray;
  d.cloud = s.cloud;
  d.wet = s.wet;
  d.rain = s.rain;
}

/** Smoothly move live env toward the target for the chosen time/weather. Returns total change (for PMREM refresh). */
export function stepEnv(dt: number, time: TimeOfDay, weather: Weather): number {
  computeTarget(time, weather, target);
  const k = 1 - Math.exp(-dt * 1.5);
  let change = 0;
  const lc = (a: Color, b: Color) => {
    change += Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
    a.lerp(b, k);
  };
  lc(env.skyTop, target.skyTop);
  lc(env.skyHorizon, target.skyHorizon);
  lc(env.sunColor, target.sunColor);
  lc(env.hemiSky, target.hemiSky);
  lc(env.hemiGround, target.hemiGround);
  lc(env.fogColor, target.fogColor);
  change += env.sunDir.distanceTo(target.sunDir);
  env.sunDir.lerp(target.sunDir, k).normalize();
  const ln = (key: keyof EnvVals, rate = 1.5) => {
    const cur = env[key] as number;
    const nxt = damp(cur, target[key] as number, rate, dt);
    change += Math.abs(nxt - cur);
    (env[key] as number) = nxt;
  };
  ln("sunIntensity");
  ln("hemiIntensity");
  ln("fogDensity");
  ln("night");
  ln("envIntensity");
  ln("bloom");
  ln("stars");
  ln("gray");
  ln("cloud");
  ln("wet", 0.5); // surfaces dry slower than the sky clears
  ln("rain", 1.0);
  env.night = clamp(env.night, 0, 1);
  return change;
}
