"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { Ability, EggData, EggDetails, LearnedAbility, MonsterData } from "@/lib/types";

export const NEST_SIZE = 5;

export type SlotState =
  | { status: "empty" }
  | { status: "forging"; startedAt: number }
  | { status: "forge-failed"; essenceIds: string[]; error: string }
  | { status: "egg-ready"; egg: EggData; error: string | null }
  | { status: "hatching"; egg: EggData; startedAt: number }
  | {
      status: "monster-ready";
      egg: EggData;
      monster: MonsterData;
      monsterSaved: boolean;
      savedMonsterId: string | null;
      saveError: string | null;
      error: string | null;
    }
  | {
      status: "learning-ability";
      egg: EggData;
      monster: MonsterData;
      monsterSaved: boolean;
      savedMonsterId: string | null;
      ability: Ability;
      startedAt: number;
    }
  | { status: "done"; egg: EggData; monster: MonsterData; learnedAbility: LearnedAbility | null };

// Diagnostic info for a slot's most recent animation attempt — kept
// separate from SlotState's own `error` field, which drives blocking
// retry UI. This is supplementary: the raw, unsliced video straight from
// the model (so you can tell whether the model itself produced motion, or
// our own extract/chroma-key/encode pipeline lost it) plus the last
// animation error message, if any, even when the slot otherwise recovered
// by falling back to a still image.
export type AnimationDebugInfo = { videoUrl?: string; error?: string };

type ForgeContextValue = {
  slots: SlotState[];
  animationDebug: Record<number, AnimationDebugInfo>;
  startForge: (index: number, essenceIds: string[]) => void;
  retryForge: (index: number) => void;
  hatch: (index: number) => void;
  chooseAbility: (index: number, ability: Ability) => void;
  skipAbility: (index: number) => void;
  release: (index: number) => void;
  cancel: (index: number) => void;
  dismissError: (index: number) => void;
};

const ForgeContext = createContext<ForgeContextValue | null>(null);

const VIDEO_POLL_INTERVAL_MS = 4000;
const VIDEO_POLL_MAX_ATTEMPTS = 90; // ~6 minutes ceiling

class AbortedError extends Error {}

async function postJson<T>(url: string, body: unknown, idToken?: string | null, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `Request to ${url} failed`);
  return data as T;
}

type SpriteVideoResult = {
  imageDataUrl: string;
  debugVideoDataUrl?: string;
  saved?: boolean;
  saveError?: string | null;
};

async function pollSpriteVideo(
  jobId: string,
  extraParams: Record<string, string> = {},
  idToken?: string | null,
  signal?: AbortSignal
): Promise<SpriteVideoResult> {
  for (let attempt = 0; attempt < VIDEO_POLL_MAX_ATTEMPTS; attempt++) {
    const params = new URLSearchParams({ jobId, ...extraParams });
    const res = await fetch(`/api/sprite-video/status?${params.toString()}`, {
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "Failed to check animation status");
    if (data.status === "completed") return data as SpriteVideoResult;
    if (data.status === "failed" || data.status === "cancelled" || data.status === "expired") {
      throw new Error(data.error ?? `Animation generation ${data.status}`);
    }
    await sleep(VIDEO_POLL_INTERVAL_MS, signal);
  }
  throw new Error("Timed out waiting for the animation to render");
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortedError());
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new AbortedError());
      },
      { once: true }
    );
  });
}

async function submitSpriteVideo(
  params: {
    stillImageDataUrl: string;
    kind: "idle" | "ability";
    monsterName?: string;
    abilityName?: string;
    abilityDescription?: string;
  },
  signal?: AbortSignal
): Promise<string> {
  const { jobId } = await postJson<{ jobId: string }>("/api/sprite-video/submit", params, undefined, signal);
  return jobId;
}

function isAbortError(err: unknown): boolean {
  return err instanceof AbortedError || (err instanceof DOMException && err.name === "AbortError");
}

