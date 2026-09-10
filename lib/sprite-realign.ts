import "server-only";
import sharp from "sharp";
import { SPRITE_GRID_COLS, SPRITE_GRID_ROWS } from "./sprite";

const DATA_URL_RE = /^data:([^;]+);base64,([\s\S]*)$/;

// Prompting the model to "align everything perfectly" only ever gets it
// approximately right — the subject still drifts a few pixels between
// cells. This corrects the actual pixel data instead of asking nicely: for
// each frame, compute the alpha-weighted centroid ("mass center") of its
// non-transparent pixels, then shift that frame's content so the centroid
// lands on the cell's exact geometric center. Every frame ends up centered
// on the same point regardless of how the model drew it.
export async function realignSpriteFrames(dataUrl: string): Promise<string> {
  const match = dataUrl.match(DATA_URL_RE);
  if (!match) {
    throw new Error("realignSpriteFrames: input is not a data URL");
  }

  const { data, info } = await sharp(Buffer.from(match[2], "base64"))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const cellW = width / SPRITE_GRID_COLS;
  const cellH = height / SPRITE_GRID_ROWS;
  const maxShift = Math.min(cellW, cellH) * 0.2; // safety clamp against pathological frames

  const out = Buffer.alloc(data.length); // zeroed = fully transparent everywhere by default

  for (let row = 0; row < SPRITE_GRID_ROWS; row++) {
    for (let col = 0; col < SPRITE_GRID_COLS; col++) {
      const x0 = Math.round(col * cellW);
      const y0 = Math.round(row * cellH);
      const x1 = Math.round((col + 1) * cellW);
      const y1 = Math.round((row + 1) * cellH);

      let sumAlpha = 0;
      let sumX = 0;
      let sumY = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const alpha = data[(y * width + x) * channels + 3];
          if (alpha === 0) continue;
          sumAlpha += alpha;
          sumX += alpha * x;
          sumY += alpha * y;
        }
      }

      if (sumAlpha === 0) continue; // empty frame — nothing to align

      const centroidX = sumX / sumAlpha;
      const centroidY = sumY / sumAlpha;
      const targetX = x0 + (x1 - x0) / 2;
      const targetY = y0 + (y1 - y0) / 2;
      let shiftX = Math.round(targetX - centroidX);
      let shiftY = Math.round(targetY - centroidY);
      shiftX = Math.max(-maxShift, Math.min(maxShift, shiftX));
      shiftY = Math.max(-maxShift, Math.min(maxShift, shiftY));

      for (let y = y0; y < y1; y++) {
        const srcY = y - shiftY;
        if (srcY < y0 || srcY >= y1) continue;
        for (let x = x0; x < x1; x++) {
          const srcX = x - shiftX;
          if (srcX < x0 || srcX >= x1) continue;
          const srcIdx = (srcY * width + srcX) * channels;
          const dstIdx = (y * width + x) * channels;
          for (let c = 0; c < channels; c++) out[dstIdx + c] = data[srcIdx + c];
        }
      }
    }
  }

  const png = await sharp(out, { raw: { width, height, channels } }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}
