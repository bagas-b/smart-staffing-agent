import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) breaks when webpack tries to bundle it into
  // the RSC/route-handler build ("Object.defineProperty called on
  // non-object") — leave it as a native require at runtime instead.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
