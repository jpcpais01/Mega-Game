"use client";

import { useState } from "react";
import AbilityChoice from "@/components/AbilityChoice";
import AnimationDebugPanel from "@/components/AnimationDebugPanel";
import CookingSlotView from "@/components/CookingSlotView";
import EggReveal from "@/components/EggReveal";
import EssencePicker from "@/components/EssencePicker";
import { useForge } from "@/components/ForgeProvider";
import MonsterStage from "@/components/MonsterStage";
import Nest from "@/components/Nest";
import SlotDetail from "@/components/SlotDetail";
import GameButton from "@/components/ui/GameButton";
import GamePanel from "@/components/ui/GamePanel";
import { useUnlockedEssences } from "@/lib/unlocked-essences";

export default function Home() {
  const { slots, animationDebug, startForge, retryForge, hatch, chooseAbility, skipAbility, release, cancel, dismissError } =
    useForge();
  const { unlockedIds } = useUnlockedEssences();
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [choosingAbility, setChoosingAbility] = useState(false);

  function backToNest() {
    setActiveSlot(null);
    setChoosingAbility(false);
  }

  function openSlot(index: number) {
    setActiveSlot(index);
    setChoosingAbility(false);
  }

  if (activeSlot === null) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center py-4">
        <Nest slots={slots} onTapSlot={openSlot} />
      </div>
    );
  }

  const slot = slots[activeSlot];

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center py-4">
      {slot.status === "empty" && (
        <EssencePicker
          onForge={(essenceIds) => startForge(activeSlot, essenceIds)}
          loading={false}
          unlockedEssenceIds={unlockedIds}
        />
      )}

      {slot.status === "forging" && (
        <CookingSlotView
          kind="forging"
          startedAt={slot.startedAt}
          title="Forging your egg…"
          onBack={backToNest}
          onCancel={() => {
            cancel(activeSlot);
            backToNest();
          }}
        />
      )}

      {slot.status === "forge-failed" && (
        <GamePanel className="rounded-2xl p-4 w-full text-center flex flex-col gap-3">
          <p className="text-sm text-[var(--danger)]">{slot.error}</p>
          <GameButton size="md" onClick={() => retryForge(activeSlot)}>
            Try again
          </GameButton>
          <div className="flex gap-4 justify-center">
            <button onClick={backToNest} className="text-xs text-[var(--text-dim)] underline underline-offset-2">
              Back to Nest
            </button>
            <button
              onClick={() => {
                release(activeSlot);
                backToNest();
              }}
              className="text-xs text-[var(--danger)] underline underline-offset-2"
            >
              Release slot
            </button>
          </div>
        </GamePanel>
      )}

      {slot.status === "egg-ready" && (
        <div className="flex flex-col items-center gap-4 w-full">
          {slot.error && (
            <GamePanel className="rounded-2xl p-3 w-full text-center flex flex-col gap-2">
              <p className="text-xs text-[var(--danger)]">{slot.error}</p>
              <button
                onClick={() => dismissError(activeSlot)}
                className="text-xs text-[var(--text-dim)] underline underline-offset-2"
              >
                Dismiss
              </button>
            </GamePanel>
          )}
          <EggReveal egg={slot.egg} onHatch={() => hatch(activeSlot)} onBack={backToNest} loading={false} />
        </div>
      )}

      {slot.status === "hatching" && (
        <CookingSlotView
          kind="hatching"
          startedAt={slot.startedAt}
          title="Hatching…"
          subtitle={slot.egg.eggName}
          onBack={backToNest}
          onCancel={() => {
            cancel(activeSlot);
            backToNest();
          }}
        />
      )}

      {slot.status === "monster-ready" && !choosingAbility && (
        <div className="flex flex-col items-center gap-4 w-full">
          {slot.error && (
            <GamePanel className="rounded-2xl p-3 w-full text-center flex flex-col gap-2">
              <p className="text-xs text-[var(--danger)]">{slot.error}</p>
              <button
                onClick={() => dismissError(activeSlot)}
                className="text-xs text-[var(--text-dim)] underline underline-offset-2"
              >
                Dismiss
              </button>
            </GamePanel>
          )}
          <MonsterStage
            monster={slot.monster}
            onLearnAbility={() => setChoosingAbility(true)}
            onSkip={() => {
              skipAbility(activeSlot);
              backToNest();
            }}
            onBack={backToNest}
            saved={slot.monsterSaved}
            saveError={slot.saveError}
          />
        </div>
      )}

      {slot.status === "monster-ready" && choosingAbility && (
        <AbilityChoice
          monster={slot.monster}
          onChoose={(ability) => {
            chooseAbility(activeSlot, ability);
            setChoosingAbility(false);
          }}
          onBack={() => setChoosingAbility(false)}
        />
      )}

      {slot.status === "learning-ability" && (
        <CookingSlotView
          kind="learning-ability"
          startedAt={slot.startedAt}
          title="Learning an ability…"
          subtitle={slot.ability.name}
          onBack={backToNest}
          onCancel={() => {
            cancel(activeSlot);
            backToNest();
          }}
        />
      )}

      {slot.status === "done" && (
        <SlotDetail
          monster={slot.monster}
          learnedAbility={slot.learnedAbility}
          onClose={backToNest}
          onRelease={() => {
            release(activeSlot);
            backToNest();
          }}
        />
      )}

      {animationDebug[activeSlot] && <AnimationDebugPanel debug={animationDebug[activeSlot]} />}
    </div>
  );
}
