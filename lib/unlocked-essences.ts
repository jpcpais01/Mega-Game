"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

const LOCAL_KEY = "unlockedEssenceIds";

function readLocal(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeLocal(ids: string[]) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(ids));
  } catch {
    // best-effort — ignore quota/availability errors
  }
}

export function useUnlockedEssences() {
  const { user, getIdToken } = useAuth();
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        if (!cancelled) {
          setUnlockedIds(readLocal());
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const idToken = await getIdToken();
        const res = await fetch("/api/essences/unlocked", {
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        });
        if (!res.ok) throw new Error("Failed to load unlocked essences");
        const data = await res.json();
        if (!cancelled) setUnlockedIds(Array.isArray(data.unlockedEssenceIds) ? data.unlockedEssenceIds : []);
      } catch {
        if (!cancelled) setUnlockedIds(readLocal());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, getIdToken]);

  const claim = useCallback(
    async (essenceId: string) => {
      if (unlockedIds.includes(essenceId)) return;
      const next = [...unlockedIds, essenceId];
      setUnlockedIds(next);

      if (!user) {
        writeLocal(next);
        return;
      }

      try {
        const idToken = await getIdToken();
        const res = await fetch("/api/essences/unlocked", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify({ essenceId }),
        });
        if (!res.ok) throw new Error("Failed to claim essence");
      } catch (err) {
        setUnlockedIds((prev) => prev.filter((id) => id !== essenceId));
        throw err instanceof Error ? err : new Error("Failed to claim essence");
      }
    },
    [unlockedIds, user, getIdToken]
  );

  return { unlockedIds, claim, loading };
}
