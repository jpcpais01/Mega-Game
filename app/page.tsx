"use client";

import { useEffect, useRef, useState } from "react";
import EssencePicker from "@/components/EssencePicker";
import EggReveal from "@/components/EggReveal";
import MonsterStage from "@/components/MonsterStage";
import { EggData, EggDetails, MonsterData } from "@/lib/types";

type Stage = "pick" | "egg" | "monster";

const EGG_DETAILS_STATUS_MESSAGES = ["Blending essences…", "Consulting the Egg Creator…"];
const HATCH_STATUS_MESSAGES = ["Designing the monster…", "Rendering monster sprite sheet…"];

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `Request to ${url} failed`);
  return data as T;
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("pick");
  const [egg, setEgg] = useState<EggData | null>(null);
  const [eggImageFailed, setEggImageFailed] = useState(false);
  const [monster, setMonster] = useState<MonsterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [statusIndex, setStatusIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const monsterPromiseRef = useRef<Promise<MonsterData> | null>(null);

  function startStatusCycle(messages: string[]) {
    setStatusMessages(messages);
    setStatusIndex(0);
    if (statusTimer.current) clearInterval(statusTimer.current);
    statusTimer.current = setInterval(() => {
      setStatusIndex((i) => Math.min(i + 1, messages.length - 1));
    }, 3200);
  }

  function stopStatusCycle() {
    if (statusTimer.current) clearInterval(statusTimer.current);
  }

  useEffect(() => stopStatusCycle, []);

  function beginMonsterGeneration(details: EggDetails) {
    const promise = postJson<MonsterData>("/api/hatch", {
      eggName: details.eggName,
      lore: details.lore,
      stats: details.stats,
      essenceIds: details.essenceIds,
    }).then((m) => {
      setMonster(m);
      return m;
    });
    monsterPromiseRef.current = promise;
    promise.catch(() => {}); // prevent unhandled-rejection noise; handleHatch awaits & surfaces the real error
  }

  function beginEggImage(details: EggDetails) {
    postJson<{ imageDataUrl: string }>("/api/egg-image", { imagePrompt: details.imagePrompt })
      .then(({ imageDataUrl }) => {
        setEgg((prev) => (prev ? { ...prev, imageDataUrl } : prev));
      })
      .catch((err) => {
        console.error("egg-image error:", err);
        setEggImageFailed(true);
      });
  }

  async function handleForge(essenceIds: string[]) {
    setError(null);
    setEggImageFailed(false);
    setMonster(null);
    monsterPromiseRef.current = null;
    setLoading(true);
    startStatusCycle(EGG_DETAILS_STATUS_MESSAGES);
    try {
      const details = await postJson<EggDetails>("/api/egg-details", { essenceIds });
      setEgg({ ...details, imageDataUrl: null });
      setStage("egg");
      // Fire both the egg's own artwork and the monster generation in parallel —
      // the monster doesn't need the egg image, only the egg's text details.
      beginEggImage(details);
      beginMonsterGeneration(details);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create egg");
    } finally {
      setLoading(false);
      stopStatusCycle();
    }
  }

  async function handleHatch() {
    setError(null);
    if (monster) {
      setStage("monster");
      return;
    }
    if (!monsterPromiseRef.current) return;
    setLoading(true);
    startStatusCycle(HATCH_STATUS_MESSAGES);
    try {
      await monsterPromiseRef.current;
      setStage("monster");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to hatch egg");
    } finally {
      setLoading(false);
      stopStatusCycle();
    }
  }

  function handleRestart() {
    setEgg(null);
    setEggImageFailed(false);
    setMonster(null);
    monsterPromiseRef.current = null;
    setError(null);
    setStage("pick");
  }

  return (
    <main
      className="min-h-dvh flex flex-col items-center px-4 pb-8"
      style={{ paddingTop: "calc(var(--safe-top) + 1.5rem)" }}
    >
      <header className="w-full max-w-md flex flex-col items-center gap-1 mb-6">
        <div className="text-3xl">🥚</div>
        <h1 className="text-xl font-extrabold tracking-tight">Mega Game</h1>
        <p className="text-xs text-[var(--text-dim)]">Essence Forge</p>
      </header>

      <div className="w-full max-w-md flex-1 flex flex-col items-center justify-center">
        {loading && (
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="w-16 h-16 rounded-full border-4 border-[var(--accent)]/30 border-t-[var(--accent)] spin-slow" />
            <p className="text-sm text-[var(--text-dim)] text-center min-h-[1.5em]">
              {statusMessages[statusIndex]}
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="glass-panel rounded-2xl p-4 w-full text-center flex flex-col gap-3">
            <p className="text-sm text-[var(--danger)]">{error}</p>
            <button
              className="glow-btn rounded-xl py-3 text-sm font-bold"
              onClick={() => setError(null)}
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && stage === "pick" && (
          <EssencePicker onForge={handleForge} loading={loading} />
        )}
        {!loading && !error && stage === "egg" && egg && (
          <EggReveal egg={egg} onHatch={handleHatch} loading={loading} imageFailed={eggImageFailed} />
        )}
        {!loading && !error && stage === "monster" && monster && (
          <MonsterStage monster={monster} onRestart={handleRestart} />
        )}
      </div>
    </main>
  );
}
