import sharp from "sharp";
import { CHROMA_KEY_HEX, chromaKeyToTransparentPng } from "./chroma-key";
import { DEFAULT_IMAGE_MODEL, ImageModelId } from "./image-models";
import { buildSpriteSheetSuffix } from "./sprite";
import { realignSpriteFrames } from "./sprite-realign";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

const TEXT_MODEL = "openai/gpt-5.6-luna";

// Gemini's Image API has no `quality` field — it takes a resolution tier
// instead. Map our app-wide quality intent onto the closest tier.
function resolutionForQuality(quality: string): "512" | "1K" | "2K" | "4K" {
  if (quality === "low") return "512";
  if (quality === "high") return "2K";
  return "1K";
}

const CHROMA_KEY_BG_SUFFIX = `Background: fill the ENTIRE background area with one single, perfectly flat, completely uniform, unbroken solid chroma-key color: ${CHROMA_KEY_HEX} (pure magenta/pink) — a solid opaque studio background paint, like a photography green-screen. This is NOT a representation of transparency, so do NOT draw a checkerboard pattern or any transparency icon, and do NOT use any gradient, texture, vignette, or scenery. Every background pixel must be that exact flat magenta color. The subject itself must never use this magenta/pink color anywhere.`;

// Real background:"transparent" beats the magenta/chroma-key trick outright
// (no fringe, no post-processing) when a provider actually honors it. The
// original default model's OpenRouter routing hard-rejects it every time
// (400: "Accepted: auto, opaque"), confirmed by testing — Gemini's Image API
// doesn't list `background` as an accepted field at all, so it can never use
// it either. The two newer GPT Image models' docs are ambiguous (their enum
// only shows "auto"|"opaque", but the description still references a
// transparent mode needing png/webp output), so we actually try it for
// those and fall back to the proven chroma-key path if the provider refuses.
const MODELS_THAT_MIGHT_SUPPORT_TRANSPARENT = new Set<ImageModelId>([
  "openai/gpt-image-2",
  "openai/gpt-image-2.5-sunburst",
]);

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to your environment (.env.local or Vercel project settings)."
    );
  }
  return key;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://mega-game.app",
    "X-Title": "Mega Game",
  };
}

