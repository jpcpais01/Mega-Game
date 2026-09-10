import "server-only";
import sharp from "sharp";
import { chromaKeyToTransparentPng } from "./chroma-key";
import { VIDEO_SPRITE_FRAME_COUNT, VIDEO_SPRITE_GRID_COLS, VIDEO_SPRITE_GRID_ROWS } from "./sprite";

// Per-frame square size inside the assembled sheet. Kept modest on purpose:
// the sheet holds VIDEO_SPRITE_FRAME_COUNT frames (50) rather than the old
// single-image sheets' 4-9, and this sheet travels back to the client as a
// base64 JSON response body — the exact same request-size limit that broke
// the ability-save round trip applies to large *responses* too, so this
// stays deliberately smaller than that incident's image.
const CELL_SIZE = 192;

// Turns the raw frames extracted from the generated video into one
// transparent-background sprite sheet: chroma-key each frame individually
// (the video's magenta backdrop can drift slightly frame to frame, unlike a
// single generated image, so keying per-frame is what actually handles
// that), then pack them into the fixed grid.
export async function framesToSpriteSheet(frames: Buffer[]): Promise<string> {
  if (frames.length === 0) {
    throw new Error("framesToSpriteSheet: no frames given");
  }

  // Normalize to exactly VIDEO_SPRITE_FRAME_COUNT so the fixed grid always
  // has a frame in every cell: video generation can land a frame or two
  // short of (or over) the target duration*fps.
  const normalized = frames.slice(0, VIDEO_SPRITE_FRAME_COUNT);
  while (normalized.length < VIDEO_SPRITE_FRAME_COUNT) {
    normalized.push(normalized[normalized.length - 1]);
  }

  const cells = await Promise.all(
    normalized.map(async (frame) => {
      const keyed = await chromaKeyToTransparentPng(frame);
      return sharp(keyed)
        .resize(CELL_SIZE, CELL_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
    })
  );

  const sheetWidth = CELL_SIZE * VIDEO_SPRITE_GRID_COLS;
  const sheetHeight = CELL_SIZE * VIDEO_SPRITE_GRID_ROWS;

  const composite = cells.map((input, i) => ({
    input,
    left: (i % VIDEO_SPRITE_GRID_COLS) * CELL_SIZE,
    top: Math.floor(i / VIDEO_SPRITE_GRID_COLS) * CELL_SIZE,
  }));

  const sheet = await sharp({
    create: { width: sheetWidth, height: sheetHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composite)
    .png({ compressionLevel: 9 })
    .toBuffer();

  return `data:image/png;base64,${sheet.toString("base64")}`;
}
