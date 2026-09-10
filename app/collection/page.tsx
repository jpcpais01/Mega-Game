"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import SpriteAnimator from "@/components/SpriteAnimator";
import GameButton from "@/components/ui/GameButton";
import GamePanel from "@/components/ui/GamePanel";
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
        if (!res.ok) {
          const serverMessage = (data as { error?: string })?.error;
          throw new Error(serverMessage ? `${serverMessage} (status ${res.status})` : `Failed to load collection (status ${res.status})`);
        }
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
    <div className="w-full flex-1 flex flex-col items-center py-4">
      <div className="text-center mb-5">
        <h1 className="font-display text-xl tracking-wide text-[var(--gold)]">THE VAULT</h1>
        <p className="text-xs text-[var(--text-dim)] mt-1">Every monster you&apos;ve forged</p>
      </div>

      {!configured && (
        <GamePanel className="rounded-2xl p-6 w-full text-center flex flex-col items-center gap-2 mt-6">
          <p className="text-3xl">🛠️</p>
          <p className="text-sm text-[var(--text-dim)]">
            Sign-in isn&apos;t set up yet — the app owner needs to add the Firebase environment variables.
          </p>
        </GamePanel>
      )}

      {configured && authLoading && (
        <div className="w-10 h-10 rounded-full border-4 border-[var(--accent)]/30 border-t-[var(--accent)] spin-slow mt-6" />
      )}

      {configured && !authLoading && !user && (
        <GamePanel className="rounded-2xl p-6 w-full text-center flex flex-col items-center gap-3 mt-6">
          <p className="text-3xl">🔒</p>
          <p className="text-sm text-[var(--text-dim)]">Sign in to see the monsters you&apos;ve forged.</p>
          <GameButton size="md" onClick={signIn}>
            Sign in with Google
          </GameButton>
        </GamePanel>
      )}

      {!authLoading && user && error && (
        <GamePanel className="rounded-2xl p-4 w-full text-center flex flex-col gap-3 mt-6">
          <p className="text-sm text-[var(--danger)]">{error}</p>
          <GameButton size="md" className="self-center px-6" onClick={() => setRetryTick((t) => t + 1)}>
            Try again
          </GameButton>
        </GamePanel>
      )}

      {!authLoading && user && !error && monsters === null && (
        <div className="w-10 h-10 rounded-full border-4 border-[var(--accent)]/30 border-t-[var(--accent)] spin-slow mt-6" />
      )}

      {!authLoading && user && !error && monsters?.length === 0 && (
        <GamePanel className="rounded-2xl p-6 w-full text-center flex flex-col items-center gap-3 mt-6">
          <p className="text-3xl">🥚</p>
          <p className="text-sm text-[var(--text-dim)]">The vault is empty.</p>
          <Link href="/">
            <GameButton size="md">Forge your first egg</GameButton>
          </Link>
        </GamePanel>
      )}

      {!authLoading && user && !error && monsters && monsters.length > 0 && (
        <div className="grid grid-cols-2 gap-3 w-full pop-in">
          {monsters.map((m) => (
            <GamePanel key={m.id} className="rounded-2xl p-3 flex flex-col items-center gap-1.5" glow="var(--accent)">
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
            </GamePanel>
          ))}
        </div>
      )}
    </div>
  );
}
