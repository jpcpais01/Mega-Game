import { NextRequest, NextResponse } from "next/server";
import { EGG_GRID_TEMPLATE_INSTRUCTION, eggGridAlignmentTemplate } from "@/lib/grid-template";
import { resolveImageModel } from "@/lib/image-models";
import { generateImage } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const imagePrompt: unknown = body?.imagePrompt;
    const imageModel = resolveImageModel(body?.imageModel);

    if (typeof imagePrompt !== "string" || !imagePrompt.trim()) {
      return NextResponse.json({ error: "imagePrompt is required" }, { status: 400 });
    }

    const template = await eggGridAlignmentTemplate();
    const imageDataUrl = await generateImage({
      prompt: `${imagePrompt} ${EGG_GRID_TEMPLATE_INSTRUCTION}`,
      model: imageModel,
      referenceImages: [template],
      spriteSheet: true,
    });
    return NextResponse.json({ imageDataUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error rendering egg image";
    console.error("egg-image error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
