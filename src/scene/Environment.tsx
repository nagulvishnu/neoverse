import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BackSide,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Mesh,
  PCFSoftShadowMap,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Material,
  type WebGLRenderTarget,
} from "three";
import { env, live, stepEnv, snapEnv } from "../core/environment";
import { useStore } from "../core/store";
import { QUALITY } from "../core/quality";
import { LAYOUT } from "../core/layout";
import { camState } from "../core/camera";
import { damp, smoothstep } from "../core/rng";
import { GLSL_NOISE, U } from "./materials";

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const skyFragment = /* glsl */ `
uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunCol;
uniform float uNight; uniform float uStars; uniform float uCloud; uniform float uGray; uniform float uTime;
varying vec3 vDir;
${GLSL_NOISE}
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.3, 1.0);
  vec3 col = mix(uHorizon, uTop, pow(max(h, 0.0), 0.5));
  col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.25, d.y));
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  float horizonGlow = pow(1.0 - abs(d.y), 6.0);
  col += uSunCol * (pow(sd, 900.0) * 10.0 + pow(sd, 48.0) * 0.45 + pow(sd, 5.0) * 0.18 * (1.0 - uNight * 0.7)) * (1.0 - uGray * 0.75);
  col += uSunCol * pow(sd, 3.0) * horizonGlow * 0.35;
  // stars
  vec3 sp = d * 220.0; vec3 id = floor(sp);
  float sr = hash12(id.xy + id.z * 17.0);
  float star = step(0.9965, sr) * smoothstep(0.02, 0.35, d.y) * uStars;
  col += vec3(0.8, 0.9, 1.0) * star * (0.6 + 0.4 * sin(uTime * 2.0 + sr * 99.0)) * 1.5;
  // clouds
  vec2 cp = d.xz / (d.y + 0.18) * 0.9 + vec2(uTime * 0.004, uTime * 0.002);
  float c = fbm(cp * 1.6);
  float cov = smoothstep(0.62 - 0.38 * uCloud, 0.95, c);
  vec3 cloudCol = (uHorizon * 0.85 + uSunCol * 0.22 * (1.0 - uNight * 0.6) + 0.04) * mix(1.0, 0.5, uGray);
  cloudCol = mix(cloudCol, cloudCol * 0.5, smoothstep(0.7, 1.0, c));
  col = mix(col, cloudCol, cov * smoothstep(0.0, 0.3, d.y) * (0.35 + 0.65 * uCloud));
  gl_FragColor = vec4(col, 1.0);
}`;

const UG_FOG = new Color("#04141a");
const UG_HEMI_SKY = new Color("#1d5a66");
const UG_HEMI_GROUND = new Color("#050b0e");
const TINTS: Record<string, { c: Color; x: number; z: number; r: number }> = {
  downtown: { c: new Color("#355f9c"), x: 0, z: 0, r: 280 },
  neon: { c: new Color("#6a1f9a"), x: LAYOUT.neon.x, z: LAYOUT.neon.z, r: 200 },
  green: { c: new Color("#2f8a62"), x: LAYOUT.green.x, z: LAYOUT.green.z, r: 240 },
  sky: { c: new Color("#8db4ff"), x: LAYOUT.sky.x, z: LAYOUT.sky.z, r: 200 },
};
const lum = (c: Color) => c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
const tmp = new Color();
const tmpV = new Vector3();

