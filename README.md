# Mega Game — Essence Forge

A mobile-first, installable PWA prototype for Mega Game's core loop: combine elemental essences into an egg,
watch it get designed and illustrated by an AI art pipeline, then hatch it into a monster — both the egg and the
monster idle on screen as looping pixel-art sprite animations.

## How the loop works

0. **The Nest** (`components/Nest.tsx`, the home screen) — 5 slots. An empty slot starts a new forge; a filled
   slot opens `components/SlotDetail.tsx` to review that monster (and release the slot). `app/page.tsx`'s stage
   machine (`"nest" | "view" | "pick" | "egg" | "monster" | "ability" | "learned"`) tracks which slot is active
   and, once a monster (optionally with a learned ability) is finished, commits it into that slot and returns
   to the nest — it's per-session UI state, separate from the persisted collection below.
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
5. **Sprite sheets via video** — every animated sprite (egg idle, monster idle, and abilities) is built from a
   short AI-generated *video*, not a single multi-frame image. First a plain still reference image is generated
   (`generateImage()` in `lib/openrouter.ts` — no grid, just the subject on a flat magenta backdrop). That still
   is submitted to OpenRouter's Video API (`minimax/hailuo-3-max`, `lib/video-api.ts`) as both the first and last
   frame, with a prompt asking for a calm, seamlessly-looping, 10fps-feeling pixel-art animation on that same
   flat magenta background. Video generation routinely takes well over a minute, so the server never blocks on
   it: `POST /api/sprite-video/submit` only submits the job and returns its id; the client polls
   `GET /api/sprite-video/status?jobId=...` (`app/page.tsx`) until it's done. Once complete, that status route
   downloads the finished video, extracts frames at 10fps with a bundled `ffmpeg` binary (`ffmpeg-static`,
   `lib/video-frames.ts`), chroma-keys each frame individually (`lib/chroma-key.ts` — the video's background can
   drift slightly frame to frame, unlike a single generated image, so keying happens per-frame rather than once
   for a whole sheet), and packs them into one fixed 10×5-cell sprite sheet (`lib/video-sprite-sheet.ts`).
   `components/SpriteAnimator.tsx` plays it back the same way as before — slice the sheet into its cells and
   step through them on a canvas with `imageSmoothingEnabled = false` for crisp pixel edges.
   Because the still shows immediately while its video renders in the background, an egg/monster's
   `imageDataUrl` starts out as the plain still and gets swapped for the animated sheet once the video finishes
   — `animated` on `EggData`/`MonsterData` tracks which one it currently is (a player can hit "Skip" on
   `MonsterStage` and commit a monster to a Nest slot before its animation is ready), and `SpriteAnimator` is
   told `animated={false}` so it renders the still as-is instead of grid-slicing it.
6. **First ability** — the Monster Designer LLM also invents 4 candidate abilities alongside the monster
   (`lib/prompts.ts`, validated/backfilled in `app/api/hatch/route.ts`). `components/AbilityChoice.tsx` shows
   them as cards; picking one submits the monster's saved *still* reference (`MonsterData.stillImageDataUrl` —
   set once at hatch and never overwritten by the idle animation, so it stays a clean single-pose image-to-image
   reference) to the same sprite-video pipeline with a prompt describing the ability's action. If the monster
   was already saved to the player's collection, the status-poll call also carries that saved id so the
   finished sprite sheet gets persisted server-side the moment it's ready, in the very request that generates
   it — sending a several-MB finished sprite sheet back to the server in a *second* request once blew past
   Vercel's request body size limit. `components/AbilityLearned.tsx` plays the result.

## Accounts & collection

Google sign-in (Firebase Auth) is optional — the whole forge → hatch → ability loop works fully signed out. When
a player *is* signed in, every hatched monster (plus its learned ability, once chosen) is auto-saved to their
account in the background, no explicit "save" button — see the `useEffect` in `app/page.tsx` that fires once
both the monster and the egg's own artwork are ready. `app/collection/page.tsx` lists everything a signed-in
player has forged.

