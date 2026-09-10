import "server-only";
import sharp from "sharp";
import { SPRITE_GRID_COLS, SPRITE_GRID_ROWS } from "./sprite";

const DATA_URL_RE = /^data:([^;]+);base64,([\s\S]*)$/;

// Ceiling on the FULL (pre-strength) computed shift, as a fraction of cell
// size. At strength=1 (the idle default) this is the real limit on how far
// a frame gets nudged — not just a rare-case safety net.
const MAX_SHIFT_FRACTION_OF_CELL = 0.2;

// Prompting the model to "align everything perfectly" only ever gets it
// approximately right — the subject still drifts a few pixels between
// cells. This corrects the actual pixel data instead of asking nicely: for
// each frame, compute the alpha-weighted centroid ("mass center") of its
// non-transparent pixels, then shift that frame's content toward the cell's
// exact geometric center.
//
// `strength` (0-1) controls how much of that correction to actually apply:
// 0 leaves frames untouched, 1 snaps every centroid exactly onto the cell
// center. An idle animation isn't supposed to have any real center-of-mass
// movement, so it can use a strength close to 1 — any centroid drift there
// is pure model inconsistency. An attack/ability animation, though,
// *intentionally* shifts mass (a lunge, an outstretched arm), so full
// alignment there would cancel out the real motion along with the
// unwanted jitter — a lower strength (e.g. 0.5) damps drift while letting
// the intended movement mostly through.
export async function realignSpriteFrames(dataUrl: string, strength: number = 1): Promise<string> {
  const match = dataUrl.match(DATA_URL_RE);
  if (!match) {
    throw new Error("realignSpriteFrames: input is not a data URL");
  }
  const clampedStrength = Math.max(0, Math.min(1, strength));

  const { data, info } = await sharp(Buffer.from(match[2], "base64"))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const cellW = width / SPRITE_GRID_COLS;
  const cellH = height / SPRITE_GRID_ROWS;
  const maxFullShift = Math.min(cellW, cellH) * MAX_SHIFT_FRACTION_OF_CELL;

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

      let fullShiftX = targetX - centroidX;
      let fullShiftY = targetY - centroidY;
      fullShiftX = Math.max(-maxFullShift, Math.min(maxFullShift, fullShiftX));
      fullShiftY = Math.max(-maxFullShift, Math.min(maxFullShift, fullShiftY));

      const shiftX = Math.round(fullShiftX * clampedStrength);
      const shiftY = Math.round(fullShiftY * clampedStrength);

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
