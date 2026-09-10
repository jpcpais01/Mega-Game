import "server-only";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

// Vercel's Node.js functions give /tmp as the only writable directory —
// os.tmpdir() resolves there in that environment and to the regular system
// temp dir locally, so this works in both without special-casing.
async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mega-game-frames-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// Extracts frames from a video buffer at a fixed frame rate, returning each
// frame as a PNG buffer in playback order. ffmpeg-static resolves the path
// to a real ffmpeg binary at runtime (not a static require(), so Next.js's
// build-time file tracing can't auto-detect it — next.config.ts explicitly
// includes it for the routes that call this).
export async function extractFramesFromVideo(videoBuffer: Buffer, fps: number): Promise<Buffer[]> {
  // Narrowed into a local const: the null-check above doesn't survive into
  // the nested closure below since ffmpegPath is an imported binding, not a
  // local variable TypeScript can track control flow on across that boundary.
  const ffmpeg = ffmpegPath;
  if (!ffmpeg) {
    throw new Error("ffmpeg-static has no binary for this platform/architecture");
  }

  return withTempDir(async (dir) => {
    const inputPath = path.join(dir, "input.mp4");
    await fs.writeFile(inputPath, videoBuffer);

    const framePattern = path.join(dir, "frame-%04d.png");
    await execFileAsync(ffmpeg, ["-y", "-i", inputPath, "-vf", `fps=${fps}`, framePattern], {
      maxBuffer: 1024 * 1024 * 64,
    });

    const files = (await fs.readdir(dir)).filter((f) => f.startsWith("frame-") && f.endsWith(".png")).sort();
    if (files.length === 0) {
      throw new Error("ffmpeg produced no frames from the generated video");
    }
    return Promise.all(files.map((f) => fs.readFile(path.join(dir, f))));
  });
}
