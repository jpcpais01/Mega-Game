"use client";

import { useEffect, useRef } from "react";
import { MeshPoint } from "@/lib/types";
import { expandTriangle, idwOffset, Pt, triangleAffine } from "@/lib/mesh-warp";

const GRID_COLS = 9;
const GRID_ROWS = 9;
const BLEED_PX = 1.5;

function seededRand(seed: number) {
  let a = seed || 1;
  return function () {
    a = (a * 16807) % 2147483647;
    return (a - 1) / 2147483646;
  };
}

export default function MeshCanvas({
  imageDataUrl,
  points,
  size = 300,
}: {
  imageDataUrl: string;
  points: MeshPoint[];
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let cancelled = false;
    const img = new Image();

    img.onload = () => {
      if (cancelled) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;

      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      const scale = Math.min((size * dpr) / naturalW, (size * dpr) / naturalH);
      const drawW = naturalW * scale;
      const drawH = naturalH * scale;
      const offsetX = (size * dpr - drawW) / 2;
      const offsetY = (size * dpr - drawH) / 2;

      const amplitude = Math.min(drawW, drawH) * 0.035;

      const anchors = points.map((p, i) => {
        const rand = seededRand(i * 7919 + Math.round(p.x * 1000) + Math.round(p.y * 3000) + 17);
        return {
          norm: { x: p.x, y: p.y } as Pt,
          freq: 0.55 + rand() * 0.5,
          phase: rand() * Math.PI * 2,
          freqY: 0.5 + rand() * 0.5,
          phaseY: rand() * Math.PI * 2,
          dirX: rand() > 0.5 ? 1 : -1,
          dirY: rand() > 0.5 ? 1 : -1,
        };
      });

      function baseGridSrc(i: number, j: number): Pt {
        return { x: (i / GRID_COLS) * naturalW, y: (j / GRID_ROWS) * naturalH };
      }
      function baseGridDstNorm(i: number, j: number): Pt {
        return { x: i / GRID_COLS, y: j / GRID_ROWS };
      }
      function baseGridDst(i: number, j: number): Pt {
        return {
          x: offsetX + (i / GRID_COLS) * drawW,
          y: offsetY + (j / GRID_ROWS) * drawH,
        };
      }

      function draw(t: number) {
        if (cancelled) return;
        ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

        const controlOffsets = anchors.map((a) => ({
          pos: a.norm,
          offset: {
            x: Math.sin(t * a.freq + a.phase) * amplitude * a.dirX,
            y: Math.cos(t * a.freqY + a.phaseY) * amplitude * 0.7 * a.dirY,
          },
        }));

        const dstCache = new Map<string, Pt>();
        function dstAt(i: number, j: number): Pt {
          const key = `${i}_${j}`;
          const cached = dstCache.get(key);
          if (cached) return cached;
          const norm = baseGridDstNorm(i, j);
          const off = idwOffset(norm, controlOffsets);
          const base = baseGridDst(i, j);
          const result = { x: base.x + off.x, y: base.y + off.y };
          dstCache.set(key, result);
          return result;
        }

        for (let i = 0; i < GRID_COLS; i++) {
          for (let j = 0; j < GRID_ROWS; j++) {
            const s00 = baseGridSrc(i, j);
            const s10 = baseGridSrc(i + 1, j);
            const s01 = baseGridSrc(i, j + 1);
            const s11 = baseGridSrc(i + 1, j + 1);
            const d00 = dstAt(i, j);
            const d10 = dstAt(i + 1, j);
            const d01 = dstAt(i, j + 1);
            const d11 = dstAt(i + 1, j + 1);

            drawTriangle(ctx!, img, [s00, s10, s01], [d00, d10, d01], naturalW, naturalH);
            drawTriangle(ctx!, img, [s10, s11, s01], [d10, d11, d01], naturalW, naturalH);
          }
        }

        raf = requestAnimationFrame((next) => draw(next / 1000));
      }

      raf = requestAnimationFrame((first) => draw(first / 1000));
    };

    img.src = imageDataUrl;

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [imageDataUrl, points, size]);

  return <canvas ref={canvasRef} className="block" />;
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  src: [Pt, Pt, Pt],
  dst: [Pt, Pt, Pt],
  naturalW: number,
  naturalH: number
) {
  const m = triangleAffine(src, dst);
  if (!m) return;
  const clipDst = expandTriangle(dst, BLEED_PX);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(clipDst[0].x, clipDst[0].y);
  ctx.lineTo(clipDst[1].x, clipDst[1].y);
  ctx.lineTo(clipDst[2].x, clipDst[2].y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  ctx.drawImage(img, 0, 0, naturalW, naturalH);
  ctx.restore();
}
