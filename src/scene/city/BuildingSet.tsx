import { useEffect, useMemo } from "react";
import { Color, Euler, InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { archGeometry, isRound } from "../archetypes";
import { makeBuildingMaterial, type BuildingStyle } from "../materials";
import type { Bld } from "../cityData";

interface Props {
  items: Bld[];
  style: BuildingStyle;
  facade: string[];
  lod?: 0 | 1;
  shadows?: boolean;
  chunk?: number;
}

/**
 * Renders buildings as instanced meshes, one per (spatial chunk × architecture archetype).
 * Chunking gives frustum culling per area; all windows/facades are shader generated.
 */
export function BuildingSet({ items, style, facade, lod = 0, shadows = true, chunk = 320 }: Props) {
  const built = useMemo(() => {
    const matBox = makeBuildingMaterial(style, false);
    const matRound = makeBuildingMaterial(style, true);
    const groups = new Map<string, Bld[]>();
    for (const b of items) {
      const k = `${Math.floor(b.x / chunk)}_${Math.floor(b.z / chunk)}_${b.kind}`;
      let a = groups.get(k);
      if (!a) groups.set(k, (a = []));
      a.push(b);
    }
    const palette = facade.map((c) => new Color(c));
    const m = new Matrix4();
    const q = new Quaternion();
    const e = new Euler();
    const p = new Vector3();
    const s = new Vector3();
    const meshes: InstancedMesh[] = [];
    groups.forEach((arr) => {
      const kind = arr[0].kind;
      const mesh = new InstancedMesh(archGeometry(kind, lod), isRound(kind) ? matRound : matBox, arr.length);
      arr.forEach((b, i) => {
        e.set(0, b.rot, 0);
        q.setFromEuler(e);
        p.set(b.x, b.y, b.z);
        s.set(b.w, b.h, b.d);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, palette[b.tint % palette.length]);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
      meshes.push(mesh);
    });
    return { meshes, mats: [matBox, matRound] };
  }, [items, style, facade, lod, shadows, chunk]);

  useEffect(
    () => () => {
      built.meshes.forEach((m) => m.dispose());
      built.mats.forEach((m) => m.dispose());
    },
    [built],
  );

  return (
    <>
      {built.meshes.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
    </>
  );
}
