import sharp from "sharp";

// This image provider doesn't emit real alpha transparency, and asking for
// "transparent background" in the prompt just makes the model paint a
// literal checkerboard (the visual convention editors use to *display*
// transparency) as actual pixels. So instead we ask for a flat, unmistakable
// solid fill color and strip it out ourselves. Pure magenta is picked
// because it's far in color-space from every essence's palette (fire,
// water, earth, ... none land near pure magenta/pink at this distance).
export const CHROMA_KEY_COLOR = { r: 255, g: 0, b: 255 };
export const CHROMA_KEY_HEX = "#FF00FF";

// Different image models don't all paint the background as precisely pure
// magenta as the original tuning assumed — a lighter/darker or hue-shifted
// render can fall outside a too-narrow keying zone entirely and stay fully
// opaque, leaving a visible pink/purple background. Widened to 0-155: the
// closest real essence color to magenta is "sonic" (hot pink) at a measured
// distance of ~145, so a "sonic" creature's edge pixels can dip into the
// tail of the feather band (a very slight, spill-corrected softening) —
// an acceptable trade against a background that doesn't fully clear.
const THRESHOLD = 90; // color distance below this is fully transparent
const FEATHER = 65; // distance band above THRESHOLD that ramps alpha back in, to soften edges

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export async function chromaKeyToTransparentPng(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const dist = Math.sqrt(
      (r - CHROMA_KEY_COLOR.r) ** 2 + (g - CHROMA_KEY_COLOR.g) ** 2 + (b - CHROMA_KEY_COLOR.b) ** 2
    );

    let alphaMultiplier = 1;
    if (dist < THRESHOLD) {
      alphaMultiplier = 0;
    } else if (dist < THRESHOLD + FEATHER) {
      alphaMultiplier = (dist - THRESHOLD) / FEATHER;
    }

    // A partially-keyed edge pixel (anti-aliasing between the subject and
    // the magenta backdrop) is a genuine color blend, not just a see-through
    // one — its RGB still contains magenta. Thinning only the alpha leaves
    // that magenta baked into the visible color, which shows up as a
    // pink/purple fringe once composited over the app's UI. Un-premultiply
    // it: solve for the foreground color assuming
    // observed = alpha*fg + (1-alpha)*magenta.
    if (alphaMultiplier > 0 && alphaMultiplier < 1) {
      const spillR = (1 - alphaMultiplier) * CHROMA_KEY_COLOR.r;
      const spillG = (1 - alphaMultiplier) * CHROMA_KEY_COLOR.g;
      const spillB = (1 - alphaMultiplier) * CHROMA_KEY_COLOR.b;
      data[i] = clamp255((r - spillR) / alphaMultiplier);
      data[i + 1] = clamp255((g - spillG) / alphaMultiplier);
      data[i + 2] = clamp255((b - spillB) / alphaMultiplier);
    }

    data[i + 3] = Math.round(data[i + 3] * alphaMultiplier);
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}
