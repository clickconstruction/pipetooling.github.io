import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync, cpSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
import { parseHelpGuideFrontmatter } from './src/lib/helpGuides'
import { PDFJS_ASSET_DIRS, PDFJS_ASSET_PREFIX, pdfjsAssetPath } from './src/lib/pdfjsAssets'
import { HELP_SHARE_PATH_PREFIX, helpShareCardPath, helpShareCardSvg, helpShareDescription, helpSharePageHtml } from './src/lib/helpShareCard'
import { formerHelpGuideSlugs } from './src/lib/helpGuideFormerSlugs'
import { renderTodoBoardModule } from './scripts/todos/readTodos'
import { renderTodoHistoryModule } from './scripts/todos/readTodoHistory'
import { lensSchemaFromDatabaseTs, lensSchemaModule } from './scripts/lens/lensSchema'
import { parseThemeTokens } from './src/lib/lens/lensTokens'

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

/**
 * The punch list's history, replayed from git when the Punch list page's chunk is built: the plugin loads
 * `src/lib/todos/punchListHistoryData.ts` (an empty history, which TypeScript and the tests read) with every change
 * of `to-dos/` on main as the burndown on /punch-list draws it (`scripts/todos/readTodoHistory.ts`). A real file, not a
 * virtual module, so no global type declaration is needed. Nothing is committed. A build with no git history serves
 * an empty one and the page says so; `deploy.yml` checks the whole history out. The dev server replays once a start.
 */
const PUNCH_HISTORY_FILE = '/src/lib/todos/punchListHistoryData.ts'
function todoHistoryPlugin() {
  return {
    name: 'todo-history',
    enforce: 'pre' as const,
    load(id: string) {
      return id.split('?')[0]!.replace(/\\/g, '/').endsWith(PUNCH_HISTORY_FILE) ? renderTodoHistoryModule(process.cwd()) : null
    },
  }
}

/**
 * The lens's schema map (punch list #194): each table's columns and foreign keys and each RPC's kind
 * of return, read from src/types/database.ts when the lens's chunk is built, so the invented world
 * always answers with the types' own shape and there is no generated file to keep in step.
 */
const LENS_SCHEMA_ID = 'virtual:lens-schema'
const LENS_SCHEMA_RESOLVED = '\0' + LENS_SCHEMA_ID
function lensSchemaPlugin() {
  return {
    name: 'lens-schema',
    resolveId(id: string) {
      return id === LENS_SCHEMA_ID ? LENS_SCHEMA_RESOLVED : null
    },
    load(id: string) {
      if (id !== LENS_SCHEMA_RESOLVED) return null
      return lensSchemaModule(lensSchemaFromDatabaseTs(readFileSync(join(process.cwd(), 'src/types/database.ts'), 'utf8')))
    },
  }
}

/**
 * The theme's tokens for What everyone sees' theme draft (punch list #194): the light and dark blocks
 * of src/index.css, read when the tab's draft panel is built, so the draft always starts from the
 * shipped values and index.css itself (240 KB) never ships as text.
 */
