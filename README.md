# Mega Game — Essence Forge

A mobile-first, installable PWA prototype for Mega Game's core loop: combine elemental essences into an egg,
watch it get designed and illustrated by an AI art pipeline, then hatch it into a monster — both the egg and the
monster idle on screen as looping pixel-art sprite animations.

## How the loop works

0. **The Nest** (`components/Nest.tsx`, the home screen) — 5 slots, each an independent `SlotState` owned by
   `components/ForgeProvider.tsx` (see item 7 below). Tapping a slot opens whatever screen matches its current
   status: an empty slot opens the essence picker, a cooking slot opens its live progress view, a finished egg
   opens the reveal/hatch screen, and so on. `app/page.tsx` only tracks *which* slot is open — all of it is
   per-session UI state, separate from the persisted collection below.
1. **Pick essences** — choose 1–5 essences (of 20, repeats allowed) in `components/EssencePicker.tsx`.
2. **`POST /api/egg-details`** (`app/api/egg-details/route.ts`) — calls the **Egg Creator** LLM
   (`openai/gpt-5.6-luna` via OpenRouter chat completions, JSON mode) with the chosen essences. Returns an egg
   name, a ≤20-word mini lore, five 1–100 stats, and a text-to-image prompt. This is the only step the player
   waits on — it's a fast text-only call.
3. **Reveal** — `components/EggReveal.tsx` shows the egg immediately (name/lore/stats), with the artwork area as
   a shimmering placeholder until `POST /api/egg-image` (a soft glow pulse or gentle wobble, not it cracking or
   hatching) and its idle video finish in the background — see item 7 below for how that background work is
   started and kept running.
4. **Hatch is its own real wait** — the monster isn't designed or rendered until the player actually taps
   "Hatch." `POST /api/hatch` (`app/api/hatch/route.ts`) calls the **Monster Designer** LLM with the egg's
   name/lore/stats/essences to get a monster name, lore, and an image prompt (explicitly excluding any
   egg/shell — full-body monster only), renders its still reference, then waits for its idle video too — so the
   slot's `"hatching"` status genuinely covers the whole thing, not just the text step.
5. **Real animated WebPs via video, never a sprite sheet** — every animated egg/monster/ability image is built
   from a short AI-generated *video*, then reassembled into one genuine animated image file. First a plain still
   reference image is generated (`generateImage()` in `lib/openrouter.ts` — just the subject on a flat magenta
   backdrop). That still is submitted to OpenRouter's Video API (`minimax/hailuo-3-max`, `lib/video-api.ts`) as
   the first frame (the model only accepts a single keyframe — sending both first and last frame is a 400), with
   a prompt asking for a calm, seamlessly-looping, 10fps-feeling pixel-art animation on that same flat magenta
   background, ending on the same pose it started on. Video generation routinely takes well over a minute, so
   the server never blocks on it: `POST /api/sprite-video/submit` only submits the job and returns its id; the
   client polls `GET /api/sprite-video/status?jobId=...` (`components/ForgeProvider.tsx`) until it's done. Once
   complete, that status route downloads the finished video, extracts frames at 10fps with a bundled `ffmpeg`
   binary (`ffmpeg-static`, `lib/video-frames.ts`), chroma-keys each frame individually (`lib/chroma-key.ts` —
   the video's background can drift slightly frame to frame, unlike a single generated image, so keying happens
   per-frame), then encodes all of them as one animated, transparent, infinitely-looping WebP
   (`lib/animated-image.ts` — `sharp`'s raw-multi-page input, `{ loop: 0 }`). `components/SpriteAnimator.tsx` is
   nothing more than a plain `<img>` — the browser decodes and loops the WebP natively forever, no canvas, no
   frame-stepping JS, no grid to slice or get out of sync with.
   Because the still shows immediately while its video renders in the background, an egg/monster's
   `imageDataUrl` starts out as the plain still PNG and gets swapped for the animated WebP once the video
   finishes — `animated` on `EggData`/`MonsterData` just tracks which one it currently is, for save/UI-gating
   logic (a player can hit "Skip" on `MonsterStage` and commit a monster to a Nest slot before its animation is
   ready); `SpriteAnimator` itself doesn't need to know either way, since both render the same way.
6. **First ability** — the Monster Designer LLM also invents 4 candidate abilities alongside the monster
   (`lib/prompts.ts`, validated/backfilled in `app/api/hatch/route.ts`). `components/AbilityChoice.tsx` shows
   them as cards; picking one submits the monster's saved *still* reference (`MonsterData.stillImageDataUrl` —
   set once at hatch and never overwritten by the idle animation, so it stays a clean single-pose image-to-image
   reference) to the same video pipeline with a prompt describing the ability's action. If the monster was
   already saved to the player's collection, the status-poll call also carries that saved id so the finished
   animated WebP gets persisted server-side the moment it's ready, in the very request that generates it —
   sending a several-MB finished animation back to the server in a *second* request once blew past Vercel's
   request body size limit. `components/SlotDetail.tsx` shows the result once the slot reaches its final
   `"done"` state.
