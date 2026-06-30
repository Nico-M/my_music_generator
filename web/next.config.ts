import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow large file uploads (audio files)
  serverExternalPackages: ['@libsql/client'],
};

export default nextConfig;
