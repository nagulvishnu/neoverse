import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, ShaderMaterial } from "three";
import { useStore } from "../core/store";
import { QUALITY } from "../core/quality";
import { env, live } from "../core/environment";
import { mulberry32 } from "../core/rng";
import { U } from "./materials";

const RW = 130;
const RH = 80;

/** GPU rain: line-segment streaks wrapped around the camera, density driven by the smoothed rain factor. */
export function Rain() {
  const quality = useStore((s) => s.quality);
  const n = QUALITY[quality].rainDrops;
  const { geo, mat } = useMemo(() => {
    const r = mulberry32(42);
    const pos = new Float32Array(n * 6);
    const end = new Float32Array(n * 2);
    const seed = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = r() * RW;
      const y = r() * RH;
      const z = r() * RW;
      const s = r();
      for (let k = 0; k < 2; k++) {
        pos.set([x, y, z], i * 6 + k * 3);
        end[i * 2 + k] = k;
        seed[i * 2 + k] = s;
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.setAttribute("aEnd", new Float32BufferAttribute(end, 1));
    g.setAttribute("aSeed", new Float32BufferAttribute(seed, 1));
    const m = new ShaderMaterial({
      uniforms: { uTime: U.uTime, uRain: U.uRain, uNight: U.uNight, uUg: U.uUg, uCam: { value: [0, 0, 0] } },
      vertexShader: /* glsl */ `
        attribute float aEnd; attribute float aSeed;
        uniform float uTime; uniform float uRain; uniform float uUg; uniform vec3 uCam;
        varying float vA;
        void main(){
          float W = ${RW.toFixed(1)}; float H = ${RH.toFixed(1)};
          vec3 p = position;
          float speed = 48.0 + aSeed * 22.0;
          p.y = p.y - uTime * speed;
          vec3 w;
          w.x = uCam.x + mod(p.x - uCam.x + W * 0.5, W) - W * 0.5;
          w.z = uCam.z + mod(p.z - uCam.z + W * 0.5, W) - W * 0.5;
          w.y = uCam.y + mod(p.y - uCam.y + H * 0.5, H) - H * 0.5;
          w.y += aEnd * (1.2 + aSeed * 1.2);
          w.x += aEnd * 0.18;
          float vis = step(aSeed, uRain * 0.999);
          float d = length(w - uCam);
          vA = vis * smoothstep(W * 0.5, W * 0.18, d) * smoothstep(1.5, 5.0, d) * (1.0 - uUg) * mix(0.55, 1.0, aEnd);
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uNight; varying float vA;
        void main(){
          vec3 c = mix(vec3(0.5, 0.58, 0.7), vec3(0.65, 0.78, 1.0), uNight);
          gl_FragColor = vec4(c * (0.8 + uNight * 1.2), vA * 0.34);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    return { geo: g, mat: m };
  }, [n]);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  const cam = useThree((s) => s.camera);
  useFrame(() => {
    mat.uniforms.uCam.value = [cam.position.x, cam.position.y, cam.position.z];
  });
  return <lineSegments geometry={geo} material={mat} frustumCulled={false} renderOrder={7} visible />;
}

const MW = 110;
const MH = 60;
const MOTE_COLORS: Record<string, string> = { downtown: "#bfe6ff", neon: "#ff6adf", sky: "#fff1c8", underground: "#37ffd0", green: "#9dff8a" };

/** Floating atmospheric particles (dust, embers, fireflies, underground motes) tinted by the nearest district. */
export function Motes() {
  const quality = useStore((s) => s.quality);
  const n = QUALITY[quality].motes;
  const { geo, mat } = useMemo(() => {
    const r = mulberry32(7);
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set([r() * MW, r() * MH, r() * MW], i * 3);
      seed[i] = r();
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new Float32BufferAttribute(seed, 1));
    const m = new ShaderMaterial({
      uniforms: { uTime: U.uTime, uPx: U.uPx, uCam: { value: [0, 0, 0] }, uColor: { value: new Color() }, uAlpha: { value: 0.5 } },
      vertexShader: /* glsl */ `
        attribute float aSeed; uniform float uTime; uniform float uPx; uniform vec3 uCam; uniform float uAlpha;
        varying float vA;
        void main(){
          float W = ${MW.toFixed(1)}; float H = ${MH.toFixed(1)};
          vec3 p = position;
          p.x += sin(uTime * 0.2 + aSeed * 40.0) * 3.0; p.y += uTime * (0.4 + aSeed * 0.8); p.z += cos(uTime * 0.17 + aSeed * 31.0) * 3.0;
          vec3 w;
          w.x = uCam.x + mod(p.x - uCam.x + W * 0.5, W) - W * 0.5;
          w.z = uCam.z + mod(p.z - uCam.z + W * 0.5, W) - W * 0.5;
          w.y = uCam.y + mod(p.y - uCam.y + H * 0.5, H) - H * 0.5;
          vec4 mv = viewMatrix * vec4(w, 1.0);
          float d = max(-mv.z, 1.0);
          vA = uAlpha * smoothstep(W * 0.5, W * 0.2, length(w - uCam)) * (0.45 + 0.55 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 90.0));
          gl_PointSize = clamp((0.09 + aSeed * 0.12) * uPx / d, 1.0, 9.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying float vA;
        void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = pow(clamp(1.0 - r, 0.0, 1.0), 2.0);
          gl_FragColor = vec4(uColor * 2.2, a * vA); }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    return { geo: g, mat: m };
  }, [n]);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  const cam = useThree((s) => s.camera);
  const tmp = useMemo(() => new Color(), []);
  const c2 = useMemo(() => new Color(), []);
  useFrame(() => {
    mat.uniforms.uCam.value = [cam.position.x, cam.position.y, cam.position.z];
    tmp.set("#c9d6e6");
    let tot = 0;
    for (const k in MOTE_COLORS) {
      const w = live.zone[k] ?? 0;
      tot += w;
      c2.set(MOTE_COLORS[k]);
      tmp.lerp(c2, Math.min(1, w));
    }
    mat.uniforms.uColor.value.copy(tmp);
    const base = 0.12 + 0.55 * env.night + 0.25 * env.gray;
    mat.uniforms.uAlpha.value = base * (1 + live.ug * 0.8) * (1 - env.rain * 0.4);
    void tot;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={7} />;
}
