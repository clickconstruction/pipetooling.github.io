/**
 * What the app's entry imports eagerly (the main chunk's split, 2026-11-20).
 *
 * The build puts every module the entry reaches through plain `import` lines in one file, the main
 * chunk. The service worker's precache has a cap for a single file (`maximumFileSizeToCacheInBytes` in
 * `vite.config.ts`), and a main chunk over it fails every deploy with no error line. PR CI never runs
 * the build, so nothing said so until a merge was already on `main`. Four times the chunk grew past the
 * cap and each time the cap was raised.
 *
 * This walks the same graph from the source, with no build: follow each file's static imports from the
 * entry, never a dynamic `import()`, and add up the bytes. It over-counts a little (an import used only
 * as a type, written without `type`, counts here and is dropped by the build), which errs on the side of
 * the warning. `entryGraph.repo.test.ts` holds the entry to a budget and keeps the on-demand windows out.
 */

/** Reads a file's text, or `null` when there is none at that path. */
export type ReadSource = (file: string) => string | null

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g
/** `import x, { a, type B } from '…'` and `import * as x from '…'`. The clause holds names, braces, commas and stars only. */
const IMPORT_FROM = /(?:^|\n)[ \t]*import\s+(?!type\b)([\w$*,{}\s]+?)\s*from\s*['"]([^'"\n]+)['"]/g
/** `import './x.css'`: a module imported for what it does. */
const IMPORT_BARE = /(?:^|\n)[ \t]*import\s*['"]([^'"\n]+)['"]/g
/** `export * from '…'`, `export * as x from '…'` and `export { a } from '…'`. */
const EXPORT_FROM = /(?:^|\n)[ \t]*export\s+(?!type\b)(\*(?:\s+as\s+[\w$]+)?|\{[\w$,\s]*\})\s*from\s*['"]([^'"\n]+)['"]/g

/** True when a braces-only clause names types alone (`{ type A, type B }`): the build drops such an import. */
function typesOnly(clause: string): boolean {
  const trimmed = clause.trim()
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false
  const names = trimmed
    .slice(1, -1)
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
  return names.length > 0 && names.every((n) => /^type\s/.test(n))
}

/** The specifiers a file imports for their code, in order, each once. A dynamic `import()` is not one of them. */
export function staticImportsOf(source: string): string[] {
  const code = source.replace(BLOCK_COMMENT, '')
  const found = new Set<string>()
  for (const m of code.matchAll(IMPORT_FROM)) if (!typesOnly(m[1] ?? '')) found.add(m[2]!)
  for (const m of code.matchAll(IMPORT_BARE)) found.add(m[1]!)
  for (const m of code.matchAll(EXPORT_FROM)) if (!typesOnly(m[1] ?? '')) found.add(m[2]!)
  return [...found]
}

const TRY_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.css', '/index.ts', '/index.tsx', '/index.js']
const IS_CODE = /\.(tsx?|jsx?|mjs)$/

function dirOf(file: string): string {
  const cut = file.lastIndexOf('/')
  return cut < 0 ? '' : file.slice(0, cut)
}

function joinPath(base: string, rel: string): string {
  const out = base ? base.split('/') : []
  for (const part of rel.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return out.join('/')
}

/**
 * The repo file a specifier names, or `null` for a package. Paths are relative to the repo root with
 * forward slashes (`src/App.tsx`). `@/x` is the project's alias for `src/x`.
 */
export function resolveSpecifier(from: string, specifier: string, read: ReadSource): string | null {
  const spec = specifier.replace(/\?.*$/, '')
  let base: string
  if (spec.startsWith('@/')) base = joinPath('src', spec.slice(2))
  else if (spec.startsWith('.')) base = joinPath(dirOf(from), spec)
  else return null
  for (const ext of TRY_EXTENSIONS) {
    const candidate = base + ext
    if (read(candidate) != null) return candidate
  }
  return null
}

export type EagerGraph = {
  /** Every file the entry reaches through static imports, with its size in bytes. */
  files: Map<string, number>
  /** The file that first led to each file, for saying why one is in. */
  parent: Map<string, string>
  /** The sum of `files`. */
  bytes: number
}

function byteLength(text: string): number {
  let n = 0
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c < 0x80) n += 1
    else if (c < 0x800) n += 2
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4
      i++
    } else n += 3
  }
  return n
}

