/**
 * Vite config for GitHub Pages / standalone static hosting.
 * Used by `pnpm build:pages` — strips out all Manus-specific plugins.
 *
 * Set BASE to "/" if deploying to a root domain (e.g. username.github.io)
 * Set BASE to "/repo-name/" if deploying to a project page (e.g. username.github.io/repo-name/)
 */
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const BASE = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base: BASE,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
});
