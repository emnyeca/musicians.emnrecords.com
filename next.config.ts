import type { NextConfig } from "next";
// Node.js builds the pages; ConoHa serves static assets and the PHP API.
const nextConfig: NextConfig = { output: "export", trailingSlash: true, images: { unoptimized: true } };
export default nextConfig;
