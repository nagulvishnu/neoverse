import { env, live } from "../core/environment";
import { useStore } from "../core/store";

/**
 * Fully procedural ambient sound design (no copyrighted samples): city drone, wind, rain, underground
 * machinery, vehicle propulsion and UI blips. Nothing is created until the user explicitly enables sound.
 */
class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  private gains: Record<string, GainNode> = {};
  private veh?: { osc: OscillatorNode; osc2: OscillatorNode; filter: BiquadFilterNode };
  private timer: number | undefined;

  private noise(kind: "white" | "brown") {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "white") d[i] = w;
      else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  private layer(name: string, node: AudioNode) {
    const g = this.ctx!.createGain();
    g.gain.value = 0;
    node.connect(g).connect(this.master);
    this.gains[name] = g;
    return g;
  }

  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // city drone: brown noise + detuned low hum
    const city = this.noise("brown");
    const cl = ctx.createBiquadFilter();
    cl.type = "lowpass";
    cl.frequency.value = 380;
    city.connect(cl);
    this.layer("city", cl);
    city.start();
    const hum = ctx.createOscillator();
    hum.type = "sawtooth";
    hum.frequency.value = 55;
    const hum2 = ctx.createOscillator();
    hum2.type = "sine";
    hum2.frequency.value = 82.6;
    const hf = ctx.createBiquadFilter();
    hf.type = "lowpass";
    hf.frequency.value = 220;
    hum.connect(hf);
    hum2.connect(hf);
    this.layer("hum", hf);
    hum.start();
    hum2.start();

    // wind
    const wind = this.noise("white");
    const wf = ctx.createBiquadFilter();
    wf.type = "bandpass";
    wf.frequency.value = 520;
    wf.Q.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lg = ctx.createGain();
    lg.gain.value = 260;
    lfo.connect(lg).connect(wf.frequency);
    lfo.start();
    wind.connect(wf);
    this.layer("wind", wf);
    wind.start();

    // rain
    const rain = this.noise("white");
    const rf = ctx.createBiquadFilter();
    rf.type = "highpass";
    rf.frequency.value = 1800;
    rain.connect(rf);
    this.layer("rain", rf);
    rain.start();

    // underground machinery: low pulsing square + filtered noise
    const mach = ctx.createOscillator();
    mach.type = "square";
    mach.frequency.value = 38;
    const mf = ctx.createBiquadFilter();
    mf.type = "lowpass";
    mf.frequency.value = 160;
    const pulse = ctx.createOscillator();
    pulse.frequency.value = 1.6;
    const pg = ctx.createGain();
    pg.gain.value = 60;
    pulse.connect(pg).connect(mf.frequency);
    pulse.start();
    mach.connect(mf);
    const mn = this.noise("brown");
    const mnf = ctx.createBiquadFilter();
    mnf.type = "bandpass";
    mnf.frequency.value = 240;
    mn.connect(mnf);
    mnf.connect(mf);
    this.layer("machine", mf);
    mach.start();
    mn.start();

    // vehicle propulsion
    const vo = ctx.createOscillator();
    vo.type = "sawtooth";
    vo.frequency.value = 70;
    const vo2 = ctx.createOscillator();
    vo2.type = "triangle";
    vo2.frequency.value = 140;
    const vf = ctx.createBiquadFilter();
    vf.type = "lowpass";
    vf.frequency.value = 500;
    vo.connect(vf);
    vo2.connect(vf);
    const vn = this.noise("white");
    const vnf = ctx.createBiquadFilter();
    vnf.type = "bandpass";
    vnf.frequency.value = 900;
    vn.connect(vnf);
    vnf.connect(vf);
    this.layer("vehicle", vf);
    vo.start();
    vo2.start();
    vn.start();
    this.veh = { osc: vo, osc2: vo2, filter: vf };

    this.timer = window.setInterval(() => this.update(), 100);
    this.update();
  }

  private set(name: string, v: number, tc = 0.4) {
    const g = this.gains[name];
    if (g && this.ctx) g.gain.setTargetAtTime(v, this.ctx.currentTime, tc);
  }

  update() {
    if (!this.ctx) return;
    const s = useStore.getState();
    const on = s.audioEnabled && !s.muted;
    this.master.gain.setTargetAtTime(on ? s.volume : 0, this.ctx.currentTime, 0.15);
    const ug = live.ug;
    const above = 1 - ug;
    const height = Math.min(1, Math.max(0, live.camY / 300));
    this.set("city", 0.28 * above * (1 - env.night * 0.35));
    this.set("hum", 0.05 * (0.6 + env.night * 0.4));
    this.set("wind", (0.04 + height * 0.2 + env.gray * 0.05) * above);
    this.set("rain", 0.22 * env.rain * above);
    this.set("machine", 0.34 * ug);
    const veh = s.vehicle;
    this.set("vehicle", veh.active ? 0.1 + Math.min(1, veh.speed / 400) * 0.25 : 0, 0.2);
    if (this.veh) {
      const sp = Math.min(1, veh.speed / 400);
      this.veh.osc.frequency.setTargetAtTime(62 + sp * 110, this.ctx.currentTime, 0.2);
      this.veh.osc2.frequency.setTargetAtTime(124 + sp * 230, this.ctx.currentTime, 0.2);
      this.veh.filter.frequency.setTargetAtTime(380 + sp * 1500, this.ctx.currentTime, 0.2);
    }
  }

  blip(freq = 880, dur = 0.07, vol = 0.08) {
    const s = useStore.getState();
    if (!this.ctx || !s.audioEnabled || s.muted) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * 1.6, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol * s.volume, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  dispose() {
    if (this.timer) window.clearInterval(this.timer);
    void this.ctx?.close();
    this.ctx = null;
  }
}

export const audio = new AudioEngine();
