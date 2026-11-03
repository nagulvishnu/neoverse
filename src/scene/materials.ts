import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  SRGBColorSpace,
  UniformsLib,
  UniformsUtils,
  Vector3,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { LAYOUT } from "../core/layout";

/** Uniforms shared by every custom material; updated once per frame by the environment controller. */
export const U = {
  uTime: { value: 0 },
  uNight: { value: 0 },
  uWet: { value: 0 },
  uRain: { value: 0 },
  uPx: { value: 800 },
  uSkyH: { value: new Color("#aaccee") },
  uSkyT: { value: new Color("#3f8fe8") },
  uSunDir: { value: new Vector3(0.3, 0.8, 0.3) },
  uSunCol: { value: new Color("#ffffff") },
  uUg: { value: 0 },
};

export const GLSL_NOISE = /* glsl */ `
float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash12(i),hash12(i+vec2(1.0,0.0)),f.x), mix(hash12(i+vec2(0.0,1.0)),hash12(i+vec2(1.0,1.0)),f.x), f.y); }
float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5; } return s; }
`;

type PatchShader = WebGLProgramParametersWithUniforms;

// ---------------------------------------------------------------------------------------------
// Buildings: PBR material patched with a procedural window / facade shader (world-scale cells,
// per-window lit state & slow flicker, accent light bands, fake height-based ambient occlusion).
// ---------------------------------------------------------------------------------------------
export interface BuildingStyle {
  winA: string;
  winB: string;
  winC: string;
  accent: string;
  lit: number; // fraction of windows lit at night
  accentAmt: number; // 0..1 accent band strength
  colW?: number;
  floorH?: number;
  glass?: string;
  metal?: number;
  rough?: number;
}

