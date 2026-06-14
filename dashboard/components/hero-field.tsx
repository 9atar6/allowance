"use client";

import { useEffect, useRef } from "react";

/**
 * The hero's living background: a fine grid of ink dots on paper that swell and
 * lean toward the cursor, like iron filings on engraved banknote stock. No
 * color, no glow — the ink and the paper are the whole palette. Static (no
 * pointer, no animation) under prefers-reduced-motion.
 */
export function HeroField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const GAP = 30; // dot spacing
    const REACH = 150; // px of cursor influence
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;

    // Pointer target + an eased follower so the field glides, never snaps.
    let targetX = -9999;
    let targetY = -9999;
    let curX = -9999;
    let curY = -9999;

    // Ink color, re-read when the theme class flips.
    let ink = "25, 28, 25";
    const readInk = () => {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue("--ink")
        .trim();
      // --ink is a hex; convert to "r, g, b" for rgba alpha control.
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
    };

    const draw = () => {
      curX += (targetX - curX) * 0.1;
      curY += (targetY - curY) * 0.1;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          const x = i * GAP;
          const y = j * GAP;
          const dx = curX - x;
          const dy = curY - y;
          const dist = Math.hypot(dx, dy);
          // Base: a faint dot. Near the cursor: swell, darken, lean in.
          let r = 0.9;
          let alpha = 0.1;
          let ox = 0;
          let oy = 0;
          if (dist < REACH) {
            const f = 1 - dist / REACH; // 0..1
            r += f * 1.8;
            alpha += f * 0.5;
            const pull = f * 6;
            ox = (dx / (dist || 1)) * pull;
            oy = (dy / (dist || 1)) * pull;
          }
          ctx.beginPath();
          ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${ink}, ${alpha})`;
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };

    let raf = 0;
    const setTarget = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      targetX = clientX - rect.left;
      targetY = clientY - rect.top;
    };
    const onMove = (e: PointerEvent) => setTarget(e.clientX, e.clientY);
    // Touch: follow the finger while it's down (passive — page scroll is never
    // blocked). iOS doesn't reliably emit pointermove for touch, so handle it
    // explicitly. The cluster fades out when the finger lifts.
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) setTarget(t.clientX, t.clientY);
    };
    const onLeave = () => {
      targetX = -9999;
      targetY = -9999;
    };

    readInk();
    resize();

    if (reduced) {
      // One static frame, no pointer, no loop.
      curX = -9999;
      curY = -9999;
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          ctx.beginPath();
          ctx.arc(i * GAP, j * GAP, 0.9, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${ink}, 0.1)`;
          ctx.fill();
        }
      }
      return;
    }

    raf = requestAnimationFrame(draw);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onLeave, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchend", onLeave, { passive: true });
    window.addEventListener("touchcancel", onLeave, { passive: true });
    window.addEventListener("resize", resize);
    const themeObserver = new MutationObserver(readInk);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onLeave);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onLeave);
      window.removeEventListener("touchcancel", onLeave);
      window.removeEventListener("resize", resize);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-0 left-1/2 top-0 -z-10 w-screen -translate-x-1/2"
      style={{
        // Spans the whole hero (behind the receipt too); fades in under the nav
        // and out just before the next section, so it never bleeds past it.
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