function extractJson(raw: string): unknown {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Model did not return JSON: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export async function callChatJSON(params: {
  system: string;
  userText: string;
  userImageDataUrl?: string;
  model?: string;
}): Promise<unknown> {
  const content: ChatContentPart[] = [{ type: "text", text: params.userText }];
  if (params.userImageDataUrl) {
    content.push({ type: "image_url", image_url: { url: params.userImageDataUrl } });
  }

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: params.model ?? TEXT_MODEL,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
      temperature: 0.9,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenRouter chat error ${res.status}: ${errText.slice(0, 500)}`);
  }

  const json = await res.json();
  const message = json?.choices?.[0]?.message?.content;
  if (typeof message !== "string") {
    throw new Error("OpenRouter chat response missing message content");
  }
  return extractJson(message);
}

type ImagesApiResult = { ok: true; b64: string } | { ok: false; status: number; body: string };

async function requestImage(params: {
  model: ImageModelId;
  prompt: string;
  aspectRatio: string;
  quality: string;
  background?: "opaque" | "transparent";
  referenceImages?: string[];
}): Promise<ImagesApiResult> {
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    aspect_ratio: params.aspectRatio,
    n: 1,
    ...(params.referenceImages?.length
      ? { input_references: params.referenceImages.map((url) => ({ type: "image_url", image_url: { url } })) }
      : {}),
  };

  // Gemini's Image API doesn't accept `quality` or `background` at all —
  // an unlisted field is rejected outright, so build its body separately
  // from the OpenAI-shaped models instead of always sending both fields.
  if (params.model === "google/gemini-3.1-flash-image") {
    body.resolution = resolutionForQuality(params.quality);
  } else {
    body.quality = params.quality;
    body.background = params.background ?? "opaque";
  }

  const res = await fetch(`${OPENROUTER_BASE}/images`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, status: res.status, body: errText };
  }

  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (typeof b64 !== "string") {
    return { ok: false, status: res.status, body: "response missing b64_json" };
  }
  return { ok: true, b64 };
}

// A provider can accept background:"transparent" (200 OK) without actually
// honoring it — some silently render a normal opaque image instead. Check
// the four corners, which should always land on background: if none of them
// are actually transparent, treat the whole attempt as failed rather than
// shipping a monster with a baked-in solid background.
async function looksTransparent(pngBytes: Buffer): Promise<boolean> {
  const { data, info } = await sharp(pngBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const corners = [
    0,
    (width - 1) * channels,
    (height - 1) * width * channels,
    ((height - 1) * width + (width - 1)) * channels,
  ];
  return corners.every((offset) => data[offset + 3] < 250);
}

export async function generateImage(params: {
  prompt: string;
  model?: ImageModelId;
  aspectRatio?: string;
  quality?: string;
  /** true = default idle-loop sprite sheet; a string = custom motion description (e.g. an ability action) */
  spriteSheet?: boolean | string;
  /**
   * How hard to snap each frame's mass center onto its cell center (0-1,
   * default 1 = full correction). Idle loops have no intentional
   * center-of-mass movement, so full alignment is safe; an ability/attack
   * animation intentionally shifts mass, so pass something lower (e.g. 0.5)
   * or full alignment will cancel out the real motion along with the drift.
   */
  alignStrength?: number;
  /** Image-to-image reference(s), e.g. an existing monster sprite sheet to keep the design consistent */
  referenceImages?: string[];
}): Promise<string> {
  const model = params.model ?? DEFAULT_IMAGE_MODEL;
  const aspectRatio = params.aspectRatio ?? "1:1";
  const quality = params.quality ?? "high";
  const basePrompt = params.spriteSheet
    ? `${params.prompt} ${buildSpriteSheetSuffix(typeof params.spriteSheet === "string" ? params.spriteSheet : undefined)}`
    : params.prompt;

  if (MODELS_THAT_MIGHT_SUPPORT_TRANSPARENT.has(model)) {
    // No magenta/checkerboard instruction here — asking for it in the prompt
    // text on top of the API's own transparent mode just confuses the
    // model, so leave the prompt as-is and let the parameter do the work.
    const transparentResult = await requestImage({
      model,
      prompt: basePrompt,
      aspectRatio,
      quality,
      background: "transparent",
      referenceImages: params.referenceImages,
    });
    if (transparentResult.ok) {
      const rawBuffer = Buffer.from(transparentResult.b64, "base64");
      const pngBuffer = await sharp(rawBuffer).ensureAlpha().png().toBuffer();
      if (await looksTransparent(pngBuffer)) {
        const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
        return params.spriteSheet ? realignSpriteFrames(dataUrl, params.alignStrength ?? 1) : dataUrl;
      }
    }
    // Provider rejected the param, or accepted it without actually honoring
    // it — fall through to the proven magenta/chroma-key path below.
  }

  const chromaResult = await requestImage({
    model,
    prompt: `${basePrompt} ${CHROMA_KEY_BG_SUFFIX}`,
    aspectRatio,
    quality,
    referenceImages: params.referenceImages,
  });
  if (!chromaResult.ok) {
    throw new Error(`OpenRouter image error ${chromaResult.status}: ${chromaResult.body.slice(0, 500)}`);
  }

  const rawBuffer = Buffer.from(chromaResult.b64, "base64");
  const transparentBuffer = await chromaKeyToTransparentPng(rawBuffer);
  const transparentDataUrl = `data:image/png;base64,${transparentBuffer.toString("base64")}`;
  return params.spriteSheet ? realignSpriteFrames(transparentDataUrl, params.alignStrength ?? 1) : transparentDataUrl;
}
