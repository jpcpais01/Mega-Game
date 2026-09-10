"use client";

import { useEffect, useState } from "react";
import { DEFAULT_IMAGE_MODEL, ImageModelId, resolveImageModel } from "./image-models";

const LOCAL_KEY = "imageModel";

export function useImageModel() {
  const [model, setModel] = useState<ImageModelId>(DEFAULT_IMAGE_MODEL);

  useEffect(() => {
    (async () => {
      try {
        const stored = window.localStorage.getItem(LOCAL_KEY);
        if (stored) setModel(resolveImageModel(stored));
      } catch {
        // best-effort — ignore quota/availability errors
      }
    })();
  }, []);

  function selectModel(id: ImageModelId) {
    setModel(id);
    try {
      window.localStorage.setItem(LOCAL_KEY, id);
    } catch {
      // best-effort — ignore quota/availability errors
    }
  }

  return { model, selectModel };
}
