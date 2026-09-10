import { CHROMA_KEY_HEX, chromaKeyToTransparentPng } from "./chroma-key";
import { authHeaders, OPENROUTER_BASE } from "./openrouter-client";

const TEXT_MODEL = "openai/gpt-5.6-luna";
const IMAGE_MODEL = "openai/gpt-image-2.5-flare";

const CHROMA_KEY_BG_SUFFIX = `Background: fill the ENTIRE background area with one single, perfectly flat, completely uniform, unbroken solid chroma-key color: ${CHROMA_KEY_HEX} (pure magenta/pink) — a solid opaque studio background paint, like a photography green-screen. This is NOT a representation of transparency, so do NOT draw a checkerboard pattern or any transparency icon, and do NOT use any gradient, texture, vignette, or scenery. Every background pixel must be that exact flat magenta color. The subject itself must never use this magenta/pink color anywhere.`;

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
  background: "opaque";
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

// Generates a single still image (a chroma-keyed transparent PNG) — used
// for the "reference pose" stills that feed the video-generation step (see
// lib/video-api.ts), not for animation directly anymore.
export async function generateImage(params: {
  prompt: string;
  aspectRatio?: string;
  quality?: string;
  /** Image-to-image reference(s), e.g. an existing monster still to keep the design consistent */
  referenceImages?: string[];
}): Promise<string> {
  const aspectRatio = params.aspectRatio ?? "1:1";
  const quality = params.quality ?? "high";

  // We tried background:"transparent" first here for a while, but this
  // account's OpenRouter routing for IMAGE_MODEL hard-rejects it every time
  // (400: "Accepted: auto, opaque") — so on a cold serverless instance that
  // was a full wasted image-generation round trip before falling back to
  // the chroma-key path that actually works, roughly doubling latency. Go
  // straight to chroma-key.
  const chromaResult = await requestImage({
    prompt: `${params.prompt} ${CHROMA_KEY_BG_SUFFIX}`,
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
  return `data:image/png;base64,${transparentBuffer.toString("base64")}`;
}