export function makeBuildingMaterial(style: BuildingStyle, round: boolean) {
  const mat = new MeshStandardMaterial({ color: 0xffffff, metalness: style.metal ?? 0.65, roughness: style.rough ?? 0.38 });
  if (round) mat.defines = { ROUND: "" };
  const own = {
    uWinA: { value: new Color(style.winA) },
    uWinB: { value: new Color(style.winB) },
    uWinC: { value: new Color(style.winC) },
    uAccent: { value: new Color(style.accent) },
    uGlass: { value: new Color(style.glass ?? "#0a1522") },
    uLit: { value: style.lit },
    uAccentAmt: { value: style.accentAmt },
    uColW: { value: style.colW ?? 2.6 },
    uFloorH: { value: style.floorH ?? 3.4 },
  };
  mat.onBeforeCompile = (sh: PatchShader) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uNight: U.uNight, uWet: U.uWet }, own);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLocal; varying vec3 vLNormal; varying float vSeed;")
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `#include <begin_vertex>
        vec3 sc = vec3(1.0); float seed = 0.0;
        #ifdef USE_INSTANCING
          sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          seed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898,78.233)))*43758.5453);
        #endif
        vLocal = position * sc; vLNormal = normal; vSeed = seed;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        varying vec3 vLocal; varying vec3 vLNormal; varying float vSeed;
        uniform float uTime, uNight, uWet, uLit, uAccentAmt, uColW, uFloorH;
        uniform vec3 uWinA, uWinB, uWinC, uAccent, uGlass;
        ${GLSL_NOISE}`,
      )
      .replace(
        "#include <map_fragment>",
        /* glsl */ `#include <map_fragment>
        vec3 nL = normalize(vLNormal);
        float vertical = 1.0 - smoothstep(0.35, 0.7, abs(nL.y));
        float wu; float face;
        #ifdef ROUND
          wu = atan(vLocal.z, vLocal.x) * max(length(vLocal.xz), 1.0); face = 0.0;
        #else
          bool alongX = abs(nL.x) > abs(nL.z);
          wu = alongX ? vLocal.z : vLocal.x;
          face = (alongX ? 1.0 : 3.0) + (alongX ? step(0.0, nL.x) : step(0.0, nL.z));
        #endif
        vec2 wuv = vec2(wu, vLocal.y) / vec2(uColW, uFloorH);
        vec2 cell = floor(wuv); vec2 fr = fract(wuv);
        float aa = fwidth(wuv.x) + fwidth(wuv.y);
        float fade = smoothstep(0.45, 1.2, aa);
        float wx = smoothstep(0.08, 0.15, fr.x) * smoothstep(0.92, 0.85, fr.x);
        float wy = smoothstep(0.14, 0.22, fr.y) * smoothstep(0.86, 0.78, fr.y);
        float win = mix(wx * wy, 0.55, fade) * vertical;
        float rnd = hash12(cell + vSeed * 91.7 + face * 7.3);
        float rnd2 = hash12(cell.yx * 1.7 + vSeed * 13.1 + face);
        float ph = floor(uTime * 0.08 + rnd * 40.0);
        float flick = hash12(cell + ph + vSeed);
        float lit = step(1.0 - uLit, rnd);
        lit = mix(lit, step(0.5, flick), step(0.965, rnd2));
        lit = mix(lit, uLit, fade);
        float bandRow = fract(vLocal.y / (uFloorH * 9.0) + vSeed);
        float band = (1.0 - smoothstep(0.0, 0.02, bandRow)) * vertical * uAccentAmt;
        float ao = mix(0.5, 1.0, smoothstep(0.0, 35.0, vLocal.y));
        diffuseColor.rgb *= ao * mix(0.65, 1.0, vertical);
        diffuseColor.rgb = mix(diffuseColor.rgb, uGlass, win * 0.82);`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.06, win);
        roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.45, uWet * vertical);`,
      )
      .replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>\n metalnessFactor = mix(metalnessFactor, 0.95, win);`)
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        vec3 wcol = rnd < 0.6 ? uWinA : (rnd2 < 0.55 ? uWinB : uWinC);
        float inten = mix(0.5 + 1.2 * hash12(cell * 3.1 + vSeed), 1.0, fade);
        vec3 winE = wcol * lit * win * inten * (uNight * 1.25 + 0.035);
        vec3 bandE = uAccent * band * (uNight * 2.4 + 0.15);
        totalEmissiveRadiance += (winE + bandE) * mix(0.35, 1.0, ao);`,
      );
  };
  mat.customProgramCacheKey = () => "bld" + (round ? "R" : "B");
  return mat;
}

// ---------------------------------------------------------------------------------------------
// Ground: roads / sidewalks / plazas / grass drawn procedurally in world space, with wetness,
// puddles, ripples, faux neon reflections and a dark ceiling for the underground cavern.
// ---------------------------------------------------------------------------------------------
/** Format a number as a GLSL float literal (never an int literal). */
const F = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

export function makeGroundMaterial() {
  const mat = new MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.9, side: DoubleSide });
  const { downtown: D, neon: N, green: G, ug, arena, boulevard: B, lake } = LAYOUT;
  mat.onBeforeCompile = (sh: PatchShader) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uNight: U.uNight, uWet: U.uWet, uRain: U.uRain });
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWPos;
        uniform float uTime, uNight, uWet, uRain;
        ${GLSL_NOISE}
        float streetDist(float c, float period, float off){ return abs(mod(c - off + period*0.5, period) - period*0.5); }`,
      )
      .replace(
        "#include <map_fragment>",
        /* glsl */ `#include <map_fragment>
        vec2 p = vWPos.xz;
        float gRough = 0.88; float gWetF = 0.0; vec3 gEmit = vec3(0.0);
        float gNoise = fbm(p * 0.05);
        // base concrete
        vec3 col = vec3(0.075, 0.08, 0.09) * (0.8 + 0.4 * gNoise);
        float roadM = 0.0;
        float lane = 0.0;
        // ---- downtown grid
        float zD = 1.0 - smoothstep(${D.half - 4}.0, ${D.half + 6}.0, max(abs(p.x - ${D.x}.0), abs(p.y - ${D.z}.0)));
        float dxD = streetDist(p.x, ${D.grid}.0, ${D.offset}.0); float dzD = streetDist(p.y, ${D.grid}.0, ${D.offset}.0);
        float dD = min(dxD, dzD);
        float roadD = 1.0 - smoothstep(${D.streetHalf - 0.3}, ${D.streetHalf}.0, dD);
        float walkD = 1.0 - smoothstep(${F(D.streetHalf + 2.6)}, ${F(D.streetHalf + 3)}, dD);
        vec3 cD = mix(vec3(0.11, 0.115, 0.125), vec3(0.2, 0.21, 0.22), walkD); // lot / sidewalk
        cD = mix(cD, vec3(0.03, 0.032, 0.036), roadD);
        float dashD = step(0.5, fract((dxD < dzD ? p.y : p.x) / 6.0)) * (1.0 - smoothstep(0.12, 0.25, dD)) * roadD;
        // zebra crossings next to intersections
        float alongX = dxD < dzD ? 1.0 : 0.0; // street runs along z when dxD small
        float sAxis = (dxD < dzD ? p.y : p.x);
        float isc = streetDist(sAxis, ${D.grid}.0, ${D.offset}.0);
        float zebra = step(${D.streetHalf + 0.8}, isc) * step(isc, ${D.streetHalf + 3.6}) * roadD * step(0.5, fract((dxD < dzD ? p.x : p.y) * 0.7)) * 0.0;
        zebra = step(${F(D.streetHalf + 1)}, isc) * step(isc, ${F(D.streetHalf + 3.4)}) * roadD * step(0.5, fract((dxD < dzD ? p.x : p.y) * 0.6));
        cD = mix(cD, vec3(0.5), zebra * 0.55 * (1.0 - step(dD, 0.0)));
        cD = mix(cD, vec3(0.8, 0.75, 0.5), dashD * 0.7);
        // ---- neon streets
        float zN = 1.0 - smoothstep(${N.half - 4}.0, ${N.half + 6}.0, max(abs(p.x - ${N.x}.0), abs(p.y - ${N.z}.0)));
        float dxN = streetDist(p.x, ${N.grid}.0, ${N.x}.0); float dzN = streetDist(p.y, ${N.grid}.0, ${N.z}.0);
        float dN = min(dxN, dzN);
        float roadN = 1.0 - smoothstep(${N.streetHalf - 0.3}, ${N.streetHalf}.0, dN);
        float avenue = (1.0 - smoothstep(4.7, 5.0, abs(p.y - ${N.z}.0))) * step(${N.x + N.half}.0, p.x) * (1.0 - smoothstep(${arena.x - 40}.0, ${arena.x - 30}.0, p.x));
        roadN = max(roadN, avenue);
        vec3 cN = mix(vec3(0.07, 0.065, 0.085), vec3(0.17, 0.15, 0.2), 1.0 - smoothstep(${N.streetHalf + 1.4}, ${N.streetHalf + 1.8}, dN));
        cN = mix(cN, vec3(0.022, 0.02, 0.03), roadN);
        // ---- arena plaza
        float dA = length(p - vec2(${arena.x}.0, ${arena.z}.0));
        float plazaA = 1.0 - smoothstep(66.0, 70.0, dA);
        vec3 cA = vec3(0.1, 0.09, 0.12) + vec3(0.1) * step(0.5, fract(dA / 6.0)) * 0.3;
        // ---- boulevard
        float bx = abs(p.x - (${B.x}.0));
        float bzone = step(${B.zStart - 8}.0, p.y) * (1.0 - smoothstep(${B.half - 14}.0, ${B.half - 10}.0, bx)) ;
        float roadB = (1.0 - smoothstep(13.5, 14.0, bx)) * step(${B.zStart - 8}.0, p.y);
        vec3 cB = mix(vec3(0.16, 0.17, 0.18), vec3(0.03, 0.032, 0.036), roadB);
        float dashB = step(0.5, fract(p.y / 8.0)) * (1.0 - smoothstep(0.15, 0.3, abs(bx - 0.0))) * roadB;
        float edgeB = (1.0 - smoothstep(0.1, 0.25, abs(bx - 12.5))) * roadB;
        cB = mix(cB, vec3(0.85, 0.8, 0.6), max(dashB, edgeB * 0.0) * 0.6);
        cB = mix(cB, vec3(0.5, 0.8, 0.9), edgeB * 0.5);
        // ---- green district
        float dG = length(p - vec2(${G.x}.0, ${G.z}.0));
        float zG = 1.0 - smoothstep(${G.r - 12}.0, ${G.r + 6}.0, dG);
        vec3 grass = mix(vec3(0.04, 0.16, 0.05), vec3(0.09, 0.26, 0.08), fbm(p * 0.09));
        grass = mix(grass, vec3(0.13, 0.22, 0.06), fbm(p * 0.4 + 7.0) * 0.5);
        float pathG = (1.0 - smoothstep(1.6, 2.4, abs(p.y - (${G.z}.0 + 70.0 * sin(p.x * 0.018 + 1.0)) )));
        pathG = max(pathG, 1.0 - smoothstep(1.6, 2.4, abs(p.x - (${G.x}.0 - 20.0 + 55.0 * sin(p.y * 0.02)))));
        grass = mix(grass, vec3(0.28, 0.27, 0.24), pathG * zG);
        float lakeD = length(p - vec2(${lake.x}.0, ${lake.z}.0));
        grass = mix(grass, vec3(0.02, 0.05, 0.05), 1.0 - smoothstep(${lake.r - 3}.0, ${lake.r + 5}.0, lakeD));
        float museumD = length(p - vec2(${LAYOUT.museum.x}.0, ${LAYOUT.museum.z}.0));
        grass = mix(grass, vec3(0.18, 0.2, 0.2), 1.0 - smoothstep(44.0, 47.0, museumD));
        // ---- underground access plaza
        float dU = length(p - vec2(${ug.x}.0, ${ug.z}.0));
        float plazaU = (1.0 - smoothstep(${ug.shaftR + 38}.0, ${ug.shaftR + 42}.0, dU)) * step(${ug.shaftR - 1}.0, dU);
        vec3 cU = vec3(0.06, 0.07, 0.075) + vec3(0.05) * step(0.5, fract(dU / 5.0));
        float ringU = (1.0 - smoothstep(0.0, 0.5, abs(dU - ${ug.shaftR + 12}.0))) + (1.0 - smoothstep(0.0, 0.5, abs(dU - ${ug.shaftR + 30}.0)));
        // ---- compose
        col = mix(col, cD, zD);
        col = mix(col, cN, zN);
        col = mix(col, cB, bzone);
        col = mix(col, cA, plazaA);
        col = mix(col, grass, zG);
        col = mix(col, cU, plazaU);
        roadM = max(max(roadD * zD, roadN * zN), max(roadB * bzone, plazaA * 0.5));
        float walkM = max(walkD * zD, zN * 0.5);
        float puddle = smoothstep(0.52, 0.68, fbm(p * 0.08 + 3.0));
        gWetF = uWet * clamp(roadM * (0.65 + 0.35 * puddle) + (1.0 - roadM) * (0.25 * puddle + 0.12) * (1.0 - zG * 0.6), 0.0, 1.0);
        col *= mix(1.0, 0.55, gWetF);
        diffuseColor.rgb = col;
        gRough = mix(0.9, 0.55, roadM);
        // faux neon / city-light reflections on wet asphalt
        float streak = max(fbm(vec2(p.x * 0.55, p.y * 0.035)), fbm(vec2(p.x * 0.035, p.y * 0.55)));
        vec3 pal = 0.55 + 0.45 * cos(6.2831 * (hash12(floor(p / 11.0)) + vec3(0.0, 0.33, 0.67)));
        float refl = pow(streak, 3.2) * gWetF * uNight;
        gEmit += pal * refl * 3.2 * roadN * zN;
        gEmit += vec3(0.25, 0.5, 0.95) * pow(streak, 3.6) * gWetF * uNight * 1.1 * roadD * zD;
        gEmit += vec3(1.0, 0.85, 0.6) * pow(streak, 3.6) * gWetF * uNight * 0.9 * roadB;
        // lane markings glow faintly at night; plaza rings pulse
        gEmit += vec3(0.9, 0.8, 0.5) * dashD * zD * (0.15 + uNight * 0.15);
        gEmit += vec3(0.1, 1.0, 0.7) * ringU * plazaU * (0.6 + 0.4 * sin(uTime * 2.0 - dU * 0.2)) * 2.0;
        gEmit += vec3(1.0, 0.2, 0.8) * (1.0 - smoothstep(0.0, 0.6, abs(dA - 62.0))) * plazaA * (0.5 + 0.5 * sin(uTime * 3.0 - dA * 0.3)) * 2.0 * (0.4 + uNight);
        // rain ripples
        vec2 rc = floor(p * 0.55); vec2 rf = fract(p * 0.55) - 0.5;
        float rt = fract(uTime * 0.7 + hash12(rc));
        float ring = smoothstep(0.05, 0.0, abs(length(rf) - rt * 0.5)) * (1.0 - rt);
        gEmit += vec3(0.55, 0.7, 1.0) * ring * uRain * 0.22 * (0.4 + roadM);
        // underside of the ground is the cavern ceiling
        if (!gl_FrontFacing) {
          diffuseColor.rgb = vec3(0.035, 0.045, 0.05);
          float gl1 = step(0.965, fract(p.x / 24.0)) + step(0.965, fract(p.y / 24.0));
          gEmit = vec3(0.1, 0.85, 0.7) * gl1 * 0.5;
          gRough = 0.7;
        }`,
      )
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n roughnessFactor = mix(gRough, 0.04, gWetF);`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n totalEmissiveRadiance += gEmit;`);
  };
  mat.customProgramCacheKey = () => "ground";
  return mat;
}

