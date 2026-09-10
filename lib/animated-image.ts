import "server-only";
import sharp from "sharp";
import { chromaKeyToTransparentPng } from "./chroma-key";

// Square size each frame is resized to before being packed into the
// animated file. Kept modest since the encoded result travels back to the
// client as a base64 JSON response body — the same request-size limit that
// broke the ability-save round trip once applies to large *responses* too.
const FRAME_SIZE = 224;

// Turns the raw frames extracted from a generated video into a single real
// animated, transparent-background image (WebP) — no sprite sheet, no
// grid, no client-side slicing. Each frame is chroma-keyed individually
// (the video's magenta backdrop can drift slightly frame to frame, unlike a
// single generated still, so keying per-frame is what actually handles
// that), resized to a common size, then encoded as one animated WebP that
// browsers decode and loop natively via a plain <img> tag.
export async function framesToAnimatedWebp(frames: Buffer[], fps: number): Promise<string> {
  if (frames.length === 0) {
    throw new Error("framesToAnimatedWebp: no frames given");
  }

  const rawFrames = await Promise.all(
    frames.map(async (frame) => {
      const keyed = await chromaKeyToTransparentPng(frame);
      return sharp(keyed)
        .resize(FRAME_SIZE, FRAME_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .ensureAlpha()
        .raw()
        .toBuffer();
    })
  );

  const stacked = Buffer.concat(rawFrames);
  const delayMs = Math.round(1000 / fps);

  const webp = await sharp(stacked, {
    raw: { width: FRAME_SIZE, height: FRAME_SIZE * rawFrames.length, channels: 4, pageHeight: FRAME_SIZE },
    animated: true,
  })
    .webp({ quality: 82, effort: 4, loop: 0, delay: new Array(rawFrames.length).fill(delayMs) })
    .toBuffer();

  return `data:image/webp;base64,${webp.toString("base64")}`;
}
