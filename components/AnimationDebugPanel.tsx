"use client";

import { useState } from "react";
import { AnimationDebugInfo } from "./ForgeProvider";
import GamePanel from "./ui/GamePanel";

// Shows the raw, unsliced video straight from the video model — collapsed
// by default so it doesn't clutter the normal flow, but reachable whenever
// an animation was attempted for the active slot. This is the tool for
// answering "did the model actually generate motion, or did our own
// extract/chroma-key/encode pipeline lose it": if the raw clip below moves
// but the egg/monster art doesn't, the bug is in our pipeline; if the raw
// clip itself is static, the bug (or the prompt) is upstream, at the model.
export default function AnimationDebugPanel({ debug }: { debug: AnimationDebugInfo }) {
  const [open, setOpen] = useState(false);

  if (!debug.videoUrl && !debug.error) return null;

  return (
    <div className="w-full mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] text-[var(--text-dim)] underline underline-offset-2"
      >
        {open ? "Hide" : "Debug: view raw generated video"}
      </button>
      {open && (
        <GamePanel className="rounded-xl p-3 mt-2 w-full flex flex-col items-center gap-2">
          {debug.videoUrl ? (
            <video
              src={debug.videoUrl}
              controls
              autoPlay
              loop
              muted
              playsInline
              style={{ width: 200, height: 200, background: "#000" }}
            />
          ) : (
            <p className="text-[10px] text-[var(--text-dim)]">No raw video captured for this attempt.</p>
          )}
          {debug.error && <p className="text-[10px] text-[var(--danger)] text-center">{debug.error}</p>}
        </GamePanel>
      )}
    </div>
  );
}
