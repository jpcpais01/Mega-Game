"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { useAuth } from "@/components/AuthProvider";
import SpriteAnimator from "@/components/SpriteAnimator";
import { getEssence } from "@/lib/essences";
import { SavedMonsterSummary } from "@/lib/types";

export default function CollectionPage() {
  const { user, loading: authLoading, configured, signIn, getIdToken } = useAuth();
  const [monsters, setMonsters] = useState<SavedMonsterSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        if (!cancelled) setMonsters(null);
        return;
      }
      setError(null);
      try {
        const idToken = await getIdToken();
        const res = await fetch("/api/monsters", {
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        });
        const bodyText = await res.text();
        let data: unknown;
        try {
          data = bodyText ? JSON.parse(bodyText) : {};
        } catch {
          throw new Error(
            res.ok
              ? "The collection response was cut off (it may be too large) — try again."
              : `Failed to load collection (status ${res.status}).`
          );
        }
        if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Failed to load collection");
        if (!cancelled) setMonsters((data as { monsters: SavedMonsterSummary[] }).monsters);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load collection");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, getIdToken, retryTick]);

  return (
    <main
      className="min-h-dvh flex flex-col items-center px-4 pb-8"
      style={{ paddingTop: "calc(var(--safe-top) + 1.5rem)" }}
    >
      <AppHeader active="collection" />

      <div className="w-full max-w-md flex-1 flex flex-col items-center">
        {!configured && (
          <div className="glass-panel rounded-2xl p-6 w-full text-center flex flex-col items-center gap-2 mt-10">
            <p className="text-3xl">🛠️</p>
            <p className="text-sm text-[var(--text-dim)]">
              Sign-in isn&apos;t set up yet — the app owner needs to add the Firebase environment variables.
            </p>
          </div>
        )}

        {configured && authLoading && <div className="w-10 h-10 rounded-full border-4 border-[var(--accent)]/30 border-t-[var(--accent)] spin-slow mt-10" />}

        {configured && !authLoading && !user && (
          <div className="glass-panel rounded-2xl p-6 w-full text-center flex flex-col items-center gap-3 mt-10">
            <p className="text-3xl">🗂️</p>
            <p className="text-sm text-[var(--text-dim)]">Sign in to see the monsters you&apos;ve forged.</p>
            <button onClick={signIn} className="glow-btn rounded-xl py-3 px-6 text-sm font-bold text-white">
              Sign in with Google
            </button>
          </div>
        )}

        {!authLoading && user && error && (
          <div className="glass-panel rounded-2xl p-4 w-full text-center flex flex-col gap-3 mt-10">
            <p className="text-sm text-[var(--danger)]">{error}</p>
            <button
              className="glow-btn rounded-xl py-3 text-sm font-bold text-white self-center px-6"
              onClick={() => setRetryTick((t) => t + 1)}
            >
              Try again
            </button>
          </div>
        )}

        {!authLoading && user && !error && monsters === null && (
          <div className="w-10 h-10 rounded-full border-4 border-[var(--accent)]/30 border-t-[var(--accent)] spin-slow mt-10" />
        )}

        {!authLoading && user && !error && monsters?.length === 0 && (
          <div className="glass-panel rounded-2xl p-6 w-full text-center flex flex-col items-center gap-3 mt-10">
            <p className="text-3xl">🥚</p>
            <p className="text-sm text-[var(--text-dim)]">No monsters yet.</p>
            <Link href="/" className="glow-btn rounded-xl py-3 px-6 text-sm font-bold text-white">
              Forge your first egg
            </Link>
          </div>
        )}

        {!authLoading && user && !error && monsters && monsters.length > 0 && (
          <div className="grid grid-cols-2 gap-3 w-full pop-in">
            {monsters.map((m) => (
              <div key={m.id} className="glass-panel rounded-2xl p-3 flex flex-col items-center gap-1.5">
                <SpriteAnimator imageDataUrl={m.monsterImageDataUrl} size={100} />
                <p className="text-sm font-bold text-center truncate w-full">{m.monsterName}</p>
                <p className="text-[10px] text-[var(--text-dim)] text-center line-clamp-2">{m.monsterLore}</p>
                <div className="flex gap-1 flex-wrap justify-center">
                  {m.essenceIds.slice(0, 5).map((id, i) => (
                    <span key={i} className="text-xs">
                      {getEssence(id)?.emoji}
                    </span>
                  ))}
                </div>
                {m.learnedAbility && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent)]/20 text-[var(--accent-2)]">
                    ✨ {m.learnedAbility.name}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
