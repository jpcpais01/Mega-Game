import { Essence } from "./essences";
import { Ability } from "./types";

// Validates/backfills a raw LLM abilities array into exactly 4 usable
// Ability objects — used both right after hatch (4 candidates to choose a
// first ability from) and later, whenever a Vault monster learns another
// attack (4 fresh candidates from the same shape of LLM response).
export function validateAbilities(raw: unknown, essences: Essence[]): Ability[] {
  const abilities: Ability[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const a = entry as { name?: unknown; description?: unknown };
      if (typeof a.name === "string" && a.name.trim() && typeof a.description === "string" && a.description.trim()) {
        abilities.push({ name: a.name.trim(), description: a.description.trim() });
      }
      if (abilities.length === 4) break;
    }
  }
  while (abilities.length < 4) {
    const essence = essences[abilities.length % essences.length];
    abilities.push({
      name: `${essence.name} Strike`,
      description: `Channels raw ${essence.name.toLowerCase()} essence into a quick offensive strike.`,
    });
  }
  return abilities;
}
