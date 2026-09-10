"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import GameButton from "@/components/ui/GameButton";
import GamePanel from "@/components/ui/GamePanel";
import ParticleBurst from "@/components/ui/ParticleBurst";
import { EVENT_ESSENCES } from "@/lib/essences";
import { useUnlockedEssences } from "@/lib/unlocked-essences";

export default function EventsPage() {
  const { user, configured } = useAuth();
  const { unlockedIds, claim, loading } = useUnlockedEssences();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [justClaimedId, setJustClaimedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim(id: string) {
    setError(null);
    setClaimingId(id);
    try {
      await claim(id);
      setJustClaimedId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim essence");
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <div className="w-full flex-1 flex flex-col items-center py-4">
      <div className="text-center mb-5">
        <h1 className="font-display text-xl tracking-wide text-[var(--gold)]">THE RIFT</h1>
        <p className="text-xs text-[var(--text-dim)] mt-1">A tear between worlds — claim what leaks through</p>
      </div>

      {configured && !user && (
        <GamePanel className="rounded-2xl p-3 w-full text-center mb-4">
          <p className="text-xs text-[var(--text-dim)]">
            Playing as a guest — claims are saved on this device only. Sign in to keep them on your account.
          </p>
        </GamePanel>
      )}

      {error && (
        <GamePanel className="rounded-2xl p-3 w-full text-center mb-4">
          <p className="text-xs text-[var(--danger)]">{error}</p>
        </GamePanel>
      )}

      {loading ? (
        <div className="w-10 h-10 rounded-full border-4 border-[var(--accent)]/30 border-t-[var(--accent)] spin-slow mt-6" />
      ) : (
        <div className="flex flex-col gap-4 w-full">
          {EVENT_ESSENCES.map((essence) => {
            const isUnlocked = unlockedIds.includes(essence.id);
            const isClaiming = claimingId === essence.id;
            return (
              <GamePanel
                key={essence.id}
                className="relative rounded-2xl p-5 flex flex-col items-center gap-2 overflow-hidden"
                glow={essence.glow}
              >
                {justClaimedId === essence.id && <ParticleBurst color={essence.color} />}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border-2"
                  style={{
                    borderColor: essence.color,
                    background: `${essence.color}22`,
                    boxShadow: `0 0 20px -4px ${essence.glow}`,
                  }}
                >
                  {essence.emoji}
                </div>
                <p className="font-display text-base text-[var(--gold)]">{essence.name}</p>
                <p className="text-xs text-[var(--text-dim)] text-center max-w-xs">{essence.flavor}</p>

                {isUnlocked ? (
                  <p className="text-xs font-semibold text-[var(--accent-2)] mt-1">✓ Claimed — unlocked in your forge</p>
                ) : (
                  <GameButton
                    size="md"
                    className="mt-1 px-6"
                    disabled={isClaiming}
                    onClick={() => handleClaim(essence.id)}
                  >
                    {isClaiming ? "Claiming…" : "Claim Essence"}
                  </GameButton>
                )}
              </GamePanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
