/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // The app shell, grounding flow and fallback missions are all in the bundle,
      // so a reset works offline once MERA has been opened.
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2,png,webmanifest}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        // The model worker bundle is large; it's cached on first use instead.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globIgnores: ["**/*worker*.js", "**/ort-*.wasm"],
      },
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "MERA — Meep Emotional Reset Assistant",
        short_name: "MERA",
        description: "Come back to yourself. A short grounding reset, then one real-world action — and the phone goes down.",
        theme_color: "#f4f0e8",
        background_color: "#f4f0e8",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    proxy: { "/api": "http://localhost:8787" },
  },
  worker: { format: "es" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "server/**/*.test.ts"],
  },
});