const LENS_TOKENS_ID = 'virtual:lens-tokens'
const LENS_TOKENS_RESOLVED = '\0' + LENS_TOKENS_ID
function lensTokensPlugin() {
  return {
    name: 'lens-tokens',
    resolveId(id: string) {
      return id === LENS_TOKENS_ID ? LENS_TOKENS_RESOLVED : null
    },
    load(id: string) {
      if (id !== LENS_TOKENS_RESOLVED) return null
      return `export default ${JSON.stringify(parseThemeTokens(readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')))}\n`
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
    async closeBundle() {
      const guidesDir = join(process.cwd(), 'src', 'content', 'help')
      const outDir = join(process.cwd(), 'dist')
      const guides = readdirSync(guidesDir)
        .filter((file) => file.endsWith('.md'))
        .map((file) => {
          const slug = file.replace(/\.md$/, '')
          const { fields, body } = parseHelpGuideFrontmatter(readFileSync(join(guidesDir, file), 'utf8'))
          return { slug, title: (fields.title ?? '').trim(), category: (fields.category ?? '').trim(), body }
        })
        .filter((g) => g.title)
      // The guide's own card (v2.4190): the SVG rasterised by Playwright's Chromium. No browser → the site card, and the build says so.
      let shoot: ((svg: string, out: string) => Promise<void>) | null = null
      let browser: { close: () => Promise<void> } | null = null
      if (process.env.HELP_SHARE_CARDS !== '0') {
        try {
          const { chromium } = await import('playwright')
          const b = await chromium.launch()
          browser = b
          const page = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
          shoot = async (svg, out) => {
            await page.setContent(`<!doctype html><html><body style="margin:0;background:#0f172a">${svg}</body></html>`, { waitUntil: 'load' })
            await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 }, type: 'png' })
          }
        } catch (e) {
          console.warn(`help-share-pages: no browser for the per-guide cards (${String(e).split('\n')[0]}) — pages carry the site card`)
        }
      }
      let count = 0
      let cards = 0
      let formerPages = 0
      for (const g of guides) {
        const dir = join(outDir, HELP_SHARE_PATH_PREFIX.replace(/^\/|\/$/g, ''), g.slug)
        mkdirSync(dir, { recursive: true })
        let image: string | undefined
        if (shoot) {
          try {
            await shoot(helpShareCardSvg({ title: g.title, category: g.category, slug: g.slug }), join(dir, 'card.png'))
            image = helpShareCardPath(g.slug)
            cards += 1
          } catch (e) {
            console.warn(`help-share-pages: card for ${g.slug} failed (${String(e).split('\n')[0]}) — site card`)
          }
        }
        const html = helpSharePageHtml({ slug: g.slug, title: g.title, category: g.category, description: helpShareDescription(g.body), origin: 'https://clicktooling.com', image })
        writeFileSync(join(dir, 'index.html'), html)
        count += 1
        // A renamed guide's old share address (v2.7050): the same page, so a link sent under the old name shows the guide's card and opens the guide.
        for (const former of formerHelpGuideSlugs(g.slug)) {
          const formerDir = join(outDir, HELP_SHARE_PATH_PREFIX.replace(/^\/|\/$/g, ''), former)
          mkdirSync(formerDir, { recursive: true })
          writeFileSync(join(formerDir, 'index.html'), html)
          formerPages += 1
        }
      }
      await browser?.close()
      console.log(`help-share-pages: wrote ${count} share pages under dist${HELP_SHARE_PATH_PREFIX}${shoot ? ` with ${cards} cards` : ' (site card — no browser)'}${formerPages > 0 ? `, and ${formerPages} at a renamed guide's old address` : ''}`)
    },
  }
}

/**
 * pdf.js's run-time files (v2.4192): the JBIG2 / JPEG 2000 wasm decoders, the packed
 * CMaps and the standard fonts, served under /pdfjs/<dir>/ straight from the installed
 * pdfjs-dist in dev and copied into dist/pdfjs/ at build, so what the app names in
 * `getDocument` (src/lib/pdfjsAssets.ts) is always the installed version's. Without
 * them a scanned vendor PDF renders blank.
 */
function pdfjsAssetsPlugin() {
  const source = (dir: string) => join(process.cwd(), 'node_modules', 'pdfjs-dist', dir)
  const types: Record<string, string> = { '.wasm': 'application/wasm', '.js': 'text/javascript', '.mjs': 'text/javascript', '.bcmap': 'application/octet-stream', '.pfb': 'application/octet-stream', '.ttf': 'font/ttf' }
  return {
    name: 'pdfjs-assets',
    configureServer(server: { middlewares: { use(fn: (req: { url?: string }, res: { setHeader(k: string, v: string): void; statusCode: number; end(): void }, next: () => void) => void): void } }) {
      server.middlewares.use((req, res, next) => {
        const hit = pdfjsAssetPath(req.url ?? '')
        if (!hit) return next()
        const file = join(source(hit.dir), hit.file)
        if (!existsSync(file)) {
          res.statusCode = 404
          return res.end()
        }
        res.setHeader('Content-Type', types[hit.file.slice(hit.file.lastIndexOf('.'))] ?? 'application/octet-stream')
        res.setHeader('Cache-Control', 'no-cache')
        createReadStream(file).pipe(res as unknown as NodeJS.WritableStream)
      })
    },
    closeBundle() {
      const outDir = join(process.cwd(), 'dist', PDFJS_ASSET_PREFIX)
      for (const dir of PDFJS_ASSET_DIRS) cpSync(source(dir), join(outDir, dir), { recursive: true })
      console.log(`pdfjs-assets: copied ${PDFJS_ASSET_DIRS.join(', ')} into dist/${PDFJS_ASSET_PREFIX}/`)
    },
  }
}

