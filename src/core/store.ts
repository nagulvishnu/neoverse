import { create } from "zustand";
import { Vector3 } from "three";
import { MOBILE, type DistrictId } from "./layout";
import { DISTRICTS, OVERVIEW, districtById, landmarkById, orbitPosition, type OrbitDef } from "./data";
import { camState, flyTo, cancelFly, syncFreeFromCamera } from "./camera";
import type { Quality } from "./quality";
import type { TimeOfDay, Weather } from "./environment";

export type Phase = "loading" | "intro" | "city";
export type CameraMode = "cinematic" | "free" | "district" | "vehicle";

interface VehicleHud {
  active: boolean;
  speed: number;
  alt: number;
  status: string;
}

interface State {
  phase: Phase;
  loadProgress: number;
  loadLabel: string;
  loadError: string | null;
  storySection: number;
  cameraMode: CameraMode;
  focusDistrict: DistrictId | null;
  districtPanel: DistrictId | null;
  selectedLandmark: string | null;
  hover: { id: string; x: number; y: number } | null;
  currentDistrict: DistrictId;
  timeOfDay: TimeOfDay;
  weather: Weather;
  quality: Quality;
  dprScale: number;
  fps: number;
  audioEnabled: boolean;
  volume: number;
  muted: boolean;
  hud: boolean;
  menuOpen: boolean;
  envOpen: boolean;
  helpOpen: boolean;
  moveSpeed: number;
  vehicle: VehicleHud;
  toast: string | null;
  flying: boolean;
  shotName: string;

  setProgress: (p: number, label: string) => void;
  setLoadError: (m: string) => void;
  finishLoading: () => void;
  setStorySection: (i: number) => void;
  enterCity: (skip?: boolean) => void;
  openStory: () => void;
  setCameraMode: (m: CameraMode) => void;
  goDistrict: (id: DistrictId) => void;
  goLandmark: (id: string) => void;
  enterDistrict: (id: DistrictId) => void;
  viewLandmark: (id: string) => void;
  resetCamera: () => void;
  closePanels: () => void;
  setTime: (t: TimeOfDay) => void;
  setWeather: (w: Weather) => void;
  setQuality: (q: Quality) => void;
  setHover: (h: State["hover"]) => void;
  setCurrentDistrict: (d: DistrictId) => void;
  setAudio: (p: Partial<{ audioEnabled: boolean; volume: number; muted: boolean }>) => void;
  toggle: (k: "hud" | "menuOpen" | "envOpen" | "helpOpen") => void;
  setMoveSpeed: (v: number) => void;
  enterVehicle: () => void;
  exitVehicle: () => void;
  setVehicleHud: (v: Partial<VehicleHud>) => void;
  setTimeoutToast: (m: string) => void;
  setDprScale: (v: number, fps: number) => void;
  setFlying: (f: boolean) => void;
  setShot: (n: string) => void;
}

let toastTimer: number | undefined;

/** Default quality: mobile → low, desktop → high; `?quality=low|medium|high` overrides. */
function initialQuality(): Quality {
  const q = new URLSearchParams(window.location.search).get("quality");
  if (q === "low" || q === "medium" || q === "high") return q;
  return MOBILE ? "low" : "high";
}

function setOrbit(o: OrbitDef) {
  camState.orbit.center.set(...o.center);
  camState.orbit.tRadius = o.radius;
  camState.orbit.radius = o.radius;
  camState.orbit.tAz = o.az;
  camState.orbit.az = o.az;
  camState.orbit.tEl = o.el;
  camState.orbit.el = o.el;
}

