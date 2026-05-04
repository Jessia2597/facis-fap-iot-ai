import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],

  // Absolute base path matching the ORCE/UIBUILDER mount point. The Vue Router
  // history needs an absolute base, and asset URLs need to resolve correctly
  // regardless of the current SPA route. The default aligns with the FACIS
  // standard URL scheme: ORCE is mounted at /orce/, UIBUILDER serves the
  // SPA at /orce/<uibuilder-url>/, where <uibuilder-url> = "aiInsight".
  // Override at build time with `BASE_PATH=/foo/ npm run build` for a
  // different deploy origin. `||` (not `??`) so an empty BASE_PATH falls
  // through to the default rather than producing a broken bundle.
  base: process.env.BASE_PATH || '/orce/aiInsight/',

  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },

  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8080'
    }
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Ensure index.html works as a standalone SPA entry point
    rollupOptions: {
      input: resolve(__dirname, 'index.html')
    }
  }
})
