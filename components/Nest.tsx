"use client";

import { SlotEntry } from "@/lib/types";
import SpriteAnimator from "./SpriteAnimator";

export default function Nest({
  slots,
  onSelectEmpty,
  onViewFilled,
}: {
  slots: (SlotEntry | null)[];
  onSelectEmpty: (index: number) => void;
  onViewFilled: (index: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 w-full pop-in">
      <div className="text-center">
        <h2 className="text-lg font-bold">Your Nest</h2>
        <p className="text-xs text-[var(--text-dim)] mt-1">Tap an empty slot to forge a new egg</p>
      </div>

      <div className="grid grid-cols-5 gap-2 w-full">
        {slots.map((entry, i) =>
          entry ? (
            <button
              key={i}
              onClick={() => onViewFilled(i)}
              className="aspect-square rounded-2xl glass-panel flex items-center justify-center overflow-hidden active:scale-95 transition-transform"
              style={{ boxShadow: "0 0 16px -4px var(--accent)" }}
            >
              <SpriteAnimator imageDataUrl={entry.monster.imageDataUrl} size={64} />
            </button>
          ) : (
            <button
              key={i}
              onClick={() => onSelectEmpty(i)}
              className="aspect-square rounded-2xl border-2 border-dashed border-[var(--panel-border)] flex items-center justify-center text-2xl text-[var(--text-dim)] active:scale-95 transition-transform"
            >
              +
            </button>
          )
        )}
      </div>
    </div>
  );
}
