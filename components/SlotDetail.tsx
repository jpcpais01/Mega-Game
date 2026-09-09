"use client";

import { SlotEntry } from "@/lib/types";
import SpriteAnimator from "./SpriteAnimator";

export default function SlotDetail({
  entry,
  onClose,
  onRelease,
}: {
  entry: SlotEntry;
  onClose: () => void;
  onRelease: () => void;
}) {
  const { monster, learnedAbility } = entry;

  return (
    <div className="flex flex-col items-center gap-6 w-full pop-in">
      <div className="relative w-56 h-56 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full blur-3xl opacity-30 bg-[var(--accent-2)]" />
        <div className="relative">
          <SpriteAnimator imageDataUrl={monster.imageDataUrl} size={224} />
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-bold">{monster.monsterName}</h2>
        <p className="text-sm text-[var(--text-dim)] mt-1 max-w-xs mx-auto">{monster.lore}</p>
      </div>

      {learnedAbility ? (
        <div className="glass-panel rounded-2xl p-4 w-full flex flex-col items-center gap-3">
          <SpriteAnimator imageDataUrl={learnedAbility.imageDataUrl} size={120} />
          <div className="text-center">
            <p className="font-bold text-sm">{learnedAbility.name}</p>
            <p className="text-xs text-[var(--text-dim)] mt-1">{learnedAbility.description}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--text-dim)]">No ability learned yet</p>
      )}

      <div className="flex gap-3 w-full">
        <button
          onClick={onClose}
          className="flex-1 rounded-2xl py-4 text-sm font-bold glass-panel text-[var(--text-dim)]"
        >
          Back to Nest
        </button>
        <button
          onClick={onRelease}
          className="flex-1 rounded-2xl py-4 text-sm font-bold glass-panel text-[var(--danger)]"
        >
          Release
        </button>
      </div>
    </div>
  );
}
