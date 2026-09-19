import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
import { parseHelpGuideFrontmatter } from './src/lib/helpGuides'
import { HELP_SHARE_PATH_PREFIX, helpShareDescription, helpSharePageHtml } from './src/lib/helpShareCard'
import { renderTodoBoardModule } from './scripts/todos/readTodos'

const bundleAnalyze = process.env.ANALYZE === '1'

/**
 * The to-dos' mock-ups, served beside the app (v2.3558): every `.html` under `to-dos/` is
 * copied to `dist/to-dos/<same path>` so the Punch list page (`/punch-list`) can open
 * `/to-dos/submittals/mockup.html` as a page. Not precached (`globIgnores`), and the
 * service worker's navigation fallback leaves `/to-dos/` alone (src/sw.ts). Runs after
 * VitePWA's own closeBundle, so the files never enter the precache manifest either way.
 */
function todoMockupsPlugin() {
  return {
    name: 'todo-mockups',
    closeBundle() {
      const srcRoot = join(process.cwd(), 'to-dos')
      const outRoot = join(process.cwd(), 'dist', 'to-dos')
      let count = 0
      const walk = (rel: string): void => {
        for (const entry of readdirSync(join(srcRoot, rel), { withFileTypes: true })) {
          const relPath = rel ? `${rel}/${entry.name}` : entry.name
          if (entry.isDirectory()) walk(relPath)
          else if (entry.name.endsWith('.html')) {
            mkdirSync(join(outRoot, rel), { recursive: true })
            copyFileSync(join(srcRoot, relPath), join(outRoot, relPath))
            count += 1
          }
        }
      }
      walk('')
      console.log(`todo-mockups: copied ${count} mock-up page(s) under dist/to-dos`)
    },
  }
}

/**
 * The punch list, rendered at build time (v2.3623): `virtual:punch-list` is the board module
 * the Punch list page imports, rendered from `to-dos/` by the same kernel `npm run check:todos`
 * runs. Nothing generated is committed any more — until v2.3622 a committed module and a README
 * index conflicted on every to-do PR whenever main moved. A build refuses broken to-dos (the
 * same errors CI reports); the dev server logs them, serves what parsed, and reloads on any
 * change under `to-dos/`.
 */
const PUNCH_LIST_ID = 'virtual:punch-list'
const PUNCH_LIST_RESOLVED = '\0' + PUNCH_LIST_ID
function todoBoardPlugin() {
  let serving = false
  return {
    name: 'todo-board',
    configResolved(config: { command: string }) {
      serving = config.command === 'serve'
    },
    resolveId(id: string) {
      return id === PUNCH_LIST_ID ? PUNCH_LIST_RESOLVED : null
    },
    load(id: string) {
      if (id !== PUNCH_LIST_RESOLVED) return null
      const { module, problems } = renderTodoBoardModule(process.cwd())
      const errors = problems.filter((p) => p.severity === 'error')
      if (errors.length > 0) {
        const lines = errors.map((p) => `  ${p.message}`).join('\n')
        if (!serving) throw new Error(`the punch list cannot be rendered from to-dos/:\n${lines}`)
        console.error(`todo-board: ${errors.length} problem(s) in to-dos/ (served anyway in dev):\n${lines}`)
      }
      return module
    },
    configureServer(server: {
      watcher: { add: (p: string) => void; on: (ev: string, fn: (file: string) => void) => void }
      moduleGraph: { getModuleById: (id: string) => unknown; invalidateModule: (m: never) => void }
      ws: { send: (m: { type: 'full-reload' }) => void }
    }) {
      const todosDir = join(process.cwd(), 'to-dos')
      server.watcher.add(todosDir)
      const onChange = (file: string) => {
        if (!file.startsWith(todosDir)) return
        const mod = server.moduleGraph.getModuleById(PUNCH_LIST_RESOLVED)
        if (mod) server.moduleGraph.invalidateModule(mod as never)
        server.ws.send({ type: 'full-reload' })
      }
      for (const ev of ['change', 'add', 'unlink']) server.watcher.on(ev, onChange)
    },
  }
}

// Copy index.html to 404.html so GitHub Pages serves the SPA for any path (e.g. /dashboard refresh)
/**
 * One static share page per help guide (v2.3147): dist/g/<slug>/index.html
 * carries the guide's title and first sentence as Open Graph tags plus an
 * instant bounce into /help?g=<slug> — link previews never run the app, so
 * the card has to be real HTML on the server. Pure parts in src/lib/helpShareCard.ts.
 */
function helpSharePagesPlugin() {
  return {
    name: 'help-share-pages',
    closeBundle() {
      const guidesDir = join(process.cwd(), 'src', 'content', 'help')
      const outDir = join(process.cwd(), 'dist')
      let count = 0
      for (const file of readdirSync(guidesDir)) {
        if (!file.endsWith('.md')) continue
        const slug = file.replace(/\.md$/, '')
        const { fields, body } = parseHelpGuideFrontmatter(readFileSync(join(guidesDir, file), 'utf8'))
        const title = (fields.title ?? '').trim()
        if (!title) continue
        const dir = join(outDir, HELP_SHARE_PATH_PREFIX.replace(/^\/|\/$/g, ''), slug)
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, 'index.html'), helpSharePageHtml({ slug, title, description: helpShareDescription(body), origin: 'https://clicktooling.com' }))
        count += 1
      }
      console.log(`help-share-pages: wrote ${count} share pages under dist${HELP_SHARE_PATH_PREFIX}`)
    },
  }
}

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
    // *.render.test.tsx files opt into jsdom per-file via `// @vitest-environment jsdom`;
    // the global environment stays node for the pure-logic *.test.ts suite.
    include: ['src/**/*.test.ts', 'src/**/*.render.test.tsx'],
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
      // Prompt mode: a new SW waits until the user clicks Reload on the UpdatePrompt
      // pill (posts SKIP_WAITING — listener in src/sw.ts). autoUpdate never worked with
      // the custom sw.ts (nothing called skipWaiting), leaving clients stale forever.
      registerType: 'prompt',
      injectManifest: {
        // Workbox default is 2 MiB; main chunk can exceed 3 MiB as the app grows.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Help screen recordings ({{gif:…}} tokens) are lazy-loaded media, never precached.
        globIgnores: ['**/help/**', '**/easter-eggs/**', '**/fonts/**', '**/to-dos/**'],
      },
      manifest: {
        name: 'ClickTooling',
        short_name: 'ClickTooling',
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
    helpSharePagesPlugin(),
    todoMockupsPlugin(),
    todoBoardPlugin(),
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
