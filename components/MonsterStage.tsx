"use client";

import { MonsterData } from "@/lib/types";
import SpriteAnimator from "./SpriteAnimator";

export default function MonsterStage({
  monster,
  onLearnAbility,
  onSkip,
}: {
  monster: MonsterData;
  onLearnAbility: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 w-full pop-in">
      <div className="relative w-72 h-72 flex items-center justify-center">
        <div className="absolute bottom-2 w-40 h-8 rounded-full bg-[var(--accent)]/30 blur-xl" />
        <div className="absolute inset-0 rounded-full blur-3xl opacity-30 bg-[var(--accent-2)]" />
        <div className="relative">
          <SpriteAnimator imageDataUrl={monster.imageDataUrl} size={280} />
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-bold">{monster.monsterName}</h2>
        <p className="text-sm text-[var(--text-dim)] mt-1 max-w-xs mx-auto">{monster.lore}</p>
      </div>

      <button
        className="glow-btn w-full rounded-2xl py-4 text-base font-bold tracking-wide text-white"
        onClick={onLearnAbility}
      >
        Learn First Ability
      </button>
      <button onClick={onSkip} className="text-xs text-[var(--text-dim)] underline underline-offset-2 -mt-3">
        Skip — keep as-is
      </button>
    </div>
  );
}
