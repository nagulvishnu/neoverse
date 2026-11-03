import { Vector3 } from "three";
import { LAYOUT, type DistrictId } from "./layout";

export interface OrbitDef {
  center: [number, number, number];
  radius: number;
  az: number;
  el: number;
}
export interface PoseDef {
  pos: [number, number, number];
  target: [number, number, number];
}

export interface DistrictDef {
  id: DistrictId;
  index: string;
  name: string;
  tagline: string;
  description: string;
  stats: [string, string][];
  accent: string;
  center: [number, number, number];
  radius: number;
  orbit: OrbitDef;
  enter: PoseDef;
  landmarks: string[];
}

export interface LandmarkDef {
  id: string;
  name: string;
  district: DistrictId;
  tagline: string;
  description: string;
  facts: [string, string][];
  position: [number, number, number];
  proxy: { size: [number, number, number]; center: [number, number, number] };
  orbit: OrbitDef;
  view: PoseDef;
  viewLabel: string;
  accent: string;
}

export const DISTRICTS: DistrictDef[] = [
  {
    id: "downtown",
    index: "01",
    name: "Downtown",
    tagline: "The metropolitan core",
    description:
      "A canyon of twisting glass towers, elevated maglev loops and giant digital billboards. At its heart rises the Central Tower — the silhouette of NEOVERSE.",
    stats: [["Tallest structure", "440 m"], ["Avenues", "16"], ["Transit", "Maglev + sky lanes"]],
    accent: "#5ef2ff",
    center: [0, 60, 0],
    radius: 280,
    orbit: { center: [0, 70, 0], radius: 560, el: 0.42, az: 0.55 },
    enter: { pos: [30, 10, 210], target: [30, 80, 0] },
    landmarks: ["central-tower", "nexus-hub"],
  },
  {
    id: "neon",
    index: "02",
    name: "Neon District",
    tagline: "Nightlife never closes",
    description:
      "Narrow rain-soaked streets under holographic signage, ramen counters, arcades and glowing arches. The avenue ends at the Cyber Arena.",
    stats: [["Open", "24 / 7"], ["Signage", "Holographic"], ["Streets", "Reflective, wet"]],
    accent: "#ff4fd8",
    center: [400, 20, 40],
    radius: 190,
    orbit: { center: [400, 20, 40], radius: 250, el: 0.45, az: 0.3 },
    enter: { pos: [400, 9, 200], target: [400, 16, 40] },
    landmarks: ["cyber-arena"],
  },
  {
    id: "sky",
    index: "03",
    name: "Sky District",
    tagline: "Above the clouds",
    description:
      "Floating platforms of luxury towers, rooftop gardens and sky bridges, linked by tram rings and flying vehicle lanes. Panoramic views in every direction.",
    stats: [["Altitude", "200 – 300 m"], ["Platforms", "5 + Observation Deck"], ["Transit", "Sky tram ring"]],
    accent: "#ffd37a",
    center: [-160, 230, -360],
    radius: 190,
    orbit: { center: [-160, 230, -360], radius: 330, el: 0.25, az: 0.5 },
    enter: { pos: [-72, 208.5, -261], target: [0, 150, 0] },
    landmarks: ["observation-deck"],
  },
  {
    id: "underground",
    index: "04",
    name: "Underground",
    tagline: "Technology beneath us",
    description:
      "A vast excavated cavern beneath the city — reactor halls, maintenance robots, metro tunnels and the Quantum Energy Core that powers NEOVERSE.",
    stats: [["Depth", "100 m"], ["Cavern radius", "240 m"], ["Access", "Central shaft"]],
    accent: "#37ffb5",
    center: [-420, -55, 100],
    radius: 200,
    orbit: { center: [-420, -55, 100], radius: 150, el: 0.1, az: 2.0 },
    enter: { pos: [-350, -85, 170], target: [-420, -45, 100] },
    landmarks: ["quantum-core", "research-facility"],
  },
  {
    id: "green",
    index: "05",
    name: "Green District",
    tagline: "Nature, reimagined",
    description:
      "Vertical forests, botanical towers, a luminous lake and a roaring waterfall. Solar canopies and bioluminescent gardens glow softly after dark.",
    stats: [["Parkland", "70%"], ["Energy", "Solar + wind"], ["Water", "Lake + waterfall"]],
    accent: "#7dff9a",
    center: [200, 40, 470],
    radius: 230,
    orbit: { center: [200, 40, 470], radius: 300, el: 0.3, az: -0.5 },
    enter: { pos: [110, 8, 345], target: [200, 30, 470] },
    landmarks: ["tech-museum"],
  },
];

