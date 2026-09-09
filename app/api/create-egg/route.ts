import { NextRequest, NextResponse } from "next/server";
import { ESSENCES, MAX_ESSENCES_PER_EGG } from "@/lib/essences";
import { callChatJSON, generateImage } from "@/lib/openrouter";
import { eggCreatorSystemPrompt, eggCreatorUserPrompt } from "@/lib/prompts";
import { EggData, EggStat } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type RawEggJson = {
  eggName?: unknown;
  lore?: unknown;
  stats?: unknown;
  imagePrompt?: unknown;
};

function validateEggJson(raw: unknown): { eggName: string; lore: string; stats: EggStat[]; imagePrompt: string } {
  const data = raw as RawEggJson;
  if (typeof data.eggName !== "string" || !data.eggName.trim()) {
    throw new Error("Egg creator response missing eggName");
  }
  if (typeof data.lore !== "string") {
    throw new Error("Egg creator response missing lore");
  }
  if (typeof data.imagePrompt !== "string" || !data.imagePrompt.trim()) {
    throw new Error("Egg creator response missing imagePrompt");
  }
  if (!Array.isArray(data.stats) || data.stats.length === 0) {
    throw new Error("Egg creator response missing stats");
  }
  const stats: EggStat[] = data.stats.slice(0, 5).map((s) => {
    const stat = s as { name?: unknown; value?: unknown };
    const name = typeof stat.name === "string" && stat.name.trim() ? stat.name.trim() : "Mystery";
    const rawValue = typeof stat.value === "number" ? stat.value : Number(stat.value);
    const value = Number.isFinite(rawValue) ? Math.min(100, Math.max(1, Math.round(rawValue))) : 50;
    return { name, value };
  });
  return { eggName: data.eggName.trim(), lore: data.lore.trim(), stats, imagePrompt: data.imagePrompt.trim() };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const essenceIds: unknown = body?.essenceIds;

    if (!Array.isArray(essenceIds) || essenceIds.length === 0) {
      return NextResponse.json({ error: "essenceIds must be a non-empty array" }, { status: 400 });
    }
    if (essenceIds.length > MAX_ESSENCES_PER_EGG) {
      return NextResponse.json(
        { error: `You can combine at most ${MAX_ESSENCES_PER_EGG} essences` },
        { status: 400 }
      );
    }

    const essences = essenceIds.map((id) => {
      const found = ESSENCES.find((e) => e.id === id);
      if (!found) throw new Error(`Unknown essence id: ${id}`);
      return found;
    });

    const rawJson = await callChatJSON({
      system: eggCreatorSystemPrompt(),
      userText: eggCreatorUserPrompt(essences),
    });
    const eggJson = validateEggJson(rawJson);

    const imageDataUrl = await generateImage({ prompt: eggJson.imagePrompt });

    const egg: EggData = {
      ...eggJson,
      imageDataUrl,
      essenceIds: essences.map((e) => e.id),
    };

    return NextResponse.json(egg);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error creating egg";
    console.error("create-egg error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
