import { CHROMA_KEY_HEX, chromaKeyToTransparentPng } from "./chroma-key";
import { buildSpriteSheetSuffix } from "./sprite";
import { realignSpriteFrames } from "./sprite-realign";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

const TEXT_MODEL = "openai/gpt-5.6-luna";
const IMAGE_MODEL = "openai/gpt-image-2.5-flare";

const TRANSPARENT_BG_SUFFIX =
  "Background: fully transparent. Render the background pixels with alpha 0 (a genuine transparent PNG alpha channel, like a game sprite asset) — not white, not a color fill, not a checkerboard pattern, not a gradient.";

const CHROMA_KEY_BG_SUFFIX = `Background: fill the ENTIRE background area with one single, perfectly flat, completely uniform, unbroken solid chroma-key color: ${CHROMA_KEY_HEX} (pure magenta/pink) — a solid opaque studio background paint, like a photography green-screen. This is NOT a representation of transparency, so do NOT draw a checkerboard pattern or any transparency icon, and do NOT use any gradient, texture, vignette, or scenery. Every background pixel must be that exact flat magenta color. The subject itself must never use this magenta/pink color anywhere.`;

// Cached per-process: whether OpenRouter's current provider for IMAGE_MODEL
// actually accepts background:"transparent", so repeat calls in the same
// warm serverless instance skip straight to whichever strategy works
// instead of re-probing every time.
let nativeTransparentSupport: "unknown" | "yes" | "no" = "unknown";

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
  prompt: string;
  aspectRatio: string;
  quality: string;
  background: "transparent" | "opaque";
  referenceImages?: string[];
}): Promise<ImagesApiResult> {
  const res = await fetch(`${OPENROUTER_BASE}/images`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio,
      quality: params.quality,
      background: params.background,
      n: 1,
      ...(params.referenceImages?.length
        ? { input_references: params.referenceImages.map((url) => ({ type: "image_url", image_url: { url } })) }
        : {}),
    }),
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

export async function generateImage(params: {
  prompt: string;
  aspectRatio?: string;
  quality?: string;
  /** true = default idle-loop sprite sheet; a string = custom motion description (e.g. an ability action) */
  spriteSheet?: boolean | string;
  /**
   * How hard to snap each frame's mass center onto its cell center (0-1,
   * default 0.8). Idle loops have no intentional center-of-mass movement,
   * so a high strength is safe; an ability/attack animation intentionally
   * shifts mass, so pass something lower (e.g. 0.5) or full alignment will
   * cancel out the real motion along with the drift.
   */
  alignStrength?: number;
  /** Image-to-image reference(s), e.g. an existing monster sprite sheet to keep the design consistent */
  referenceImages?: string[];
}): Promise<string> {
  const aspectRatio = params.aspectRatio ?? "1:1";
  const quality = params.quality ?? "high";
  const basePrompt = params.spriteSheet
    ? `${params.prompt} ${buildSpriteSheetSuffix(typeof params.spriteSheet === "string" ? params.spriteSheet : undefined)}`
    : params.prompt;

  if (nativeTransparentSupport !== "no") {
    const transparentResult = await requestImage({
      prompt: `${basePrompt} ${TRANSPARENT_BG_SUFFIX}`,
      aspectRatio,
      quality,
      background: "transparent",
      referenceImages: params.referenceImages,
    });
    if (transparentResult.ok) {
      nativeTransparentSupport = "yes";
      const raw = `data:image/png;base64,${transparentResult.b64}`;
      return params.spriteSheet ? realignSpriteFrames(raw, params.alignStrength ?? 0.8) : raw;
    }
    nativeTransparentSupport = "no";
    console.warn(
      `OpenRouter rejected background:"transparent" (status ${transparentResult.status}), falling back to chroma-key: ${transparentResult.body.slice(0, 300)}`
    );
  }

  const chromaResult = await requestImage({
    prompt: `${basePrompt} ${CHROMA_KEY_BG_SUFFIX}`,
    aspectRatio,
    quality,
    background: "opaque",
    referenceImages: params.referenceImages,
  });
  if (!chromaResult.ok) {
    throw new Error(`OpenRouter image error ${chromaResult.status}: ${chromaResult.body.slice(0, 500)}`);
  }

  const rawBuffer = Buffer.from(chromaResult.b64, "base64");
  const transparentBuffer = await chromaKeyToTransparentPng(rawBuffer);
  const transparentDataUrl = `data:image/png;base64,${transparentBuffer.toString("base64")}`;
  return params.spriteSheet ? realignSpriteFrames(transparentDataUrl, params.alignStrength ?? 0.8) : transparentDataUrl;
}
