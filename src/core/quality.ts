export type Quality = "low" | "medium" | "high";

export interface QualityCfg {
  dprMax: number;
  dprMin: number;
  shadows: boolean;
  shadowSize: number;
  shadowRange: number;
  rainDrops: number;
  motes: number;
  traffic: number; // vehicle density multiplier
  foliage: number; // vegetation density multiplier
  msaa: number;
  smaa: boolean;
  vignette: boolean;
  noise: boolean;
  dof: boolean;
  bloomLevels: number;
}

export const QUALITY: Record<Quality, QualityCfg> = {
  low: {
    dprMax: 1,
    dprMin: 0.55,
    shadows: false,
    shadowSize: 0,
    shadowRange: 0,
    rainDrops: 3500,
    motes: 500,
    traffic: 0.5,
    foliage: 0.35,
    msaa: 0,
    smaa: false,
    vignette: false,
    noise: false,
    dof: false,
    bloomLevels: 5,
  },
  medium: {
    dprMax: 1.25,
    dprMin: 0.6,
    shadows: true,
    shadowSize: 1024,
    shadowRange: 170,
    rainDrops: 9000,
    motes: 1200,
    traffic: 0.8,
    foliage: 0.7,
    msaa: 0,
    smaa: true,
    vignette: true,
    noise: false,
    dof: false,
    bloomLevels: 7,
  },
  high: {
    dprMax: 1.6,
    dprMin: 0.65,
    shadows: true,
    shadowSize: 2048,
    shadowRange: 210,
    rainDrops: 18000,
    motes: 2200,
    traffic: 1,
    foliage: 1,
    msaa: 0,
    smaa: true,
    vignette: true,
    noise: true,
    dof: true,
    bloomLevels: 8,
  },
};
