import { useEffect, useState } from "react";
import { useStore } from "../core/store";
import { Logo } from "./icons";

export function ErrorPanel({ message }: { message: string }) {
  const setQuality = useStore((s) => s.setQuality);
  return (
    <div className="max-w-md text-center anim-fade-up">
      <div className="mx-auto mb-4 h-px w-24 bg-gradient-to-r from-transparent via-neo-magenta to-transparent" />
      <h2 className="font-display text-xl tracking-widest text-neo-magenta">RENDERING ERROR</h2>
      <p className="mt-3 text-sm text-slate-300/90 break-words">{message}</p>
      <div className="mt-6 flex justify-center gap-3">
        <button className="glass glass-btn rounded px-5 py-2 font-display text-xs tracking-widest" onClick={() => location.reload()}>
          RELOAD
        </button>
        <button
          className="glass glass-btn rounded px-5 py-2 font-display text-xs tracking-widest"
          onClick={() => {
            setQuality("low");
            location.reload();
          }}
        >
          RELOAD · LOW QUALITY
        </button>
      </div>
    </div>
  );
}

export function LoadingScreen() {
  const phase = useStore((s) => s.phase);
  const progress = useStore((s) => s.loadProgress);
  const label = useStore((s) => s.loadLabel);
  const error = useStore((s) => s.loadError);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (phase !== "loading") {
      const t = setTimeout(() => setGone(true), 1400);
      return () => clearTimeout(t);
    }
  }, [phase]);
  if (gone && !error) return null;

  const leaving = phase !== "loading" && !error;
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#02030a] transition-opacity duration-[1400ms]"
      style={{ opacity: leaving ? 0 : 1, pointerEvents: leaving ? "none" : "auto" }}
      role="status"
      aria-live="polite"
    >
      {error ? (
        <ErrorPanel message={error} />
      ) : (
        <div className="flex w-[min(86vw,420px)] flex-col items-center">
          <div className="mb-6 animate-pulse">
            <Logo size={46} />
          </div>
          <div className="font-display text-3xl font-extrabold tracking-[0.5em] text-white title-glow pl-[0.5em]">NEOVERSE</div>
          <div className="mt-2 font-body text-xs tracking-[0.4em] text-neo-cyan/70">THE CITY THAT NEVER SLEEPS</div>
          <div className="mt-10 h-[3px] w-full overflow-hidden rounded bg-white/10">
            <div className="h-full rounded bg-gradient-to-r from-neo-cyan to-neo-magenta shadow-[0_0_14px_#5ef2ff] transition-[width] duration-500" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="mt-3 flex w-full justify-between font-body text-xs tracking-widest text-slate-400">
            <span>{label.toUpperCase()}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
