import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 5173,
    // Tauri loads exactly this address.
    strictPort: true,
    // Cargo locks its build output on Windows; watching it crashes Vite with EBUSY.
    watch: { ignored: ["**/src-tauri/**"] },
  },
  // The desktop app runs in WebView2 (Chromium), so modern output is fine.
  // The 3D viewer is a lazy chunk of its own (three.js), so its size is expected.
  build: { target: "es2022", chunkSizeWarningLimit: 800 },
});
