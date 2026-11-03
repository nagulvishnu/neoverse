import type { SVGProps } from "react";

const P: Record<string, string> = {
  sun: "M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z",
  sunset: "M12 10V3m0 0L9 6m3-3 3 3M5 18a7 7 0 0 1 14 0M2 18h20M4 21h16",
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z",
  rain: "M7 15a5 5 0 1 1 1.5-9.8A6 6 0 0 1 20 8a4 4 0 0 1-1 7.9M8 19l-1 2m5-2-1 2m5-2-1 2",
  fog: "M4 10a6 6 0 0 1 11.5-2A4.5 4.5 0 0 1 20 12M3 15h14m-10 3h14M5 12h9",
  clear: "M12 5V3m0 18v-2m7-7h2M3 12h2m11.24-4.24 1.42-1.42M6.34 17.66l1.42-1.42m0-8.48L6.34 6.34m11.32 11.32-1.42-1.42M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  volume: "M11 5 6 9H2v6h4l5 4V5Zm4.5 3.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13",
  mute: "M11 5 6 9H2v6h4l5 4V5Zm5 4 6 6m0-6-6 6",
  full: "M4 9V4h5M20 9V4h-5M4 15v5h5m11-5v5h-5",
  exitfull: "M9 4v5H4m11-5v5h5M9 20v-5H4m11 5v-5h5",
  reset: "M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5",
  close: "M6 6l12 12M18 6 6 18",
  menu: "M4 7h16M4 12h16M4 17h16",
  film: "M4 4h16v16H4V4Zm4 0v16m8-16v16M4 8h4m8 0h4M4 12h16M4 16h4m8 0h4",
  walk: "M13 4a1.5 1.5 0 1 0 0 .01M9 21l2-6-2-2 1-5 4 2 2 3m-6-1-3 3",
  free: "M12 3l3 3-3 3-3-3 3-3Zm0 12 3 3-3 3-3-3 3-3ZM3 12l3-3 3 3-3 3-3-3Zm12 0 3-3 3 3-3 3-3-3Z",
  district: "M3 21V9l6-3v15M9 21V3l6 3v15m0 0V10l6 2v9M3 21h18",
  car: "M5 16h14M3 16v-3l2-5h14l2 5v3m-4 0a2 2 0 1 0 4 0M3 16a2 2 0 1 0 4 0m1-6h8",
  jet: "M12 2l3 8 7 4-7 1-1 7-2-5-2 5-1-7-7-1 7-4 3-8Z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  eyeoff: "M3 3l18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.7M6.6 7.6A17 17 0 0 0 2 12s4 6 10 6a9.7 9.7 0 0 0 4-.9",
  help: "M12 17v.01M9.1 9a3 3 0 1 1 4.6 2.5c-1 .7-1.7 1.2-1.7 2.5M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z",
  pin: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  chevron: "M6 9l6 6 6-6",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Zm2 14h13",
  up: "M12 19V5m-6 6 6-6 6 6",
  down: "M12 5v14m-6-6 6 6 6-6",
  layers: "M12 3 3 8l9 5 9-5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5",
};

export function Icon({ name, size = 18, ...rest }: { name: keyof typeof P | string; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      <path d={P[name] ?? P.help} />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M4 28V8l8 8V4l8 12V4l8 8v16" stroke="#5ef2ff" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <path d="M4 28h24" stroke="#ff4fd8" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
