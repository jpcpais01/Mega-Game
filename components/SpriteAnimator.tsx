"use client";

import { useEffect, useRef } from "react";
import { SPRITE_FPS, SPRITE_GRID_COLS, SPRITE_GRID_ROWS, SPRITE_FRAME_COUNT } from "@/lib/sprite";

export default function SpriteAnimator({
  imageDataUrl,
  size = 280,
  fps = SPRITE_FPS,
}: {
  imageDataUrl: string;
  size?: number;
  fps?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let cancelled = false;
    let lastFrame = -1;
    const img = new Image();

    img.onload = () => {
      if (cancelled) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      ctx.imageSmoothingEnabled = false;

      const frameW = img.naturalWidth / SPRITE_GRID_COLS;
      const frameH = img.naturalHeight / SPRITE_GRID_ROWS;
      const startTime = performance.now();

      function draw(now: number) {
        if (cancelled) return;
        const elapsed = (now - startTime) / 1000;
        const frame = Math.floor(elapsed * fps) % SPRITE_FRAME_COUNT;

        if (frame !== lastFrame) {
          lastFrame = frame;
          const col = frame % SPRITE_GRID_COLS;
          const row = Math.floor(frame / SPRITE_GRID_COLS);
          ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
          ctx!.drawImage(
            img,
            col * frameW,
            row * frameH,
            frameW,
            frameH,
            0,
            0,
            canvas!.width,
            canvas!.height
          );
        }

        raf = requestAnimationFrame(draw);
      }

      raf = requestAnimationFrame(draw);
    };

    img.src = imageDataUrl;

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [imageDataUrl, size, fps]);

  return <canvas ref={canvasRef} className="block" style={{ imageRendering: "pixelated" }} />;
}
