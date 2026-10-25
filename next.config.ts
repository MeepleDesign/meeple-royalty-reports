import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Every page in this app reads fresh data from Supabase on each request —
     Cache Components' opt-in caching model adds nothing here, so it's off. */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