/** Sky dome, fog, sun/hemisphere lights, reflection environment and shared shader uniforms. */
export function EnvironmentController() {
  const { scene, gl, camera } = useThree();
  const quality = useStore((s) => s.quality);
  const sunRef = useRef<DirectionalLight>(null);
  const hemiRef = useRef<HemisphereLight>(null);
  const skyRef = useRef<Mesh>(null);

  const sky = useMemo(() => {
    const uniforms = {
      uTop: { value: env.skyTop },
      uHorizon: { value: env.skyHorizon },
      uSunDir: { value: env.sunDir },
      uSunCol: { value: env.sunColor },
      uNight: { value: 0 },
      uStars: { value: 0 },
      uCloud: { value: 0 },
      uGray: { value: 0 },
      uTime: U.uTime,
    };
    const mk = () =>
      new ShaderMaterial({ uniforms, vertexShader: skyVertex, fragmentShader: skyFragment, side: BackSide, depthWrite: false, fog: false, toneMapped: false });
    const geo = new SphereGeometry(1, 48, 24);
    const envScene = new Scene();
    const envMesh = new Mesh(geo, mk());
    envMesh.scale.setScalar(500);
    envScene.add(envMesh);
    return { uniforms, material: mk(), geo, envScene, envMesh };
  }, []);

  const state = useRef({ pmrem: null as PMREMGenerator | null, rt: null as WebGLRenderTarget | null, accum: 1, lastGen: -10 });

  // initial fog + env snapshot
  useEffect(() => {
    const st = useStore.getState();
    snapEnv(st.timeOfDay, st.weather);
    scene.fog = new FogExp2(env.fogColor.getHex(), env.fogDensity);
    const s = state.current;
    s.pmrem = new PMREMGenerator(gl);
    const sun = sunRef.current;
    if (sun) scene.add(sun.target);
    return () => {
      if (sun) scene.remove(sun.target);
      s.rt?.dispose();
      s.pmrem?.dispose();
      sky.material.dispose();
      (sky.envMesh.material as Material).dispose();
      sky.geo.dispose();
      scene.environment = null;
      scene.fog = null;
    };
  }, [scene, gl, sky]);

  // quality-dependent shadow setup
  useEffect(() => {
    const cfg = QUALITY[quality];
    const light = sunRef.current;
    gl.shadowMap.enabled = cfg.shadows;
    gl.shadowMap.type = PCFSoftShadowMap;
    if (light) {
      light.castShadow = cfg.shadows;
      if (cfg.shadows) {
        light.shadow.mapSize.set(cfg.shadowSize, cfg.shadowSize);
        light.shadow.map?.dispose();
        light.shadow.map = null;
        const c = light.shadow.camera;
        const r = cfg.shadowRange;
        c.left = -r;
        c.right = r;
        c.top = r;
        c.bottom = -r;
        c.near = 10;
        c.far = 1400;
        c.updateProjectionMatrix();
      }
    }
    scene.traverse((o) => {
      const m = (o as Mesh).material as Material | Material[] | undefined;
      if (Array.isArray(m)) m.forEach((x) => (x.needsUpdate = true));
      else if (m) m.needsUpdate = true;
    });
  }, [quality, gl, scene]);

  useFrame((frame, delta) => {
    const dt = Math.min(delta, 0.1);
    const st = useStore.getState();
    const t = frame.clock.elapsedTime;
    U.uTime.value = t;
    const change = stepEnv(dt, st.timeOfDay, st.weather);
    const cam = camera.position;
    const { ug, downtown } = LAYOUT;
    void downtown;

    // underground factor
    const inCav = Math.hypot(cam.x - ug.x, cam.z - ug.z) < ug.cavR;
    live.ug = damp(live.ug, inCav ? smoothstep(3, -10, cam.y) : 0, 6, dt);
    live.camY = cam.y;
    const u = live.ug;

    // zone weights → fog tint
    fogTint: {
      let wsum = 0;
      tmp.copy(env.fogColor);
      const fl = lum(env.fogColor);
      for (const k in TINTS) {
        const z = TINTS[k];
        let w = smoothstep(z.r * 1.25, z.r * 0.4, Math.hypot(cam.x - z.x, cam.z - z.z));
        if (k === "sky") w *= smoothstep(120, 200, cam.y);
        live.zone[k] = w;
        wsum += w;
        const tint = z.c.clone().multiplyScalar(fl / Math.max(lum(z.c), 0.001));
        tmp.lerp(tint, w * (0.08 + 0.32 * env.night) * (k === "downtown" ? 0.6 : 1));
      }
      live.zone.underground = u;
      void wsum;
      break fogTint;
    }
    const fog = frame.scene.fog as FogExp2 | null;
    if (fog) {
      fog.color.copy(tmp).lerp(UG_FOG, u);
      fog.density = env.fogDensity * (1 - u) + 0.0042 * u;
    }
    const hemi = hemiRef.current;
    if (hemi) {
      hemi.color.copy(env.hemiSky).lerp(UG_HEMI_SKY, u);
      hemi.groundColor.copy(env.hemiGround).lerp(UG_HEMI_GROUND, u);
      hemi.intensity = env.hemiIntensity * (1 - u) + 0.7 * u;
    }
    const sun = sunRef.current;
    if (sun) {
      sun.color.copy(env.sunColor);
      sun.intensity = env.sunIntensity * (1 - u);
      // shadow frustum follows the point the camera is looking at (snapped to avoid shimmer)
      tmpV.copy(camState.target).sub(cam);
      const len = Math.min(tmpV.length(), 90);
      tmpV.normalize().multiplyScalar(len * 0.7).add(cam);
      const snap = 12;
      tmpV.set(Math.round(tmpV.x / snap) * snap, Math.round(tmpV.y / snap) * snap, Math.round(tmpV.z / snap) * snap);
      sun.target.position.copy(tmpV);
      sun.position.copy(tmpV).addScaledVector(env.sunDir, 600);
      sun.target.updateMatrixWorld();
    }
    frame.scene.environmentIntensity = env.envIntensity * (1 - 0.8 * u) + 0.18 * u;

    // shared uniforms
    U.uNight.value = env.night;
    U.uWet.value = env.wet;
    U.uRain.value = env.rain;
    U.uUg.value = u;
    U.uPx.value = gl.domElement.height * 0.866;
    U.uSkyH.value.copy(env.skyHorizon);
    U.uSkyT.value.copy(env.skyTop);
    U.uSunDir.value.copy(env.sunDir);
    U.uSunCol.value.copy(env.sunColor);
    sky.uniforms.uNight.value = env.night;
    sky.uniforms.uStars.value = env.stars;
    sky.uniforms.uCloud.value = env.cloud;
    sky.uniforms.uGray.value = env.gray;
    if (skyRef.current) skyRef.current.position.copy(cam);

    // refresh reflection environment (throttled) while lighting changes
    const s = state.current;
    s.accum += change;
    if (s.pmrem && s.accum > 0.03 && t - s.lastGen > 0.45) {
      s.accum = 0;
      s.lastGen = t;
      const prev = s.rt;
      s.rt = s.pmrem.fromScene(sky.envScene, 0, 1, 1000);
      frame.scene.environment = s.rt.texture;
      prev?.dispose();
    }
  }, -30);

  return (
    <>
      <mesh ref={skyRef} geometry={sky.geo} material={sky.material} scale={3200} renderOrder={-1000} frustumCulled={false} />
      <hemisphereLight ref={hemiRef} args={["#ffffff", "#444444", 1]} />
      <directionalLight ref={sunRef} args={["#ffffff", 2]} shadow-bias={-0.0004} shadow-normalBias={0.9} />
    </>
  );
}
