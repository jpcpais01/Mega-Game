"use client";

import { useEffect, useRef, useState } from "react";
import AbilityChoice from "@/components/AbilityChoice";
import AbilityLearned from "@/components/AbilityLearned";
import { useAuth } from "@/components/AuthProvider";
import EssencePicker from "@/components/EssencePicker";
import EggReveal from "@/components/EggReveal";
import MonsterStage from "@/components/MonsterStage";
import Nest from "@/components/Nest";
import SlotDetail from "@/components/SlotDetail";
import GameButton from "@/components/ui/GameButton";
import GamePanel from "@/components/ui/GamePanel";
import { Ability, EggData, EggDetails, LearnedAbility, MonsterData, SlotEntry } from "@/lib/types";
import { useUnlockedEssences } from "@/lib/unlocked-essences";

type Stage = "nest" | "view" | "pick" | "egg" | "monster" | "ability" | "learned";

const NEST_SIZE = 5;

const EGG_DETAILS_STATUS_MESSAGES = ["Blending essences…", "Consulting the Egg Creator…"];
const HATCH_STATUS_MESSAGES = ["Designing the monster…", "Sketching a reference pose…"];
const ABILITY_STATUS_MESSAGES = [
  "Channeling the ability…",
  "Directing the animation…",
  "Rendering the ability video…",
  "This can take a couple of minutes…",
  "Compositing sprite frames…",
];

const VIDEO_POLL_INTERVAL_MS = 4000;
const VIDEO_POLL_MAX_ATTEMPTS = 90; // ~6 minutes ceiling

async function postJson<T>(url: string, body: unknown, idToken?: string | null): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `Request to ${url} failed`);
  return data as T;
}

type SpriteVideoResult = { imageDataUrl: string; saved?: boolean; saveError?: string | null };

