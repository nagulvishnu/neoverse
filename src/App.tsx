import { Component, useEffect, useMemo, type ReactNode } from "react";
import Scene from "./scene/Scene";
import { LoadingScreen, ErrorPanel } from "./ui/LoadingScreen";
import { Story } from "./ui/Story";
import { CityUI, Toast, Tooltip } from "./ui/CityUI";
import { useStore } from "./core/store";
import { DISTRICTS } from "./core/data";
import { audio } from "./audio/AudioEngine";
import { Logo } from "./ui/icons";

function webglSupported() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

class Boundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  componentDidCatch(e: unknown) {
    console.error("NEOVERSE scene error", e);
  }
  render() {
    if (this.state.error)
      return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#02030a] p-6">
          <ErrorPanel message={this.state.error} />
        </div>
      );
    return this.props.children;
  }
}

function Unsupported() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden bg-[#02030a] p-8 text-center">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-neo-magenta/20 via-neo-cyan/5 to-transparent" />
      <Logo size={54} />
      <h1 className="mt-6 font-display text-3xl font-extrabold tracking-[0.4em] text-white title-glow">NEOVERSE</h1>
      <p className="mt-2 font-body text-xs tracking-[0.4em] text-neo-cyan/80">THE CITY THAT NEVER SLEEPS</p>
      <p className="mt-10 max-w-md font-body text-slate-300">
        This experience needs WebGL, which isn't available in this browser or device. Enable hardware acceleration, update your browser or try another device to enter the city.
      </p>
    </div>
  );
}

function useShortcuts() {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const s = useStore.getState();
      if (s.phase !== "city") return;
      if (e.code === "Escape") {
        if (s.vehicle.active) s.exitVehicle();
        else if (s.helpOpen) s.toggle("helpOpen");
        else if (s.districtPanel || s.selectedLandmark) s.closePanels();
        else if (s.envOpen) s.toggle("envOpen");
        else if (s.menuOpen) s.toggle("menuOpen");
        return;
      }
      if (e.repeat) return;
      if (e.code === "KeyH") s.toggle("hud");
      else if (e.code === "KeyR") s.resetCamera();
      else if (e.code === "KeyV") (s.vehicle.active ? s.exitVehicle : s.enterVehicle)();
      else if (/^Digit[1-5]$/.test(e.code)) s.goDistrict(DISTRICTS[parseInt(e.code.slice(5)) - 1].id);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
}

export default function App() {
  const phase = useStore((s) => s.phase);
  const supported = useMemo(webglSupported, []);
  useShortcuts();
  useEffect(() => useStore.subscribe(() => audio.update()), []);

  if (!supported) return <Unsupported />;
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#02030a]">
      <Boundary>
        <Scene />
      </Boundary>
      {phase === "intro" && <Story />}
      {phase === "city" && <CityUI />}
      <Tooltip />
      <Toast />
      <LoadingScreen />
    </div>
  );
}