7. **Generation survives navigation** — `components/ForgeProvider.tsx` is a React Context mounted once at the
   root layout (`app/layout.tsx`), above the page component Next.js unmounts on every route change. It owns a
   `SlotState` per Nest slot (`empty | forging | forge-failed | egg-ready | hatching | monster-ready |
   learning-ability | done`) and runs every forge/hatch/ability chain as a plain async function that writes its
   results back into that shared state — never into local component state. That means closing the "generating"
   view, hopping to the Vault, and coming back later still shows the slot cooking (or done) on the Nest grid
   (`components/CookingSlotView.tsx`, `components/Nest.tsx` — no fixed-duration countdown, just a spinner and
   rotating status text, since the real wait varies job to job). `app/page.tsx` is just a thin router over
   `slots[activeSlot]?.status` from `useForge()`. Each in-flight chain carries its own `AbortController` so
   leaving a slot's cooking view and tapping "Cancel" can stop it cleanly — `cancel()` rewinds to the last
   state that has something real in it (hatching → back to the egg, learning an ability → back to the monster)
   rather than deleting the whole slot; `release()` is the explicit full reset. The same provider also backs
   the Vault's "Learn New Attack" flow (`vaultAbilityJobs`, keyed by Firestore monster id instead of a slot
   index) for the same reason — that job needs to survive navigation too.

## Accounts & collection

Google sign-in (Firebase Auth) is optional — the whole forge → hatch → ability loop works fully signed out. When
a player *is* signed in, every hatched monster is auto-saved to their account in the background, no explicit
"save" button — see `hatch()` in `components/ForgeProvider.tsx`, which saves once the monster's own idle
animation has settled (succeeded or failed). `app/collection/page.tsx` (the Vault) lists everything a signed-in
player has forged as a 3-per-row grid; each card cycles its art through the monster's idle loop 3 times, then
each learned attack once in turn, repeating forever (`components/VaultMonsterCard.tsx`, timed off
`VIDEO_SPRITE_DURATION_SECONDS`). Tapping a card opens `components/VaultMonsterDetail.tsx`, which shows the
idle animation, every learned attack, and a **Learn New Attack** button — it fetches 4 fresh candidate abilities
from `POST /api/monsters/[id]/abilities` (an LLM call, given the monster's context and the names it already
knows, so it won't repeat one), and picking one runs through the exact same submit → poll → animate pipeline as
the original hatch-time ability choice, via `ForgeProvider`'s `startLearnVaultAbility()` — a per-monster-id
background job that, like everything else in `ForgeProvider`, survives navigating away and back.

Because a monster can keep learning new attacks indefinitely, each learned ability is its own document in a
Firestore **subcollection** (`users/{uid}/monsters/{monsterId}/abilities/{abilityId}`) rather than an array
field on the monster doc — that keeps the monster doc's own size bounded no matter how many attacks it
eventually learns, instead of risking Firestore's 1MiB single-document cap. `GET /api/monsters` fetches each
monster's abilities alongside it and merges them into the response; `POST /api/sprite-video/status` is what
actually writes a newly-finished ability into that subcollection, the moment its animation is ready.

Auth is client-side (`components/AuthProvider.tsx`, Firebase JS SDK, Google provider via `signInWithRedirect`
for reliability inside an installed PWA where popups are flaky). Firestore is **never** touched from the
client — every read/write goes through an API route that verifies the Firebase ID token server-side
(`lib/auth-server.ts`) and then uses the Firebase **Admin** SDK (`lib/firebase/admin.ts`), which bypasses
security rules entirely. That's deliberate: it means Firestore rules can stay locked to "deny all" (see the
setup steps) since nothing but our own verified server code ever reaches them — no client-side rules to get
subtly wrong.