// Video generation routinely takes well past a minute, so the server only
// ever submits the job and returns its id — this polls a status endpoint
// from the client instead of waiting inside one request, which would risk
// the platform's own function-duration limit regardless of how the server
// code is written.
async function pollSpriteVideo(
  jobId: string,
  extraParams: Record<string, string> = {},
  idToken?: string | null
): Promise<SpriteVideoResult> {
  for (let attempt = 0; attempt < VIDEO_POLL_MAX_ATTEMPTS; attempt++) {
    const params = new URLSearchParams({ jobId, ...extraParams });
    const res = await fetch(`/api/sprite-video/status?${params.toString()}`, {
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "Failed to check animation status");
    if (data.status === "completed") return data as SpriteVideoResult;
    if (data.status === "failed" || data.status === "cancelled" || data.status === "expired") {
      throw new Error(data.error ?? `Animation generation ${data.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));
  }
  throw new Error("Timed out waiting for the animation to render");
}

async function submitSpriteVideo(params: {
  stillImageDataUrl: string;
  kind: "idle" | "ability";
  monsterName?: string;
  abilityName?: string;
  abilityDescription?: string;
}): Promise<string> {
  const { jobId } = await postJson<{ jobId: string }>("/api/sprite-video/submit", params);
  return jobId;
}

export default function Home() {
  const { user, getIdToken } = useAuth();
  const { unlockedIds } = useUnlockedEssences();

  const [stage, setStage] = useState<Stage>("nest");
  const [slots, setSlots] = useState<(SlotEntry | null)[]>(() => Array(NEST_SIZE).fill(null));
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  const [egg, setEgg] = useState<EggData | null>(null);
  const [eggImageFailed, setEggImageFailed] = useState(false);
  const [eggAnimationSettled, setEggAnimationSettled] = useState(false);
  const [monster, setMonster] = useState<MonsterData | null>(null);
  const [monsterAnimationSettled, setMonsterAnimationSettled] = useState(false);
  const [learnedAbility, setLearnedAbility] = useState<LearnedAbility | null>(null);
  const [monsterSaved, setMonsterSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [abilitySaved, setAbilitySaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [statusIndex, setStatusIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const monsterPromiseRef = useRef<Promise<MonsterData> | null>(null);
  const savedMonsterIdPromiseRef = useRef<Promise<string | null> | null>(null);
  const autoSaveStartedRef = useRef(false);

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

  // The moment we have a hatched monster AND the egg's own artwork, auto-save
  // the whole thing to the signed-in user's collection in the background —
  // no explicit "save" button needed. Guests just skip this silently.
  //
  // Also waits for both idle animations to settle (succeeded or failed) so
  // the Vault always gets the best available image — animated if the video
  // finished in time, the still as a fallback if it didn't — rather than
  // racing to save the bare still the instant it's ready.
  //
  // The user check must come BEFORE the autoSaveStartedRef lock: Firebase
  // auth state resolves asynchronously, so this effect can fire once while
  // `user` is still null (not yet hydrated) even for a signed-in visitor.
  // Locking the ref first meant that single premature run permanently
  // blocked every later retry, so the save silently never happened even
  // though the user really was signed in — exactly the "monster never
  // shows up in the Vault, no error either" symptom.
  useEffect(() => {
    if (autoSaveStartedRef.current) return;
    if (!monster || !egg?.imageDataUrl) return;
    if (!eggAnimationSettled || !monsterAnimationSettled) return;
    if (!user) return;
    autoSaveStartedRef.current = true;

    const promise = (async (): Promise<string | null> => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("Couldn't get a sign-in token to save this monster");
      const saved = await postJson<{ id: string }>(
        "/api/monsters",
        {
          eggName: egg.eggName,
          eggLore: egg.lore,
          stats: egg.stats,
          essenceIds: egg.essenceIds,
          eggImageDataUrl: egg.imageDataUrl,
          monsterName: monster.monsterName,
          monsterLore: monster.lore,
          monsterImageDataUrl: monster.imageDataUrl,
          monsterAnimated: monster.animated,
          abilities: monster.abilities,
        },
        idToken
      );
      return saved.id;
    })();
    savedMonsterIdPromiseRef.current = promise;
    promise
      .then(() => setMonsterSaved(true))
      .catch((err) => {
        console.error("auto-save error:", err);
        setSaveError(err instanceof Error ? err.message : "Failed to save this monster to your collection");
      });
  }, [monster, egg, user, getIdToken, eggAnimationSettled, monsterAnimationSettled]);

  function beginMonsterGeneration(details: EggDetails) {
    const promise = postJson<MonsterData>("/api/hatch", {
      eggName: details.eggName,
      lore: details.lore,
      stats: details.stats,
      essenceIds: details.essenceIds,
    }).then((m) => {
      setMonster(m);
      // Kick off the monster's own idle animation in the background — don't
      // block the hatch reveal on it, and don't let it clobber a fresher
      // monster if the player has already moved on to a new egg by the
      // time it finishes.
      (async () => {
        try {
          const jobId = await submitSpriteVideo({ stillImageDataUrl: m.stillImageDataUrl, kind: "idle" });
          const result = await pollSpriteVideo(jobId);
          setMonster((prev) =>
            prev && prev.stillImageDataUrl === m.stillImageDataUrl
              ? { ...prev, imageDataUrl: result.imageDataUrl, animated: true }
              : prev
          );
        } catch (err) {
          console.error("monster animation error:", err);
        } finally {
          setMonsterAnimationSettled(true);
        }
      })();
      return m;
    });
    monsterPromiseRef.current = promise;
    promise.catch(() => {}); // prevent unhandled-rejection noise; handleHatch awaits & surfaces the real error
  }

  async function beginEggImage(details: EggDetails) {
    let stillImageDataUrl: string;
    try {
      const result = await postJson<{ imageDataUrl: string }>("/api/egg-image", { imagePrompt: details.imagePrompt });
      stillImageDataUrl = result.imageDataUrl;
      setEgg((prev) => (prev ? { ...prev, imageDataUrl: stillImageDataUrl } : prev));
    } catch (err) {
      console.error("egg-image error:", err);
      setEggImageFailed(true);
      setEggAnimationSettled(true);
      return;
    }

    try {
      const jobId = await submitSpriteVideo({ stillImageDataUrl, kind: "idle" });
      const result = await pollSpriteVideo(jobId);
      setEgg((prev) => (prev ? { ...prev, imageDataUrl: result.imageDataUrl, animated: true } : prev));
    } catch (err) {
      console.error("egg animation error:", err);
      // Keep showing the still — the animation upgrade just didn't happen.
    } finally {
      setEggAnimationSettled(true);
    }
  }

  function resetWorkingState() {
    setEgg(null);
    setEggImageFailed(false);
    setEggAnimationSettled(false);
    setMonster(null);
    setMonsterAnimationSettled(false);
    setLearnedAbility(null);
    setMonsterSaved(false);
    setSaveError(null);
    setAbilitySaved(false);
    monsterPromiseRef.current = null;
    savedMonsterIdPromiseRef.current = null;
    autoSaveStartedRef.current = false;
    setError(null);
  }

  function handleSelectEmptySlot(index: number) {
    setActiveSlot(index);
    resetWorkingState();
    setStage("pick");
  }

  function handleViewSlot(index: number) {
    setActiveSlot(index);
    setStage("view");
  }

  function handleCloseSlotView() {
    setActiveSlot(null);
    setStage("nest");
  }

  function handleReleaseSlot() {
    if (activeSlot === null) return;
    setSlots((prev) => prev.map((s, i) => (i === activeSlot ? null : s)));
    setActiveSlot(null);
    setStage("nest");
  }

  // Commits the current in-progress monster (with or without a learned
  // ability) into the active nest slot and returns to the nest overview.
  function commitActiveSlotAndReturnToNest() {
    if (activeSlot !== null && monster) {
      const index = activeSlot;
      setSlots((prev) => prev.map((s, i) => (i === index ? { monster, learnedAbility } : s)));
    }
    setActiveSlot(null);
    resetWorkingState();
    setStage("nest");
  }

  async function handleForge(essenceIds: string[]) {
    setError(null);
    setEggImageFailed(false);
    setEggAnimationSettled(false);
    setMonster(null);
    setMonsterAnimationSettled(false);
    setLearnedAbility(null);
    setMonsterSaved(false);
    setSaveError(null);
    setAbilitySaved(false);
    monsterPromiseRef.current = null;
    savedMonsterIdPromiseRef.current = null;
    autoSaveStartedRef.current = false;
    setLoading(true);
    startStatusCycle(EGG_DETAILS_STATUS_MESSAGES);
    try {
      const details = await postJson<EggDetails>("/api/egg-details", { essenceIds });
      setEgg({ ...details, imageDataUrl: null, animated: false });
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

  async function handleChooseAbility(ability: Ability) {
    if (!monster) return;
    setError(null);
    setLoading(true);
    startStatusCycle(ABILITY_STATUS_MESSAGES);
    try {
      const savedId = await savedMonsterIdPromiseRef.current?.catch(() => null);
      const idToken = savedId ? await getIdToken() : null;

      const jobId = await submitSpriteVideo({
        stillImageDataUrl: monster.stillImageDataUrl,
        kind: "ability",
        monsterName: monster.monsterName,
        abilityName: ability.name,
        abilityDescription: ability.description,
      });

      // savedMonsterId tells the status route to persist the (server-
      // shrunk) result the moment it's ready, instead of us sending the
      // full sprite sheet back to the server in a second request — a
      // detailed sheet can be several MB, past the platform's request
      // body limit.
      const extraParams: Record<string, string> = {};
      if (savedId) {
        extraParams.savedMonsterId = savedId;
        extraParams.abilityName = ability.name;
        extraParams.abilityDescription = ability.description;
      }

      const result = await pollSpriteVideo(jobId, extraParams, idToken);
      const learned: LearnedAbility = { ...ability, imageDataUrl: result.imageDataUrl };
      setLearnedAbility(learned);
      setStage("learned");

      if (result.saved) {
        setAbilitySaved(true);
      } else if (result.saveError) {
        setSaveError(result.saveError);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to learn ability");
    } finally {
      setLoading(false);
      stopStatusCycle();
    }
  }

  const activeEntry = activeSlot !== null ? slots[activeSlot] : null;

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center py-4">
      {loading && (
        <div className="flex flex-col items-center gap-4 py-10">
          <div className="w-16 h-16 rounded-full border-4 border-[var(--accent)]/30 border-t-[var(--accent)] spin-slow" />
          <p className="text-sm text-[var(--text-dim)] text-center min-h-[1.5em]">
            {statusMessages[statusIndex]}
          </p>
        </div>
      )}

      {!loading && error && (
        <GamePanel className="rounded-2xl p-4 w-full text-center flex flex-col gap-3">
          <p className="text-sm text-[var(--danger)]">{error}</p>
          <GameButton size="md" onClick={() => setError(null)}>
            Try again
          </GameButton>
        </GamePanel>
      )}

      {!loading && !error && stage === "nest" && (
        <Nest slots={slots} onSelectEmpty={handleSelectEmptySlot} onViewFilled={handleViewSlot} />
      )}
      {!loading && !error && stage === "view" && activeEntry && (
        <SlotDetail entry={activeEntry} onClose={handleCloseSlotView} onRelease={handleReleaseSlot} />
      )}
      {!loading && !error && stage === "pick" && (
        <EssencePicker onForge={handleForge} loading={loading} unlockedEssenceIds={unlockedIds} />
      )}
      {!loading && !error && stage === "egg" && egg && (
        <EggReveal egg={egg} onHatch={handleHatch} loading={loading} imageFailed={eggImageFailed} />
      )}
      {!loading && !error && stage === "monster" && monster && (
        <MonsterStage
          monster={monster}
          onLearnAbility={() => setStage("ability")}
          onSkip={commitActiveSlotAndReturnToNest}
          saved={monsterSaved}
          saveError={saveError}
        />
      )}
      {!loading && !error && stage === "ability" && monster && (
        <AbilityChoice monster={monster} onChoose={handleChooseAbility} />
      )}
      {!loading && !error && stage === "learned" && monster && learnedAbility && (
        <AbilityLearned
          monster={monster}
          ability={learnedAbility}
          onDone={commitActiveSlotAndReturnToNest}
          saved={abilitySaved}
          saveError={saveError}
        />
      )}
    </div>
  );
}
