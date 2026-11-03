import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { STORY } from "../core/data";
import { camState } from "../core/camera";
import { useStore } from "../core/store";
import { audio } from "../audio/AudioEngine";
import { Icon, Logo } from "./icons";

gsap.registerPlugin(ScrollTrigger);

function Title() {
  const letters = "NEOVERSE".split("");
  return (
    <h1 className="font-display text-[clamp(2.6rem,11vw,9rem)] font-extrabold leading-none text-white title-glow" aria-label="NEOVERSE">
      {letters.map((l, i) => (
        <span key={i} className="inline-block opacity-0" style={{ animation: "letterIn 1.6s cubic-bezier(.2,.8,.2,1) forwards", animationDelay: `${3.2 + i * 0.11}s`, letterSpacing: "0.12em" }}>
          {l}
        </span>
      ))}
    </h1>
  );
}

/**
 * Scroll-driven storytelling. A normal scrollable page (no pinning / no scroll-jacking) whose progress is
 * mapped by GSAP ScrollTrigger onto the camera spline; each section also sets time-of-day and weather.
 */
export function Story() {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const enterCity = useStore((s) => s.enterCity);
  const setTime = useStore((s) => s.setTime);
  const setWeather = useStore((s) => s.setWeather);
  const setStorySection = useStore((s) => s.setStorySection);
  const audioEnabled = useStore((s) => s.audioEnabled);
  const setAudio = useStore((s) => s.setAudio);
  const muted = useStore((s) => s.muted);
  const [veil, setVeil] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVeil(false), 120);
    // dark → reveal: start in night fog and brighten into sunset as the title appears
    const t2 = setTimeout(() => {
      if (useStore.getState().storySection === 0 && !camState.storyTouched) {
        setTime("sunset");
        setWeather("clear");
      }
    }, 4800);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [setTime, setWeather]);

  useEffect(() => {
    const el = scroller.current;
    const ct = content.current;
    if (!el || !ct) return;
    camState.storyT = 0;
    const ctx = gsap.context(() => {
      const proxy = { t: 0 };
      gsap.to(proxy, {
        t: 1,
        ease: "none",
        onUpdate: () => {
          camState.storyT = proxy.t;
        },
        scrollTrigger: {
          trigger: ct,
          scroller: el,
          start: "top top",
          end: "bottom bottom",
          scrub: 1.1,
          onUpdate: (self) => {
            if (self.progress > 0.003) camState.storyTouched = true;
          },
        },
      });
      gsap.utils.toArray<HTMLElement>("[data-sec]").forEach((sec, i) => {
        ScrollTrigger.create({
          trigger: sec,
          scroller: el,
          start: "top 55%",
          end: "bottom 55%",
          onToggle: (self) => {
            if (!self.isActive) return;
            setActive(i);
            setStorySection(i);
            const s = STORY[i];
            if (i > 0) {
              setTime(s.time);
              setWeather(s.weather);
            }
          },
        });
        if (i > 0)
          gsap.from(sec.querySelectorAll("[data-reveal]"), {
            y: 46,
            opacity: 0,
            duration: 0.9,
            stagger: 0.12,
            ease: "power3.out",
            scrollTrigger: { trigger: sec, scroller: el, start: "top 62%", toggleActions: "play none none reverse" },
          });
      });
    }, ct);
    return () => ctx.revert();
  }, [setTime, setWeather, setStorySection]);

  const go = (i: number) => {
    const secs = content.current?.querySelectorAll<HTMLElement>("[data-sec]");
    const target = secs?.[i];
    if (target && scroller.current) scroller.current.scrollTo({ top: target.offsetTop, behavior: "smooth" });
  };

  return (
    <div className="fixed inset-0 z-30">
      {/* initial darkness that melts away */}
      <div className="pointer-events-none fixed inset-0 z-40 bg-black transition-opacity duration-[3800ms] ease-out" style={{ opacity: veil ? 1 : 0 }} />
      {/* top bar */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between p-4 sm:p-6">
        <div className="pointer-events-auto flex items-center gap-3 opacity-90">
          <Logo size={26} />
          <span className="font-display text-sm font-bold tracking-[0.4em] text-white">NEOVERSE</span>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            className="glass glass-btn flex h-10 w-10 items-center justify-center rounded-full"
            aria-label={audioEnabled && !muted ? "Mute sound" : "Enable sound"}
            title={audioEnabled && !muted ? "Mute sound" : "Enable sound"}
            onClick={() => {
              if (!audioEnabled) {
                audio.start();
                setAudio({ audioEnabled: true, muted: false });
              } else setAudio({ muted: !muted });
            }}
          >
            <Icon name={audioEnabled && !muted ? "volume" : "mute"} />
          </button>
          <button className="glass glass-btn rounded-full px-5 py-2.5 font-display text-[11px] tracking-[0.3em]" onClick={() => enterCity(true)}>
            SKIP INTRO
          </button>
        </div>
      </div>

      {/* progress rail */}
      <div className="pointer-events-none fixed right-3 top-1/2 z-50 hidden -translate-y-1/2 flex-col gap-3 sm:flex">
        {STORY.map((s, i) => (
          <button key={i} className="pointer-events-auto group flex items-center justify-end gap-3" onClick={() => go(i)} aria-label={s.title}>
            <span className={`font-body text-[11px] tracking-widest transition-all ${active === i ? "opacity-90" : "opacity-0 group-hover:opacity-70"} text-neo-cyan`}>{s.title.toUpperCase()}</span>
            <span className={`block rounded-full transition-all ${active === i ? "h-3 w-3 bg-neo-cyan shadow-[0_0_12px_#5ef2ff]" : "h-1.5 w-1.5 bg-white/40"}`} />
          </button>
        ))}
      </div>

      <div ref={scroller} data-scroll-ok className="story-scroll absolute inset-0 overflow-y-auto overflow-x-hidden" style={{ scrollBehavior: "auto" }}>
        <div ref={content}>
          {/* 01 hero */}
          <section data-sec className="relative flex h-screen min-h-[560px] flex-col items-center justify-center px-6 text-center">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
            <Title />
            <p className="mt-6 font-display text-[clamp(0.65rem,2vw,1.05rem)] tracking-[0.55em] text-neo-cyan opacity-0" style={{ animation: "fadeUp 1.4s ease forwards", animationDelay: "5.3s", paddingLeft: "0.55em" }}>
              THE CITY THAT NEVER SLEEPS.
            </p>
            <div className="mt-12 flex flex-col items-center gap-4 opacity-0 sm:flex-row" style={{ animation: "fadeUp 1.2s ease forwards", animationDelay: "6.2s" }}>
              <button onClick={() => enterCity(false)} className="glass glass-btn group relative overflow-hidden rounded-full px-10 py-4 font-display text-sm tracking-[0.4em] text-white">
                <span className="relative z-10 flex items-center gap-3">
                  ENTER THE CITY <Icon name="arrow" size={18} />
                </span>
                <span className="absolute inset-0 -z-0 bg-gradient-to-r from-neo-cyan/0 via-neo-cyan/25 to-neo-magenta/0 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
              <button onClick={() => go(1)} className="font-body text-xs tracking-[0.35em] text-slate-300/80 transition hover:text-neo-cyan">
                OR SCROLL TO DISCOVER
              </button>
            </div>
            <div className="absolute bottom-6 flex flex-col items-center gap-2 opacity-0" style={{ animation: "fadeUp 1s ease forwards", animationDelay: "7s" }}>
              <span className="font-body text-[10px] tracking-[0.5em] text-slate-300/60">SCROLL</span>
              <span className="block h-10 w-px bg-gradient-to-b from-neo-cyan to-transparent" style={{ animation: "pulseLine 2s ease infinite" }} />
            </div>
          </section>

          {STORY.slice(1).map((s, k) => {
            const i = k + 1;
            const last = i === STORY.length - 1;
            return (
              <section key={i} data-sec className={`flex h-screen min-h-[560px] items-center px-5 sm:px-[7vw] ${s.side === "right" ? "justify-end" : "justify-start"}`}>
                <div className="glass max-w-[min(92vw,460px)] rounded-2xl p-6 sm:p-8">
                  <div data-reveal className="font-body text-xs tracking-[0.4em] text-neo-cyan/90">
                    {s.kicker.toUpperCase()}
                  </div>
                  <h2 data-reveal className="mt-3 font-display text-2xl font-bold leading-tight text-white sm:text-3xl">
                    {s.title}
                  </h2>
                  <p data-reveal className="mt-4 font-body text-[1.05rem] leading-relaxed text-slate-200/90">
                    {s.body}
                  </p>
                  {last && (
                    <button data-reveal onClick={() => enterCity(false)} className="glass-btn mt-6 flex items-center gap-3 rounded-full border border-neo-cyan/50 bg-neo-cyan/10 px-8 py-3 font-display text-xs tracking-[0.35em] text-white">
                      BEGIN EXPLORING <Icon name="arrow" size={16} />
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
