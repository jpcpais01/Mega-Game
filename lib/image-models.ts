export type ImageModelId = "openai/gpt-image-2.5-flare" | "openai/gpt-image-2" | "google/gemini-3.1-flash-image";

export type ImageModelOption = {
  id: ImageModelId;
  name: string;
  tagline: string;
};

export const IMAGE_MODELS: ImageModelOption[] = [
  { id: "openai/gpt-image-2.5-flare", name: "Flare", tagline: "Balanced default — fast & detailed" },
  { id: "openai/gpt-image-2", name: "GPT Image 2", tagline: "OpenAI's flagship image model" },
  { id: "google/gemini-3.1-flash-image", name: "Nano Banana 2", tagline: "Google's fast, vivid image model" },
];

export const DEFAULT_IMAGE_MODEL: ImageModelId = "openai/gpt-image-2.5-flare";

export function isValidImageModel(id: unknown): id is ImageModelId {
  return typeof id === "string" && IMAGE_MODELS.some((m) => m.id === id);
}

export function resolveImageModel(id: unknown): ImageModelId {
  return isValidImageModel(id) ? id : DEFAULT_IMAGE_MODEL;
}