// ---------------------------------------------------------------------------------------------
// Emissive "glow" basic material (neon tubes, lamps, vehicle lights). HDR colours -> bloom.
// ---------------------------------------------------------------------------------------------
export function makeGlowMaterial(base = 0.35, vertexColors = false, alwaysOn = false) {
  const m = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false, vertexColors, side: DoubleSide });
  m.onBeforeCompile = (sh: PatchShader) => {
    sh.uniforms.uNight = U.uNight;
    sh.uniforms.uGlowBase = { value: alwaysOn ? 1 : base };
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uNight; uniform float uGlowBase;")
      .replace("#include <color_fragment>", "#include <color_fragment>\n diffuseColor.rgb *= uGlowBase + (1.0 - uGlowBase) * uNight;");
  };
  m.customProgramCacheKey = () => "glow" + (alwaysOn ? "A" : "N");
  return m;
}

// ---------------------------------------------------------------------------------------------
// Helper for custom fogged shaders
// ---------------------------------------------------------------------------------------------
function fogged(opts: {
  vertex: string;
  fragment: string;
  uniforms: Record<string, { value: unknown }>;
  transparent?: boolean;
  additive?: boolean;
  side?: typeof DoubleSide;
  defines?: Record<string, string>;
}) {
  const m = new ShaderMaterial({
    // NB: spread (not UniformsUtils.merge) so shared uniform objects like U.uTime stay linked
    uniforms: { ...UniformsUtils.clone(UniformsLib.fog), ...(opts.uniforms as Record<string, { value: never }>) },
    vertexShader: opts.vertex,
    fragmentShader: opts.fragment,
    transparent: opts.transparent ?? false,
    depthWrite: !(opts.transparent || opts.additive),
    side: opts.side ?? DoubleSide,
    fog: true,
    toneMapped: false,
  });
  if (opts.additive) m.blending = AdditiveBlending;
  if (opts.defines) m.defines = opts.defines;
  return m;
}

