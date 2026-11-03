import { useEffect, useRef, useState, type ReactNode } from "react";
import { DISTRICTS, LANDMARKS, districtById, landmarkById } from "../core/data";
import { MOBILE } from "../core/layout";
import { input } from "../core/input";
import { useStore, type CameraMode } from "../core/store";
import { QUALITY, type Quality } from "../core/quality";
import type { TimeOfDay, Weather } from "../core/environment";
import { audio } from "../audio/AudioEngine";
import { Icon, Logo } from "./icons";

const blip = (f = 880) => audio.blip(f);

function IconBtn({ icon, label, onClick, active, badge }: { icon: string; label: string; onClick: () => void; active?: boolean; badge?: ReactNode }) {
  return (
    <button
      className="glass glass-btn relative flex h-10 w-10 items-center justify-center rounded-full text-slate-100"
      data-active={active}
      aria-label={label}
      title={label}
      onClick={() => {
        blip(760);
        onClick();
      }}
    >
      <Icon name={icon} />
      {badge}
    </button>
  );
}

function useFullscreen() {
  const [fs, setFs] = useState(false);
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => useStore.getState().setTimeoutToast("Fullscreen is not available in this browser context"));
  };
  return [fs, toggle] as const;
}

function AudioControl() {
  const enabled = useStore((s) => s.audioEnabled);
  const muted = useStore((s) => s.muted);
  const volume = useStore((s) => s.volume);
  const setAudio = useStore((s) => s.setAudio);
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <IconBtn
        icon={enabled && !muted ? "volume" : "mute"}
        label="Sound"
        active={open}
        onClick={() => {
          if (!enabled) {
            audio.start();
            setAudio({ audioEnabled: true, muted: false });
            setOpen(true);
          } else setOpen((o) => !o);
        }}
      />
      {open && (
        <div className="glass anim-fade-up absolute right-0 top-12 z-50 w-56 rounded-xl p-4">
          <div className="mb-3 flex items-center justify-between font-display text-[10px] tracking-[0.3em] text-neo-cyan">
            SOUND
            <button className="text-slate-400 hover:text-white" onClick={() => setOpen(false)} aria-label="Close">
              <Icon name="close" size={14} />
            </button>
          </div>
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setAudio({ volume: parseFloat(e.target.value) })} className="w-full" aria-label="Volume" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="glass-btn rounded border border-white/10 px-3 py-2 text-xs tracking-widest" data-active={muted} onClick={() => setAudio({ muted: !muted })}>
              {muted ? "UNMUTE" : "MUTE"}
            </button>
            <button
              className="glass-btn rounded border border-white/10 px-3 py-2 text-xs tracking-widest"
              onClick={() => {
                setAudio({ audioEnabled: false });
                setOpen(false);
              }}
            >
              SOUND OFF
            </button>
          </div>
          <p className="mt-3 text-[11px] leading-snug text-slate-400">Procedural ambience: city drone, wind, rain, machinery and propulsion.</p>
        </div>
      )}
    </div>
  );
}

function DistrictNav({ vertical = false, onPick }: { vertical?: boolean; onPick?: () => void }) {
  const focus = useStore((s) => s.focusDistrict);
  const goDistrict = useStore((s) => s.goDistrict);
  return (
    <nav className={`flex ${vertical ? "flex-col" : "items-center"} gap-2`} aria-label="Districts">
      {DISTRICTS.map((d) => (
        <button
          key={d.id}
          className="glass-btn glass flex items-center gap-2 rounded-full px-4 py-2 font-display text-[10px] tracking-[0.22em] text-slate-100"
          data-active={focus === d.id}
          onClick={() => {
            blip(520);
            goDistrict(d.id);
            onPick?.();
          }}
        >
          <span style={{ color: d.accent }}>{d.index}</span>
          {d.name.toUpperCase()}
        </button>
      ))}
    </nav>
  );
}

