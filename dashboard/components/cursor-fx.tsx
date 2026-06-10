"use client";

import { useEffect, useRef } from "react";

/**
 * Landing-page cursor experience:
 *  - a soft light that lags behind the pointer (lerped via rAF, so it glides)
 *  - an expanding press-ripple where the user clicks
 * Desktop-only (pointer: fine) and disabled for prefers-reduced-motion.
 */
export function CursorFx() {
  const glowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    const glow = glowRef.current;
    if (!glow) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 3;
    let x = targetX;
    let y = targetY;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      glow.style.opacity = "1";
    };

    const tick = () => {
      // Lerp toward the pointer so the light glides instead of sticking.
      x += (targetX - x) * 0.12;
      y += (targetY - y) * 0.12;
      glow.style.transform = `translate(${x}px, ${y}px)`;
      raf = requestAnimationFrame(tick);
    };

    const onClick = (e: PointerEvent) => {
      const ring = document.createElement("span");
      ring.className = "click-ripple";
      ring.style.left = `${e.clientX}px`;
      ring.style.top = `${e.clientY}px`;
      document.body.appendChild(ring);
      ring.addEventListener("animationend", () => ring.remove());
    };

    glow.style.opacity = "0";
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onClick, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onClick);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={glowRef} className="cursor-glow" aria-hidden />;
}
