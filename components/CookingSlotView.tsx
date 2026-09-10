"use client";

import { useEffect, useState } from "react";
import SpriteAnimator from "./SpriteAnimator";
import GameButton from "./ui/GameButton";
import GamePanel from "./ui/GamePanel";

const FORGING_MESSAGES = ["Blending essences…", "Consulting the Egg Creator…", "Painting the shell…"];
const HATCHING_MESSAGES = [
  "Designing the monster…",
  "Sketching a reference pose…",
  "Bringing it to life…",
  "This can take a couple of minutes…",
];
const LEARNING_MESSAGES = [
  "Channeling the ability…",
  "Directing the animation…",
  "Rendering the ability video…",
  "This can take a couple of minutes…",
  "Compositing sprite frames…",
];

const MESSAGES_BY_KIND = {
  forging: FORGING_MESSAGES,
  hatching: HATCHING_MESSAGES,
  "learning-ability": LEARNING_MESSAGES,
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function CookingSlotView({
  kind,
  startedAt,
  title,
  subtitle,
  imageDataUrl,
  onBack,
  onCancel,
}: {
  kind: "forging" | "hatching" | "learning-ability";
  startedAt: number;
  title: string;
  subtitle?: string;
  /** The egg/monster's current art, if there already is one — shown (with a gentle pulse) instead of a bare placeholder while this step cooks. */
  imageDataUrl?: string;
  onBack: () => void;
  onCancel: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedMs = now - startedAt;
  const messages = MESSAGES_BY_KIND[kind];
  const messageIndex = Math.min(Math.floor(elapsedMs / 3200), messages.length - 1);

  return (
    <div className="flex flex-col items-center gap-6 w-full pop-in">
      <div className="relative w-56 h-56 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full blur-3xl opacity-30 bg-[var(--accent)]" />
        {imageDataUrl ? (
          <div className="relative animate-pulse">
            <SpriteAnimator imageDataUrl={imageDataUrl} size={224} />
          </div>
        ) : (
          <div className="relative w-4/5 h-4/5 rounded-full shimmer" />
        )}
      </div>

      <div className="text-center">
        <h2 className="font-display text-xl text-[var(--gold)]">{title}</h2>
        {subtitle && <p className="text-sm text-[var(--text-dim)] mt-1 max-w-xs mx-auto">{subtitle}</p>}
      </div>

      <GamePanel className="rounded-2xl p-4 w-full flex flex-col items-center gap-2">
        <p className="font-display text-2xl text-[var(--gold)] tabular-nums">{formatElapsed(elapsedMs)}</p>
        <p className="text-xs text-[var(--text-dim)] text-center min-h-[1.5em]">{messages[messageIndex]}</p>
      </GamePanel>

      <div className="flex gap-3 w-full">
        <GameButton variant="ghost" size="lg" className="flex-1" onClick={onBack}>
          Back to Nest
        </GameButton>
        <GameButton variant="danger" size="lg" className="flex-1" onClick={onCancel}>
          Cancel
        </GameButton>
      </div>
    </div>
  );
}