export const LANDMARKS: LandmarkDef[] = [
  {
    id: "central-tower",
    name: "NEOVERSE Central Tower",
    district: "downtown",
    tagline: "The twisting icon of the skyline",
    description:
      "Twenty rotated glass tiers spiral 440 metres into the clouds, crowned by a luminous ring, a holographic NEOVERSE band and a beacon visible from every district.",
    facts: [["Height", "440 m"], ["Floors", "118"], ["Crown", "Beacon + hologram band"]],
    position: [0, 0, 0],
    proxy: { size: [70, 470, 70], center: [0, 235, 0] },
    orbit: { center: [0, 200, 0], radius: 380, az: 0.7, el: 0.1 },
    view: { pos: [70, 335, 70], target: [0, 320, 0] },
    viewLabel: "Crown deck",
    accent: "#5ef2ff",
  },
  {
    id: "nexus-hub",
    name: "Nexus Transport Hub",
    district: "downtown",
    tagline: "Where every route converges",
    description:
      "A glass transit dome ringed by an orbital gantry. Maglev lines, flying vehicle lanes and ground shuttles meet under a rotating holographic route map.",
    facts: [["Lines", "Maglev A + B"], ["Gantry", "68 m ring"], ["Service", "24 / 7"]],
    position: [120, 0, -60],
    proxy: { size: [92, 60, 92], center: [0, 30, 0] },
    orbit: { center: [120, 25, -60], radius: 200, az: 2.4, el: 0.3 },
    view: { pos: [120, 26, 30], target: [120, 22, -60] },
    viewLabel: "Concourse",
    accent: "#8ab6ff",
  },
  {
    id: "cyber-arena",
    name: "Cyber Arena",
    district: "neon",
    tagline: "Sixty thousand voices, one pulse",
    description:
      "A tiered entertainment colosseum wrapped in animated light rings, with searchlights sweeping the Neon District skyline every night.",
    facts: [["Capacity", "60,000"], ["Lighting", "Sweeping beams"], ["Events", "Nightly"]],
    position: [590, 0, 40],
    proxy: { size: [100, 70, 100], center: [0, 30, 0] },
    orbit: { center: [590, 25, 40], radius: 210, az: -1.57, el: 0.36 },
    view: { pos: [535, 14, 40], target: [590, 20, 40] },
    viewLabel: "Arena gate",
    accent: "#ff4fd8",
  },
  {
    id: "observation-deck",
    name: "Skyline Observation Deck",
    district: "sky",
    tagline: "The city at your feet",
    description:
      "A ring-shaped deck 290 metres up, reached by a glass elevator that rises from the Sky District's central platform. 360° panoramas of every district.",
    facts: [["Altitude", "290 m"], ["Elevator", "Glass, 12 m/s"], ["View", "360°"]],
    position: [-160, 290, -360],
    proxy: { size: [84, 60, 84], center: [0, 10, 0] },
    orbit: { center: [-160, 285, -360], radius: 130, az: 0.6, el: 0.18 },
    view: { pos: [-148, 296, -338], target: [0, 140, 40] },
    viewLabel: "On the deck",
    accent: "#ffd37a",
  },
  {
    id: "quantum-core",
    name: "Quantum Energy Core",
    district: "underground",
    tagline: "The heart of the grid",
    description:
      "A suspended plasma sphere inside rotating containment rings powers the entire city. Energy conduits radiate across the cavern floor.",
    facts: [["Output", "42 TW"], ["Containment", "Triple ring"], ["Depth", "100 m"]],
    position: [-420, -100, 100],
    proxy: { size: [64, 100, 64], center: [0, 50, 0] },
    orbit: { center: [-420, -55, 100], radius: 130, az: 0.8, el: 0.15 },
    view: { pos: [-380, -70, 140], target: [-420, -45, 100] },
    viewLabel: "Containment floor",
    accent: "#37ffb5",
  },
  {
    id: "tech-museum",
    name: "Future Technology Museum",
    district: "green",
    tagline: "A knot of glass and chrome",
    description:
      "A sculptural chrome torus-knot enclosing a living hologram exhibit, surrounded by a reflecting plaza and bioluminescent gardens.",
    facts: [["Exhibits", "3,400"], ["Form", "Torus knot"], ["Garden", "Bioluminescent"]],
    position: [250, 0, 420],
    proxy: { size: [76, 66, 76], center: [0, 32, 0] },
    orbit: { center: [250, 30, 420], radius: 170, az: -0.6, el: 0.3 },
    view: { pos: [212, 8, 362], target: [250, 25, 420] },
    viewLabel: "Museum plaza",
    accent: "#7dff9a",
  },
  {
    id: "research-facility",
    name: "Underground Research Facility",
    district: "underground",
    tagline: "Hidden labs, restricted levels",
    description:
      "A domed laboratory complex on the cavern floor with antenna arrays, vent stacks and maintenance robots patrolling its perimeter.",
    facts: [["Levels", "9 (4 restricted)"], ["Robots", "Autonomous"], ["Access", "Cleared only"]],
    position: [-290, -100, 60],
    proxy: { size: [84, 46, 84], center: [0, 23, 0] },
    orbit: { center: [-290, -80, 60], radius: 120, az: -0.8, el: 0.15 },
    view: { pos: [-340, -88, 90], target: [-290, -80, 60] },
    viewLabel: "Lab perimeter",
    accent: "#37d6ff",
  },
];

