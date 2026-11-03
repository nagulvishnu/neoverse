import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import { useStore } from "../core/store";
import { advanceFly, camState } from "../core/camera";
import { consumeLook, consumeWheel, input, key } from "../core/input";
import { constrainToWorld, resolveSphere } from "../core/collision";
import { orbitPosition, districtAt } from "../core/data";
import { evalCinematic, evalIntro, evalStory, INTRO_DURATION } from "../core/paths";
import { clamp, damp } from "../core/rng";

const desiredPos = new Vector3();
const desiredTarget = new Vector3();
const fwd = new Vector3();
const right = new Vector3();
const wish = new Vector3();
const prev = new Vector3();
const UP = new Vector3(0, 1, 0);

/**
 * Single owner of the camera. Handles: cinematic intro + scroll story, autopilot, flights between
 * viewpoints, free exploration (WASD, mouse-look, boundaries & collisions) and district orbit.
 * The flying vehicle controller writes camState itself when in vehicle mode.
 */
export function CameraRig() {
  const { camera } = useThree();
  const frame = useRef(0);
  const lastShot = useRef("");

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const st = useStore.getState();
    const cam = camera as PerspectiveCamera;
    frame.current++;

    if (st.phase === "intro") {
      camState.introT += dt;
      if (!camState.storyTouched) {
        if (camState.introT < INTRO_DURATION) evalIntro(camState.introT / INTRO_DURATION, camState.pos, camState.target);
        else evalStory(0, camState.pos, camState.target);
      } else {
        evalStory(camState.storyT, desiredPos, desiredTarget);
        const k = 1 - Math.exp(-dt * 3.5);
        camState.pos.lerp(desiredPos, k);
        camState.target.lerp(desiredTarget, k);
      }
      camState.fovTarget = 58;
    } else if (st.phase === "city") {
      if (camState.fly) {
        advanceFly(dt);
        camState.fovTarget = 60;
      } else {
        switch (st.cameraMode) {
          case "free":
            updateFree(dt, st.moveSpeed, st.setMoveSpeed);
            camState.fovTarget = 62;
            break;
          case "district":
            updateOrbit(dt);
            camState.fovTarget = 55;
            break;
          case "cinematic": {
            camState.cineTime += dt;
            const name = evalCinematic(camState.cineTime, desiredPos, desiredTarget);
            const k = 1 - Math.exp(-dt * 2.2);
            camState.pos.lerp(desiredPos, k);
            camState.target.lerp(desiredTarget, k);
            if (name !== lastShot.current) {
              lastShot.current = name;
              st.setShot(name);
            }
            camState.fovTarget = 50;
            break;
          }
          case "vehicle":
            break; // PlayerVehicle drives camState
        }
      }
    }

    if (camState.target.distanceToSquared(camState.pos) < 1e-4) camState.target.z += 1;
    camera.position.copy(camState.pos);
    camera.lookAt(camState.target);
    const f = damp(cam.fov, camState.fovTarget, 3, dt);
    if (Math.abs(f - cam.fov) > 0.005) {
      cam.fov = f;
      cam.updateProjectionMatrix();
    }

    if (frame.current % 15 === 0 && st.phase !== "loading") {
      const d = districtAt(camState.pos.x, camState.pos.y, camState.pos.z);
      if (d !== st.currentDistrict) st.setCurrentDistrict(d);
    }
  }, -10);

  return null;
}

let speedTimer = 0;
function updateFree(dt: number, moveSpeed: number, setMoveSpeed: (v: number) => void) {
  const [dx, dy] = consumeLook();
  const sens = 0.0024;
  camState.yaw -= dx * sens;
  camState.pitch = clamp(camState.pitch - dy * sens, -1.5, 1.5);
  const w = consumeWheel();
  if (w !== 0) {
    const ns = clamp(moveSpeed * Math.exp(-w * 0.0012), 8, 500);
    speedTimer += 1;
    setMoveSpeed(Math.round(ns));
  }
  const cp = Math.cos(camState.pitch);
  fwd.set(Math.sin(camState.yaw) * cp, Math.sin(camState.pitch), Math.cos(camState.yaw) * cp);
  right.set(-fwd.z, 0, fwd.x).normalize();
  const f = (key("KeyW", "ArrowUp") ? 1 : 0) - (key("KeyS", "ArrowDown") ? 1 : 0) + input.joyY;
  const r = (key("KeyD", "ArrowRight") ? 1 : 0) - (key("KeyA", "ArrowLeft") ? 1 : 0) + input.joyX;
  const u = (key("Space", "KeyE") ? 1 : 0) - (key("ShiftLeft", "ShiftRight", "KeyQ") ? 1 : 0) + input.touchUp;
  wish.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(right, r).addScaledVector(UP, u);
  if (wish.lengthSq() > 1) wish.normalize();
  wish.multiplyScalar(moveSpeed);
  // smooth acceleration / deceleration
  const k = 1 - Math.exp(-dt * (wish.lengthSq() > 0.01 ? 4.5 : 6));
  camState.vel.lerp(wish, k);
  prev.copy(camState.pos);
  camState.pos.addScaledVector(camState.vel, dt);
  const hit = resolveSphere(camState.pos, 2.4);
  const hit2 = constrainToWorld(prev, camState.pos, 2.4);
  if (hit || hit2) camState.vel.copy(camState.pos).sub(prev).divideScalar(Math.max(dt, 1e-3));
  camState.target.copy(camState.pos).addScaledVector(fwd, 20);
}

const ORBIT_PREV = new Vector3();
function updateOrbit(dt: number) {
  const o = camState.orbit;
  const [dx, dy] = consumeLook();
  const w = consumeWheel();
  if (dx || dy) {
    o.tAz -= dx * 0.005;
    o.tEl = clamp(o.tEl + dy * 0.004, -0.15, 1.3);
  } else if (!input.dragging) {
    o.tAz += dt * 0.035;
  }
  if (w) o.tRadius = clamp(o.tRadius * Math.exp(w * 0.001), 30, 1400);
  const ke = 1 - Math.exp(-dt * 5);
  o.az += (o.tAz - o.az) * ke;
  o.el += (o.tEl - o.el) * ke;
  o.radius += (o.tRadius - o.radius) * ke;
  orbitPosition({ center: [o.center.x, o.center.y, o.center.z], radius: o.radius, az: o.az, el: o.el }, camState.pos);
  // keep the orbit camera inside the world (and inside the cavern when orbiting underground)
  ORBIT_PREV.set(camState.pos.x, o.center.y < 0 ? -2 : 20, camState.pos.z);
  constrainToWorld(ORBIT_PREV, camState.pos, 3);
  camState.target.copy(o.center);
}
void speedTimer;
