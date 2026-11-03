import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, InstancedMesh, Matrix4, MeshStandardMaterial, Vector3, type Material, type ShaderMaterial } from "three";
import { useStore } from "../../core/store";
import { camState } from "../../core/camera";
import { input, key } from "../../core/input";
import { constrainToWorld, resolveSphere } from "../../core/collision";
import { MOBILE } from "../../core/layout";
import { clamp, damp } from "../../core/rng";
import { makeFlameMaterial, makeGlowMaterial } from "../materials";
import { buildVehicle } from "../traffic/vehicleModels";
import { useGlass, useGlow } from "../city/props";

const R = 3.2; // collision radius
const MAX_SPEED = 115;
const MAX_REVERSE = 28;
const SCALE = 1.7;

const v = {
  pos: new Vector3(60, 1.5, 60),
  yaw: 0,
  speed: 0,
  vy: 0,
  yawRate: 0,
  roll: 0,
  pitch: 0,
  wasActive: false,
  spawn: 1, // 0..1 materialise animation
  hudT: 0,
  hit: 0,
  mounted: false,
};

/**
 * The player's flying vehicle: smooth throttle, banking turns, climb/descend, chase camera,
 * building collisions and world boundaries. Parked at the Downtown plaza until entered.
 */
export function PlayerVehicle() {
  const root = useRef<Group>(null);
  const model = useMemo(() => buildVehicle("wedge"), []);
  const bodyMat = useMemo(() => new MeshStandardMaterial({ color: "#e9eef6", metalness: 0.9, roughness: 0.18 }), []);
  const lightMat = useMemo(() => makeGlowMaterial(0.9, true, true), []);
  const flameMat = useMemo(() => makeFlameMaterial("#7ad8ff") as ShaderMaterial, []);
  const canopy = useGlass(0.55, "#7fc8ff");
  const winglet = useGlow("#5ef2ff", 3.5, 0.9, true);
  const meshes = useMemo(() => {
    const id = new Matrix4();
    const mk = (g: typeof model.body, m: Material) => {
      const im = new InstancedMesh(g, m, 1);
      im.setMatrixAt(0, id);
      im.frustumCulled = false;
      return im;
    };
    const body = mk(model.body, bodyMat);
    body.castShadow = true;
    return { body, lights: mk(model.lights, lightMat), flames: model.flames ? mk(model.flames, flameMat) : null };
  }, [model, bodyMat, lightMat, flameMat]);
  useEffect(
    () => () => {
      meshes.body.dispose();
      meshes.lights.dispose();
      meshes.flames?.dispose();
      bodyMat.dispose();
      lightMat.dispose();
      flameMat.dispose();
      model.body.dispose();
      model.lights.dispose();
      model.flames?.dispose();
    },
    [meshes, bodyMat, lightMat, flameMat, model],
  );

  const tmp = useMemo(() => ({ fwd: new Vector3(), want: new Vector3(), look: new Vector3(), prev: new Vector3() }), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const st = useStore.getState();
    const active = st.vehicle.active;
    const t = state.clock.elapsedTime;
    const g = root.current;

    // ---- enter / exit edges
    if (active && !v.wasActive) {
      v.mounted = true;
      const d = tmp.want.set(camState.target.x - camState.pos.x, 0, camState.target.z - camState.pos.z);
      const camYaw = d.lengthSq() > 1e-6 ? Math.atan2(d.x, d.z) : 0;
      if (v.pos.distanceTo(camState.pos) > 70) {
        v.pos.copy(camState.pos).addScaledVector(d.normalize(), 20);
        v.pos.y = Math.max(camState.pos.y - 2, 6);
        v.yaw = camYaw;
        v.spawn = 0;
        tmp.prev.copy(v.pos);
        resolveSphere(v.pos, R + 2);
        constrainToWorld(tmp.prev.set(v.pos.x, v.pos.y + 5, v.pos.z), v.pos, R);
      } else {
        v.yaw = camYaw;
      }
      v.speed = 0;
      v.vy = 0;
      v.yawRate = 0;
      st.setVehicleHud({ status: "Engaging" });
    }
    v.wasActive = active;

    // ---- controls
    const w = key("KeyW", "ArrowUp") || input.joyY > 0.25;
    const s = key("KeyS", "ArrowDown") || input.joyY < -0.25;
    const turn = (key("KeyA", "ArrowLeft") ? 1 : 0) - (key("KeyD", "ArrowRight") ? 1 : 0) - (Math.abs(input.joyX) > 0.2 ? input.joyX : 0);
    const up = (key("Space") ? 1 : 0) - (key("ShiftLeft", "ShiftRight") ? 1 : 0) + input.touchUp;
    const ctl = active && v.spawn >= 1;

    const targetSpeed = ctl ? (w ? MAX_SPEED : s ? -MAX_REVERSE : 0) : 0;
    const lam = ctl && (w || s) ? 0.9 : 1.6;
    v.speed = damp(v.speed, targetSpeed, lam, dt);
    const authority = 0.35 + 0.65 * Math.min(1, Math.abs(v.speed) / 30);
    v.yawRate = damp(v.yawRate, ctl ? turn * 1.15 * authority * (v.speed < -1 ? -1 : 1) : 0, 4, dt);
    v.yaw += v.yawRate * dt;
    v.vy = damp(v.vy, ctl ? up * 30 : 0, 3, dt);

    // ---- integrate + collisions
    tmp.prev.copy(v.pos);
    tmp.fwd.set(Math.sin(v.yaw), 0, Math.cos(v.yaw));
    v.pos.addScaledVector(tmp.fwd, v.speed * dt);
    v.pos.y += v.vy * dt;
    const bumped = resolveSphere(v.pos, R);
    const limited = constrainToWorld(tmp.prev, v.pos, R);
    if (bumped || limited) {
      if (v.hit <= 0) v.speed *= bumped ? 0.4 : 0.7;
      v.hit = 0.8;
      if (active) st.setVehicleHud({ status: bumped ? "Collision avoided" : "Boundary" });
    }
    v.hit = Math.max(0, v.hit - dt);

    // hover when idle (parked) — gentle bob
    const bob = !active ? Math.sin(t * 1.6) * 0.15 : Math.sin(t * 2) * 0.05;
    v.roll = damp(v.roll, -v.yawRate * 0.42, 5, dt);
    v.pitch = damp(v.pitch, clamp(v.vy / 70 + (w ? 0.05 : 0) - (s ? 0.04 : 0), -0.35, 0.35), 5, dt);
    if (v.spawn < 1) v.spawn = Math.min(1, v.spawn + dt / 1.1);

    // ---- apply to model
    if (g) {
      g.visible = v.mounted || true;
      g.position.set(v.pos.x, v.pos.y + bob, v.pos.z);
      g.rotation.set(-v.pitch, v.yaw, v.roll, "YXZ");
      const k = v.spawn < 1 ? 1 - Math.pow(1 - v.spawn, 3) : 1;
      g.scale.setScalar(Math.max(0.001, SCALE * k));
    }
    flameMat.uniforms.uThrust.value = damp(flameMat.uniforms.uThrust.value, active ? clamp(Math.abs(v.speed) / MAX_SPEED + (w ? 0.3 : 0) + Math.max(0, up) * 0.2, 0.15, 1.1) : 0.12, 6, dt);

    // ---- chase camera
    if (active) {
      const mx = MOBILE ? 0 : input.mouseX;
      const my = MOBILE ? 0 : input.mouseY;
      const lookYaw = v.yaw - mx * 0.85;
      const pitchC = 0.17 + my * 0.28;
      const D = 15 + Math.abs(v.speed) * 0.045;
      tmp.want.set(
        v.pos.x - Math.sin(lookYaw) * Math.cos(pitchC) * D,
        v.pos.y + Math.sin(pitchC) * D + 1.8,
        v.pos.z - Math.cos(lookYaw) * Math.cos(pitchC) * D,
      );
      tmp.look.set(v.pos.x + Math.sin(lookYaw) * 14, v.pos.y + 1.4 + my * -3, v.pos.z + Math.cos(lookYaw) * 14);
      // keep the camera out of buildings / underground
      tmp.prev.set(tmp.want.x, v.pos.y + 3, tmp.want.z);
      resolveSphere(tmp.want, 1.5);
      constrainToWorld(tmp.prev, tmp.want, 1.5);
      const k = 1 - Math.exp(-dt * (v.spawn < 1 ? 3 : 6.5));
      camState.pos.lerp(tmp.want, k);
      camState.target.lerp(tmp.look, 1 - Math.exp(-dt * 9));
      camState.fovTarget = 62 + (Math.max(0, v.speed) / MAX_SPEED) * 12;
      // throttled HUD
      v.hudT += dt;
      if (v.hudT > 0.15) {
        v.hudT = 0;
        const status = v.hit > 0 ? st.vehicle.status : v.spawn < 1 ? "Engaging" : Math.abs(v.speed) < 3 && Math.abs(v.vy) < 2 ? "Hovering" : v.speed < -1 ? "Reversing" : v.vy > 8 ? "Ascending" : v.vy < -8 ? "Descending" : "Cruising";
        st.setVehicleHud({ speed: Math.round(Math.abs(v.speed) * 3.6), alt: Math.round(v.pos.y), status });
      }
    }
  }, -20);

  const onOver = () => {
    const s = useStore.getState();
    if (s.phase === "city" && !s.vehicle.active) document.body.style.cursor = "pointer";
  };
  const onOut = () => {
    document.body.style.cursor = "";
  };
  const onClick = (e: { stopPropagation: () => void; delta: number }) => {
    const s = useStore.getState();
    if (s.phase !== "city" || s.vehicle.active || e.delta > 6) return;
    e.stopPropagation();
    s.enterVehicle();
  };

  return (
    <group ref={root} position={[60, 1.5, 60]} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
      <primitive object={meshes.body} />
      <primitive object={meshes.lights} />
      {meshes.flames && <primitive object={meshes.flames} renderOrder={4} />}
      <mesh position={[0, 0.78, 0.25]} scale={[0.62, 0.42, 1.05]} material={canopy}>
        <sphereGeometry args={[1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[1.35, 0.55, -1.7]} material={winglet}>
        <boxGeometry args={[0.08, 0.6, 1.0]} />
      </mesh>
      <mesh position={[-1.35, 0.55, -1.7]} material={winglet}>
        <boxGeometry args={[0.08, 0.6, 1.0]} />
      </mesh>
      <pointLight position={[0, -0.6, 0]} color="#5ef2ff" intensity={90} distance={22} decay={2} />
    </group>
  );
}
