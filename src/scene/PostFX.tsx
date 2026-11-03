import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Bloom, DepthOfField, EffectComposer, Noise, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode, type DepthOfFieldEffect } from "postprocessing";
import { useStore } from "../core/store";
import { QUALITY } from "../core/quality";
import { env, live } from "../core/environment";
import { camState } from "../core/camera";
import { MOBILE } from "../core/layout";

/** Selective post-processing stack scaled by quality level. */
export function PostFX() {
  const quality = useStore((s) => s.quality);
  const phase = useStore((s) => s.phase);
  const mode = useStore((s) => s.cameraMode);
  const cfg = QUALITY[quality];
  const bloom = useRef<{ intensity: number } | null>(null);
  const dof = useRef<DepthOfFieldEffect | null>(null);
  const camera = useThree((s) => s.camera);
  const cinematic = cfg.dof && !MOBILE && (phase === "intro" || (phase === "city" && mode === "cinematic"));

  useFrame(() => {
    if (bloom.current) bloom.current.intensity = env.bloom * (1 + live.ug * 0.4);
    const d = dof.current;
    if (d && "calculateFocusDistance" in d) {
      d.cocMaterial.focusDistance = d.calculateFocusDistance(camState.target) * 0.6;
    }
    void camera;
  });

  return (
    <EffectComposer multisampling={cfg.msaa} enableNormalPass={false}>
      <Bloom ref={bloom as never} mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.25} intensity={0.8} levels={cfg.bloomLevels} radius={0.75} />
      {cinematic ? <DepthOfField ref={dof as never} focusDistance={0.05} focusRange={0.05} bokehScale={2.2} /> : <></>}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {cfg.smaa ? <SMAA /> : <></>}
      {cfg.vignette ? <Vignette eskil={false} offset={0.25} darkness={0.62} /> : <></>}
      {cfg.noise ? <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.35} /> : <></>}
    </EffectComposer>
  );
}
