import "server-only";
import { authHeaders, OPENROUTER_BASE } from "./openrouter-client";

const VIDEO_MODEL = "minimax/hailuo-3-max";

export type VideoJobStatus = {
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled" | "expired";
  error?: string;
};

// Submits a video-generation job and returns immediately with its id —
// this never waits for the video itself. Hailuo (and video models
// generally) routinely take well past a minute to render, and Vercel
// serverless functions have a hard duration cap, so the caller must poll
// getVideoJobStatus() separately instead of awaiting completion here.
export async function submitVideoJob(params: {
  prompt: string;
  firstFrameImageDataUrl: string;
  duration?: 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
  resolution?: "768p" | "480p";
  aspectRatio?: "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
}): Promise<string> {
  const res = await fetch(`${OPENROUTER_BASE}/videos`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: VIDEO_MODEL,
      prompt: params.prompt,
      duration: params.duration ?? 5,
      resolution: params.resolution ?? "480p",
      aspect_ratio: params.aspectRatio ?? "1:1",
      // This model only accepts a single keyframe image (first_frame OR
      // last_frame, never both — sending both is a 400). The loop-back-to-
      // start behavior is enforced entirely through the prompt instead.
      frame_images: [
        { type: "image_url", image_url: { url: params.firstFrameImageDataUrl }, frame_type: "first_frame" },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenRouter video submit error ${res.status}: ${errText.slice(0, 500)}`);
  }

  const json = await res.json();
  const jobId = json?.id;
  if (typeof jobId !== "string") {
    throw new Error("OpenRouter video submit response missing job id");
  }
  return jobId;
}

export async function getVideoJobStatus(jobId: string): Promise<VideoJobStatus> {
  const res = await fetch(`${OPENROUTER_BASE}/videos/${encodeURIComponent(jobId)}`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenRouter video status error ${res.status}: ${errText.slice(0, 500)}`);
  }

  const json = await res.json();
  const status = json?.status;
  const known = ["pending", "in_progress", "completed", "failed", "cancelled", "expired"];
  if (typeof status !== "string" || !known.includes(status)) {
    throw new Error(`OpenRouter video status response has unexpected status: ${JSON.stringify(status)}`);
  }
  return { status: status as VideoJobStatus["status"], error: typeof json?.error === "string" ? json.error : undefined };
}

export async function downloadVideo(jobId: string): Promise<Buffer> {
  const res = await fetch(`${OPENROUTER_BASE}/videos/${encodeURIComponent(jobId)}/content`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenRouter video download error ${res.status}: ${errText.slice(0, 500)}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
