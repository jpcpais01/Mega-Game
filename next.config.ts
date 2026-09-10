import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ hostname: "lh3.googleusercontent.com" }],
  },
  // ffmpeg-static resolves its binary path at runtime (not a static
  // require()), so Next's build-time file tracing can't auto-detect it —
  // without this, the route works locally but is missing the binary once
  // deployed as a serverless function.
  outputFileTracingIncludes: {
    "/api/sprite-video/status": ["./node_modules/ffmpeg-static/**/*"],
  },
};

export default nextConfig;
