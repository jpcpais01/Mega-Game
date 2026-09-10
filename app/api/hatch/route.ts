import { NextRequest, NextResponse } from "next/server";
import { Essence, ESSENCES } from "@/lib/essences";
import { GRID_TEMPLATE_INSTRUCTION, gridAlignmentTemplate } from "@/lib/grid-template";
import { resolveImageModel } from "@/lib/image-models";
import { callChatJSON, generateImage } from "@/lib/openrouter";
import { monsterDesignerSystemPrompt, monsterDesignerUserPrompt } from "@/lib/prompts";
import { Ability, EggStat, MonsterData } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 90;

type RawMonsterJson = {
  monsterName?: unknown;
  lore?: unknown;
  imagePrompt?: unknown;
  abilities?: unknown;
};

function validateAbilities(raw: unknown, essences: Essence[]): Ability[] {
  const abilities: Ability[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const a = entry as { name?: unknown; description?: unknown };
      if (typeof a.name === "string" && a.name.trim() && typeof a.description === "string" && a.description.trim()) {
        abilities.push({ name: a.name.trim(), description: a.description.trim() });
      }
      if (abilities.length === 4) break;
    }
  }
  while (abilities.length < 4) {
    const essence = essences[abilities.length % essences.length];
    abilities.push({
      name: `${essence.name} Strike`,
      description: `Channels raw ${essence.name.toLowerCase()} essence into a quick offensive strike.`,
    });
  }
  return abilities;
}

function validateMonsterJson(
  raw: unknown,
  essences: Essence[]
): { monsterName: string; lore: string; imagePrompt: string; abilities: Ability[] } {
  const data = raw as RawMonsterJson;
  if (typeof data.monsterName !== "string" || !data.monsterName.trim()) {
    throw new Error("Monster designer response missing monsterName");
  }
  if (typeof data.lore !== "string") {
    throw new Error("Monster designer response missing lore");
  }
  if (typeof data.imagePrompt !== "string" || !data.imagePrompt.trim()) {
    throw new Error("Monster designer response missing imagePrompt");
  }
  return {
    monsterName: data.monsterName.trim(),
    lore: data.lore.trim(),
    imagePrompt: data.imagePrompt.trim(),
    abilities: validateAbilities(data.abilities, essences),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const eggName: unknown = body?.eggName;
    const lore: unknown = body?.lore;
    const stats: unknown = body?.stats;
    const essenceIds: unknown = body?.essenceIds;
    const imageModel = resolveImageModel(body?.imageModel);

    if (typeof eggName !== "string" || typeof lore !== "string" || !Array.isArray(stats) || !Array.isArray(essenceIds)) {
      return NextResponse.json({ error: "eggName, lore, stats, essenceIds are required" }, { status: 400 });
    }

    const essences = essenceIds.map((id) => {
      const found = ESSENCES.find((e) => e.id === id);
      if (!found) throw new Error(`Unknown essence id: ${id}`);
      return found;
    });

    const rawMonsterJson = await callChatJSON({
      system: monsterDesignerSystemPrompt(),
      userText: monsterDesignerUserPrompt({
        eggName,
        lore,
        stats: stats as EggStat[],
        essences,
      }),
    });
    const monsterJson = validateMonsterJson(rawMonsterJson, essences);

    const template = await gridAlignmentTemplate();
    const imageDataUrl = await generateImage({
      prompt: `${monsterJson.imagePrompt} ${GRID_TEMPLATE_INSTRUCTION}`,
      model: imageModel,
      referenceImages: [template],
      spriteSheet: true,
    });

    const monster: MonsterData = {
      ...monsterJson,
      imageDataUrl,
    };

    return NextResponse.json(monster);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error hatching monster";
    console.error("hatch error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
