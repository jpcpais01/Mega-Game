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
  imageDataUrl: string; // the still PNG (chroma-keyed to transparent) — eggs are never animated
};

export type Ability = {
  name: string;
  description: string; // short, punchy — what the ability does
};

export type LearnedAbility = Ability & {
  imageDataUrl: string; // animated WebP of the monster performing this ability — always animated by the time this exists
};

// A learned ability once it's persisted to a signed-in player's collection —
// each lives as its own document in a `abilities` subcollection under the
// monster doc (not an array field on the monster itself), so a monster can
// keep learning new attacks indefinitely without ever risking Firestore's
// 1MiB single-document size cap.
export type SavedAbility = LearnedAbility & {
  id: string;
  learnedAt: number; // epoch ms
};

export type MonsterData = {
  monsterName: string;
  lore: string;
  imagePrompt: string;
  imageDataUrl: string; // the still PNG at first, then the animated idle WebP once its video finishes
  animated: boolean; // false while imageDataUrl is the still; true once the real looping animation replaced it — a player can commit the monster to a Nest slot before its video finishes
  // A clean single-pose reference image that never changes after hatch —
  // used as the video-generation reference for later ability animations,
  // since imageDataUrl becomes the animated idle loop once that finishes
  // and isn't a usable single-character reference anymore.
  stillImageDataUrl: string;
  abilities: Ability[]; // exactly 4 options to choose a first ability from
};

// A monster persisted to a signed-in user's collection. Images are stored as
// downscaled/compressed data URLs directly in the Firestore doc (no Firebase
// Storage — that requires the paid Blaze plan) — see lib/image-resize.ts.
// learnedAbilities is not itself a Firestore field on this doc — it's the
// monster's `abilities` subcollection, fetched and merged in by the API.
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
  monsterAnimated: boolean; // whether monsterImageDataUrl is the animated WebP or still a plain still
  // A clean single-pose reference image, kept around as the image-to-image
  // reference for generating any future ability animation — same role as
  // MonsterData.stillImageDataUrl, just persisted so "learn a new attack"
  // still works on a monster loaded fresh from the Vault in a new session.
  monsterStillImageDataUrl: string;
  abilities: Ability[]; // the original 4 candidates offered right after hatch
  learnedAbilities: SavedAbility[]; // every ability actually learned, oldest first
  createdAt: number; // epoch ms
};

// Trimmed shape returned by the collection LIST endpoint — omits the egg
// image (never shown in the Vault grid) to keep the response from
// ballooning as a collection grows; the monster's own art and every learned
// ability's art ARE included, since the Vault card cycles through all of
// them.
export type SavedMonsterSummary = Omit<SavedMonster, "eggImageDataUrl">;
