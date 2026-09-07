import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next treats localhost and 127.0.0.1 as different origins, so HMR
  // websockets from http://127.0.0.1:3000 are blocked unless listed.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