const FOG_DIM = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float ff = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  #else
    float ff = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  gl_FragColor.rgb *= (1.0 - ff);
  gl_FragColor.a *= (1.0 - ff * 0.5);
#endif
`;

// ---------------------------------------------------------------------------------------------
// Sign atlas (neon signs, billboards, holograms) drawn to a canvas -> texture.
// ---------------------------------------------------------------------------------------------
const SIGN_TEXT: [string, string][] = [
  ["NEOVERSE", "#5ef2ff"], ["NEON ARCADE", "#ff4fd8"], ["RAMEN-X", "#ffb347"], ["CYBER BAR", "#b06bff"],
  ["SYNTHWAVE", "#ff4f9a"], ["QUANTUM ENERGY", "#37ffb5"], ["SKY LINES", "#7ab8ff"], ["HOLO CLUB", "#e07bff"],
  ["NEXUS HUB", "#5ef2ff"], ["FLY NEOCAR", "#ffe14f"], ["DREAMLAB", "#ff8ad8"], ["OPEN 24/7", "#7dff9a"],
  ["NOODLE 9", "#ff7a47"], ["DATA DINER", "#4fd8ff"], ["ARENA LIVE", "#ff3d6e"], ["MEGA MALL", "#ffd37a"],
  ["GENE SPA", "#7dffd6"], ["BIO GREEN", "#7dff9a"], ["AURORA TEA", "#ffb0e0"], ["CYBER CAFE", "#4fffe0"],
  ["PLASMA", "#ff5ad0"], ["ORBIT AIR", "#6ab0ff"], ["VR PLAY", "#c07bff"], ["HYPER BAR", "#ff9a3d"],
  ["NIGHT MARKET", "#ffcf5f"], ["TURBO TAXI", "#fff04f"], ["NEURAL LINK", "#6dffea"], ["SAKE-3", "#ff6a8a"],
  ["MAGLEV", "#5ef2ff"], ["CITY OF TOMORROW", "#ff4fd8"], ["WELCOME HOME", "#ffd37a"], ["NEO NEWS", "#5ef2ff"],
];

export function makeSignAtlas(): CanvasTexture {
  const cw = 512;
  const ch = 128;
  const canvas = document.createElement("canvas");
  canvas.width = cw * 4;
  canvas.height = ch * 8;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, canvas.width, canvas.height);
  SIGN_TEXT.forEach(([txt, color], i) => {
    const x = (i % 4) * cw;
    const y = Math.floor(i / 4) * ch;
    const grad = g.createLinearGradient(x, y, x + cw, y + ch);
    grad.addColorStop(0, "#07070f");
    grad.addColorStop(1, "#150a20");
    g.fillStyle = grad;
    g.fillRect(x, y, cw, ch);
    // frame
    g.strokeStyle = color;
    g.lineWidth = 5;
    g.shadowColor = color;
    g.shadowBlur = 14;
    g.strokeRect(x + 8, y + 8, cw - 16, ch - 16);
    // text
    let size = 64;
    g.font = `800 ${size}px Orbitron, "Segoe UI", sans-serif`;
    while (g.measureText(txt).width > cw - 56 && size > 20) {
      size -= 4;
      g.font = `800 ${size}px Orbitron, "Segoe UI", sans-serif`;
    }
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.shadowBlur = 20;
    g.fillStyle = "#ffffff";
    g.fillText(txt, x + cw / 2, y + ch / 2 + 3);
    g.shadowBlur = 0;
    g.fillStyle = color;
    g.globalCompositeOperation = "source-atop";
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 0.55;
    g.fillText(txt, x + cw / 2, y + ch / 2 + 3);
    g.globalAlpha = 1;
  });
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function makeSignMaterial(atlas: Texture, mode: "sign" | "billboard" | "holo") {
  const vertex = /* glsl */ `
    attribute float aSign; attribute float aPhase;
    varying vec2 vUv; varying float vSign; varying float vPhase; varying vec3 vTint;
    #include <fog_pars_vertex>
    void main(){
      vUv = uv; vSign = aSign; vPhase = aPhase;
      #ifdef USE_INSTANCING_COLOR
        vTint = instanceColor;
      #else
        vTint = vec3(1.0);
      #endif
      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`;
  const fragment = /* glsl */ `
    uniform sampler2D uAtlas; uniform float uTime; uniform float uNight;
    varying vec2 vUv; varying float vSign; varying float vPhase; varying vec3 vTint;
    ${GLSL_NOISE}
    #include <fog_pars_fragment>
    vec3 atlasAt(float idx, vec2 uv){
      idx = mod(idx, 32.0); float c = mod(idx, 4.0); float r = floor(idx / 4.0);
      vec2 fu = fract(uv * 0.99999);
      return texture2D(uAtlas, vec2((c + fu.x) / 4.0, (7.0 - r + fu.y) / 8.0)).rgb;
    }
    void main(){
      vec2 uv = vUv;
      #ifdef HOLO
        float g = step(0.965, hash11(floor(uTime * 3.0 + vPhase * 40.0)));
        uv.x += g * 0.04 * sin(uv.y * 40.0);
      #endif
      vec3 col;
      #ifdef BILLBOARD
        float t = uTime * 0.16 + vPhase * 7.0;
        float n = floor(t); float k = fract(t);
        float wipe = smoothstep(0.82, 1.0, k) * 1.08;
        vec3 a = atlasAt(vSign + n, uv); vec3 b = atlasAt(vSign + n + 1.0, uv);
        col = mix(a, b, step(uv.x, wipe));
        col += vec3(0.06, 0.1, 0.16) * (0.5 + 0.5 * sin(uv.x * 8.0 - uTime * 2.0 + uv.y * 4.0));
      #else
        col = atlasAt(vSign, uv);
      #endif
      float flick = 1.0 - 0.45 * step(0.985, hash11(floor(uTime * 9.0 + vPhase * 77.0)));
      #ifdef HOLO
        float m = max(col.r, max(col.g, col.b));
        float scan = 0.65 + 0.35 * sin(uv.y * 140.0 - uTime * 7.0);
        vec2 eu = fract(uv * 0.99999);
        float edge = smoothstep(0.0, 0.08, eu.x) * smoothstep(1.0, 0.92, eu.x) * smoothstep(0.0, 0.12, eu.y) * smoothstep(1.0, 0.88, eu.y);
        vec3 c = (col * 0.9 + vec3(0.04, 0.12, 0.2)) * vTint * 2.6 * scan * flick;
        gl_FragColor = vec4(c, clamp(m * 1.4 + 0.12, 0.0, 1.0) * edge * 0.9);
        ${FOG_DIM}
      #else
        float lvl = 0.35 + 0.65 * uNight;
        gl_FragColor = vec4(col * vTint * 2.4 * lvl * flick, 1.0);
        #include <fog_fragment>
      #endif
    }`;
  const defines: Record<string, string> = {};
  if (mode === "holo") defines.HOLO = "";
  if (mode === "billboard") defines.BILLBOARD = "";
  const m = fogged({
    vertex,
    fragment,
    uniforms: { uAtlas: { value: atlas }, uTime: U.uTime, uNight: U.uNight },
    transparent: mode === "holo",
    additive: mode === "holo",
    defines,
  });
  return m;
}

// ---------------------------------------------------------------------------------------------
// Thruster flames (instanced cones)
// ---------------------------------------------------------------------------------------------
export function makeFlameMaterial(color = "#6ac8ff") {
  const m = fogged({
    vertex: /* glsl */ `
      attribute float aK; attribute float aBaseZ;
      varying float vK; varying float vPh;
      uniform float uTime; uniform float uThrust;
      #include <fog_pars_vertex>
      void main(){
        float ph = 0.0;
        mat4 im = mat4(1.0);
        #ifdef USE_INSTANCING
          im = instanceMatrix;
          ph = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898,78.233))) * 43758.5453);
        #endif
        vPh = ph; vK = aK;
        vec3 pos = position;
        float fl = 0.82 + 0.25 * sin(uTime * 38.0 + ph * 50.0) + 0.1 * sin(uTime * 71.0 + ph * 13.0);
        pos.z = aBaseZ + (pos.z - aBaseZ) * fl * (0.55 + 0.9 * uThrust);
        vec4 mvPosition = modelViewMatrix * im * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragment: /* glsl */ `
      uniform vec3 uColor; uniform float uNight;
      varying float vK; varying float vPh;
      #include <fog_pars_fragment>
      void main(){
        float a = pow(1.0 - vK, 1.4);
        vec3 c = mix(vec3(1.8, 2.2, 2.8), uColor * 2.4, smoothstep(0.0, 0.6, vK)) * (0.5 + 0.5 * uNight);
        gl_FragColor = vec4(c * a * 1.4, a * 0.9);
        ${FOG_DIM}
      }`,
    uniforms: { uColor: { value: new Color(color) }, uTime: U.uTime, uNight: U.uNight, uThrust: { value: 0.5 } },
    transparent: true,
    additive: true,
  });
  return m;
}

