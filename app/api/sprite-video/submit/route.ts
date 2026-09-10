import { NextRequest, NextResponse } from "next/server";
import { abilitySpriteVideoPrompt, idleSpriteVideoPrompt } from "@/lib/prompts";
import { submitVideoJob } from "@/lib/video-api";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const stillImageDataUrl: unknown = body?.stillImageDataUrl;
    const kind: unknown = body?.kind;

    if (typeof stillImageDataUrl !== "string" || !stillImageDataUrl.startsWith("data:")) {
      return NextResponse.json({ error: "stillImageDataUrl is required" }, { status: 400 });
    }

    let prompt: string;
    if (kind === "ability") {
      const monsterName: unknown = body?.monsterName;
      const abilityName: unknown = body?.abilityName;
      const abilityDescription: unknown = body?.abilityDescription;
      if (typeof monsterName !== "string" || typeof abilityName !== "string" || typeof abilityDescription !== "string") {
        return NextResponse.json(
          { error: "monsterName, abilityName, abilityDescription are required for kind=ability" },
          { status: 400 }
        );
      }
      prompt = abilitySpriteVideoPrompt({ monsterName, abilityName, abilityDescription });
    } else if (kind === "idle") {
      prompt = idleSpriteVideoPrompt();
    } else {
      return NextResponse.json({ error: "kind must be 'idle' or 'ability'" }, { status: 400 });
    }

    const jobId = await submitVideoJob({
      prompt,
      firstFrameImageDataUrl: stillImageDataUrl,
      duration: 5,
      resolution: "480p",
      aspectRatio: "1:1",
    });

    return NextResponse.json({ jobId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error submitting sprite video job";
    console.error("sprite-video submit error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
