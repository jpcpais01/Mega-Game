import { NextRequest, NextResponse } from "next/server";
import { GRID_TEMPLATE_INSTRUCTION, gridAlignmentTemplate } from "@/lib/grid-template";
import { generateImage } from "@/lib/openrouter";
import { abilityAnimationMotion, abilityAnimationPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const monsterName: unknown = body?.monsterName;
    const monsterImageDataUrl: unknown = body?.monsterImageDataUrl;
    const abilityName: unknown = body?.abilityName;
    const abilityDescription: unknown = body?.abilityDescription;

    if (
      typeof monsterName !== "string" ||
      typeof monsterImageDataUrl !== "string" ||
      !monsterImageDataUrl.startsWith("data:") ||
      typeof abilityName !== "string" ||
      typeof abilityDescription !== "string"
    ) {
      return NextResponse.json(
        { error: "monsterName, monsterImageDataUrl, abilityName, abilityDescription are required" },
        { status: 400 }
      );
    }

    const template = await gridAlignmentTemplate();
    const imageDataUrl = await generateImage({
      prompt: `${abilityAnimationPrompt({ monsterName, abilityName, abilityDescription })} ${GRID_TEMPLATE_INSTRUCTION}`,
      referenceImages: [monsterImageDataUrl, template],
      spriteSheet: abilityAnimationMotion({ abilityName, abilityDescription }),
    });

    return NextResponse.json({ imageDataUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error rendering ability animation";
    console.error("ability error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
