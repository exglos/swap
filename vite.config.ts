import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ['buffer'],
      globals: { Buffer: true },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}))