export function ForgeProvider({ children }: { children: React.ReactNode }) {
  const { user, getIdToken } = useAuth();
  const [slots, setSlots] = useState<SlotState[]>(() => Array.from({ length: NEST_SIZE }, () => ({ status: "empty" })));
  const [animationDebug, setAnimationDebug] = useState<Record<number, AnimationDebugInfo>>({});
  const abortControllersRef = useRef<Map<number, AbortController>>(new Map());
  // Auth state used inside long-running background chains via a ref, since
  // those chains outlive any single render and closures would otherwise
  // capture a stale `user`/`getIdToken` from whenever they started.
  const authRef = useRef({ user, getIdToken });
  useEffect(() => {
    authRef.current = { user, getIdToken };
  }, [user, getIdToken]);

  const setSlot = useCallback((index: number, next: SlotState) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? next : s)));
  }, []);

  const recordAnimationDebug = useCallback((index: number, info: AnimationDebugInfo) => {
    setAnimationDebug((prev) => ({ ...prev, [index]: { ...prev[index], ...info } }));
  }, []);

  const newSignal = useCallback((index: number): AbortSignal => {
    abortControllersRef.current.get(index)?.abort();
    const controller = new AbortController();
    abortControllersRef.current.set(index, controller);
    return controller.signal;
  }, []);

  // Generates the egg's own idle animation in the background: still image
  // first (shown right away), then submits + polls for the animated sheet.
  // Runs independently of whatever screen is mounted — nothing here reads
  // component state, everything lands back in the shared slots array.
  const beginEggAnimation = useCallback(
    async (index: number, details: EggDetails, signal: AbortSignal) => {
      let stillImageDataUrl: string;
      try {
        const result = await postJson<{ imageDataUrl: string }>(
          "/api/egg-image",
          { imagePrompt: details.imagePrompt },
          undefined,
          signal
        );
        stillImageDataUrl = result.imageDataUrl;
        setSlots((prev) =>
          prev.map((s, i) => (i === index && s.status === "egg-ready" ? { ...s, egg: { ...s.egg, imageDataUrl: stillImageDataUrl } } : s))
        );
      } catch (err) {
        if (!isAbortError(err)) console.error("egg-image error:", err);
        return;
      }

      try {
        const jobId = await submitSpriteVideo({ stillImageDataUrl, kind: "idle" }, signal);
        const result = await pollSpriteVideo(jobId, {}, undefined, signal);
        recordAnimationDebug(index, { videoUrl: result.debugVideoDataUrl, error: undefined });
        setSlots((prev) =>
          prev.map((s, i) =>
            i === index && s.status === "egg-ready"
              ? { ...s, egg: { ...s.egg, imageDataUrl: result.imageDataUrl, animated: true } }
              : s
          )
        );
      } catch (err) {
        if (!isAbortError(err)) {
          console.error("egg animation error:", err);
          recordAnimationDebug(index, { error: err instanceof Error ? err.message : "Egg animation failed" });
        }
        // Keep whatever still image already landed — the animation upgrade just didn't happen.
      }
    },
    [recordAnimationDebug]
  );

  const startForge = useCallback(
    (index: number, essenceIds: string[]) => {
      const signal = newSignal(index);
      setSlot(index, { status: "forging", startedAt: Date.now() });

      (async () => {
        try {
          const details = await postJson<EggDetails>("/api/egg-details", { essenceIds }, undefined, signal);
          const egg: EggData = { ...details, imageDataUrl: null, animated: false };
          setSlot(index, { status: "egg-ready", egg, error: null });
          beginEggAnimation(index, details, signal);
        } catch (err) {
          if (isAbortError(err)) return;
          console.error("forge error:", err);
          setSlot(index, {
            status: "forge-failed",
            essenceIds,
            error: err instanceof Error ? err.message : "Failed to forge egg",
          });
        }
      })();
    },
    [newSignal, setSlot, beginEggAnimation]
  );

  const retryForge = useCallback(
    (index: number) => {
      const slot = slots[index];
      if (slot.status !== "forge-failed") return;
      startForge(index, slot.essenceIds);
    },
    [slots, startForge]
  );

  const hatch = useCallback(
    (index: number) => {
      const slot = slots[index];
      if (slot.status !== "egg-ready") return;
      const { egg } = slot;
      const signal = newSignal(index);
      setSlot(index, { status: "hatching", egg, startedAt: Date.now() });

      (async () => {
        try {
          const monsterJson = await postJson<MonsterData>(
            "/api/hatch",
            { eggName: egg.eggName, lore: egg.lore, stats: egg.stats, essenceIds: egg.essenceIds },
            undefined,
            signal
          );

          // The monster's own idle animation is part of "hatching" — unlike
          // the egg, we wait for it (success or failure) before the slot
          // becomes tappable, so hatching reads as a real, deliberate wait.
          let monster = monsterJson;
          try {
            const jobId = await submitSpriteVideo({ stillImageDataUrl: monster.stillImageDataUrl, kind: "idle" }, signal);
            const result = await pollSpriteVideo(jobId, {}, undefined, signal);
            recordAnimationDebug(index, { videoUrl: result.debugVideoDataUrl, error: undefined });
            monster = { ...monster, imageDataUrl: result.imageDataUrl, animated: true };
          } catch (err) {
            if (isAbortError(err)) throw err;
            console.error("monster animation error:", err);
            recordAnimationDebug(index, { error: err instanceof Error ? err.message : "Monster animation failed" });
            // Keep the still — hatching still completes, just unanimated.
          }

          setSlot(index, {
            status: "monster-ready",
            egg,
            monster,
            monsterSaved: false,
            savedMonsterId: null,
            saveError: null,
            error: null,
          });

          // Auto-save to the signed-in player's collection, in the background.
          const { user: currentUser, getIdToken: currentGetIdToken } = authRef.current;
          if (currentUser) {
            try {
              const idToken = await currentGetIdToken();
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
                idToken,
                signal
              );
              setSlots((prev) =>
                prev[index]?.status === "monster-ready"
                  ? prev.map((s, i) => (i === index ? { ...s, monsterSaved: true, savedMonsterId: saved.id } : s))
                  : prev
              );
            } catch (err) {
              if (isAbortError(err)) throw err;
              console.error("auto-save error:", err);
              const message = err instanceof Error ? err.message : "Failed to save this monster to your collection";
              setSlots((prev) => (prev[index]?.status === "monster-ready" ? prev.map((s, i) => (i === index ? { ...s, saveError: message } : s)) : prev));
            }
          }
        } catch (err) {
          if (isAbortError(err)) return;
          console.error("hatch error:", err);
          setSlot(index, {
            status: "egg-ready",
            egg,
            error: err instanceof Error ? err.message : "Failed to hatch egg",
          });
        }
      })();
    },
    [slots, newSignal, setSlot, recordAnimationDebug]
  );

  const chooseAbility = useCallback(
    (index: number, ability: Ability) => {
      const slot = slots[index];
      if (slot.status !== "monster-ready") return;
      const { egg, monster, monsterSaved, savedMonsterId } = slot;
      const signal = newSignal(index);
      setSlot(index, { status: "learning-ability", egg, monster, monsterSaved, savedMonsterId, ability, startedAt: Date.now() });

      (async () => {
        try {
          const { user: currentUser, getIdToken: currentGetIdToken } = authRef.current;
          const jobId = await submitSpriteVideo(
            {
              stillImageDataUrl: monster.stillImageDataUrl,
              kind: "ability",
              monsterName: monster.monsterName,
              abilityName: ability.name,
              abilityDescription: ability.description,
            },
            signal
          );

          const idToken = currentUser ? await currentGetIdToken() : null;
          // Passing savedMonsterId (plus the ability name/description again)
          // is what makes /api/sprite-video/status persist the learned
          // ability onto the saved monster doc once the video finishes —
          // omitted entirely when the monster never made it to Firestore.
          const extraParams: Record<string, string> =
            savedMonsterId != null
              ? { savedMonsterId, abilityName: ability.name, abilityDescription: ability.description }
              : {};
          const result = await pollSpriteVideo(jobId, extraParams, idToken, signal);
          recordAnimationDebug(index, { videoUrl: result.debugVideoDataUrl, error: undefined });

          const learned: LearnedAbility = { ...ability, imageDataUrl: result.imageDataUrl };
          setSlot(index, { status: "done", egg, monster, learnedAbility: learned });
        } catch (err) {
          if (isAbortError(err)) return;
          console.error("ability error:", err);
          recordAnimationDebug(index, { error: err instanceof Error ? err.message : "Ability animation failed" });
          setSlot(index, {
            status: "monster-ready",
            egg,
            monster,
            monsterSaved,
            savedMonsterId,
            saveError: null,
            error: err instanceof Error ? err.message : "Failed to learn ability",
          });
        }
      })();
    },
    [slots, newSignal, setSlot, recordAnimationDebug]
  );

  const skipAbility = useCallback(
    (index: number) => {
      const slot = slots[index];
      if (slot.status !== "monster-ready") return;
      setSlot(index, { status: "done", egg: slot.egg, monster: slot.monster, learnedAbility: null });
    },
    [slots, setSlot]
  );

  const release = useCallback(
    (index: number) => {
      abortControllersRef.current.get(index)?.abort();
      abortControllersRef.current.delete(index);
      setSlot(index, { status: "empty" });
    },
    [setSlot]
  );

  // Aborts an in-flight cooking step and rewinds the slot to the last state
  // that already has something real in it, instead of nuking the whole slot
  // the way release() does — cancelling a hatch shouldn't throw the egg
  // away, and cancelling an ability animation shouldn't throw the monster
  // away. Forging has nothing to rewind to yet, so it falls back to empty.
  const cancel = useCallback(
    (index: number) => {
      const slot = slots[index];
      abortControllersRef.current.get(index)?.abort();
      abortControllersRef.current.delete(index);

      if (slot.status === "hatching") {
        setSlot(index, { status: "egg-ready", egg: slot.egg, error: null });
      } else if (slot.status === "learning-ability") {
        setSlot(index, {
          status: "monster-ready",
          egg: slot.egg,
          monster: slot.monster,
          monsterSaved: slot.monsterSaved,
          savedMonsterId: slot.savedMonsterId,
          saveError: null,
          error: null,
        });
      } else {
        setSlot(index, { status: "empty" });
      }
    },
    [slots, setSlot]
  );

  const dismissError = useCallback(
    (index: number) => {
      setSlots((prev) =>
        prev.map((s, i) => {
          if (i !== index) return s;
          if (s.status === "egg-ready") return { ...s, error: null };
          if (s.status === "monster-ready") return { ...s, error: null };
          return s;
        })
      );
    },
    []
  );

  return (
    <ForgeContext.Provider
      value={{
        slots,
        animationDebug,
        startForge,
        retryForge,
        hatch,
        chooseAbility,
        skipAbility,
        release,
        cancel,
        dismissError,
      }}
    >
      {children}
    </ForgeContext.Provider>
  );
}

export function useForge(): ForgeContextValue {
  const ctx = useContext(ForgeContext);
  if (!ctx) throw new Error("useForge must be used within ForgeProvider");
  return ctx;
}
