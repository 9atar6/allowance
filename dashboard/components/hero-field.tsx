"use client";

import { useEffect, useRef } from "react";

/**
 * The hero's living background: a fine grid of ink dots on paper that swell and
 * lean toward the cursor (desktop) or your finger (mobile), like iron filings
 * on engraved banknote stock. No color, no glow.
 *
 * - Works with mouse, pen, and touch. On touch the cluster stays where you last
 *   touched (no hover to rely on), so the effect is actually visible on phones.
 * - Respects prefers-reduced-motion by responding instantly (no glide) rather
 *   than disabling the effect — it's direct manipulation, not autoplay.
 * - Idles (stops the rAF loop) once settled, so it costs nothing at rest.
 */
export function HeroField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ease = reduced ? 1 : 0.12; // instant under reduced-motion
    const GAP = 30;
    const REACH = 165;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0, height = 0, cols = 0, rows = 0;
    let targetX = -9999, targetY = -9999;
    let curX = -9999, curY = -9999;
    let raf = 0;
    let idle = true;

    let ink = "25, 28, 25";
    const readInk = () => {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue("--ink")
        .trim();
      const m = /^#?([0-9a-f]{6})$/i.exec(v);
      if (m) {
        const n = parseInt(m[1], 16);
        ink = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / GAP);
      rows = Math.ceil(height / GAP);
      frame();
    };

    const frame = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          const x = i * GAP;
          const y = j * GAP;
          const dx = curX - x;
          const dy = curY - y;
          const dist = Math.hypot(dx, dy);
          let r = 0.9;
          let alpha = 0.1;
          let ox = 0;
          let oy = 0;
          if (dist < REACH) {
            const f = 1 - dist / REACH;
            r += f * 2;
            alpha += f * 0.55;
            const pull = f * 7;
            ox = (dx / (dist || 1)) * pull;
            oy = (dy / (dist || 1)) * pull;
          }
          ctx.beginPath();
          ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${ink}, ${alpha})`;
          ctx.fill();
        }
      }
    };

    const tick = () => {
      curX += (targetX - curX) * ease;
      curY += (targetY - curY) * ease;
      frame();
      if (Math.abs(targetX - curX) < 0.5 && Math.abs(targetY - curY) < 0.5) {
        idle = true; // settled — stop until the next input
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (idle) {
        idle = false;
        raf = requestAnimationFrame(tick);
      }
    };

    const setTarget = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      targetX = clientX - rect.left;
      targetY = clientY - rect.top;
      kick();
    };
    const onMove = (e: PointerEvent) => setTarget(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) setTarget(t.clientX, t.clientY);
    };
    // Desktop: when the mouse leaves, ease the cluster away. Touch deliberately
    // does NOT reset on lift — the gather stays where you last touched so it's
    // visible on a phone (no hover to keep it alive).
    const onLeave = () => {
      targetX = -9999;
      targetY = -9999;
      kick();
    };

    readInk();
    resize(); // draws the initial faint grid

    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onLeave, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("resize", resize);
    const themeObserver = new MutationObserver(() => {
      readInk();
      frame();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onLeave);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("resize", resize);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-0 left-1/2 top-0 -z-10 w-screen -translate-x-1/2"
      style={{
        maskImage:
          "linear-gradient(to bottom, transparent 0%, #000 7%, #000 88%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, #000 7%, #000 88%, transparent 100%)",
      }}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
