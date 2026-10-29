import { configDefaults, defineConfig } from "vitest/config";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 5173,
    // Tauri loads exactly this address.
    strictPort: true,
    // Cargo locks its build output on Windows; watching it crashes Vite with EBUSY.
    // Agent worktrees under .claude/ are whole copies of the project.
    watch: { ignored: ["**/src-tauri/**", "**/.claude/**"] },
  },
  // The desktop app runs in WebView2 (Chromium), so modern output is fine.
  // The 3D viewer is a lazy chunk of its own (three.js), so its size is expected.
  build: { target: "es2022", chunkSizeWarningLimit: 800 },
  // Agent worktrees under .claude/ hold other branches' copies of the tests.
  test: { exclude: [...configDefaults.exclude, ".claude/**"] },
});
