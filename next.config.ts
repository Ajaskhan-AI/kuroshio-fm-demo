import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: let the dev server answer on 127.0.0.1 as well as localhost (e.g. preview panes).
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
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
