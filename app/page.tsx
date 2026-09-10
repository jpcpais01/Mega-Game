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
const HATCH_STATUS_MESSAGES = ["Designing the monster…", "Rendering monster sprite sheet…"];
const ABILITY_STATUS_MESSAGES = ["Channeling the ability…", "Rendering ability animation…"];

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

export default function Home() {
  const { user, getIdToken } = useAuth();
  const { unlockedIds } = useUnlockedEssences();

  const [stage, setStage] = useState<Stage>("nest");
  const [slots, setSlots] = useState<(SlotEntry | null)[]>(() => Array(NEST_SIZE).fill(null));
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  const [egg, setEgg] = useState<EggData | null>(null);
  const [eggImageFailed, setEggImageFailed] = useState(false);
  const [monster, setMonster] = useState<MonsterData | null>(null);
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
  }, [monster, egg, user, getIdToken]);

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

  function resetWorkingState() {
    setEgg(null);
    setEggImageFailed(false);
    setMonster(null);
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
    setMonster(null);
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

  async function handleChooseAbility(ability: Ability) {
    if (!monster) return;
    setError(null);
    setLoading(true);
    startStatusCycle(ABILITY_STATUS_MESSAGES);
    try {
      const savedId = await savedMonsterIdPromiseRef.current?.catch(() => null);
      const idToken = savedId ? await getIdToken() : null;
      // savedMonsterId tells the route to persist the (server-shrunk) result
      // in this same request, instead of us sending the full sprite sheet
      // back to the server a second time — a high-detail sheet can be
      // several MB, past the platform's request body limit.
      const result = await postJson<{ imageDataUrl: string; saved?: boolean; saveError?: string | null }>(
        "/api/ability",
        {
          monsterName: monster.monsterName,
          monsterImageDataUrl: monster.imageDataUrl,
          abilityName: ability.name,
          abilityDescription: ability.description,
          savedMonsterId: savedId ?? undefined,
        },
        idToken
      );
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
