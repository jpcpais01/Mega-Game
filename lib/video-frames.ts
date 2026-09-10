import "server-only";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ffmpeg-static normally resolves its own binary path via `__dirname`
// inside the package at import time — but that path does not survive
// Next.js's output-file tracing on Vercel intact (it resolves to a bogus
// location and every spawn ENOENTs). This is a known issue with the
// package on Vercel; the documented workaround (also used by Vercel's own
// vercel-labs/ffmpeg-on-vercel example) is to ignore the package's
// resolved path entirely and spawn the binary via a path relative to the
// process's cwd instead, which both `next dev` and Vercel's Node.js
// functions set to the project/function root where node_modules actually
// lives.
function resolveFfmpegBinaryPath(): string {
  const name = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  return path.join(process.cwd(), "node_modules", "ffmpeg-static", name);
}

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
// frame as a PNG buffer in playback order. next.config.ts's
// outputFileTracingIncludes explicitly bundles the ffmpeg binary for the
// routes that call this.
export async function extractFramesFromVideo(videoBuffer: Buffer, fps: number): Promise<Buffer[]> {
  const ffmpeg = resolveFfmpegBinaryPath();
  try {
    await fs.access(ffmpeg);
  } catch {
    throw new Error(`ffmpeg binary not found at ${ffmpeg} — check outputFileTracingIncludes in next.config.ts`);
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
