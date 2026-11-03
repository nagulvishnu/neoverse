import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { BoxGeometry, CylinderGeometry, EdgesGeometry, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, ShaderMaterial } from "three";
import { landmarkById } from "../../core/data";
import { useStore } from "../../core/store";
import { makeBeamMaterial } from "../materials";

/**
 * Invisible hit proxy + edge highlight + light beacon for an interactive landmark.
 * Hover shows the tooltip/outline, click flies the camera to the landmark and opens the info panel.
 */
export function LandmarkMarker({ id, beamHeight = 160, beamRadius = 1.4, beamY }: { id: string; beamHeight?: number; beamRadius?: number; beamY?: number }) {
  const def = landmarkById(id);
  const hitMat = useMemo(() => new MeshBasicMaterial({ colorWrite: false, depthWrite: false }), []);
  const hitGeo = useMemo(() => new BoxGeometry(...def.proxy.size), [def]);
  const edges = useMemo(() => {
    const g = new EdgesGeometry(hitGeo);
    const m = new LineBasicMaterial({ color: def.accent, transparent: true, opacity: 0.9, toneMapped: false });
    const l = new LineSegments(g, m);
    l.visible = false;
    l.raycast = () => {};
    return l;
  }, [hitGeo, def]);
  const beamGeo = useMemo(() => new CylinderGeometry(beamRadius * 0.6, beamRadius, beamHeight, 16, 1, true), [beamRadius, beamHeight]);
  const beamMat = useMemo(() => makeBeamMaterial(def.accent, 1.1) as ShaderMaterial, [def]);
  const beamRef = useRef<Mesh>(null);

  useEffect(
    () => () => {
      hitMat.dispose();
      hitGeo.dispose();
      edges.geometry.dispose();
      (edges.material as LineBasicMaterial).dispose();
      beamGeo.dispose();
      beamMat.dispose();
    },
    [hitMat, hitGeo, edges, beamGeo, beamMat],
  );

  useFrame((_, dt) => {
    const s = useStore.getState();
    const hovered = s.hover?.id === id;
    const selected = s.selectedLandmark === id;
    const target = hovered ? 3 : selected ? 1.6 : 0;
    const u = beamMat.uniforms.uBoost;
    u.value += (target - u.value) * Math.min(1, dt * 6);
    edges.visible = hovered || selected;
    if (beamRef.current) beamRef.current.visible = s.phase !== "loading";
  });

  const [px, py, pz] = def.position;
  const [cx, cy, cz] = def.proxy.center;
  const by = beamY ?? py + def.proxy.center[1] * 2;

  const over = (e: ThreeEvent<PointerEvent>) => {
    const s = useStore.getState();
    if (s.phase !== "city" || s.vehicle.active) return;
    e.stopPropagation();
    document.body.style.cursor = "pointer";
    s.setHover({ id, x: e.clientX, y: e.clientY });
  };
  const out = () => {
    document.body.style.cursor = "";
    const s = useStore.getState();
    if (s.hover?.id === id) s.setHover(null);
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    const s = useStore.getState();
    if (s.phase !== "city" || s.vehicle.active) return;
    if (e.delta > 6) return; // was a drag, not a click
    e.stopPropagation();
    s.goLandmark(id);
  };

  return (
    <group position={[px, py, pz]}>
      <mesh geometry={hitGeo} material={hitMat} position={[cx, cy, cz]} onPointerOver={over} onPointerMove={over} onPointerOut={out} onClick={click} />
      <primitive object={edges} position={[cx, cy, cz]} />
      <mesh ref={beamRef} geometry={beamGeo} material={beamMat} position={[0, by - py + beamHeight / 2, 0]} raycast={() => {}} renderOrder={3} />
    </group>
  );
}