export const landmarkById = (id: string) => LANDMARKS.find((l) => l.id === id)!;
export const districtById = (id: DistrictId) => DISTRICTS.find((d) => d.id === id)!;

export const OVERVIEW: PoseDef = { pos: [-380, 420, 780], target: [40, 40, 60] };

export function orbitPosition(o: OrbitDef, out = new Vector3()) {
  const [cx, cy, cz] = o.center;
  const ce = Math.cos(o.el);
  return out.set(cx + o.radius * ce * Math.sin(o.az), cy + o.radius * Math.sin(o.el), cz + o.radius * ce * Math.cos(o.az));
}

/** Which district is a world position closest to / inside. */
export function districtAt(x: number, y: number, z: number): DistrictId {
  const { ug, sky, green, neon } = LAYOUT;
  if (y < -0.5 && Math.hypot(x - ug.x, z - ug.z) < ug.cavR + 5) return "underground";
  if (Math.hypot(x - sky.x, z - sky.z) < 190 && y > 120) return "sky";
  if (Math.hypot(x - green.x, z - green.z) < 240) return "green";
  if (Math.abs(x - neon.x) < 250 && Math.abs(z - neon.z) < 190) return "neon";
  if (Math.hypot(x - ug.x, z - ug.z) < 130) return "underground";
  let best: DistrictId = "downtown";
  let bd = Math.hypot(x, z) / 1.2;
  const cands: [DistrictId, number][] = [
    ["neon", Math.hypot(x - neon.x, z - neon.z)],
    ["green", Math.hypot(x - green.x, z - green.z)],
    ["sky", Math.hypot(x - sky.x, z - sky.z) * (y > 100 ? 0.8 : 1.4)],
    ["underground", Math.hypot(x - ug.x, z - ug.z)],
  ];
  for (const [id, d] of cands)
    if (d < bd) {
      bd = d;
      best = id;
    }
  return best;
}

export interface StorySection {
  kicker: string;
  title: string;
  body: string;
  side: "left" | "right";
  time: "day" | "sunset" | "night";
  weather: "clear" | "rain" | "fog";
  district?: DistrictId;
}

export const STORY: StorySection[] = [
  {
    kicker: "01 — Arrival",
    title: "Welcome to NEOVERSE",
    body: "Eleven million people. Five districts. One skyline that glows from the first star to the last. You are entering a city that has forgotten how to sleep.",
    side: "left",
    time: "sunset",
    weather: "clear",
  },
  {
    kicker: "02 — Scale",
    title: "The Megacity",
    body: "Towers of glass and chrome climb past the clouds. Every silhouette is different — twisted, stepped, tapered, crowned — stitched together by elevated avenues and sky bridges.",
    side: "right",
    time: "day",
    weather: "clear",
    district: "downtown",
  },
  {
    kicker: "03 — Motion",
    title: "A City in Motion",
    body: "Flying cars glide through disciplined sky lanes. Maglev trains thread the avenues. Autonomous shuttles pause at every signal. Nothing is random; everything moves.",
    side: "left",
    time: "sunset",
    weather: "clear",
    district: "downtown",
  },
  {
    kicker: "04 — Altitude",
    title: "Beyond the Skyline",
    body: "Above the weather, platforms of luxury architecture float in the open sky — joined by bridges, gardens and a tram that never touches the ground.",
    side: "right",
    time: "day",
    weather: "clear",
    district: "sky",
  },
  {
    kicker: "05 — Nightlife",
    title: "Neon After Dark",
    body: "Rain on the asphalt. Holograms that never blink. In the Neon District the avenue is a river of colour and every doorway has a story.",
    side: "left",
    time: "night",
    weather: "rain",
    district: "neon",
  },
  {
    kicker: "06 — Depth",
    title: "Technology Beneath Us",
    body: "Descend a hundred metres into the cavern where NEOVERSE's engines turn. Plasma, steel, robots and silent trains — the machinery behind the magic.",
    side: "right",
    time: "night",
    weather: "clear",
    district: "underground",
  },
  {
    kicker: "07 — Renewal",
    title: "Nature Reimagined",
    body: "Vertical forests, a glowing lake and a waterfall in the middle of a megacity. The Green District proves that the future can be quiet.",
    side: "left",
    time: "day",
    weather: "clear",
    district: "green",
  },
  {
    kicker: "08 — Your Turn",
    title: "Your City, Your Exploration",
    body: "Take the camera. Fly a vehicle. Change the hour, summon the rain, find every landmark. The city is yours.",
    side: "right",
    time: "sunset",
    weather: "clear",
  },
];
