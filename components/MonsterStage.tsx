"use client";

import { MonsterData } from "@/lib/types";
import GameButton from "./ui/GameButton";
import ParticleBurst from "./ui/ParticleBurst";
import SpriteAnimator from "./SpriteAnimator";

export default function MonsterStage({
  monster,
  onLearnAbility,
  onSkip,
  onBack,
  saved,
  saveError,
}: {
  monster: MonsterData;
  onLearnAbility: () => void;
  onSkip: () => void;
  onBack: () => void;
  saved?: boolean;
  saveError?: string | null;
}) {
  return (
    <div className="flex flex-col items-center gap-6 w-full pop-in">
      <div className="relative w-72 h-72 flex items-center justify-center">
        <div className="absolute bottom-2 w-40 h-8 rounded-full bg-[var(--accent)]/30 blur-xl" />
        <div className="absolute inset-0 rounded-full blur-3xl opacity-30 bg-[var(--accent-2)]" />
        <ParticleBurst color="var(--accent-2)" />
        <div className="relative">
          <SpriteAnimator imageDataUrl={monster.imageDataUrl} size={280} animated={monster.animated} />
        </div>
      </div>

      <div className="text-center">
        <h2 className="font-display text-xl text-[var(--gold)]">{monster.monsterName}</h2>
        <p className="text-sm text-[var(--text-dim)] mt-1 max-w-xs mx-auto">{monster.lore}</p>
      </div>

      {saved && <p className="text-xs text-[var(--accent-2)] -mt-2">✓ Saved to your collection</p>}
      {saveError && <p className="text-xs text-[var(--danger)] -mt-2 max-w-xs text-center">⚠ Couldn&apos;t save: {saveError}</p>}

      <GameButton onClick={onLearnAbility}>Learn First Ability</GameButton>
      <div className="flex gap-4 -mt-3">
        <button onClick={onSkip} className="text-xs text-[var(--text-dim)] underline underline-offset-2">
          Skip — keep as-is
        </button>
        <button onClick={onBack} className="text-xs text-[var(--text-dim)] underline underline-offset-2">
          Back to Nest
        </button>
      </div>
    </div>
  );
}