// ---------------------------------------------------------------------------------------------
// Energy: pulsing plasma sphere / flowing conduit
// ---------------------------------------------------------------------------------------------
export function makeEnergyMaterial(color: string, mode: "sphere" | "flow", speed = 1) {
  return fogged({
    vertex: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vObj;
      #include <fog_pars_vertex>
      void main(){
        vUv = uv; vObj = position;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragment: /* glsl */ `
      uniform vec3 uColor; uniform float uTime; uniform float uSpeed;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vObj;
      ${GLSL_NOISE}
      #include <fog_pars_fragment>
      void main(){
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        #ifdef FLOW
          float pulse = smoothstep(0.55, 1.0, sin(vUv.x * 60.0 - uTime * 4.0 * uSpeed) * 0.5 + 0.5);
          float base = 0.35 + 0.35 * sin(uTime * 2.0 + vUv.x * 10.0);
          vec3 c = uColor * (base + pulse * 2.2) * (0.6 + fres);
          gl_FragColor = vec4(c, 0.9);
        #else
          vec3 d = normalize(vObj);
          float n = fbm(vec2(atan(d.z, d.x) * 2.0 + uTime * 0.6 * uSpeed, d.y * 4.0 - uTime * 0.8 * uSpeed));
          float n2 = fbm(vec2(atan(d.x, d.z) * 3.0 - uTime * 0.4, d.y * 6.0 + uTime));
          float core = pow(n * 1.3 + n2 * 0.5, 2.0);
          vec3 c = uColor * (0.6 + core * 3.0) + vec3(1.0) * pow(fres, 3.0) * 0.8;
          gl_FragColor = vec4(c * (0.8 + 0.3 * sin(uTime * 3.0 * uSpeed)), 0.55 + fres * 0.4);
        #endif
        ${FOG_DIM}
      }`,
    uniforms: { uColor: { value: new Color(color) }, uTime: U.uTime, uSpeed: { value: speed } },
    transparent: true,
    additive: true,
    defines: mode === "flow" ? { FLOW: "" } : {},
  });
}

// ---------------------------------------------------------------------------------------------
// Water & waterfall
// ---------------------------------------------------------------------------------------------
export function makeWaterMaterial() {
  return fogged({
    vertex: /* glsl */ `
      varying vec3 vWPos; varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0); vWPos = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragment: /* glsl */ `
      uniform float uTime; uniform float uNight; uniform float uRain;
      uniform vec3 uSkyH; uniform vec3 uSkyT; uniform vec3 uSunDir; uniform vec3 uSunCol;
      varying vec3 vWPos; varying vec2 vUv;
      ${GLSL_NOISE}
      #include <fog_pars_fragment>
      void main(){
        vec2 p = vWPos.xz;
        float e = 0.35;
        float h0 = fbm(p * 0.12 + vec2(uTime * 0.05, uTime * 0.03));
        float hx = fbm((p + vec2(e, 0.0)) * 0.12 + vec2(uTime * 0.05, uTime * 0.03));
        float hz = fbm((p + vec2(0.0, e)) * 0.12 + vec2(uTime * 0.05, uTime * 0.03));
        vec3 N = normalize(vec3((h0 - hx) * 6.0, 1.0, (h0 - hz) * 6.0));
        vec3 V = normalize(cameraPosition - vWPos);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
        vec3 R = reflect(-V, N);
        vec3 sky = mix(uSkyH, uSkyT, smoothstep(0.0, 0.6, R.y));
        vec3 deep = vec3(0.01, 0.07, 0.09) * (0.4 + 0.6 * (1.0 - uNight));
        vec3 col = mix(deep, sky, 0.15 + 0.85 * fres);
        col += uSunCol * pow(max(dot(R, normalize(uSunDir)), 0.0), 220.0) * 6.0;
        float glow = pow(fbm(p * 0.35 - uTime * 0.08), 3.5) * uNight;
        col += vec3(0.05, 1.0, 0.75) * glow * 3.2;
        vec2 rc = floor(p * 0.5); vec2 rf = fract(p * 0.5) - 0.5;
        float rt = fract(uTime * 0.8 + hash12(rc));
        col += vec3(0.6, 0.8, 1.0) * smoothstep(0.05, 0.0, abs(length(rf) - rt * 0.5)) * (1.0 - rt) * uRain * 0.4;
        gl_FragColor = vec4(col, 0.93);
        #include <fog_fragment>
      }`,
    uniforms: { uTime: U.uTime, uNight: U.uNight, uRain: U.uRain, uSkyH: U.uSkyH, uSkyT: U.uSkyT, uSunDir: U.uSunDir, uSunCol: U.uSunCol },
    transparent: true,
  });
}

export function makeWaterfallMaterial() {
  return fogged({
    vertex: /* glsl */ `
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragment: /* glsl */ `
      uniform float uTime; uniform float uNight;
      varying vec2 vUv;
      ${GLSL_NOISE}
      #include <fog_pars_fragment>
      void main(){
        float s = fbm(vec2(vUv.x * 16.0, vUv.y * 2.5 + uTime * 2.4));
        float s2 = fbm(vec2(vUv.x * 36.0 + 3.0, vUv.y * 5.0 + uTime * 3.6));
        float f = clamp(s * 1.1 + s2 * 0.6, 0.0, 1.0);
        float edge = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
        float foam = smoothstep(0.1, 0.0, vUv.y) * 0.9;
        vec3 c = mix(vec3(0.35, 0.6, 0.75), vec3(0.95, 1.0, 1.0), f * f + foam) * (0.45 + 0.55 * (1.0 - uNight * 0.7));
        c += vec3(0.05, 0.6, 0.5) * uNight * f * 0.9;
        gl_FragColor = vec4(c, (0.35 + 0.55 * f) * edge);
        #include <fog_fragment>
      }`,
    uniforms: { uTime: U.uTime, uNight: U.uNight },
    transparent: true,
  });
}

// ---------------------------------------------------------------------------------------------
// Light beams (searchlights, tower beacon, landmark beacons) – additive cones/cylinders
// ---------------------------------------------------------------------------------------------
export function makeBeamMaterial(color: string, strength = 1) {
  const m = fogged({
    vertex: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragment: /* glsl */ `
      uniform vec3 uColor; uniform float uNight; uniform float uStrength; uniform float uTime; uniform float uBoost;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      #include <fog_pars_fragment>
      void main(){
        float f = abs(dot(normalize(vN), normalize(vV)));
        float a = pow(f, 1.6) * pow(1.0 - vUv.y, 1.3) * uStrength * (0.12 + 0.88 * uNight) * (1.0 + uBoost);
        a *= 0.85 + 0.15 * sin(uTime * 3.0 + vUv.y * 20.0);
        gl_FragColor = vec4(uColor * 2.5, a);
        ${FOG_DIM}
      }`,
    uniforms: { uColor: { value: new Color(color) }, uNight: U.uNight, uStrength: { value: strength }, uTime: U.uTime, uBoost: { value: 0 } },
    transparent: true,
    additive: true,
  });
  return m;
}

// ---------------------------------------------------------------------------------------------
// Point-sprite beacons (aviation lights, distant lights, fireflies)
// ---------------------------------------------------------------------------------------------
export function makeBeaconMaterial(blink = 1) {
  return new ShaderMaterial({
    uniforms: { uTime: U.uTime, uNight: U.uNight, uPx: U.uPx, uBlink: { value: blink } },
    vertexShader: /* glsl */ `
      attribute float aPhase; attribute vec3 aColor; attribute float aSize;
      uniform float uTime; uniform float uPx; uniform float uBlink;
      varying vec3 vC; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = max(-mv.z, 1.0);
        float b = mix(1.0, 0.15 + 0.85 * smoothstep(0.35, 0.5, fract(uTime * 0.7 + aPhase)), uBlink);
        vC = aColor * b;
        vA = clamp(1.6 - d / 1800.0, 0.0, 1.0);
        gl_PointSize = clamp(aSize * uPx / d, 1.5, 36.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uNight; varying vec3 vC; varying float vA;
      void main(){
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(clamp(1.0 - r, 0.0, 1.0), 2.0);
        gl_FragColor = vec4(vC * 3.0 * (0.45 + 0.55 * uNight), a * vA);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}
