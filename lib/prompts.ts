import { Essence } from "./essences";

// Background treatment is deliberately NOT part of this: it's appended
// programmatically by lib/openrouter.ts, which picks between a real
// transparent-PNG request and a chroma-key fallback depending on what the
// image provider actually accepts. Keeping it out of the LLM-authored
// imagePrompt means we can switch strategy without a second text-LLM call.
const ART_STYLE = [
  "Detailed modern pixel art (rich 32-bit-era color depth and shading, crisp hard pixel edges, no anti-aliasing blur, no smooth gradients) — think high-quality indie pixel art, not blocky flat 8-bit retro.",
  "Camera: 2.5D isometric game-camera perspective viewed from the front-left, roughly a 30-degree isometric angle (NOT a flat front view, NOT top-down).",
  "The subject is perfectly centered and fully visible within the frame, floating with no ground tile, no platform, no shadow, no scenery, no text, no watermark, no border, no frame.",
  "Single subject only, game-ready asset composition. Do not mention or describe any background — background treatment is handled separately.",
].join(" ");

export function eggCreatorSystemPrompt(): string {
  return `You are the Egg Creator, a world-building AI for "Mega Game", a mobile monster-collecting game.
Players combine 1-5 elemental essences (repeats allowed) to conjure a mysterious egg. Your job is to imagine that
egg and describe it precisely.

Art direction you MUST bake into the "imagePrompt" field: ${ART_STYLE}
The egg should visually blend the color palettes, textures, and symbolism of the given essences (e.g. cracks of
glowing lava, veins of lightning, frost crystals, mossy growth) onto a single ovoid egg shape with an interesting
silhouette (bumps, spikes, shell patterns are welcome). Do not describe any creature, only the egg itself.

Respond with ONLY a strict JSON object, no prose, matching exactly this shape:
{
  "eggName": string (2-4 words, evocative fantasy name),
  "lore": string (max 20 words, a mini lore blurb, punchy and mysterious),
  "stats": [
    { "name": string (short fun stat name, e.g. "Hatch Speed", "Shell Density"), "value": number (integer 1-100) }
    // exactly 5 of these, each a different creative stat relevant to the essence mix
  ],
  "imagePrompt": string (a single detailed text-to-image prompt describing ONLY the egg's appearance — shape, colors, textures, patterns — following the art direction above; do not mention background)
}`;
}

export function eggCreatorUserPrompt(essences: Essence[]): string {
  const list = essences
    .map((e, i) => `${i + 1}. ${e.name} (${e.flavor})`)
    .join("\n");
  return `The player combined these ${essences.length} essence(s) into one egg:\n${list}\n\nDesign the resulting egg now.`;
}

export function monsterDesignerSystemPrompt(): string {
  return `You are the Monster Designer, a world-building AI for "Mega Game", a mobile monster-collecting game.
An egg is now hatching. You must design the creature that emerges from it, consistent with the egg's name, lore,
stats and essences.

Art direction you MUST bake into the "imagePrompt" field: ${ART_STYLE}
Show the fully hatched creature's whole body, an original creature design (not a real-world animal), with a
distinct silhouette and color palette drawn from its essences. Absolutely do NOT depict any egg, eggshell
fragments, or hatching remnants in the image — only the finished monster, standing in a light idle pose suitable
for a game character sprite.

Respond with ONLY a strict JSON object, no prose, matching exactly this shape:
{
  "monsterName": string (a creature name, can riff on the egg name),
  "lore": string (max 20 words, punchy mini lore for the hatched monster),
  "imagePrompt": string (a single detailed text-to-image prompt describing ONLY the monster's appearance — anatomy, colors, textures, silhouette — following the art direction above; do not mention background)
}`;
}

export function monsterDesignerUserPrompt(params: {
  eggName: string;
  lore: string;
  stats: { name: string; value: number }[];
  essences: Essence[];
}): string {
  const statsList = params.stats.map((s) => `${s.name}: ${s.value}/100`).join(", ");
  const essenceList = params.essences.map((e) => e.name).join(", ");
  return `Egg name: ${params.eggName}\nEgg lore: ${params.lore}\nEgg stats: ${statsList}\nEssences used: ${essenceList}\n\nDesign the hatched monster now.`;
}
