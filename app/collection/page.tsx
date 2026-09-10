"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import GameButton from "@/components/ui/GameButton";
import GamePanel from "@/components/ui/GamePanel";
import VaultMonsterCard from "@/components/VaultMonsterCard";
import VaultMonsterDetail from "@/components/VaultMonsterDetail";
import { SavedAbility, SavedMonsterSummary } from "@/lib/types";

export default function CollectionPage() {
  const { user, loading: authLoading, configured, signIn, getIdToken } = useAuth();
  const [monsters, setMonsters] = useState<SavedMonsterSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [openMonsterId, setOpenMonsterId] = useState<string | null>(null);

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

  function handleAbilityLearned(monsterId: string, ability: SavedAbility) {
    setMonsters((prev) =>
      prev
        ? prev.map((m) => (m.id === monsterId ? { ...m, learnedAbilities: [...m.learnedAbilities, ability] } : m))
        : prev
    );
  }

  const openMonster = openMonsterId ? (monsters?.find((m) => m.id === openMonsterId) ?? null) : null;

  if (openMonster) {
    return (
      <div className="w-full flex-1 flex flex-col items-center py-4">
        <VaultMonsterDetail
          monster={openMonster}
          onClose={() => setOpenMonsterId(null)}
          onAbilityLearned={handleAbilityLearned}
        />
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col items-center py-4">
      <div className="text-center mb-5">
        <h1 className="font-display text-xl tracking-wide text-[var(--gold)]">THE VAULT</h1>
        <p className="text-xs text-[var(--text-dim)] mt-1">Every monster you&apos;ve forged</p>
      </div>

      {!configured && (
        <GamePanel className="p-6 w-full text-center flex flex-col items-center gap-2 mt-6">
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
        <GamePanel className="p-6 w-full text-center flex flex-col items-center gap-3 mt-6">
          <p className="text-3xl">🔒</p>
          <p className="text-sm text-[var(--text-dim)]">Sign in to see the monsters you&apos;ve forged.</p>
          <GameButton size="md" onClick={signIn}>
            Sign in with Google
          </GameButton>
        </GamePanel>
      )}

      {!authLoading && user && error && (
        <GamePanel className="p-4 w-full text-center flex flex-col gap-3 mt-6">
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
        <GamePanel className="p-6 w-full text-center flex flex-col items-center gap-3 mt-6">
          <p className="text-3xl">🥚</p>
          <p className="text-sm text-[var(--text-dim)]">The vault is empty.</p>
          <Link href="/">
            <GameButton size="md">Forge your first egg</GameButton>
          </Link>
        </GamePanel>
      )}

      {!authLoading && user && !error && monsters && monsters.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 w-full pop-in">
          {monsters.map((m) => (
            <VaultMonsterCard key={m.id} monster={m} onTap={() => setOpenMonsterId(m.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
