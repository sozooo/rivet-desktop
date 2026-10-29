import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";
import pkg from "./package.json" with { type: "json" };

// Agent worktrees live in this project's .claude/ and are whole copies of it. Match
// only this project's folder: a worktree's own path also contains ".claude".
const agentFolder = fileURLToPath(new URL(".claude", import.meta.url)).replace(
  /\\/g,
  "/",
);

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 5173,
    // Tauri loads exactly this address.
    strictPort: true,
    // Cargo locks its build output on Windows; watching it crashes Vite with EBUSY.
    watch: { ignored: ["**/src-tauri/**", `${agentFolder}/**`] },
  },
  // The desktop app runs in WebView2 (Chromium), so modern output is fine.
  // The 3D viewer is a lazy chunk of its own (three.js), so its size is expected.
  build: { target: "es2022", chunkSizeWarningLimit: 800 },
  // Agent worktrees under .claude/ hold other branches' copies of the tests.
  test: { exclude: [...configDefaults.exclude, ".claude/**"] },
});