function TopBar() {
  const s = useStore();
  const [fs, toggleFs] = useFullscreen();
  const dist = districtById(s.currentDistrict);
  const timeIcon = s.timeOfDay === "day" ? "sun" : s.timeOfDay === "sunset" ? "sunset" : "moon";
  const actions = (
    <>
      <button
        className="glass glass-btn flex items-center gap-2 rounded-full px-5 py-2.5 font-display text-[10px] tracking-[0.3em] text-white"
        data-active={s.cameraMode === "free" && !s.vehicle.active}
        onClick={() => {
          blip(660);
          s.setCameraMode("free");
          s.setTimeoutToast("Free camera — WASD to move, drag to look");
        }}
      >
        <Icon name="free" size={16} /> EXPLORE
      </button>
      <IconBtn icon={timeIcon} label="Environment: time of day & weather" active={s.envOpen} onClick={() => s.toggle("envOpen")} />
      <AudioControl />
      <IconBtn icon={fs ? "exitfull" : "full"} label={fs ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFs} />
      <IconBtn icon="reset" label="Reset camera (R)" onClick={() => s.resetCamera()} />
      <IconBtn icon="book" label="Replay the story" onClick={() => s.openStory()} />
      <IconBtn icon="help" label="Controls help" active={s.helpOpen} onClick={() => s.toggle("helpOpen")} />
      <IconBtn icon="eyeoff" label="Hide interface (H)" onClick={() => s.toggle("hud")} />
    </>
  );
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 p-3 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="pointer-events-auto glass flex items-center gap-3 rounded-full py-2 pl-3 pr-5 anim-slide-in-left">
          <Logo size={26} />
          <div className="leading-tight">
            <div className="font-display text-xs font-bold tracking-[0.4em] text-white">NEOVERSE</div>
            <div className="font-body text-[10px] tracking-[0.25em]" style={{ color: dist.accent }}>
              {dist.name.toUpperCase()}
            </div>
          </div>
        </div>
        <div className="pointer-events-auto hidden xl:block">
          <DistrictNav />
        </div>
        <div className="pointer-events-auto hidden items-center gap-2 lg:flex">{actions}</div>
        <button className="pointer-events-auto glass glass-btn flex h-11 w-11 items-center justify-center rounded-full lg:hidden" aria-label="Menu" onClick={() => s.toggle("menuOpen")}>
          <Icon name={s.menuOpen ? "close" : "menu"} />
        </button>
      </div>
      {/* medium screens: districts under the bar */}
      <div className="pointer-events-auto mt-3 hidden justify-center lg:flex xl:hidden">
        <DistrictNav />
      </div>
      {s.menuOpen && (
        <div className="pointer-events-auto glass anim-fade-up mt-3 ml-auto max-h-[75vh] w-full max-w-sm overflow-y-auto rounded-2xl p-4 lg:hidden">
          <div className="mb-3 font-display text-[10px] tracking-[0.3em] text-neo-cyan">DISTRICTS</div>
          <DistrictNav vertical onPick={() => s.toggle("menuOpen")} />
          <div className="mb-3 mt-5 font-display text-[10px] tracking-[0.3em] text-neo-cyan">CONTROLS</div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
      )}
    </header>
  );
}

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; icon: string; text: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="mb-5">
      <div className="mb-2 font-display text-[10px] tracking-[0.3em] text-neo-cyan">{label}</div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
        {options.map((o) => (
          <button
            key={o.v}
            className="glass-btn flex flex-col items-center gap-1 rounded-lg border border-white/10 px-2 py-2.5 text-[11px] tracking-widest text-slate-200"
            data-active={value === o.v}
            onClick={() => {
              blip(600);
              onChange(o.v);
            }}
          >
            <Icon name={o.icon} />
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function EnvPanel() {
  const s = useStore();
  if (!s.envOpen) return null;
  return (
    <aside className="glass anim-slide-in pointer-events-auto fixed right-3 top-[4.5rem] z-40 max-h-[calc(100vh-8rem)] w-[min(92vw,330px)] overflow-y-auto rounded-2xl p-5 sm:right-5 sm:top-20">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-display text-xs tracking-[0.3em] text-white">ENVIRONMENT</div>
        <button className="text-slate-400 hover:text-white" onClick={() => s.toggle("envOpen")} aria-label="Close">
          <Icon name="close" size={16} />
        </button>
      </div>
      <Seg<TimeOfDay> label="TIME OF DAY" value={s.timeOfDay} onChange={s.setTime} options={[{ v: "day", icon: "sun", text: "DAY" }, { v: "sunset", icon: "sunset", text: "SUNSET" }, { v: "night", icon: "moon", text: "NIGHT" }]} />
      <Seg<Weather> label="WEATHER" value={s.weather} onChange={s.setWeather} options={[{ v: "clear", icon: "clear", text: "CLEAR" }, { v: "rain", icon: "rain", text: "RAIN" }, { v: "fog", icon: "fog", text: "FOG" }]} />
      <Seg<Quality> label="GRAPHICS QUALITY" value={s.quality} onChange={s.setQuality} options={[{ v: "low", icon: "layers", text: "LOW" }, { v: "medium", icon: "layers", text: "MEDIUM" }, { v: "high", icon: "layers", text: "HIGH" }]} />
      <div className="mb-1 flex justify-between font-display text-[10px] tracking-[0.3em] text-neo-cyan">
        <span>FREE-CAM SPEED</span>
        <span className="text-slate-300">{s.moveSpeed} m/s</span>
      </div>
      <input type="range" min={10} max={400} step={5} value={s.moveSpeed} onChange={(e) => s.setMoveSpeed(parseInt(e.target.value))} className="w-full" aria-label="Free camera speed" />
      <p className="mt-4 text-[11px] leading-snug text-slate-400">
        Resolution {Math.round(s.dprScale * 100)}% · {s.fps} fps · {QUALITY[s.quality].shadows ? "shadows on" : "shadows off"}. Resolution adapts automatically to keep motion smooth.
      </p>
    </aside>
  );
}

function ModeBar() {
  const mode = useStore((s) => s.cameraMode);
  const vehicle = useStore((s) => s.vehicle.active);
  const set = useStore((s) => s.setCameraMode);
  const exit = useStore((s) => s.exitVehicle);
  const items: { m: CameraMode; icon: string; text: string }[] = [
    { m: "cinematic", icon: "film", text: "CINEMATIC" },
    { m: "free", icon: "free", text: "FREE" },
    { m: "district", icon: "district", text: "DISTRICT" },
    { m: "vehicle", icon: "jet", text: "VEHICLE" },
  ];
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-30 flex justify-center px-3 sm:bottom-5">
      <div className="pointer-events-auto glass flex items-center gap-1 rounded-full p-1.5 anim-fade-up">
        {items.map((it) => (
          <button
            key={it.m}
            className="glass-btn flex items-center gap-2 rounded-full border border-transparent px-3 py-2 font-display text-[10px] tracking-[0.18em] text-slate-200 sm:px-4"
            data-active={mode === it.m}
            onClick={() => {
              blip(640);
              set(it.m);
            }}
            aria-label={`${it.text.toLowerCase()} camera`}
          >
            <Icon name={it.icon} size={16} />
            <span className="hidden sm:inline">{it.text}</span>
          </button>
        ))}
        {vehicle && (
          <button className="ml-1 rounded-full border border-neo-magenta/60 bg-neo-magenta/15 px-4 py-2 font-display text-[10px] tracking-[0.2em] text-white hover:bg-neo-magenta/30" onClick={exit}>
            EXIT · ESC
          </button>
        )}
      </div>
    </div>
  );
}

function StatusHud() {
  const s = useStore();
  const d = districtById(s.currentDistrict);
  const modeLabel = s.vehicle.active ? "Vehicle" : s.cameraMode === "free" ? "Free camera" : s.cameraMode === "district" ? "District orbit" : "Cinematic";
  return (
    <div className="pointer-events-none fixed bottom-5 left-5 z-20 hidden lg:block">
      <div className="glass rounded-xl px-4 py-3 anim-slide-in-left">
        <div className="font-display text-[9px] tracking-[0.35em] text-slate-400">LOCATION</div>
        <div className="mt-0.5 font-display text-sm tracking-[0.18em]" style={{ color: d.accent }}>
          {d.name.toUpperCase()}
        </div>
        <div className="mt-2 font-body text-xs tracking-widest text-slate-300">
          {modeLabel.toUpperCase()}
          {s.cameraMode === "cinematic" && s.shotName ? ` · ${s.shotName.toUpperCase()}` : ""}
          {s.flying ? " · TRAVELLING" : ""}
        </div>
        <div className="mt-1 font-body text-[10px] tracking-widest text-slate-500">
          {s.timeOfDay.toUpperCase()} · {s.weather.toUpperCase()} · {s.quality.toUpperCase()} · {s.fps} FPS
        </div>
      </div>
    </div>
  );
}

function Instructions() {
  const mode = useStore((s) => s.cameraMode);
  const speed = useStore((s) => s.moveSpeed);
  const veh = useStore((s) => s.vehicle.active);
  if (MOBILE) return null;
  const rows: [string, string][] = veh
    ? [["W / S", "Throttle / reverse"], ["A / D", "Turn left / right"], ["SPACE / SHIFT", "Ascend / descend"], ["MOUSE", "Look around"], ["ESC", "Exit vehicle"]]
    : mode === "free"
      ? [["W A S D", "Move"], ["SPACE / SHIFT", "Up / down"], ["DRAG", "Look around"], ["WHEEL", `Speed (${speed} m/s)`], ["R", "Reset camera"]]
      : mode === "district"
        ? [["DRAG", "Orbit"], ["WHEEL", "Zoom"], ["CLICK", "Select landmark"], ["1–5", "Districts"]]
        : [["MODE BAR", "Take control any time"], ["V", "Fly a vehicle"], ["H", "Hide interface"]];
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-20 hidden lg:block">
      <div className="glass rounded-xl px-4 py-3 anim-slide-in">
        <div className="mb-2 font-display text-[9px] tracking-[0.35em] text-slate-400">CONTROLS</div>
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-6 py-0.5 font-body text-xs">
            <span className="rounded border border-neo-cyan/40 px-1.5 py-px font-display text-[9px] tracking-widest text-neo-cyan">{k}</span>
            <span className="text-slate-300">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VehicleHud() {
  const v = useStore((s) => s.vehicle);
  if (!v.active) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-20 flex justify-center sm:bottom-24">
      <div className="glass anim-fade-up flex items-stretch gap-6 rounded-2xl px-6 py-3">
        <Gauge label="SPEED" value={v.speed} unit="km/h" max={420} color="#5ef2ff" />
        <Gauge label="ALTITUDE" value={v.alt} unit="m" max={700} color="#ff4fd8" />
        <div className="flex flex-col justify-center">
          <div className="font-display text-[9px] tracking-[0.35em] text-slate-400">STATUS</div>
          <div className="mt-1 font-display text-xs tracking-[0.2em] text-white">{v.status.toUpperCase()}</div>
          <div className="mt-1 flex items-center gap-1.5 font-body text-[10px] tracking-widest text-neo-cyan">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neo-cyan" /> LIGHTS · THRUSTERS
          </div>
        </div>
      </div>
    </div>
  );
}

function Gauge({ label, value, unit, max, color }: { label: string; value: number; unit: string; max: number; color: string }) {
  return (
    <div className="w-24">
      <div className="font-display text-[9px] tracking-[0.35em] text-slate-400">{label}</div>
      <div className="font-display text-2xl font-bold tabular-nums text-white">
        {value}
        <span className="ml-1 text-[10px] font-normal text-slate-400">{unit}</span>
      </div>
      <div className="mt-1 h-[3px] w-full rounded bg-white/10">
        <div className="h-full rounded transition-[width] duration-150" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
    </div>
  );
}

function Panel({ children, onClose, accent }: { children: ReactNode; onClose: () => void; accent: string }) {
  return (
    <aside className="glass anim-slide-in pointer-events-auto fixed inset-x-3 bottom-[4.75rem] z-30 max-h-[52vh] overflow-y-auto rounded-2xl p-5 sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-[6.2rem] sm:max-h-[calc(100vh-9rem)] sm:w-[370px]" style={{ borderColor: `${accent}55` }}>
      <button className="absolute right-4 top-4 text-slate-400 hover:text-white" onClick={onClose} aria-label="Close panel">
        <Icon name="close" size={16} />
      </button>
      {children}
    </aside>
  );
}

function ActionBtn({ children, onClick, primary, accent }: { children: ReactNode; onClick: () => void; primary?: boolean; accent?: string }) {
  return (
    <button
      className="glass-btn flex w-full items-center justify-between rounded-lg border px-4 py-3 font-display text-[10px] tracking-[0.25em] text-white"
      style={{ borderColor: primary ? `${accent}99` : "rgba(255,255,255,0.12)", background: primary ? `${accent}22` : undefined }}
      onClick={() => {
        blip(700);
        onClick();
      }}
    >
      {children}
      <Icon name="arrow" size={14} />
    </button>
  );
}

function DistrictPanel() {
  const id = useStore((s) => s.districtPanel);
  const s = useStore.getState();
  const closePanels = useStore((st) => st.closePanels);
  if (!id) return null;
  const d = districtById(id);
  return (
    <Panel onClose={closePanels} accent={d.accent}>
      <div className="font-display text-[10px] tracking-[0.4em]" style={{ color: d.accent }}>
        DISTRICT {d.index}
      </div>
      <h2 className="mt-2 pr-6 font-display text-2xl font-bold text-white">{d.name}</h2>
      <div className="mt-1 font-body text-sm tracking-widest text-slate-400">{d.tagline.toUpperCase()}</div>
      <p className="mt-4 font-body text-[1.02rem] leading-relaxed text-slate-200/90">{d.description}</p>
      <div className="mt-4 grid grid-cols-1 gap-2">
        {d.stats.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-white/10 pb-1.5 font-body text-sm">
            <span className="tracking-widest text-slate-400">{k.toUpperCase()}</span>
            <span className="text-white">{v}</span>
          </div>
        ))}
      </div>
      <div className="mb-2 mt-5 font-display text-[10px] tracking-[0.3em] text-slate-400">LANDMARKS</div>
      <div className="flex flex-col gap-2">
        {d.landmarks.map((lid) => (
          <button key={lid} className="glass-btn flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5 text-left" onClick={() => { blip(700); s.goLandmark(lid); }}>
            <Icon name="pin" size={16} style={{ color: d.accent }} />
            <span className="font-body text-sm tracking-wide text-slate-100">{landmarkById(lid).name}</span>
          </button>
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <ActionBtn primary accent={d.accent} onClick={() => s.enterDistrict(d.id)}>
          ENTER DISTRICT
        </ActionBtn>
        <ActionBtn onClick={() => s.resetCamera()}>RETURN TO CITY OVERVIEW</ActionBtn>
      </div>
    </Panel>
  );
}

function LandmarkPanel() {
  const id = useStore((s) => s.selectedLandmark);
  const closePanels = useStore((st) => st.closePanels);
  const s = useStore.getState();
  if (!id) return null;
  const l = landmarkById(id);
  const d = districtById(l.district);
  return (
    <Panel onClose={closePanels} accent={l.accent}>
      <div className="font-display text-[10px] tracking-[0.4em]" style={{ color: l.accent }}>
        LANDMARK · {d.name.toUpperCase()}
      </div>
      <h2 className="mt-2 pr-6 font-display text-xl font-bold leading-snug text-white">{l.name}</h2>
      <div className="mt-1 font-body text-sm tracking-widest text-slate-400">{l.tagline.toUpperCase()}</div>
      <p className="mt-4 font-body text-[1.02rem] leading-relaxed text-slate-200/90">{l.description}</p>
      <div className="mt-4 grid grid-cols-1 gap-2">
        {l.facts.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-white/10 pb-1.5 font-body text-sm">
            <span className="tracking-widest text-slate-400">{k.toUpperCase()}</span>
            <span className="text-white">{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <ActionBtn primary accent={l.accent} onClick={() => s.viewLandmark(l.id)}>
          EXPLORE · {l.viewLabel.toUpperCase()}
        </ActionBtn>
        <ActionBtn onClick={() => s.goDistrict(l.district)}>BACK TO {d.name.toUpperCase()}</ActionBtn>
      </div>
    </Panel>
  );
}

function Tooltip() {
  const h = useStore((s) => s.hover);
  if (!h) return null;
  const l = landmarkById(h.id);
  return (
    <div className="pointer-events-none fixed z-50 anim-fade-up" style={{ left: Math.min(h.x + 18, window.innerWidth - 250), top: h.y + 18 }}>
      <div className="glass rounded-lg px-3 py-2" style={{ borderColor: `${l.accent}88` }}>
        <div className="font-display text-[11px] tracking-[0.15em] text-white">{l.name}</div>
        <div className="font-body text-[11px] tracking-widest" style={{ color: l.accent }}>
          CLICK TO DISCOVER
        </div>
      </div>
    </div>
  );
}

export function Toast() {
  const t = useStore((s) => s.toast);
  if (!t) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[8.5rem] z-40 flex justify-center px-4 sm:bottom-24">
      <div key={t} className="glass anim-fade-up rounded-full px-5 py-2.5 font-body text-sm tracking-wider text-slate-100">
        {t}
      </div>
    </div>
  );
}

function Help() {
  const open = useStore((s) => s.helpOpen);
  const toggle = useStore((s) => s.toggle);
  if (!open) return null;
  const rows: [string, string][] = [
    ["W A S D", "Free camera movement (smooth acceleration)"],
    ["SPACE / SHIFT", "Free camera up / down  ·  vehicle ascend / descend"],
    ["MOUSE DRAG", "Look around (free) · orbit (district)"],
    ["MOUSE WHEEL", "Free-cam speed · district zoom"],
    ["V", "Enter / exit flying vehicle (or click the parked ship in Downtown)"],
    ["W S A D (vehicle)", "Throttle, reverse, turn left, turn right"],
    ["ESC", "Exit vehicle / close panels"],
    ["R", "Reset camera to the city overview"],
    ["1 – 5", "Jump to district"],
    ["H", "Hide / show interface"],
    ["CLICK LANDMARK", "Glowing beacons mark the 7 landmarks"],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => toggle("helpOpen")}>
      <div className="glass anim-fade-up w-[min(94vw,520px)] rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="font-display text-sm tracking-[0.3em] text-white">CONTROLS</div>
          <button onClick={() => toggle("helpOpen")} className="text-slate-400 hover:text-white" aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-4 border-b border-white/5 py-2 font-body text-sm">
            <span className="shrink-0 font-display text-[10px] tracking-widest text-neo-cyan">{k}</span>
            <span className="text-right text-slate-300">{v}</span>
          </div>
        ))}
        <p className="mt-4 text-xs text-slate-500">On touch devices use the on-screen joystick, the ▲▼ buttons and drag to look.</p>
      </div>
    </div>
  );
}

