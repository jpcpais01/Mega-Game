import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ hostname: "lh3.googleusercontent.com" }],
  },
  // ffmpeg-static's binary isn't a static require() target, so Next's
  // build-time file tracing can't auto-detect it — without this, the route
  // works locally but 404s/ENOENTs on the binary once deployed as a
  // serverless function. The literal file path (not a glob over the whole
  // package) matches Vercel's own known-working vercel-labs/ffmpeg-on-vercel
  // example; lib/video-frames.ts spawns this exact path too.
  outputFileTracingIncludes: {
    "/api/sprite-video/status": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
};

export default nextConfig;
