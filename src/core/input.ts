// Central input state for keyboard, mouse and touch. Polled by camera rig & vehicle controller.
export const input = {
  keys: new Set<string>(),
  lookDX: 0,
  lookDY: 0,
  wheel: 0,
  joyX: 0, // touch strafe/turn
  joyY: 0, // touch forward
  touchUp: 0, // -1 / 0 / 1
  mouseX: 0, // NDC
  mouseY: 0,
  dragging: false,
};

let inited = false;
let lastX = 0;
let lastY = 0;
let activePointer = -1;

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

export function initInput() {
  if (inited) return;
  inited = true;
  window.addEventListener("keydown", (e) => {
    if (isTyping(e.target)) return;
    const k = e.code;
    input.keys.add(k);
    if (k === "Space" || k.startsWith("Arrow")) {
      // keep page from scrolling while exploring (story scroller opts out via data attribute)
      if (!(e.target as HTMLElement)?.closest?.("[data-scroll-ok]")) e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => input.keys.delete(e.code));
  window.addEventListener("blur", () => {
    input.keys.clear();
    input.dragging = false;
  });
  window.addEventListener("pointerdown", (e) => {
    const t = e.target as HTMLElement;
    if (t && t.tagName === "CANVAS") {
      input.dragging = true;
      activePointer = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });
  window.addEventListener("pointermove", (e) => {
    input.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    input.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    if (input.dragging && e.pointerId === activePointer) {
      input.lookDX += e.clientX - lastX;
      input.lookDY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId === activePointer) {
      input.dragging = false;
      activePointer = -1;
    }
  };
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
  window.addEventListener(
    "wheel",
    (e) => {
      if ((e.target as HTMLElement)?.tagName === "CANVAS") input.wheel += e.deltaY;
    },
    { passive: true },
  );
}

export const key = (...codes: string[]) => codes.some((c) => input.keys.has(c));

export function consumeLook() {
  const r = [input.lookDX, input.lookDY] as const;
  input.lookDX = 0;
  input.lookDY = 0;
  return r;
}
export function consumeWheel() {
  const w = input.wheel;
  input.wheel = 0;
  return w;
}