function TouchControls() {
  const mode = useStore((s) => s.cameraMode);
  const flying = useStore((s) => s.flying);
  const pad = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef(-1);
  if (!MOBILE || (mode !== "free" && mode !== "vehicle") || flying) return null;
  const move = (e: React.PointerEvent) => {
    const r = pad.current!.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.min(1, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    const x = Math.cos(a) * m;
    const y = Math.sin(a) * m;
    setKnob({ x, y });
    input.joyX = x;
    input.joyY = -y;
  };
  const end = () => {
    active.current = -1;
    setKnob({ x: 0, y: 0 });
    input.joyX = 0;
    input.joyY = 0;
  };
  return (
    <>
      <div
        ref={pad}
        className="glass pointer-events-auto fixed bottom-24 left-5 z-30 h-28 w-28 rounded-full touch-none"
        onPointerDown={(e) => {
          active.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={(e) => active.current === e.pointerId && move(e)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="absolute h-12 w-12 rounded-full bg-neo-cyan/30 ring-1 ring-neo-cyan/70" style={{ left: `calc(50% - 24px + ${knob.x * 34}px)`, top: `calc(50% - 24px + ${knob.y * 34}px)` }} />
      </div>
      <div className="pointer-events-auto fixed bottom-24 right-5 z-30 flex flex-col gap-3">
        {[1, -1].map((d) => (
          <button
            key={d}
            className="glass glass-btn flex h-14 w-14 items-center justify-center rounded-full touch-none"
            aria-label={d > 0 ? "Ascend" : "Descend"}
            onPointerDown={() => (input.touchUp = d)}
            onPointerUp={() => (input.touchUp = 0)}
            onPointerCancel={() => (input.touchUp = 0)}
            onPointerLeave={() => (input.touchUp = 0)}
          >
            <Icon name={d > 0 ? "up" : "down"} size={22} />
          </button>
        ))}
      </div>
    </>
  );
}

export function CityUI() {
  const hud = useStore((s) => s.hud);
  const toggle = useStore((s) => s.toggle);
  if (!hud)
    return (
      <button className="glass glass-btn fixed right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full" aria-label="Show interface (H)" title="Show interface (H)" onClick={() => toggle("hud")}>
        <Icon name="eye" />
      </button>
    );
  return (
    <>
      <TopBar />
      <EnvPanel />
      <DistrictPanel />
      <LandmarkPanel />
      <StatusHud />
      <Instructions />
      <VehicleHud />
      <ModeBar />
      <TouchControls />
      <Help />
    </>
  );
}

export { Tooltip, LANDMARKS };
