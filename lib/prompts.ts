import { Essence } from "./essences";

// Background treatment is deliberately NOT part of this: it's appended
// programmatically by lib/openrouter.ts, which picks between a real
// transparent-PNG request and a chroma-key fallback depending on what the
// image provider actually accepts. Keeping it out of the LLM-authored
// imagePrompt means we can switch strategy without a second text-LLM call.
const ART_STYLE = [
  "Beautiful, clean 8-bit-style pixel art (crisp hard pixel edges, visibly chunky low-resolution pixels, no anti-aliasing blur, no smooth gradients, a small limited color palette per subject) — think classic NES-era game art, clean and readable, not muddy or noisy.",
  "Overall aesthetic: gorgeous, polished, and appealing — semi-cute, charming character design in the vein of a beloved mobile monster-collecting game, never ugly, scary, grotesque, or off-putting, even for a fierce or intimidating creature.",
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
silhouette (bumps, spikes, shell patterns are welcome). Do not describe any creature, only the egg itself. This
is a single static illustration (not an animation), so describe one clear, finished-looking resting state — e.g.
a soft inner glow, faint magical energy crackling over the shell, essence-infused patterns on its surface. Do not
describe it cracking open or hatching.

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
distinct silhouette and color palette drawn from its essences. Give it a slightly humanoid build — an upright
torso, a head, and limbs it stands and gestures with, like classic monster-collecting game creatures — while
keeping the overall silhouette wholly its own and clearly non-human: unusual limb counts or shapes, alien
proportions, extra eyes, tails, wings, or crystalline/elemental body parts are all welcome and encouraged. It
should read as a distinct fantasy creature, never as a person in a costume or an ordinary real-world animal.
Absolutely do NOT depict any egg, eggshell fragments, or hatching remnants in the image — only the finished
monster, standing in a light idle pose suitable for a game character sprite.

You must also invent exactly 4 candidate first abilities the player can choose between to teach this monster —
distinct, flavorful, and grounded in its essences (e.g. a fire-essence monster might get "Ember Claw" or "Heat
Haze"). Each needs a short punchy name and a one-sentence description of what it visually does, concrete enough
that an artist could draw the creature performing it (a specific motion, effect, or attack — not vague flavor
text).

Respond with ONLY a strict JSON object, no prose, matching exactly this shape:
{
  "monsterName": string (a creature name, can riff on the egg name),
  "lore": string (max 20 words, punchy mini lore for the hatched monster),
  "imagePrompt": string (a single detailed text-to-image prompt describing ONLY the monster's appearance — anatomy, colors, textures, silhouette — following the art direction above; do not mention background),
  "abilities": [
    { "name": string (2-4 words), "description": string (max 15 words, describes a concrete visual action/effect) }
    // exactly 4 of these, each a distinctly different ability
  ]
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

export function newAbilitiesSystemPrompt(): string {
  return `You are the Monster Designer, a world-building AI for "Mega Game", a mobile monster-collecting game.
A player wants to teach an already-hatched monster a brand-new attack. Invent exactly 4 candidate abilities for
it to choose between, consistent with the monster's name, lore, and essences, and distinct from every ability it
already knows — never repeat or lightly reskin an existing one.

Each needs a short punchy name and a one-sentence description of what it visually does, concrete enough that an
artist could draw the monster performing it (a specific motion, effect, or attack — not vague flavor text).

Respond with ONLY a strict JSON object, no prose, matching exactly this shape:
{
  "abilities": [
    { "name": string (2-4 words), "description": string (max 15 words, describes a concrete visual action/effect) }
    // exactly 4 of these, each a distinctly different ability, none repeating an already-known one
  ]
}`;
}

export function newAbilitiesUserPrompt(params: {
  monsterName: string;
  monsterLore: string;
  essences: Essence[];
  alreadyKnown: string[];
}): string {
  const essenceList = params.essences.map((e) => e.name).join(", ");
  const knownList = params.alreadyKnown.length > 0 ? params.alreadyKnown.join(", ") : "(none yet)";
  return `Monster name: ${params.monsterName}\nMonster lore: ${params.monsterLore}\nEssences: ${essenceList}\nAbilities already known: ${knownList}\n\nInvent 4 new candidate abilities now.`;
}

// Shared constraints for every generated sprite video (egg idle, monster
// idle, ability/attack) — the reference image already shows the exact
// character design, so this only needs to pin down motion style, the
// chroma-key background, and looping, not re-describe appearance.
const VIDEO_LOOP_STYLE_INSTRUCTION =
  "This is a looping sprite animation for a 2D pixel-art game. Keep the exact character design, colors, proportions, and pixel-art style from the reference image identical in every single frame — never redesign, restyle, recolor, or change the art style. Keep the background a single, perfectly flat, unbroken solid chroma-key magenta color (#FF00FF) in every frame — no gradient, vignette, shadow, lighting change, texture, or scenery. The camera never moves, zooms, or pans — only the subject's pose changes. Motion should read as a deliberate, low-frame-rate pixel-art animation (about 10 distinct poses per second) with crisp pose-to-pose changes, not smooth motion blur. The animation must loop seamlessly: the very last frame must match the very first frame's pose exactly, so it can repeat forever with no visible jump or pop.";

export function idleSpriteVideoPrompt(): string {
  return `A calm, subtle idle motion appropriate to the subject — a gentle breathe, bob, pulse, or flicker, nothing dramatic or fast. ${VIDEO_LOOP_STYLE_INSTRUCTION}`;
}

export function abilitySpriteVideoPrompt(params: { monsterName: string; abilityName: string; abilityDescription: string }): string {
  return `This is ${params.monsterName}, an existing game creature, performing its ability "${params.abilityName}": ${params.abilityDescription}. It returns to its resting pose by the final frame. ${VIDEO_LOOP_STYLE_INSTRUCTION}`;
}
