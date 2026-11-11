// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import cloudflare from "@astrojs/cloudflare";
import { execSync } from "node:child_process";

// Automatically extract latest git commit information at build time
let gitCommitDate = "";
let gitCommitHash = process.env.PUBLIC_GIT_COMMIT_HASH || process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || "";
let gitCommitShortHash = process.env.PUBLIC_GIT_COMMIT_SHORT_HASH || (gitCommitHash ? gitCommitHash.slice(0, 7) : "");

try {
  if (!gitCommitHash) {
    gitCommitHash = execSync("git log -1 --format=%H", { encoding: "utf-8" }).trim();
    gitCommitShortHash = execSync("git log -1 --format=%h", { encoding: "utf-8" }).trim();
  }
  gitCommitDate = execSync("git log -1 --format=%cI", { encoding: "utf-8" }).trim();
} catch {
  gitCommitDate = new Date().toISOString();
}

process.env.PUBLIC_GIT_COMMIT_DATE = gitCommitDate;
process.env.PUBLIC_GIT_COMMIT_HASH = gitCommitHash;
process.env.PUBLIC_GIT_COMMIT_SHORT_HASH = gitCommitShortHash;

// https://astro.build/config
export default defineConfig({
  site: "https://brob.uk",
  integrations: [sitemap()],
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  vite: {
    define: {
      "import.meta.env.PUBLIC_GIT_COMMIT_DATE": JSON.stringify(gitCommitDate),
      "import.meta.env.PUBLIC_GIT_COMMIT_HASH": JSON.stringify(gitCommitHash),
      "import.meta.env.PUBLIC_GIT_COMMIT_SHORT_HASH": JSON.stringify(gitCommitShortHash),
    },
  },
});
