import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: modules natifs (ONNX Runtime) chargés tels quels par Node, jamais bundlés.
  serverExternalPackages: ["onnxruntime-node", "kokoro-js", "msedge-tts", "ws"],
  devIndicators: false,
};

export default nextConfig;
