import type { BuildingStyle } from "./materials";

export const STYLES: Record<string, BuildingStyle> = {
  downtown: { winA: "#ffe2b0", winB: "#9fd8ff", winC: "#ffffff", accent: "#5ef2ff", lit: 0.55, accentAmt: 0.7, glass: "#0a1626" },
  neon: { winA: "#ff4fd8", winB: "#5ef2ff", winC: "#ffb347", accent: "#ff4fd8", lit: 0.55, accentAmt: 0.8, colW: 2.2, floorH: 3, glass: "#120a1e" },
  sky: { winA: "#ffe9c4", winB: "#fff6e8", winC: "#ffd37a", accent: "#ffd37a", lit: 0.5, accentAmt: 0.5, glass: "#16202c", metal: 0.8, rough: 0.25 },
  green: { winA: "#ffe9b0", winB: "#b8ffcf", winC: "#ffffff", accent: "#7dff9a", lit: 0.4, accentAmt: 0.35, glass: "#0b1d18", metal: 0.3, rough: 0.5 },
  ug: { winA: "#37ffb5", winB: "#ffb347", winC: "#37d6ff", accent: "#37ffb5", lit: 0.35, accentAmt: 0.9, colW: 4, floorH: 5, glass: "#06141a", metal: 0.8, rough: 0.4 },
  skyline: { winA: "#ffd9a0", winB: "#9fd0ff", winC: "#ffffff", accent: "#5ef2ff", lit: 0.5, accentAmt: 0.4, glass: "#0a1626" },
  tower: { winA: "#bff6ff", winB: "#ffffff", winC: "#ffd9a0", accent: "#5ef2ff", lit: 0.75, accentAmt: 1, glass: "#07111f", metal: 0.85, rough: 0.2 },
};

export const FACADES: Record<string, string[]> = {
  downtown: ["#9aa7b8", "#6f7f93", "#b9c2cc", "#556377", "#8a95a6"],
  neon: ["#4a3a66", "#35456a", "#5a3b5e", "#2e3f66", "#463a75"],
  sky: ["#e6e9ee", "#d7dbe3", "#f1ece2", "#cfd6df", "#e2e0d6"],
  green: ["#d9e3d4", "#c3d3bd", "#e8eee0", "#b7c9b0", "#cdd8c8"],
  ug: ["#5b6670", "#4a5560", "#6b7680", "#3d4650", "#52606a"],
  skyline: ["#7d8aa0", "#5d6b82", "#8c97a8", "#475569", "#6f7d92"],
  tower: ["#b8c6d6"],
};

export const NEON_COLORS = ["#5ef2ff", "#ff4fd8", "#ffb347", "#7dff9a", "#b06bff", "#ff4f6a"];
