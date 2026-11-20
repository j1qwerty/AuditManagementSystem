import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// All runtime configuration lives in .env (VITE_* variables).
// See .env.example for the full list of available options.
export default defineConfig({
  plugins: [react()],
  base: './',
  // isolate from any parent PostCSS config (e.g. when nested inside another project)
  css: { postcss: { plugins: [] } },
  server: {
    host: true,
    port: 5193
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900
  }
})
