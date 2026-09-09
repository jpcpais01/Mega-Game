export type Essence = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  glow: string;
  flavor: string;
};

export const ESSENCES: Essence[] = [
  { id: "fire", name: "Fire", emoji: "🔥", color: "#ff5a3c", glow: "#ff8a5c", flavor: "raw combustive heat and rage" },
  { id: "water", name: "Water", emoji: "💧", color: "#2fb5ff", glow: "#7fd4ff", flavor: "flowing depths and pressure" },
  { id: "earth", name: "Earth", emoji: "🪨", color: "#a9784f", glow: "#d6ab7a", flavor: "ancient stone and root" },
  { id: "wind", name: "Wind", emoji: "🌪️", color: "#8fe3c7", glow: "#c9fff0", flavor: "restless gales and speed" },
  { id: "lightning", name: "Lightning", emoji: "⚡", color: "#f6e24a", glow: "#fff9b0", flavor: "raw electric impulse" },
  { id: "ice", name: "Ice", emoji: "❄️", color: "#9fe8ff", glow: "#e6faff", flavor: "crystalline cold and stillness" },
  { id: "nature", name: "Nature", emoji: "🌿", color: "#5fd15b", glow: "#a6ff9e", flavor: "wild growth and vitality" },
  { id: "shadow", name: "Shadow", emoji: "🌑", color: "#6b4bd6", glow: "#a98cff", flavor: "creeping dark and secrecy" },
  { id: "light", name: "Light", emoji: "✨", color: "#ffe27a", glow: "#fff6d1", flavor: "radiant purity and clarity" },
  { id: "toxic", name: "Toxic", emoji: "☣️", color: "#8dff3c", glow: "#c9ff9e", flavor: "corrosive venom and decay" },
  { id: "metal", name: "Metal", emoji: "⚙️", color: "#c7ccd6", glow: "#eef1f6", flavor: "forged alloy and precision" },
  { id: "crystal", name: "Crystal", emoji: "💎", color: "#7ce8ff", glow: "#d9fbff", flavor: "faceted resonance and refraction" },
  { id: "spirit", name: "Spirit", emoji: "👻", color: "#c9d6ff", glow: "#f1f5ff", flavor: "wandering echoes of the beyond" },
  { id: "cosmic", name: "Cosmic", emoji: "🌌", color: "#7a5cff", glow: "#c6b6ff", flavor: "starlight and the void between" },
  { id: "sonic", name: "Sonic", emoji: "🔊", color: "#ff8ad1", glow: "#ffd6f0", flavor: "resonant waves and vibration" },
  { id: "gravity", name: "Gravity", emoji: "🕳️", color: "#3c3450", glow: "#8c7fc9", flavor: "warping pull and mass" },
  { id: "time", name: "Time", emoji: "⏳", color: "#e2b25a", glow: "#ffe0a0", flavor: "looping moments and decay of ages" },
  { id: "blood", name: "Blood", emoji: "🩸", color: "#c62b3a", glow: "#ff6b78", flavor: "primal life force and ferocity" },
  { id: "dream", name: "Dream", emoji: "🌙", color: "#b18cff", glow: "#e6d9ff", flavor: "shifting psychic illusion" },
  { id: "magma", name: "Magma", emoji: "🌋", color: "#ff6a1f", glow: "#ffb066", flavor: "molten pressure from the deep earth" },
];

export const MAX_ESSENCES_PER_EGG = 5;

export function getEssence(id: string): Essence | undefined {
  return ESSENCES.find((e) => e.id === id);
}