function copy404Plugin() {
  return {
    name: 'copy-404',
    closeBundle() {
      const outDir = join(process.cwd(), 'dist')
      // closeBundle runs even when the bundle failed; throwing here would replace the build's own error with
      // an ENOENT for dist/index.html (it hid the lesson-glob break for an afternoon, 2026-10-16).
      if (!existsSync(join(outDir, 'index.html'))) return
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
    // A test run holds an address that answers nobody. These win over `.env.local` and the shell, so a
    // render test whose component makes a call it did not mock can no longer reach the live database
    // from a dev machine (src/test/testRunNeverReachesProd.test.ts holds it). CI's Test steps pass the
    // same address; a worktree with no `.env.local` runs the suite too.
    env: {
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-dummy-anon-key',
    },
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
        // Workbox default is 2 MiB; the main chunk is ~8.0 MiB on 2026-11-14 (every public page is eager in App.tsx).
        // A file over this cap fails the deploy build. The main chunk reached 6 MiB on 2026-10-20 by plain
        // growth (6,277 → 6,284 kB across v2.5332's merge, the same 259 chunks before and after), so the cap
        // is 7 MiB: ~0.7 MiB for growth, and it still trips on a regression like v2.4655's, which put every
        // help guide (now ~2.3 MB) in the main chunk (fixed v2.4695: LienRulesDoor lazy-loads its window).
        // Raise it only with a reason here; the main chunk itself is due a code-split pass. It crossed 7 MiB on
        // 2026-11-03 by plain growth (7,316 kB at 792c47d36, 7,348 kB at 61f7540fe, a merge queue landing a code
        // change every few minutes), and every deploy build failed from 09:01Z, so the cap went to 8 MiB. It crossed
        // 8 MiB on 2026-11-14 the same way (8,407,622 bytes at 6dc103663, v2.7220's 1,900 new lines, against a
        // cap of 8,388,608; 0419a5517 before it was the last good deploy), and every deploy build failed from
        // 02:20Z, so the cap is 9 MiB: ~0.6 MiB for growth again, and it still trips on a regression like
        // v2.4655's, until the split. Eleven days took the last MiB, so the split is due before December.
        maximumFileSizeToCacheInBytes: 9 * 1024 * 1024,
        // Help screen recordings ({{gif:…}} tokens) are lazy-loaded media, never precached.
        globIgnores: ['**/help/**', '**/easter-eggs/**', '**/fonts/**', '**/to-dos/**', '**/lensEngine-*.js'],
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
    pdfjsAssetsPlugin(),
    helpSharePagesPlugin(),
    todoMockupsPlugin(),
    todoBoardPlugin(),
    todoHistoryPlugin(),
    lensSchemaPlugin(),
    lensTokensPlugin(),
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
  build: {
    // Punch list #319 PR 4: a First look's page is an entry of its own (`show.html` over `src/showEntry.tsx`), so a
    // customer's phone on a weak signal loads React and the page, never the app. `index.html`'s first script sends a
    // `/show/<code>` address there, and the service worker leaves `/show.html` to the network (`src/sw.ts`).
    // The app's entry keeps the name `index`: the build names an entry's script after its key, and the deploy's own
    // check, the live-site checks and the docs all look for `assets/index-<hash>.js`. Named `main` (v2.7007), every
    // deploy failed its *Verify build output* step until v2.7027.
    rollupOptions: { input: { index: resolve(__dirname, 'index.html'), show: resolve(__dirname, 'show.html') } },
  },
})