export const useStore = create<State>((set, get) => ({
  phase: "loading",
  loadProgress: 0,
  loadLabel: "Initialising renderer",
  loadError: null,
  storySection: 0,
  cameraMode: "cinematic",
  focusDistrict: null,
  districtPanel: null,
  selectedLandmark: null,
  hover: null,
  currentDistrict: "downtown",
  timeOfDay: "night",
  weather: "fog",
  quality: initialQuality(),
  dprScale: 1,
  fps: 60,
  audioEnabled: false,
  volume: 0.6,
  muted: false,
  hud: true,
  menuOpen: false,
  envOpen: false,
  helpOpen: false,
  moveSpeed: 70,
  vehicle: { active: false, speed: 0, alt: 0, status: "Docked" },
  toast: null,
  flying: false,
  shotName: "",

  setProgress: (p, label) => set({ loadProgress: p, loadLabel: label }),
  setLoadError: (m) => set({ loadError: m }),
  finishLoading: () => set({ phase: "intro", loadProgress: 1, loadLabel: "Ready" }),
  setStorySection: (i) => set({ storySection: i }),

  enterCity: (skip = false) => {
    const s = get();
    if (s.phase === "city") return;
    set({
      phase: "city",
      cameraMode: "free",
      focusDistrict: null,
      districtPanel: null,
      selectedLandmark: null,
      timeOfDay: s.timeOfDay === "night" && s.weather === "fog" ? "sunset" : s.timeOfDay,
      weather: s.timeOfDay === "night" && s.weather === "fog" ? "clear" : s.weather,
      flying: true,
    });
    cancelFly();
    flyTo(new Vector3(...OVERVIEW.pos), new Vector3(...OVERVIEW.target), {
      dur: skip ? 2.6 : 4.2,
      onDone: () => {
        syncFreeFromCamera();
        set({ flying: false });
        get().setTimeoutToast("Free camera — WASD to move, drag to look, scroll for speed");
      },
    });
  },

  openStory: () => {
    get().exitVehicle();
    cancelFly();
    camState.storyTouched = true;
    set({ phase: "intro", districtPanel: null, selectedLandmark: null, menuOpen: false, envOpen: false, flying: false });
  },

  setCameraMode: (m) => {
    const s = get();
    if (s.phase !== "city") return;
    if (m === "vehicle") return s.enterVehicle();
    if (s.vehicle.active) s.exitVehicle();
    if (m === "district") return s.goDistrict(s.currentDistrict);
    if (m === "free") {
      set({ cameraMode: "free", focusDistrict: null });
      if (!camState.fly) syncFreeFromCamera();
      else camState.fly.onDone = () => { syncFreeFromCamera(); set({ flying: false }); };
      return;
    }
    cancelFly();
    set({ cameraMode: "cinematic", focusDistrict: null, flying: false, districtPanel: null, selectedLandmark: null });
  },

  goDistrict: (id) => {
    const s = get();
    if (s.vehicle.active) s.exitVehicle();
    const d = districtById(id);
    setOrbit(d.orbit);
    set({ cameraMode: "district", focusDistrict: id, districtPanel: id, selectedLandmark: null, menuOpen: false, flying: true });
    flyTo(orbitPosition(d.orbit), new Vector3(...d.orbit.center), { onDone: () => set({ flying: false }) });
  },

  goLandmark: (id) => {
    const s = get();
    if (s.vehicle.active) s.exitVehicle();
    const l = landmarkById(id);
    setOrbit(l.orbit);
    set({ cameraMode: "district", focusDistrict: l.district, districtPanel: null, selectedLandmark: id, menuOpen: false, flying: true });
    flyTo(orbitPosition(l.orbit), new Vector3(...l.orbit.center), { onDone: () => set({ flying: false }) });
  },

  enterDistrict: (id) => {
    const d = districtById(id);
    set({ cameraMode: "free", focusDistrict: null, districtPanel: null, selectedLandmark: null, flying: true });
    flyTo(new Vector3(...d.enter.pos), new Vector3(...d.enter.target), {
      onDone: () => {
        syncFreeFromCamera();
        set({ flying: false });
        get().setTimeoutToast(`Exploring ${d.name} — WASD to move`);
      },
    });
  },

  viewLandmark: (id) => {
    const l = landmarkById(id);
    set({ cameraMode: "free", focusDistrict: null, districtPanel: null, selectedLandmark: null, flying: true });
    flyTo(new Vector3(...l.view.pos), new Vector3(...l.view.target), {
      onDone: () => {
        syncFreeFromCamera();
        set({ flying: false });
        get().setTimeoutToast(`${l.viewLabel} — ${l.name}`);
      },
    });
  },

  resetCamera: () => {
    const s = get();
    if (s.vehicle.active) s.exitVehicle();
    set({ cameraMode: "free", focusDistrict: null, districtPanel: null, selectedLandmark: null, menuOpen: false, flying: true });
    flyTo(new Vector3(...OVERVIEW.pos), new Vector3(...OVERVIEW.target), {
      onDone: () => {
        syncFreeFromCamera();
        set({ flying: false });
      },
    });
  },

  closePanels: () => set({ districtPanel: null, selectedLandmark: null }),
  setTime: (timeOfDay) => set({ timeOfDay }),
  setWeather: (weather) => set({ weather }),
  setQuality: (quality) => set({ quality }),
  setHover: (hover) => set({ hover }),
  setCurrentDistrict: (currentDistrict) => set({ currentDistrict }),
  setAudio: (p) => set(p),
  toggle: (k) => set((s) => ({ [k]: !s[k] }) as Partial<State>),
  setMoveSpeed: (moveSpeed) => set({ moveSpeed }),

  enterVehicle: () => {
    const s = get();
    if (s.phase !== "city" || s.vehicle.active) return;
    cancelFly();
    set({
      cameraMode: "vehicle",
      districtPanel: null,
      selectedLandmark: null,
      focusDistrict: null,
      menuOpen: false,
      flying: false,
      vehicle: { active: true, speed: 0, alt: 0, status: "Engaging" },
    });
  },
  exitVehicle: () => {
    const s = get();
    if (!s.vehicle.active) return;
    set({ cameraMode: "free", vehicle: { active: false, speed: 0, alt: 0, status: "Docked" } });
    // free camera continues from the chase camera pose (vehicle controller keeps camState updated)
    syncFreeFromCamera();
  },
  setVehicleHud: (v) => set((s) => ({ vehicle: { ...s.vehicle, ...v } })),

  setTimeoutToast: (m) => {
    set({ toast: m });
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => set({ toast: null }), 4200);
  },
  setDprScale: (dprScale, fps) => set({ dprScale, fps }),
  setFlying: (flying) => set({ flying }),
  setShot: (shotName) => set({ shotName }),
}));

export const DISTRICT_IDS = DISTRICTS.map((d) => d.id);
