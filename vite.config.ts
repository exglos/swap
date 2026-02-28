import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

export default defineConfig({
  plugins: [
    // 1. Polyfills go FIRST to ensure shims are available for other plugins
    nodePolyfills({
      include: ["buffer", "process", "util", "stream"],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // 3. Force Vite to pre-bundle these problematic dependencies
  optimizeDeps: {
    include: ["sonner", "ethers", "buffer"],
  },
});