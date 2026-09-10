import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { framesToAnimatedWebp } from "@/lib/animated-image";
import { VIDEO_SPRITE_FPS } from "@/lib/sprite";
import { downloadVideo, getVideoJobStatus } from "@/lib/video-api";
import { extractFramesFromVideo } from "@/lib/video-frames";

export const runtime = "nodejs";
export const maxDuration = 60;

// The client polls this repeatedly. Most calls just check status and return
// immediately (fast) — only the one call that first observes "completed"
// does the heavier work of downloading the video, extracting frames, and
// keying/reassembling them into one real animated WebP.
//
// For an ability job, the client also passes savedMonsterId/abilityName/
// abilityDescription as query params (it already holds these in its own
// state — no server-side session needed) so this same call can persist the
// result straight to Firestore, server-side, the moment it's ready —
// avoiding a second request that would have to re-send the full animated
// image over the wire, which is what caused the earlier 413 bug.
export async function GET(req: NextRequest) {
  try {
    const jobId = req.nextUrl.searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json({ error: "jobId query param is required" }, { status: 400 });
    }

    const job = await getVideoJobStatus(jobId);

    if (job.status === "completed") {
      const videoBuffer = await downloadVideo(jobId);
      const frames = await extractFramesFromVideo(videoBuffer, VIDEO_SPRITE_FPS);
      const imageDataUrl = await framesToAnimatedWebp(frames, VIDEO_SPRITE_FPS);

      const savedMonsterId = req.nextUrl.searchParams.get("savedMonsterId");
      const abilityName = req.nextUrl.searchParams.get("abilityName");
      const abilityDescription = req.nextUrl.searchParams.get("abilityDescription");

      let saved = false;
      let saveError: string | null = null;
      if (savedMonsterId && abilityName && abilityDescription) {
        try {
          const { requireUser } = await import("@/lib/auth-server");
          const { uid } = await requireUser(req);
          const { shrinkDataUrlForFirestore } = await import("@/lib/image-resize");
          const docRef = adminDb().collection("users").doc(uid).collection("monsters").doc(savedMonsterId);
          const snapshot = await docRef.get();
          if (!snapshot.exists) throw new Error("Monster not found");
          const shrunkImageDataUrl = await shrinkDataUrlForFirestore(imageDataUrl);
          await docRef.update({
            learnedAbility: { name: abilityName, description: abilityDescription, imageDataUrl: shrunkImageDataUrl },
          });
          saved = true;
        } catch (err) {
          saveError = err instanceof Error ? err.message : "Failed to save this ability to your collection";
          console.error("sprite-video ability save error:", saveError);
        }
      }

      return NextResponse.json({ status: "completed", imageDataUrl, saved, saveError });
    }

    if (job.status === "failed" || job.status === "cancelled" || job.status === "expired") {
      return NextResponse.json({ status: job.status, error: job.error ?? `Video generation ${job.status}` });
    }

    return NextResponse.json({ status: job.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error checking sprite video status";
    console.error("sprite-video status error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
