import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useStore } from "../core/store";
import { QUALITY } from "../core/quality";
import { EnvironmentController } from "./Environment";
import { CameraRig } from "./CameraRig";
import { PostFX } from "./PostFX";
import { PerfManager } from "./Perf";
import { Motes, Rain } from "./Particles";
import { Ground, Skyline } from "./city/Ground";
import { Traffic } from "./traffic/Traffic";
import { PlayerVehicle } from "./vehicle/PlayerVehicle";
import { getCity } from "./cityData";
import { makeSignAtlas } from "./materials";
import { setAtlas } from "./city/common";
import { initInput } from "../core/input";

// Districts are separate lazily-loaded modules and are mounted one at a time during loading.
const Downtown = lazy(() => import("./city/Downtown").then((m) => ({ default: m.Downtown })));
const Neon = lazy(() => import("./city/Neon").then((m) => ({ default: m.Neon })));
const SkyDistrict = lazy(() => import("./city/SkyDistrict").then((m) => ({ default: m.SkyDistrict })));
const Underground = lazy(() => import("./city/Underground").then((m) => ({ default: m.Underground })));
const Green = lazy(() => import("./city/Green").then((m) => ({ default: m.Green })));

const frames = (n = 2) =>
  new Promise<void>((res) => {
    let c = 0;
    const f = () => (++c >= n ? res() : requestAnimationFrame(f));
    requestAnimationFrame(f);
  });

let loaderStarted = false;

/** Real staged loading: fonts → sign atlas → city data → districts one by one → shader compile. */
function Loader({ onStage }: { onStage: (n: number) => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (loaderStarted) return;
    loaderStarted = true;
    const st = useStore.getState();
    (async () => {
      try {
        st.setProgress(0.04, "Initialising renderer");
        await frames(2);
        st.setProgress(0.1, "Synthesising neon signage");
        try {
          await Promise.race([document.fonts.load('800 40px "Orbitron"'), new Promise((r) => setTimeout(r, 1500))]);
        } catch {
          /* font optional */
        }
        setAtlas(makeSignAtlas());
        await frames(1);
        st.setProgress(0.2, "Generating architecture");
        await frames(1);
        getCity();
        await frames(1);
        const steps = ["Raising Downtown", "Lighting the Neon District", "Floating the Sky District", "Excavating the Underground", "Growing the Green District", "Dispatching vehicles"];
        for (let i = 0; i < steps.length; i++) {
          st.setProgress(0.28 + (i / steps.length) * 0.52, steps[i]);
          onStage(i + 1);
          await frames(7);
        }
        st.setProgress(0.86, "Compiling shaders");
        await frames(3);
        try {
          await gl.compileAsync(scene, camera);
        } catch {
          /* compile warm-up is best-effort */
        }
        st.setProgress(0.97, "Calibrating lighting");
        await frames(4);
        st.finishLoading();
      } catch (e) {
        console.error(e);
        st.setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [gl, scene, camera, onStage]);
  return null;
}

function Contexts() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      useStore.getState().setLoadError("The GPU context was lost. Reload the page or lower the quality setting.");
    };
    el.addEventListener("webglcontextlost", lost);
    return () => el.removeEventListener("webglcontextlost", lost);
  }, [gl]);
  return null;
}

export default function Scene() {
  const quality = useStore((s) => s.quality);
  const dprScale = useStore((s) => s.dprScale);
  const [stage, setStage] = useState(0);
  const cfg = QUALITY[quality];
  const dpr = useMemo(() => {
    const base = Math.min(window.devicePixelRatio || 1, cfg.dprMax);
    return Math.max(cfg.dprMin, base * dprScale);
  }, [cfg, dprScale]);

  useEffect(() => initInput(), []);

  return (
    <Canvas
      flat
      dpr={dpr}
      camera={{ fov: 60, near: 0.8, far: 6000, position: [-30, 38, 1500] }}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false }}
      onCreated={({ gl }) => gl.setClearColor("#02030a")}
      style={{ position: "fixed", inset: 0 }}
    >
      <Contexts />
      <Loader onStage={setStage} />
      <EnvironmentController />
      <CameraRig />
      <PerfManager />
      <PostFX />
      <Suspense fallback={null}>
        {stage >= 1 && (
          <>
            <Ground />
            <Skyline />
            <Downtown />
          </>
        )}
        {stage >= 2 && <Neon />}
        {stage >= 3 && <SkyDistrict />}
        {stage >= 4 && <Underground />}
        {stage >= 5 && <Green />}
        {stage >= 6 && (
          <>
            <Traffic />
            <PlayerVehicle />
            <Rain />
            <Motes />
          </>
        )}
      </Suspense>
    </Canvas>
  );
}
