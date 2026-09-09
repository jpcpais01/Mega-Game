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
6. **First ability** — the Monster Designer LLM also invents 4 candidate abilities alongside the monster
   (`lib/prompts.ts`, validated/backfilled in `app/api/hatch/route.ts`). `components/AbilityChoice.tsx` shows
   them as cards; picking one calls **`POST /api/ability`**, which does an **image-to-image** request —
   `generateImage({ referenceImages: [monsterSpriteSheet], spriteSheet: "<the ability's motion>" })` — so the
   new sprite sheet keeps the exact same character design but performs the chosen ability instead of idling.
   `components/AbilityLearned.tsx` plays the result.

## Accounts & collection

Google sign-in (Firebase Auth) is optional — the whole forge → hatch → ability loop works fully signed out. When
a player *is* signed in, every hatched monster (plus its learned ability, once chosen) is auto-saved to their
account in the background, no explicit "save" button — see the `useEffect` in `app/page.tsx` that fires once
both the monster and the egg's own artwork are ready. `app/collection/page.tsx` lists everything a signed-in
player has forged.

Auth is client-side (`components/AuthProvider.tsx`, Firebase JS SDK, Google provider via `signInWithRedirect`
for reliability inside an installed PWA where popups are flaky). Firestore and Storage are **never** touched
from the client — every read/write goes through an API route that verifies the Firebase ID token server-side
(`lib/auth-server.ts`) and then uses the Firebase **Admin** SDK (`lib/firebase/admin.ts`), which bypasses
security rules entirely. That's deliberate: it means Firestore/Storage rules can stay locked to "deny all"
(see the setup steps) since nothing but our own verified server code ever reaches them — no client-side rules
to get subtly wrong.

Sprite sheets are too big for a Firestore document (1 MiB limit; a 1024×1024 PNG can get close to or over that
as base64), so the actual images live in **Firebase Storage** and Firestore only stores metadata + a Storage
download URL per image (`lib/storage.ts` uploads a data URL and returns a token-based public URL, the same
mechanism the Firebase client SDK's `getDownloadURL()` uses).

If `NEXT_PUBLIC_FIREBASE_*` env vars aren't set, the app doesn't crash — `AuthProvider` detects this
(`isFirebaseConfigured()` in `lib/firebase/client.ts`) and behaves as permanently signed-out: sign-in UI hides
itself, and the Collection page explains that it isn't set up yet. The forge loop itself needs no Firebase
config at all.

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
4. **Enable Storage**: left sidebar → *Build → Storage* → *Get started* → keep the default bucket. On the
   *Rules* tab, set the same deny-all:
   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read, write: if false;
       }
     }
   }
   ```
   Images are still fetchable by anyone with their URL — the per-file download token embedded in the URL
   (`lib/storage.ts`) is what authorizes that specific read, the same mechanism the client SDK's
   `getDownloadURL()` relies on, and it isn't gated by these rules.
5. **Register a web app**: *Project settings* (gear icon) → *General* → *Your apps* → **Add app → Web** (`</>`
   icon). Give it a nickname, skip Firebase Hosting. It'll show a `firebaseConfig` object — copy those values
   into the `NEXT_PUBLIC_FIREBASE_*` vars in `.env.local` / Vercel (`apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`,
   `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, etc.).
6. **Generate an Admin SDK service account**: *Project settings* → *Service accounts* → **Generate new private
   key**. This downloads a JSON file — from it, fill in:
   - `FIREBASE_PROJECT_ID` = the JSON's `project_id`
   - `FIREBASE_CLIENT_EMAIL` = the JSON's `client_email`
   - `FIREBASE_PRIVATE_KEY` = the JSON's `private_key` (paste it exactly, `\n`s and all — Vercel's env var UI
     handles multi-line values fine; if pasting into a single-line `.env.local`, keep the literal `\n`
     sequences, `lib/firebase/admin.ts` converts them back to real newlines at runtime)
   - `FIREBASE_STORAGE_BUCKET` = same bucket as `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (looks like
     `<project-id>.appspot.com` or `<project-id>.firebasestorage.app` depending on when the project was created)

   **Never commit this JSON file or paste its contents anywhere but env vars** — it's a server-only secret with
   full admin access to your Firebase project.
7. **Authorize your domain for Google sign-in**: *Authentication* → *Settings* → *Authorized domains* → add
   your Vercel domain (`your-app.vercel.app`, plus any custom domain). `localhost` is already allowed by default
   for local dev.
8. Redeploy (or restart `npm run dev` locally) once the env vars are set — `AuthProvider` picks up the new
   config on load. Sign in from the header, forge a monster, and check `/collection`.

## Notes / follow-ups

- Essence definitions live in `lib/essences.ts` — add/edit essences there.
- Prompts for all LLM roles live in `lib/prompts.ts`. Background and sprite-sheet framing instructions are
  deliberately kept OUT of the LLM-authored `imagePrompt` and appended programmatically in `lib/openrouter.ts` —
  that's what lets the background strategy and sprite-sheet toggle change without a second text-LLM call.
- The OpenRouter request/response plumbing is isolated in `lib/openrouter.ts` so swapping models later is a
  one-line change.
- Sprite sheets are currently a single fixed camera angle (front-left isometric) — more directions would mean
  more grid cells or more sheets per monster/ability.
- Only the *first* ability is currently offered right after hatching; there's no further leveling/ability
  system yet, and no battling.
