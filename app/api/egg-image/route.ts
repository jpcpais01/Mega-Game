import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 60;

// Generates the egg's final art — a single still (already chroma-keyed to
// transparent by generateImage()). Eggs are never animated: only the
// monster, once hatched, goes through the video-generation pipeline.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const imagePrompt: unknown = body?.imagePrompt;

    if (typeof imagePrompt !== "string" || !imagePrompt.trim()) {
      return NextResponse.json({ error: "imagePrompt is required" }, { status: 400 });
    }

    const imageDataUrl = await generateImage({ prompt: imagePrompt });
    return NextResponse.json({ imageDataUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error rendering egg image";
    console.error("egg-image error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
