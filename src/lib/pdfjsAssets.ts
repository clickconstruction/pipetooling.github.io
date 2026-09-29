/**
 * Where pdf.js finds the files it loads at run time (v2.4192). pdf.js 6 decodes JBIG2
 * and JPEG 2000 images — every scanned vendor PDF — in WebAssembly, loads CJK fonts
 * from packed CMaps and draws the standard 14 fonts from its own font files; each is
 * fetched from a directory URL the app has to name (`wasmUrl`, `cMapUrl`,
 * `standardFontDataUrl`). Without them a scanned page decodes to nothing and renders
 * blank. The Vite plugin in vite.config.ts serves the three directories from
 * node_modules/pdfjs-dist in dev and copies them into dist/pdfjs/ at build, so the
 * served files are always the installed version's.
 */

export const PDFJS_ASSET_PREFIX = 'pdfjs'

/** The pdfjs-dist directories served under /pdfjs/<dir>/. */
export const PDFJS_ASSET_DIRS = ['wasm', 'cmaps', 'standard_fonts'] as const
export type PdfjsAssetDir = (typeof PDFJS_ASSET_DIRS)[number]

/**
 * Resolve a request path to the pdfjs-dist file it names — `/pdfjs/wasm/jbig2.wasm` →
 * `{ dir: 'wasm', file: 'jbig2.wasm' }` — or null for anything outside the three
 * directories, a nested path, or a name that is not a plain file name.
 */
export function pdfjsAssetPath(urlPath: string): { dir: PdfjsAssetDir; file: string } | null {
  const path = urlPath.split('?')[0]!.split('#')[0]!
  const m = /^\/pdfjs\/([^/]+)\/([^/]+)$/.exec(path)
  if (!m) return null
  const dir = m[1] as PdfjsAssetDir
  const file = decodeURIComponent(m[2]!)
  if (!(PDFJS_ASSET_DIRS as readonly string[]).includes(dir)) return null
  if (!/^[A-Za-z0-9._-]+$/.test(file) || file.startsWith('.')) return null
  return { dir, file }
}

/** The `getDocument` options that name the directories; `base` is the app's base URL (`/`). */
export function pdfjsDocumentOptions(base: string): { wasmUrl: string; cMapUrl: string; cMapPacked: true; standardFontDataUrl: string } {
  const root = `${base.endsWith('/') ? base : `${base}/`}${PDFJS_ASSET_PREFIX}/`
  return { wasmUrl: `${root}wasm/`, cMapUrl: `${root}cmaps/`, cMapPacked: true, standardFontDataUrl: `${root}standard_fonts/` }
}