**No Firebase Storage** — new Firebase projects need the paid Blaze plan to use Storage at all, so images are
stored directly in Firestore documents instead of a separate bucket. A full-resolution animated WebP is too big
for that, so `lib/image-resize.ts`'s `shrinkDataUrlForFirestore()` downscales each one before saving —
nearest-neighbor, so hard pixel edges stay crisp instead of blurring. It branches on whether the source is
animated (checked via `sharp(buffer, { animated: true }).metadata().pages`, not just its declared mime type):
an animated WebP is re-encoded staying animated (`sharp(buffer, { animated: true }).resize(...)` keeps every
page and its delay), while a plain still is re-encoded as a palette-quantized PNG. Re-encoding an animated
source through the *non*-animated path would silently flatten it to its first frame only — that's a real bug
this pipeline had to avoid. This only affects the *persisted* copy in the Vault; the live forge/hatch/ability
flow always displays the full-resolution image the model generated.

If `NEXT_PUBLIC_FIREBASE_*` env vars aren't set, the app doesn't crash — `AuthProvider` detects this
(`isFirebaseConfigured()` in `lib/firebase/client.ts`) and behaves as permanently signed-out: sign-in UI hides
itself, and the Collection page explains that it isn't set up yet. The forge loop itself needs no Firebase
config at all.

### Background transparency

Neither the still-image model nor the video model reliably honors a real transparent-background request, so
`generateImage()` always asks for a flat, unmistakable solid magenta backdrop and strips it to real alpha
afterward server-side with `sharp`: `lib/chroma-key.ts` (color-distance keying with spill suppression at
partially-keyed edge pixels, so a thinned-but-still-magenta-tinted edge pixel doesn't show up as a visible
fringe). For stills it runs once; for video-sourced animations it runs per extracted frame
(`lib/animated-image.ts`) — the video's backdrop can drift slightly frame to frame in a way a single generated
image doesn't, so keying once per frame is what actually keeps it clean.

All LLM and image calls happen server-side in the API routes so the OpenRouter key is never exposed to the client.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below for Firebase)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The forge → hatch → ability loop works fully once
`OPENROUTER_API_KEY` is set, with no Firebase config at all — accounts/collection are additive. See **Firebase
setup** below for the full step-by-step to enable sign-in and the collection page.

## Deploying on Vercel

1. Push this repo to GitHub and import it into Vercel.
2. In the Vercel project's **Settings → Environment Variables**, add every variable from `.env.example`
   (`OPENROUTER_API_KEY` at minimum; the `NEXT_PUBLIC_FIREBASE_*` and `FIREBASE_*` ones once you've done the
   Firebase setup below).
3. Deploy. The app is a PWA (`public/manifest.json`, `public/sw.js`, icons in `public/icons/`) — on a phone,
   "Add to Home Screen" installs it as a standalone app.