export function eagerGraph(entry: string, read: ReadSource): EagerGraph {
  const files = new Map<string, number>()
  const parent = new Map<string, string>()
  const stack = [entry]
  while (stack.length) {
    const file = stack.pop()!
    if (files.has(file)) continue
    const source = read(file)
    if (source == null) continue
    files.set(file, byteLength(source))
    if (!IS_CODE.test(file)) continue
    for (const spec of staticImportsOf(source)) {
      const target = resolveSpecifier(file, spec, read)
      if (!target || files.has(target)) continue
      if (!parent.has(target)) parent.set(target, file)
      stack.push(target)
    }
  }
  let bytes = 0
  for (const n of files.values()) bytes += n
  return { files, parent, bytes }
}

/** The chain of imports from a file back to the entry, the file first. Empty when the file is not in the graph. */
export function whyEager(graph: EagerGraph, file: string): string[] {
  if (!graph.files.has(file)) return []
  const chain: string[] = []
  let at: string | undefined = file
  while (at && chain.length < 64) {
    chain.push(at)
    at = graph.parent.get(at)
  }
  return chain
}

/** The app's entry. */
export const APP_ENTRY = 'src/main.tsx'

/**
 * Windows the app loads on demand (`lazyWindow`). None may be reachable from the entry by static imports:
 * one `import X from` in a file the entry reaches puts the window, and all it reads, back in the main chunk.
 */
export const ON_DEMAND_WINDOWS: ReadonlyArray<string> = [
  'src/components/jobs/JobWindowModal.tsx',
  'src/components/jobs/DetailJobModal.tsx',
  'src/components/jobs/JobFormModal.tsx',
  'src/components/bids/BidPreviewModal.tsx',
  'src/components/customers/CustomerProfileModal.tsx',
  'src/components/personDesk/PersonDeskDrawer.tsx',
  'src/components/UserReviewModal.tsx',
  'src/components/paintedMap/PaintedMapWindow.tsx',
  'src/components/paintedMap/PaintAMapStartSheet.tsx',
  'src/components/EditCustomerForm.tsx',
]

/**
 * Pages outside the Layout that load with their route (`lazy` in `App.tsx`): a customer's, a sub's or a lawyer's
 * page, opened from a link. None may be reachable from the entry by static imports either.
 */
export const ON_DEMAND_PAGES: ReadonlyArray<string> = [
  'src/pages/BidRoom.tsx',
  'src/pages/SubmittalRoom.tsx',
  'src/pages/EstimateAccept.tsx',
  'src/pages/EstimatePublicTerms.tsx',
  'src/pages/HazmatNoticePublic.tsx',
  'src/pages/CustomerPortal.tsx',
  'src/pages/SubPortal.tsx',
  'src/pages/PayLink.tsx',
  'src/pages/LegalPortal.tsx',
  'src/pages/GcWordAsk.tsx',
  'src/pages/LegalConfirm.tsx',
  'src/pages/SupplyHouseQuotePage.tsx',
  'src/pages/PartnerStatement.tsx',
  'src/pages/Logbook.tsx',
  'src/pages/ContractAccept.tsx',
  'src/pages/CustomerRating.tsx',
  'src/pages/JobContractSign.tsx',
  'src/pages/ContractBookPreview.tsx',
  'src/pages/FileOpen.tsx',
  'src/pages/TaskShortcut.tsx',
]

/**
 * The most source the entry may reach eagerly. A megabyte of source is about 0.4 MB of chunk: on 2026-11-20,
 * 14.1 MB of source built a main chunk of 5,671,756 bytes, 10.8 MB one of 4,307,275 and 7.2 MB one of
 * 2,794,021. Lower this as more moves out; raise it only with the reason beside it, as the precache cap's
 * comment asks.
 */
export const ENTRY_SOURCE_BUDGET_BYTES = 8.5 * 1024 * 1024
