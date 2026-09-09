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

const THRESHOLD = 60; // color distance below this is fully transparent
const FEATHER = 45; // distance band above THRESHOLD that ramps alpha back in, to soften edges

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

    data[i + 3] = Math.round(data[i + 3] * alphaMultiplier);
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}
