export type EggStat = {
  name: string;
  value: number; // 1-100
};

export type EggDetails = {
  eggName: string;
  lore: string;
  stats: EggStat[];
  imagePrompt: string;
  essenceIds: string[];
};

export type EggData = EggDetails & {
  imageDataUrl: string | null; // null while generating; the still, then the animated sheet once its video finishes
  animated: boolean; // false while imageDataUrl is the still (SpriteAnimator must not grid-slice it); true once the idle loop replaced it
};

export type Ability = {
  name: string;
  description: string; // short, punchy — what the ability does
};

export type LearnedAbility = Ability & {
  imageDataUrl: string; // sprite sheet of the monster performing this ability — always animated by the time this exists
};

export type MonsterData = {
  monsterName: string;
  lore: string;
  imagePrompt: string;
  imageDataUrl: string; // the still at first, then the animated idle sprite sheet once its video finishes
  animated: boolean; // same meaning as EggData.animated — a player can commit the monster to a Nest slot before its video finishes
  // A clean single-pose reference image that never changes after hatch —
  // used as the video-generation reference for later ability animations,
  // since imageDataUrl becomes a busy multi-frame sheet once idle animation
  // finishes and isn't a usable single-character reference anymore.
  stillImageDataUrl: string;
  abilities: Ability[]; // exactly 4 options to choose a first ability from
};

// A finished monster sitting in one of the home screen's nest slots (in-session,
// not necessarily the same thing as a Firestore-persisted SavedMonster).
export type SlotEntry = {
  monster: MonsterData;
  learnedAbility: LearnedAbility | null;
};

// A monster persisted to a signed-in user's collection. Images are stored as
// downscaled/compressed data URLs directly in the Firestore doc (no Firebase
// Storage — that requires the paid Blaze plan) — see lib/image-resize.ts.
export type SavedMonster = {
  id: string;
  eggName: string;
  eggLore: string;
  stats: EggStat[];
  essenceIds: string[];
  eggImageDataUrl: string;
  monsterName: string;
  monsterLore: string;
  monsterImageDataUrl: string;
  monsterAnimated: boolean; // whether monsterImageDataUrl is a grid-sliceable sheet or a plain still
  abilities: Ability[];
  learnedAbility: LearnedAbility | null;
  createdAt: number; // epoch ms
};

// Trimmed shape returned by the collection LIST endpoint — the grid only
// ever shows the monster's own sprite and the learned ability's name, so
// omitting the egg image and the ability's sprite (both otherwise-unused
// but sizeable base64 payloads, doubling or tripling response size per
// monster) keeps the list response from ballooning as a collection grows.
export type SavedMonsterSummary = Omit<SavedMonster, "eggImageDataUrl" | "learnedAbility"> & {
  learnedAbility: Ability | null;
};
