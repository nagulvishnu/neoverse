import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useStore } from "../core/store";
import { QUALITY, type Quality } from "../core/quality";

/**
 * Adaptive rendering: measures frame time and scales the pixel ratio (dynamic resolution).
 * If the minimum resolution still can't hold ~30 fps the quality level steps down automatically.
 */
export function PerfManager() {
  const acc = useRef({ t: 0, frames: 0, bad: 0, good: 0, warm: 0 });
  useFrame((_, delta) => {
    const a = acc.current;
    if (delta > 0.5) return; // tab was hidden / long stall
    a.t += delta;
    a.frames++;
    if (a.t < 1.5) return;
    const fps = a.frames / a.t;
    a.t = 0;
    a.frames = 0;
    a.warm++;
    if (a.warm < 3) return; // ignore shader compilation hitches
    const st = useStore.getState();
    if (st.phase === "loading") return;
    const cfg = QUALITY[st.quality];
    const dpr = Math.min(window.devicePixelRatio || 1, cfg.dprMax);
    const minScale = cfg.dprMin / dpr;
    let scale = st.dprScale;
    if (fps < 42) {
      a.good = 0;
      scale = Math.max(Math.min(1, minScale), scale - 0.12);
      if (scale <= Math.min(1, minScale) + 0.001 && fps < 28) {
        a.bad++;
        if (a.bad >= 3 && st.quality !== "low") {
          const next: Quality = st.quality === "high" ? "medium" : "low";
          a.bad = 0;
          st.setQuality(next);
          st.setTimeoutToast(`Performance mode: quality lowered to ${next}`);
          scale = 1;
        }
      }
    } else if (fps > 57) {
      a.bad = 0;
      a.good++;
      if (a.good >= 3 && scale < 1) scale = Math.min(1, scale + 0.06);
    }
    if (Math.abs(scale - st.dprScale) > 0.001 || Math.abs(fps - st.fps) > 4) st.setDprScale(scale, Math.round(fps));
  });
  return null;
}
