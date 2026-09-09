const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

const TEXT_MODEL = "openai/gpt-5.6-luna";
const IMAGE_MODEL = "openai/gpt-image-2.5-flare";

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

export async function generateImage(params: {
  prompt: string;
  aspectRatio?: string;
  quality?: string;
}): Promise<string> {
  const res = await fetch(`${OPENROUTER_BASE}/images`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio ?? "1:1",
      quality: params.quality ?? "high",
      background: "transparent",
      n: 1,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenRouter image error ${res.status}: ${errText.slice(0, 500)}`);
  }

  const json = await res.json();
  const image = json?.data?.[0];
  if (!image?.b64_json) {
    throw new Error("OpenRouter image response missing b64_json");
  }
  const mediaType = image.media_type ?? "image/png";
  return `data:${mediaType};base64,${image.b64_json}`;
}
