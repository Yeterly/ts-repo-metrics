import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Monorepo root (directory that contains `packages/engine`), regardless of whether
 * `next dev` was started from `apps/dashboard` or the repo root.
 */
function resolveMonorepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(path.join(dir, "packages", "engine", "package.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(process.cwd(), "..", "..");
}

const outputFileTracingRoot = resolveMonorepoRoot();

/**
 * On the course-only site (`CSE115A_SITE=true` at build time), course pages live at the root:
 * `/dashboard` serves `app/cse115a/dashboard`, and old `/cse115a/...` links redirect there.
 */
const cse115aSite = process.env.CSE115A_SITE === "true";
const COURSE_SECTIONS = "assignments|dashboard|instructor|preview|signin|signup";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
    ],
  },
  serverExternalPackages: [
    "adm-zip",
    "tree-sitter",
    "tree-sitter-typescript",
    "tree-sitter-python",
  ],
  async redirects() {
    if (!cse115aSite) return [];
    return [
      { source: "/cse115a", destination: "/", permanent: false },
      { source: "/cse115a/:path*", destination: "/:path*", permanent: false },
    ];
  },
  async rewrites() {
    if (!cse115aSite) return [];
    return {
      beforeFiles: [
        { source: "/", destination: "/cse115a" },
        { source: `/:section(${COURSE_SECTIONS})/:path*`, destination: "/cse115a/:section/:path*" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