## Firebase setup (Google sign-in + collection)

1. Go to the [Firebase console](https://console.firebase.google.com/) → **Add project** (or reuse an existing
   Google Cloud project). Name it whatever you like.
2. **Enable Authentication**: left sidebar → *Build → Authentication* → *Get started* → under *Sign-in method*,
   enable **Google**. Set a support email if asked.
3. **Enable Firestore**: left sidebar → *Build → Firestore Database* → *Create database* → start in
   **production mode** (any region is fine — pick one close to your users). We never write client-side, so
   go to the *Rules* tab and set:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if false;
       }
     }
   }
   ```
   This is safe (not broken) — all real access goes through the Admin SDK on the server, which ignores rules.
   No Firebase Storage needed — it requires the paid Blaze plan, so this app stores images in Firestore
   directly instead (see **Accounts & collection** above).
4. **Register a web app**: *Project settings* (gear icon) → *General* → *Your apps* → **Add app → Web** (`</>`
   icon). Give it a nickname, skip Firebase Hosting. It'll show a `firebaseConfig` object — copy those values
   into the `NEXT_PUBLIC_FIREBASE_*` vars in `.env.local` / Vercel (`apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`,
   `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, etc. — you can ignore `storageBucket`, it's unused).
5. **Generate an Admin SDK service account**: *Project settings* → *Service accounts* → **Generate new private
   key**. This downloads a JSON file — from it, fill in:
   - `FIREBASE_PROJECT_ID` = the JSON's `project_id`
   - `FIREBASE_CLIENT_EMAIL` = the JSON's `client_email`
   - `FIREBASE_PRIVATE_KEY` = the JSON's `private_key` (paste it exactly, `\n`s and all — Vercel's env var UI
     handles multi-line values fine; if pasting into a single-line `.env.local`, keep the literal `\n`
     sequences, `lib/firebase/admin.ts` converts them back to real newlines at runtime)

   **Never commit this JSON file or paste its contents anywhere but env vars** — it's a server-only secret with
   full admin access to your Firebase project.
6. **Authorize your domain for Google sign-in**: *Authentication* → *Settings* → *Authorized domains* → add
   your Vercel domain (`your-app.vercel.app`, plus any custom domain). `localhost` is already allowed by default
   for local dev.
7. Redeploy (or restart `npm run dev` locally) once the env vars are set — `AuthProvider` picks up the new
   config on load. Sign in from the header, forge a monster, and check `/collection`.

## Notes / follow-ups

- Essence definitions live in `lib/essences.ts` — add/edit essences there.
- Prompts for all LLM roles live in `lib/prompts.ts`. Background and animation-framing instructions are
  deliberately kept OUT of the LLM-authored `imagePrompt` and appended programmatically in `lib/openrouter.ts` —
  that's what lets the background strategy change without a second text-LLM call.
- The OpenRouter request/response plumbing is isolated in `lib/openrouter.ts` so swapping models later is a
  one-line change.
- Animations are currently a single fixed camera angle (front-left isometric, `ART_STYLE` in `lib/prompts.ts`)
  and a fixed 5-second/10fps length (`lib/sprite.ts`) — a longer or shorter animation means changing those
  constants together with `lib/animated-image.ts`'s per-frame size.
- Video generation is slow (often 30s–3min+) and costs meaningfully more per generation than the still-image
  model alone — expect forging a monster (egg + monster + optionally an ability, each its own video) to take
  noticeably longer than a single-image-only pipeline would.
- Frame extraction shells out to a bundled `ffmpeg` binary (`ffmpeg-static`) via `lib/video-frames.ts` — Next's
  build-time file tracing can't auto-detect a binary resolved at runtime rather than `require()`d, so
  `next.config.ts` explicitly includes it for `/api/sprite-video/status`.
- Only the *first* ability is currently offered right after hatching; there's no further leveling/ability
  system yet, and no battling.
