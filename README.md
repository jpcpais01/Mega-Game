# Mega Game — Essence Forge

A mobile-first, installable PWA prototype for Mega Game's core loop: combine elemental essences into an egg,
watch it get designed and illustrated by an AI art pipeline, then hatch it into a monster — both the egg and the
monster idle on screen as looping pixel-art sprite animations.

## How the loop works

1. **Pick essences** — choose 1–5 essences (of 20, repeats allowed) in `components/EssencePicker.tsx`.
2. **`POST /api/egg-details`** (`app/api/egg-details/route.ts`) — calls the **Egg Creator** LLM
   (`openai/gpt-5.6-luna` via OpenRouter chat completions, JSON mode) with the chosen essences. Returns an egg
   name, a ≤20-word mini lore, five 1–100 stats, and a text-to-image prompt. This is the only step the player
   waits on — it's a fast text-only call.
3. **Reveal** — `components/EggReveal.tsx` shows the egg immediately (name/lore/stats), with the artwork area as
   a shimmering placeholder. The instant the egg's details come back, the app fires two requests **in parallel**
   (see `app/page.tsx`):
   - **`POST /api/egg-image`** renders the egg's artwork as a sprite sheet (see below) — a soft glow pulse or
     gentle wobble, not it cracking or hatching.
   - **`POST /api/hatch`** starts designing and rendering the monster — it only needs the egg's name/lore/stats,
     not its finished artwork, so there's no reason to wait for the egg image first.
   Both results stream into the UI as they land; by the time the player taps "Hatch," the monster is often
   already done.
4. **`POST /api/hatch`** (`app/api/hatch/route.ts`) calls the **Monster Designer** LLM with the egg's
   name/lore/stats/essences to get a monster name, lore, and an image prompt (explicitly excluding any
   egg/shell — full-body monster only), then renders it the same sprite-sheet way as the egg.
5. **Sprite sheets** — every generated image (egg and monster alike) is requested as a single 1024×1024 image
   containing a 4×4 grid of 16 pixel-art animation frames (isometric front-left view) depicting a simple
   looping idle animation appropriate to the subject, requested directly from the image model in one shot — no
   separate "figure out the animation" step needed (`lib/sprite.ts` has the grid constants and the shared
   instruction text; `lib/openrouter.ts`'s `generateImage({ spriteSheet: true })` appends it).
   `components/SpriteAnimator.tsx` is the canvas player: it slices the sheet into its 16 256×256 cells and steps
   through them at a fixed frame rate with `imageSmoothingEnabled = false` for crisp pixel edges — a classic
   sprite-sheet player, no external library. Used for both the egg (`EggReveal.tsx`) and the monster
   (`MonsterStage.tsx`).

### Background transparency

The image model's OpenRouter route only accepts `background: "auto" | "opaque"` in principle, but empirically
(see `lib/openrouter.ts`) it sometimes *does* honor `background: "transparent"` too — so `generateImage()` tries
that first, and only falls back to a chroma-key pipeline (paint a flat solid magenta background, then strip it
to real alpha server-side with `sharp`, see `lib/chroma-key.ts`) if the transparent request is rejected. The
outcome is cached per warm serverless instance so later calls skip straight to whichever strategy actually works.

All LLM and image calls happen server-side in the API routes so the OpenRouter key is never exposed to the client.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in OPENROUTER_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The essence-forge flow works fully once the API key is set;
without it, the API routes return a 500 with a clear error message.

## Deploying on Vercel

1. Push this repo to GitHub and import it into Vercel.
2. In the Vercel project's **Settings → Environment Variables**, add `OPENROUTER_API_KEY` with your OpenRouter key.
3. Deploy. The app is a PWA (`public/manifest.json`, `public/sw.js`, icons in `public/icons/`) — on a phone,
   "Add to Home Screen" installs it as a standalone app.

## Notes / follow-ups

- Essence definitions live in `lib/essences.ts` — add/edit essences there.
- Prompts for both LLM roles live in `lib/prompts.ts`. Background and sprite-sheet framing instructions are
  deliberately kept OUT of the LLM-authored `imagePrompt` and appended programmatically in `lib/openrouter.ts` —
  that's what lets the background strategy and sprite-sheet toggle change without a second text-LLM call.
- The OpenRouter request/response plumbing is isolated in `lib/openrouter.ts` so swapping models later is a
  one-line change.
- Sprite sheets are currently a single fixed camera angle (front-left isometric) and a single idle animation —
  more directions/animations would mean more grid cells or more sheets per monster.
- This build covers the essence → egg → hatch → idle-monster core loop only, as scoped — no persistence,
  collection screen, or battling yet.
