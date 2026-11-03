import { useEffect, useMemo } from "react";
import { CylinderGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4 } from "three";
import { BuildingSet } from "./BuildingSet";
import { LandmarkMarker } from "./Landmark";
import { Elevator, Spin, useGlow, useStd } from "./props";
import { getAtlas } from "./common";
import { makeSignMaterial } from "../materials";
import { STYLES, FACADES } from "../styles";
import type { Bld } from "../cityData";
import { Color } from "three";

/** NEOVERSE Central Tower: 20 twisted glass tiers, glowing crown, rotating holographic band, beacon beam. */
export function CentralTower() {
  const tiers = useMemo<Bld[]>(() => {
    const out: Bld[] = [];
    for (let i = 0; i < 20; i++) {
      const k = i / 19;
      const w = 50 - 24 * Math.pow(k, 0.9);
      out.push({ kind: "slab", x: 0, y: i * 22, z: 0, w, h: 22.6, d: w, rot: i * 0.11, tint: 0 });
    }
    return out;
  }, []);

  const ringMat = useGlow("#5ef2ff", 3.2, 0.6, true);
  const ringMat2 = useGlow("#ff4fd8", 2.6, 0.45);
  const metal = useStd("#cfd9e6", 0.95, 0.15);

  const band = useMemo(() => {
    const geo = new CylinderGeometry(33, 33, 15, 72, 1, true);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 4);
    geo.setAttribute("aSign", new InstancedBufferAttribute(new Float32Array([0]), 1));
    geo.setAttribute("aPhase", new InstancedBufferAttribute(new Float32Array([0.3]), 1));
    const mat = makeSignMaterial(getAtlas(), "holo");
    const mesh = new InstancedMesh(geo, mat, 1);
    mesh.setMatrixAt(0, new Matrix4());
    mesh.setColorAt(0, new Color("#5ef2ff"));
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    const geo2 = geo.clone();
    return { mesh, geo, mat, geo2 };
  }, []);
  useEffect(
    () => () => {
      band.mesh.dispose();
      band.geo.dispose();
      band.geo2.dispose();
      band.mat.dispose();
    },
    [band],
  );

  return (
    <group>
      <BuildingSet items={tiers} style={STYLES.tower} facade={FACADES.tower} chunk={2000} />
      {/* crown */}
      <mesh position={[0, 441, 0]} rotation={[Math.PI / 2, 0, 0]} material={ringMat}>
        <torusGeometry args={[17, 0.8, 10, 56]} />
      </mesh>
      <Spin speed={0.5} position={[0, 452, 0]}>
        <mesh rotation={[Math.PI / 2.4, 0, 0]} material={ringMat2}>
          <torusGeometry args={[11, 0.35, 8, 48]} />
        </mesh>
        <mesh rotation={[-Math.PI / 2.4, 0.6, 0]} material={ringMat}>
          <torusGeometry args={[9, 0.3, 8, 48]} />
        </mesh>
      </Spin>
      <mesh position={[0, 462, 0]} material={metal} castShadow>
        <cylinderGeometry args={[0.35, 1.4, 44, 8]} />
      </mesh>
      {/* holographic NEOVERSE band, slowly rotating */}
      <Spin speed={0.07} position={[0, 318, 0]}>
        <primitive object={band.mesh} />
      </Spin>
      <Spin speed={-0.1} position={[0, 190, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={ringMat2}>
          <torusGeometry args={[36, 0.25, 6, 90]} />
        </mesh>
      </Spin>
      {/* plaza ring */}
      <mesh position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]} material={ringMat}>
        <torusGeometry args={[40, 0.35, 6, 96]} />
      </mesh>
      <Elevator x={46} z={0} y0={2} y1={330} period={34} />
      <LandmarkMarker id="central-tower" beamHeight={420} beamRadius={2.2} beamY={484} />
    </group>
  );
}
