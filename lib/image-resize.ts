import "server-only";
import sharp from "sharp";

const DATA_URL_RE = /^data:([^;]+);base64,([\s\S]*)$/;

// Firebase Storage needs the paid Blaze plan, so sprite sheets are stored
// directly as data URLs in Firestore instead. A single monster document
// holds up to 3 of these (egg + monster + learned-ability sprite sheets)
// and Firestore caps a whole document at 1 MiB, so each image needs to stay
// well under that. Pixel art compresses extremely well (flat colors, few
// distinct pixels), so downscaling + palette-quantized PNG gets us there
// comfortably without visibly hurting the blocky pixel-art look — nearest
// -neighbor resizing keeps hard pixel edges instead of blurring them.
const CANDIDATE_DIMENSIONS = [512, 384, 256, 192];
const TARGET_MAX_BASE64_CHARS = 280_000; // ~210KB raw, leaves headroom for 3 images + metadata in one 1MiB doc

export async function shrinkDataUrlForFirestore(dataUrl: string): Promise<string> {
  const match = dataUrl.match(DATA_URL_RE);
  if (!match) {
    throw new Error("shrinkDataUrlForFirestore: input is not a data URL");
  }
  const buffer = Buffer.from(match[2], "base64");

  let last = "";
  for (const dim of CANDIDATE_DIMENSIONS) {
    const resized = await sharp(buffer)
      .resize(dim, dim, { kernel: "nearest" })
      .png({ palette: true, compressionLevel: 9 })
      .toBuffer();
    last = resized.toString("base64");
    if (last.length <= TARGET_MAX_BASE64_CHARS) {
      return `data:image/png;base64,${last}`;
    }
  }
  // Smallest candidate still over budget — use it anyway rather than fail outright;
  // the Firestore write itself will error clearly if it's truly too large.
  return `data:image/png;base64,${last}`;
}
