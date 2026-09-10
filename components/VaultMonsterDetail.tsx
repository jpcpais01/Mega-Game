"use client";

import { useEffect, useState } from "react";
import { Ability, SavedAbility, SavedMonsterSummary } from "@/lib/types";
import { useAuth } from "./AuthProvider";
import CookingSlotView from "./CookingSlotView";
import { useForge } from "./ForgeProvider";
import SpriteAnimator from "./SpriteAnimator";
import GameButton from "./ui/GameButton";
import GamePanel, { PanelCorners } from "./ui/GamePanel";

export default function VaultMonsterDetail({
  monster,
  onClose,
  onAbilityLearned,
}: {
  monster: SavedMonsterSummary;
  onClose: () => void;
  onAbilityLearned: (monsterId: string, ability: SavedAbility) => void;
}) {
  const { getIdToken } = useAuth();
  const { vaultAbilityJobs, startLearnVaultAbility, cancelLearnVaultAbility, clearVaultAbilityJob } = useForge();
  const job = vaultAbilityJobs[monster.id];

  const [candidates, setCandidates] = useState<Ability[] | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);

  // The moment a background ability-learn job finishes, fold it into this
  // monster's displayed list and clear the job — the job's own job is done,
  // the learned ability lives on in the monster's (now-updated) list.
  useEffect(() => {
    if (job?.status !== "done") return;
    onAbilityLearned(monster.id, {
      id: job.savedAbilityId ?? `local-${Date.now()}`,
      name: job.ability.name,
      description: job.ability.description,
      imageDataUrl: job.imageDataUrl,
      learnedAt: Date.now(),
    });
    clearVaultAbilityJob(monster.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status]);

  async function loadCandidates() {
    setLoadingCandidates(true);
    setCandidatesError(null);
    try {
      const idToken = await getIdToken();
      const res = await fetch(`/api/monsters/${monster.id}/abilities`, {
        method: "POST",
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to think of new attacks");
      setCandidates(data.abilities as Ability[]);
    } catch (err) {
      setCandidatesError(err instanceof Error ? err.message : "Failed to think of new attacks");
    } finally {
      setLoadingCandidates(false);
    }
  }

  function chooseCandidate(ability: Ability) {
    setCandidates(null);
    startLearnVaultAbility(
      monster.id,
      { stillImageDataUrl: monster.monsterStillImageDataUrl, monsterName: monster.monsterName },
      ability
    );
  }

  if (job?.status === "learning") {
    return (
      <CookingSlotView
        kind="learning-ability"
        startedAt={job.startedAt}
        title="Learning an ability…"
        subtitle={job.ability.name}
        imageDataUrl={monster.monsterImageDataUrl}
        imageAnimated={monster.monsterAnimated}
        onBack={onClose}
        onCancel={() => cancelLearnVaultAbility(monster.id)}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full pop-in">
      <div className="relative w-56 h-56 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full blur-3xl opacity-30 bg-[var(--accent-2)]" />
        <div className="relative">
          <SpriteAnimator imageDataUrl={monster.monsterImageDataUrl} size={224} />
        </div>
      </div>

      <div className="text-center">
        <h2 className="font-display text-xl text-[var(--gold)]">{monster.monsterName}</h2>
        <p className="text-sm text-[var(--text-dim)] mt-1 max-w-xs mx-auto">{monster.monsterLore}</p>
      </div>

      {job?.status === "error" && (
        <GamePanel className="p-3 w-full text-center flex flex-col gap-2">
          <p className="text-xs text-[var(--danger)]">{job.error}</p>
          <button
            onClick={() => clearVaultAbilityJob(monster.id)}
            className="text-xs text-[var(--text-dim)] underline underline-offset-2"
          >
            Dismiss
          </button>
        </GamePanel>
      )}

      {monster.learnedAbilities.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 w-full">
          {monster.learnedAbilities.map((ability) => (
            <GamePanel key={ability.id} className="p-3 flex flex-col items-center gap-2">
              <SpriteAnimator imageDataUrl={ability.imageDataUrl} size={100} />
              <div className="text-center">
                <p className="text-xs font-bold">{ability.name}</p>
                <p className="text-[10px] text-[var(--text-dim)] mt-0.5">{ability.description}</p>
              </div>
            </GamePanel>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--text-dim)]">No attacks learned yet</p>
      )}

      {candidatesError && (
        <GamePanel className="p-3 w-full text-center">
          <p className="text-xs text-[var(--danger)]">{candidatesError}</p>
        </GamePanel>
      )}

      {candidates ? (
        <div className="flex flex-col gap-3 w-full">
          <p className="text-xs text-[var(--text-dim)] text-center">Choose a new attack to learn</p>
          {candidates.map((ability) => (
            <button
              key={ability.name}
              onClick={() => chooseCandidate(ability)}
              className="game-panel rounded-2xl p-4 text-left active:scale-95 transition-transform"
            >
              <PanelCorners />
              <p className="font-bold text-sm">{ability.name}</p>
              <p className="text-xs text-[var(--text-dim)] mt-1">{ability.description}</p>
            </button>
          ))}
          <button
            onClick={() => setCandidates(null)}
            className="text-xs text-[var(--text-dim)] underline underline-offset-2 self-center"
          >
            Cancel
          </button>
        </div>
      ) : (
        <GameButton onClick={loadCandidates} disabled={loadingCandidates}>
          {loadingCandidates ? "Thinking of new attacks…" : "Learn New Attack"}
        </GameButton>
      )}

      <button onClick={onClose} className="text-xs text-[var(--text-dim)] underline underline-offset-2">
        Back to Vault
      </button>
    </div>
  );
}
