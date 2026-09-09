# Mega Game — Essence Forge

A mobile-first, installable PWA prototype for Mega Game's core loop: combine elemental essences into an egg,
watch it get designed and illustrated by an AI art pipeline, then hatch it into a monster that idles on screen
with a lightweight procedural mesh-warp animation.

## How the loop works

1. **Pick essences** — choose 1–5 essences (of 20, repeats allowed) in `components/EssencePicker.tsx`.
2. **`POST /api/create-egg`** (`app/api/create-egg/route.ts`)
   - Calls the **Egg Creator** LLM (`openai/gpt-5.6-luna` via OpenRouter chat completions, JSON mode) with the
     chosen essences. It returns an egg name, a ≤20-word mini lore, five 1–100 stats, and a text-to-image prompt.
   - Sends that prompt to the **image model** (`openai/gpt-image-2.5-flare` via OpenRouter's `/images` endpoint)
     with a transparent background, ~20°-off-front framing, requesting only the egg (no scenery).
3. **Reveal** — `components/EggReveal.tsx` shows the egg art, name, lore and animated stat bars, with a "Hatch"
   button.
4. **`POST /api/hatch`** (`app/api/hatch/route.ts`)
   - Calls the **Monster Designer** LLM with the egg's name/lore/stats/essences to get a monster name, lore, and
     an image prompt (explicitly excluding any egg/shell — full-body monster only, transparent background).
   - Generates the monster image the same way as the egg.
   - Sends that monster image to the **Animation Thinker** LLM (multimodal chat completion, image input) and
     asks it to act as a 2D animator choosing 4–7 anchor points (normalized x/y) on the creature's silhouette for
     an idle "breathing" mesh animation. If this call fails or returns something malformed, a deterministic
     fallback point set is generated instead (`lib/mesh.ts`) so the game never gets stuck.
5. **Idle animation** — `components/MeshCanvas.tsx` subdivides the monster image into a triangle grid, computes
   each grid vertex's displacement every frame via inverse-distance-weighted blending of the anchor points (each
   oscillating on its own sine wave), and redraws the grid using per-triangle affine-mapped `drawImage` calls —
   a lightweight "stretchy mesh puppet" effect with no external animation library.

All three LLM calls and both image calls happen server-side in the two API routes so the OpenRouter key is never
exposed to the client.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in OPENROUTER_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The essence-forge flow works fully once the API key is set;
without it, `create-egg`/`hatch` will return a 500 with a clear error message.

## Deploying on Vercel

1. Push this repo to GitHub and import it into Vercel.
2. In the Vercel project's **Settings → Environment Variables**, add `OPENROUTER_API_KEY` with your OpenRouter key.
3. Deploy. The app is a PWA (`public/manifest.json`, `public/sw.js`, icons in `public/icons/`) — on a phone,
   "Add to Home Screen" installs it as a standalone app.

## Notes / follow-ups

- Essence definitions live in `lib/essences.ts` — add/edit essences there.
- Prompts for all three LLM roles live in `lib/prompts.ts`.
- The OpenRouter request/response plumbing is isolated in `lib/openrouter.ts` so swapping models later is a
  one-line change.
- This build covers the essence → egg → hatch → idle-monster core loop only, as scoped — no persistence,
  collection screen, or battling yet.
