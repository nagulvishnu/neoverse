import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Group,
  MeshStandardMaterial,
  Mesh,
  RepeatWrapping,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from "three";
import { LAYOUT } from "../../core/layout";
import { mulberry32 } from "../../core/rng";
import { getCity } from "../cityData";
import { BuildingSet } from "./BuildingSet";
import { Beacons, InstancedBoxes, SignSet, type BoxItem, type SignItem } from "./common";
import { LandmarkMarker } from "./Landmark";
import { Spin, useGlass, useGlow, useStd } from "./props";
import { STYLES, FACADES } from "../styles";
import { makeEnergyMaterial } from "../materials";

const { ug } = LAYOUT;

function useFloorMaterial() {
  const mat = useMemo(() => {
    const mk = (bg: string, line: string, glowOnly: boolean) => {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const g = c.getContext("2d")!;
      g.fillStyle = bg;
      g.fillRect(0, 0, 256, 256);
      if (!glowOnly) {
        for (let i = 0; i < 300; i++) {
          g.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
          g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 14, 2);
        }
      }
      g.strokeStyle = line;
      g.lineWidth = 3;
      g.strokeRect(0, 0, 256, 256);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(128, 0);
      g.lineTo(128, 256);
      g.moveTo(0, 128);
      g.lineTo(256, 128);
      g.stroke();
      const t = new CanvasTexture(c);
      t.wrapS = t.wrapT = RepeatWrapping;
      t.repeat.set(36, 36);
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    };
    const map = mk("#0c1318", "#1c4b4c", false);
    const emissiveMap = mk("#000000", "#1fd6b0", true);
    const m = new MeshStandardMaterial({ map, emissiveMap, emissive: new Color(1, 1, 1), emissiveIntensity: 0.9, metalness: 0.7, roughness: 0.42 });
    return m;
  }, []);
  useEffect(
    () => () => {
      mat.map?.dispose();
      mat.emissiveMap?.dispose();
      mat.dispose();
    },
    [mat],
  );
  return mat;
}

function Robot({ radius, speed, phase, color }: { radius: number; speed: number; phase: number; color: string }) {
  const root = useRef<Group>(null);
  const legs = useRef<Mesh[]>([]);
  const body = useStd("#aab4bf", 0.8, 0.35);
  const dark = useStd("#2a323b", 0.7, 0.5);
  const eye = useGlow(color, 4, 0.8, true);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const a = phase + t * speed;
    const g = root.current;
    if (!g) return;
    g.position.set(ug.x + Math.cos(a) * radius, ug.floorY + 1.5 + Math.abs(Math.sin(t * 6 + phase)) * 0.12, ug.z + Math.sin(a) * radius);
    g.rotation.y = Math.atan2(-Math.sin(a) * Math.sign(speed), Math.cos(a) * Math.sign(speed));
    legs.current.forEach((l, i) => {
      if (l) l.rotation.x = Math.sin(t * 6 + phase + (i % 2) * Math.PI) * 0.6;
    });
  });
  return (
    <group ref={root}>
      <mesh position={[0, 1.2, 0]} material={body} castShadow>
        <boxGeometry args={[1.5, 1.2, 2.2]} />
      </mesh>
      <mesh position={[0, 2.1, 0.5]} material={dark}>
        <sphereGeometry args={[0.6, 12, 8]} />
      </mesh>
      <mesh position={[0, 2.15, 1.05]} material={eye}>
        <boxGeometry args={[0.7, 0.18, 0.1]} />
      </mesh>
      <mesh position={[0.4, 2.9, -0.6]} material={dark}>
        <cylinderGeometry args={[0.04, 0.04, 1.4, 5]} />
      </mesh>
      {[
        [0.8, 0.7],
        [-0.8, 0.7],
        [0.8, -0.7],
        [-0.8, -0.7],
      ].map(([x, z], i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) legs.current[i] = m;
          }}
          position={[x, 0.2, z]}
          material={dark}
        >
          <boxGeometry args={[0.28, 1.6, 0.28]} />
        </mesh>
      ))}
    </group>
  );
}

function Piston({ x, z, phase }: { x: number; z: number; phase: number }) {
  const rod = useRef<Mesh>(null);
  const steel = useStd("#9aa5b1", 0.9, 0.25);
  const dark = useStd("#2c353f", 0.8, 0.4);
  useFrame((s) => {
    if (rod.current) rod.current.position.y = ug.floorY + 14 + Math.sin(s.clock.elapsedTime * 1.4 + phase) * 5;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, ug.floorY + 7, 0]} material={dark} castShadow>
        <cylinderGeometry args={[3, 3.4, 14, 14]} />
      </mesh>
      <mesh ref={rod} material={steel} castShadow>
        <cylinderGeometry args={[1.2, 1.2, 14, 10]} />
      </mesh>
    </group>
  );
}

