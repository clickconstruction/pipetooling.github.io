import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const bundleAnalyze = process.env.ANALYZE === '1'

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
  /** Avoid stale optimize-cache 504 / "Outdated Optimize Dep" when deps change (e.g. marked). */
  optimizeDeps: {
    include: ['marked', 'leaflet', 'react-leaflet', '@geoman-io/leaflet-geoman-free'],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
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
    ...(bundleAnalyze
      ? [
          // Use emitFile + filename only (no "dist/..." path) so the report is emitted
          // with Rollup assets. Pin `rollup-plugin-visualizer` to v5: v7+ treemap
          // resolves template paths with `import.meta.dirname` (Node 20.11+; fails on 20.0).
          visualizer({
            filename: 'stats.html',
            emitFile: true,
            open: false,
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
          }),
        ]
      : []),
  ],
  base: '/',
})
