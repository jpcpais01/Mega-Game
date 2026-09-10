"use client";

import { useMemo, useState } from "react";
import { ESSENCES, EVENT_ESSENCES, MAX_ESSENCES_PER_EGG, getEssence } from "@/lib/essences";
import GameButton from "./ui/GameButton";

export default function EssencePicker({
  onForge,
  loading,
  unlockedEssenceIds = [],
}: {
  onForge: (essenceIds: string[]) => void;
  loading: boolean;
  unlockedEssenceIds?: string[];
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const allEssences = useMemo(
    () => [...ESSENCES, ...EVENT_ESSENCES.filter((e) => unlockedEssenceIds.includes(e.id))],
    [unlockedEssenceIds]
  );

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const id of selected) map.set(id, (map.get(id) ?? 0) + 1);
    return map;
  }, [selected]);

  function addEssence(id: string) {
    if (loading || selected.length >= MAX_ESSENCES_PER_EGG) return;
    setSelected((prev) => [...prev, id]);
  }

  function removeSlot(index: number) {
    if (loading) return;
    setSelected((prev) => prev.filter((_, i) => i !== index));
  }

  function clearAll() {
    if (loading) return;
    setSelected([]);
  }

  const isFull = selected.length >= MAX_ESSENCES_PER_EGG;

  return (
    <div className="flex flex-col gap-5 w-full">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold tracking-wide text-[var(--text-dim)] uppercase">
          Choose up to {MAX_ESSENCES_PER_EGG} essences
        </h2>
        {selected.length > 0 && !loading && (
          <button
            onClick={clearAll}
            className="text-xs text-[var(--text-dim)] underline underline-offset-2 active:opacity-60"
          >
            clear
          </button>
        )}
      </div>

      <div className="flex justify-center gap-2">
        {Array.from({ length: MAX_ESSENCES_PER_EGG }).map((_, i) => {
          const id = selected[i];
          const essence = id ? getEssence(id) : undefined;
          return (
            <button
              key={i}
              onClick={() => essence && removeSlot(i)}
              disabled={!essence || loading}
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl border-2 transition-transform active:scale-90"
              style={{
                borderColor: essence ? essence.color : "var(--panel-border)",
                borderStyle: essence ? "solid" : "dashed",
                background: essence ? `${essence.color}22` : "transparent",
                boxShadow: essence ? `0 0 18px -4px ${essence.glow}` : "none",
              }}
            >
              {essence ? essence.emoji : ""}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        {allEssences.map((essence) => {
          const count = counts.get(essence.id) ?? 0;
          const isRare = EVENT_ESSENCES.some((e) => e.id === essence.id);
          return (
            <button
              key={essence.id}
              onClick={() => addEssence(essence.id)}
              disabled={loading || isFull}
              className="relative aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 tile-panel active:scale-95 transition-transform disabled:opacity-30"
              style={{
                boxShadow:
                  count > 0
                    ? `0 0 0 2px ${essence.color}, 0 0 16px -2px ${essence.glow}`
                    : isRare
                      ? `0 0 0 1px var(--gold), 0 0 12px -3px var(--gold)`
                      : undefined,
              }}
            >
              {isRare && <span className="absolute -top-1.5 -left-1.5 text-[10px] text-[var(--gold)]">★</span>}
              <span className="text-xl leading-none">{essence.emoji}</span>
              <span className="text-[10px] font-medium text-[var(--text-dim)] leading-none">{essence.name}</span>
              {count > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-black"
                  style={{ background: essence.color }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <GameButton className="mt-1" disabled={selected.length === 0 || loading} onClick={() => onForge(selected)}>
        {loading ? "Forging egg…" : `Forge Egg (${selected.length}/${MAX_ESSENCES_PER_EGG})`}
      </GameButton>
    </div>
  );
}