Auth is client-side (`components/AuthProvider.tsx`, Firebase JS SDK, Google provider via `signInWithRedirect`
for reliability inside an installed PWA where popups are flaky). Firestore is **never** touched from the
client — every read/write goes through an API route that verifies the Firebase ID token server-side
(`lib/auth-server.ts`) and then uses the Firebase **Admin** SDK (`lib/firebase/admin.ts`), which bypasses
security rules entirely. That's deliberate: it means Firestore rules can stay locked to "deny all" (see the
setup steps) since nothing but our own verified server code ever reaches them — no client-side rules to get
subtly wrong.

**No Firebase Storage** — new Firebase projects need the paid Blaze plan to use Storage at all, so images are
stored directly in the Firestore document instead of a separate bucket. A full-resolution 1024×1024 sprite
sheet is too big for that (Firestore caps a whole document at 1 MiB, and a monster doc holds up to three
images — egg, monster, learned ability), so `lib/image-resize.ts`'s `shrinkDataUrlForFirestore()` downscales
each one (nearest-neighbor, so hard pixel edges stay crisp instead of blurring) and re-encodes it as a
palette-quantized PNG before saving — pixel art compresses extremely well, so this comfortably fits all three
images plus metadata in one document. This only affects the *persisted* copy in `/collection`; the live
forge/hatch/ability flow always displays the full-resolution image the model generated.

If `NEXT_PUBLIC_FIREBASE_*` env vars aren't set, the app doesn't crash — `AuthProvider` detects this
(`isFirebaseConfigured()` in `lib/firebase/client.ts`) and behaves as permanently signed-out: sign-in UI hides
itself, and the Collection page explains that it isn't set up yet. The forge loop itself needs no Firebase
config at all.

### Background transparency

Neither the still-image model nor the video model reliably honors a real transparent-background request, so
`generateImage()` always asks for a flat, unmistakable solid magenta backdrop and strips it to real alpha
afterward server-side with `sharp`: `lib/chroma-key.ts` for stills (color-distance keying with spill
suppression at partially-keyed edge pixels, so a thinned-but-still-magenta-tinted edge pixel doesn't show up as
a visible fringe), and that same technique applied per-frame for video-sourced sprite sheets
(`lib/video-sprite-sheet.ts`) — the video's backdrop can drift slightly frame to frame in a way a single
generated image doesn't, so keying once per frame instead of once for the whole sheet is what actually keeps it
clean.

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
- Prompts for all LLM roles live in `lib/prompts.ts`. Background and sprite-sheet framing instructions are
  deliberately kept OUT of the LLM-authored `imagePrompt` and appended programmatically in `lib/openrouter.ts` —
  that's what lets the background strategy and sprite-sheet toggle change without a second text-LLM call.
- The OpenRouter request/response plumbing is isolated in `lib/openrouter.ts` so swapping models later is a
  one-line change.
- Sprite sheets are currently a single fixed camera angle (front-left isometric, `ART_STYLE` in
  `lib/prompts.ts`) and a fixed 5-second/10fps/10×5-grid animation length (`lib/sprite.ts`) — a longer or
  shorter animation means changing those constants together with `lib/video-sprite-sheet.ts`'s per-cell size.
- Video generation is slow (often 30s–3min+) and costs meaningfully more per generation than the still-image
  model alone — expect forging a monster (egg + monster + optionally an ability, each its own video) to take
  noticeably longer than a single-image-only pipeline would.
- Frame extraction shells out to a bundled `ffmpeg` binary (`ffmpeg-static`) via `lib/video-frames.ts` — Next's
  build-time file tracing can't auto-detect a binary resolved at runtime rather than `require()`d, so
  `next.config.ts` explicitly includes it for `/api/sprite-video/status`.
- Only the *first* ability is currently offered right after hatching; there's no further leveling/ability
  system yet, and no battling.