export function Underground() {
  const city = getCity();
  const floorMat = useFloorMaterial();
  const wall = useStd("#1a2228", 0.6, 0.6, { side: DoubleSide });
  const shaftWall = useStd("#202a31", 0.8, 0.4, { side: DoubleSide });
  const steel = useStd("#8f9ba8", 0.9, 0.25);
  const tealGlow = useGlow("#37ffb5", 3, 0.7, true);
  const amberGlow = useGlow("#ffb347", 3, 0.7, true);
  const blueGlow = useGlow("#37d6ff", 3, 0.7, true);
  const glass = useGlass(0.3, "#8fe8ff");
  const colMat = useStd("#3a454f", 0.7, 0.45);
  const dark = useStd("#04070a", 0.2, 0.9);

  const core = useMemo(() => makeEnergyMaterial("#37ffb5", "sphere", 1.2), []);
  const flow = useMemo(() => makeEnergyMaterial("#37ffb5", "flow", 1), []);
  useEffect(() => () => { core.dispose(); flow.dispose(); }, [core, flow]);

  const columns = useMemo(() => {
    const cols: BoxItem[] = [];
    const collars: BoxItem[] = [];
    for (const [R, N] of [[140, 14], [228, 22]] as const)
      for (let k = 0; k < N; k++) {
        const a = (k / N) * Math.PI * 2;
        const x = ug.x + Math.cos(a) * R;
        const z = ug.z + Math.sin(a) * R;
        cols.push({ x, y: ug.floorY, z, sx: 6, sy: 100, sz: 6 });
        for (const y of [-82, -52, -22]) collars.push({ x, y, z, sx: 7.2, sy: 0.8, sz: 7.2, color: new Color(k % 2 ? "#37ffb5" : "#37d6ff").multiplyScalar(2.2) });
      }
    return { cols, collars };
  }, []);

  const conduits = useMemo(() => {
    const tubes: TubeGeometry[] = [];
    city.ugBuildings
      .filter((b) => b.kind === "cylinder" && b.w > 18)
      .forEach((b) => {
        const mid = new Vector3((ug.x + b.x) / 2, ug.floorY + 0.9, (ug.z + b.z) / 2 + 6);
        const curve = new CatmullRomCurve3([new Vector3(ug.x, ug.floorY + 0.9, ug.z), mid, new Vector3(b.x, ug.floorY + 3, b.z)]);
        tubes.push(new TubeGeometry(curve, 40, 0.8, 8, false));
      });
    return tubes;
  }, [city]);
  useEffect(() => () => conduits.forEach((t) => t.dispose()), [conduits]);

  const shaftRings = useMemo(() => [-8, -22, -38, -54, -70, -86].map((y) => y), []);
  const strips = useMemo<BoxItem[]>(() => {
    const out: BoxItem[] = [];
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      out.push({ x: ug.x + Math.cos(a) * (ug.shaftR - 0.6), y: ug.floorY + 2, z: ug.z + Math.sin(a) * (ug.shaftR - 0.6), sx: 0.5, sy: 96, sz: 0.5, ry: -a, color: new Color("#37ffb5").multiplyScalar(1.6) });
    }
    return out;
  }, []);

  const surface = useMemo(() => {
    const posts: BoxItem[] = [];
    const caps: BoxItem[] = [];
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      const x = ug.x + Math.cos(a) * (ug.shaftR + 2.5);
      const z = ug.z + Math.sin(a) * (ug.shaftR + 2.5);
      posts.push({ x, y: 0, z, sx: 0.6, sy: 1.6, sz: 0.6 });
      caps.push({ x, y: 1.6, z, sx: 0.8, sy: 0.25, sz: 0.8, color: new Color("#37ffb5").multiplyScalar(2.5) });
    }
    const pylons: BoxItem[] = [];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const x = ug.x + Math.cos(a) * (ug.shaftR + 22);
      const z = ug.z + Math.sin(a) * (ug.shaftR + 22);
      pylons.push({ x, y: 0, z, sx: 2.4, sy: 26, sz: 2.4, ry: a });
      caps.push({ x, y: 26, z, sx: 3, sy: 0.8, sz: 3, color: new Color("#37ffb5").multiplyScalar(3) });
    }
    return { posts, caps, pylons };
  }, []);

  const portals = useMemo(() => {
    const out: { x: number; y: number; z: number; ry: number; r: number; c: string }[] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      const R = 238.5;
      out.push({ x: ug.x + Math.cos(a) * R, y: ug.floorY + 9, z: ug.z + Math.sin(a) * R, ry: Math.atan2(-Math.cos(a), -Math.sin(a)), r: k % 3 === 0 ? 9 : 6, c: k % 3 === 0 ? "teal" : k % 3 === 1 ? "amber" : "blue" });
    }
    return out;
  }, []);

  const robots = useMemo(() => {
    const r = mulberry32(5);
    const radii = [58, 70, 148, 154, 162, 66, 151, 158];
    return radii.map((radius, i) => ({ radius, speed: (i % 2 ? -1 : 1) * (0.045 + r() * 0.03), phase: r() * 6.28, color: ["#37ffb5", "#ffb347", "#37d6ff", "#ff6a8a"][i % 4] }));
  }, []);

  const signs = useMemo<SignItem[]>(() => [{ x: -290 - 13, y: ug.floorY + 12, z: 60 + 32, sx: 18, sy: 4.5, ry: 0.3 + Math.PI / 2, sign: 26, phase: 0.4, tint: "#37d6ff" }], []);
  const antenna = useMemo<BoxItem[]>(
    () => [
      { x: -290 + 22, y: ug.floorY + 36, z: 60 + 22, sx: 0.6, sy: 22, sz: 0.6 },
      { x: -290 - 22, y: ug.floorY + 28, z: 60 + 20, sx: 0.5, sy: 16, sz: 0.5 },
      { x: -290 + 5, y: ug.floorY + 18, z: 60 - 8, sx: 0.5, sy: 14, sz: 0.5 },
    ],
    [],
  );
  const beacons = useMemo(() => [-290 + 22, ug.floorY + 58, 60 + 22, -290 - 22, ug.floorY + 44, 60 + 20, -290 + 5, ug.floorY + 32, 60 - 8], []);

  return (
    <group name="underground">
      {/* hollow of the cavern */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ug.x, ug.floorY, ug.z]} material={floorMat} receiveShadow>
        <circleGeometry args={[ug.cavR, 96]} />
      </mesh>
      <mesh position={[ug.x, ug.floorY / 2, ug.z]} material={wall}>
        <cylinderGeometry args={[ug.cavR, ug.cavR, -ug.floorY, 96, 1, true]} />
      </mesh>
      <mesh position={[ug.x, ug.floorY / 2, ug.z]} material={shaftWall}>
        <cylinderGeometry args={[ug.shaftR, ug.shaftR, -ug.floorY, 64, 1, true]} />
      </mesh>
      {shaftRings.map((y, i) => (
        <mesh key={y} position={[ug.x, y, ug.z]} rotation={[Math.PI / 2, 0, 0]} material={i % 2 ? blueGlow : tealGlow}>
          <torusGeometry args={[ug.shaftR - 0.3, 0.5, 6, 96]} />
        </mesh>
      ))}
      <InstancedBoxes items={strips} material={tealGlow} />
      {/* columns */}
      <InstancedBoxes items={columns.cols} material={colMat} castShadow />
      <InstancedBoxes items={columns.collars} material={tealGlow} />
      {/* industrial buildings, reactor tanks, research facility */}
      <BuildingSet items={city.ugBuildings} style={STYLES.ug} facade={FACADES.ug} chunk={500} />
      <mesh position={[-290 - 4, ug.floorY + 18, 60]} material={glass}>
        <sphereGeometry args={[11, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <InstancedBoxes items={antenna} material={steel} />
      <Beacons points={beacons} color="#ffb347" size={1.5} />
      <SignSet items={signs} mode="sign" />
      <LandmarkMarker id="research-facility" beamHeight={46} beamRadius={1.2} beamY={-62} />

      {/* Quantum Energy Core */}
      <group position={[ug.x, ug.floorY, ug.z]}>
        <mesh position={[0, 1.5, 0]} material={steel} receiveShadow>
          <cylinderGeometry args={[26, 28, 3, 48]} />
        </mesh>
        <mesh position={[0, 3.2, 0]} rotation={[Math.PI / 2, 0, 0]} material={tealGlow}>
          <torusGeometry args={[25, 0.4, 6, 80]} />
        </mesh>
        <mesh position={[0, 40, 0]} material={steel} castShadow>
          <cylinderGeometry args={[4.5, 7, 80, 24]} />
        </mesh>
        <mesh position={[0, 48, 0]} material={core}>
          <sphereGeometry args={[10, 40, 28]} />
        </mesh>
        <Spin speed={0.7} position={[0, 48, 0]}>
          <mesh material={steel} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[16, 0.9, 10, 64]} />
          </mesh>
        </Spin>
        <Spin speed={-0.9} position={[0, 48, 0]} rotation={[0.9, 0, 0]}>
          <mesh material={tealGlow}>
            <torusGeometry args={[19, 0.5, 8, 64]} />
          </mesh>
        </Spin>
        <Spin speed={0.5} position={[0, 48, 0]} rotation={[-0.8, 0.5, 0]}>
          <mesh material={blueGlow}>
            <torusGeometry args={[22, 0.4, 8, 64]} />
          </mesh>
        </Spin>
      </group>
      {conduits.map((g, i) => (
        <mesh key={i} geometry={g} material={flow} />
      ))}
      <LandmarkMarker id="quantum-core" beamHeight={130} beamRadius={1.4} beamY={-30} />
      <pointLight position={[ug.x, ug.floorY + 48, ug.z]} color="#37ffb5" intensity={9000} distance={300} decay={2} />
      <pointLight position={[ug.x + 150, -60, ug.z + 20]} color="#ffb347" intensity={4500} distance={260} decay={2} />
      <pointLight position={[ug.x - 100, -60, ug.z - 120]} color="#37d6ff" intensity={4500} distance={260} decay={2} />
      <pointLight position={[ug.x - 60, -60, ug.z + 150]} color="#b06bff" intensity={3500} distance={260} decay={2} />

      {/* machinery */}
      {[0, 1, 2, 3].map((k) => {
        const a = (k / 4) * Math.PI * 2 + 0.8;
        return (
          <Spin key={k} axis="y" speed={k % 2 ? -1.1 : 1.1} position={[ug.x + Math.cos(a) * 190, ug.floorY + 20, ug.z + Math.sin(a) * 190]}>
            <mesh material={steel}>
              <cylinderGeometry args={[2, 2, 6, 12]} />
            </mesh>
            {[0, 1, 2, 3, 4, 5].map((b) => (
              <mesh key={b} position={[Math.cos((b / 6) * Math.PI * 2) * 7, 0, Math.sin((b / 6) * Math.PI * 2) * 7]} rotation={[0, -(b / 6) * Math.PI * 2, 0.3]} material={steel}>
                <boxGeometry args={[12, 0.4, 2.6]} />
              </mesh>
            ))}
          </Spin>
        );
      })}
      {[0, 1, 2, 3, 4, 5].map((k) => {
        const a = (k / 6) * Math.PI * 2 + 0.4;
        return <Piston key={k} x={ug.x + Math.cos(a) * 90} z={ug.z + Math.sin(a) * 90} phase={k} />;
      })}
      <group position={[ug.x + 40, ug.floorY, ug.z - 190]}>
        <mesh position={[0, 30, 0]} material={steel} castShadow>
          <boxGeometry args={[3, 60, 3]} />
        </mesh>
        <Spin speed={0.18} position={[0, 60, 0]}>
          <mesh position={[18, 0, 0]} material={steel} castShadow>
            <boxGeometry args={[44, 2.4, 2.4]} />
          </mesh>
          <mesh position={[34, -10, 0]} material={amberGlow}>
            <boxGeometry args={[1, 18, 1]} />
          </mesh>
        </Spin>
      </group>
      {robots.map((r, i) => (
        <Robot key={i} {...r} />
      ))}

      {/* tunnel portals and hidden passages */}
      {portals.map((p, i) => (
        <group key={i} position={[p.x, p.y, p.z]} rotation={[0, p.ry, 0]}>
          <mesh material={dark}>
            <circleGeometry args={[p.r, 32]} />
          </mesh>
          <mesh material={p.c === "teal" ? tealGlow : p.c === "amber" ? amberGlow : blueGlow}>
            <torusGeometry args={[p.r + 0.6, 0.7, 8, 48]} />
          </mesh>
        </group>
      ))}

      {/* surface access plaza */}
      <InstancedBoxes items={surface.posts} material={steel} />
      <InstancedBoxes items={surface.caps} material={tealGlow} />
      <InstancedBoxes items={surface.pylons} material={colMat} castShadow />
      <Spin speed={0.3} position={[ug.x, 42, ug.z]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={tealGlow}>
          <torusGeometry args={[34, 0.4, 8, 96]} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 4, 0]} material={blueGlow}>
          <torusGeometry args={[26, 0.25, 8, 96]} />
        </mesh>
      </Spin>
    </group>
  );
}
