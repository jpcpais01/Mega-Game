"use client";

import { useEffect, useState } from "react";
import { SlotState } from "./ForgeProvider";
import SpriteAnimator from "./SpriteAnimator";
import { PanelCorners } from "./ui/GamePanel";

function ElapsedBadge({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const label = `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, "0")}`;
  return (
    <span className="absolute bottom-1 right-1 text-[9px] font-bold tabular-nums px-1 rounded bg-black/50 text-[var(--gold)]">
      {label}
    </span>
  );
}

function SlotTile({ index, slot, onTap }: { index: number; slot: SlotState; onTap: (index: number) => void }) {
  if (slot.status === "empty") {
    return (
      <button
        onClick={() => onTap(index)}
        className="relative aspect-square rounded-2xl border-2 border-dashed flex items-center justify-center active:scale-95 transition-transform"
        style={{ borderColor: "rgba(217, 180, 95, 0.35)", background: "rgba(217, 180, 95, 0.04)" }}
      >
        <span className="text-xl text-[var(--gold)] opacity-70">+</span>
      </button>
    );
  }

  if (slot.status === "forge-failed") {
    return (
      <button
        onClick={() => onTap(index)}
        className="relative aspect-square rounded-2xl border-2 flex items-center justify-center active:scale-95 transition-transform"
        style={{ borderColor: "var(--danger)", background: "rgba(220, 60, 60, 0.08)" }}
      >
        <span className="text-xl text-[var(--danger)]">!</span>
      </button>
    );
  }

  if (slot.status === "forging") {
    return (
      <button
        onClick={() => onTap(index)}
        className="game-panel relative rounded-2xl aspect-square flex items-center justify-center overflow-hidden active:scale-95 transition-transform"
      >
        <PanelCorners />
        <div className="w-3/5 h-3/5 rounded-full shimmer" />
        <ElapsedBadge startedAt={slot.startedAt} />
      </button>
    );
  }

  if (slot.status === "hatching") {
    return (
      <button
        onClick={() => onTap(index)}
        className="game-panel relative rounded-2xl aspect-square flex items-center justify-center overflow-hidden active:scale-95 transition-transform opacity-70"
      >
        <PanelCorners />
        <SpriteAnimator imageDataUrl={slot.egg.imageDataUrl} size={64} />
        <ElapsedBadge startedAt={slot.startedAt} />
      </button>
    );
  }

  if (slot.status === "egg-ready") {
    return (
      <button
        onClick={() => onTap(index)}
        className="game-panel relative rounded-2xl aspect-square flex items-center justify-center overflow-hidden active:scale-95 transition-transform"
        style={{ boxShadow: "0 0 16px -4px var(--accent)" }}
      >
        <PanelCorners />
        <SpriteAnimator imageDataUrl={slot.egg.imageDataUrl} size={64} />
      </button>
    );
  }

  if (slot.status === "learning-ability") {
    return (
      <button
        onClick={() => onTap(index)}
        className="game-panel relative rounded-2xl aspect-square flex items-center justify-center overflow-hidden active:scale-95 transition-transform opacity-70"
      >
        <PanelCorners />
        <SpriteAnimator imageDataUrl={slot.monster.imageDataUrl} size={64} />
        <ElapsedBadge startedAt={slot.startedAt} />
      </button>
    );
  }

  // monster-ready | done
  const monster = slot.monster;
  return (
    <button
      onClick={() => onTap(index)}
      className="game-panel relative rounded-2xl aspect-square flex items-center justify-center overflow-hidden active:scale-95 transition-transform"
      style={{ boxShadow: "0 0 16px -4px var(--accent)" }}
    >
      <PanelCorners />
      <SpriteAnimator imageDataUrl={monster.imageDataUrl} size={64} />
    </button>
  );
}

export default function Nest({ slots, onTapSlot }: { slots: SlotState[]; onTapSlot: (index: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-6 w-full pop-in">
      <div className="text-center">
        <h1 className="font-display text-xl tracking-wide text-[var(--gold)]">YOUR NEST</h1>
        <p className="text-xs text-[var(--text-dim)] mt-1">Tap an empty pedestal to forge a new egg</p>
      </div>

      <div className="grid grid-cols-5 gap-2 w-full">
        {slots.map((slot, i) => (
          <SlotTile key={i} index={i} slot={slot} onTap={onTapSlot} />
        ))}
      </div>
    </div>
  );
}
