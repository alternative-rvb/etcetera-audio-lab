import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: modules natifs (ONNX Runtime) chargés tels quels par Node, jamais bundlés.
  serverExternalPackages: ["onnxruntime-node", "kokoro-js", "edge-tts-universal"],
  devIndicators: false,
};

export default nextConfig;
