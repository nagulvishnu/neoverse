import { useEffect, useMemo } from "react";
import { Path, Shape, ShapeGeometry } from "three";
import { LAYOUT } from "../../core/layout";
import { makeGroundMaterial } from "../materials";
import { getCity } from "../cityData";
import { BuildingSet } from "./BuildingSet";
import { Beacons } from "./common";
import { STYLES, FACADES } from "../styles";

/** One huge ground plane with a circular hole over the underground shaft. Roads etc. are shader-drawn. */
export function Ground() {
  const { geo, mat } = useMemo(() => {
    const S = 3200;
    const shape = new Shape();
    shape.moveTo(-S, -S);
    shape.lineTo(S, -S);
    shape.lineTo(S, S);
    shape.lineTo(-S, S);
    shape.lineTo(-S, -S);
    const hole = new Path();
    const { ug } = LAYOUT;
    hole.absarc(ug.x, -ug.z, ug.shaftR, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const g = new ShapeGeometry(shape, 96);
    g.rotateX(-Math.PI / 2);
    return { geo: g, mat: makeGroundMaterial() };
  }, []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  return <mesh geometry={geo} material={mat} receiveShadow />;
}

/** Distant LOD-1 ring of generic skyscrapers that gives the megacity its scale. */
export function Skyline() {
  const city = getCity();
  return (
    <group name="skyline">
      <BuildingSet items={city.skyline} style={STYLES.skyline} facade={FACADES.skyline} lod={1} shadows={false} chunk={420} />
      <Beacons points={city.skylineBeacons} color="#ff3a3a" size={2.4} />
    </group>
  );
}
