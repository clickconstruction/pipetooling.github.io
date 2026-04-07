import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Copy index.html to 404.html so GitHub Pages serves the SPA for any path (e.g. /dashboard refresh)
function copy404Plugin() {
  return {
    name: 'copy-404',
    closeBundle() {
      const outDir = join(process.cwd(), 'dist')
      copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html'))
    },
  }
}

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        // Workbox default is 2 MiB; main chunk can exceed 3 MiB as the app grows.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'PipeTooling',
        short_name: 'PipeTooling',
        description: 'Construction workflow and bid management',
        theme_color: '#f97316',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
    copy404Plugin(),
  ],
  base: '/',
})
