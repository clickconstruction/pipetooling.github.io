import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error — the generator runs on bare Node, so it is plain JS with no types
import * as generator from '../../../scripts/edge-kernels.mjs'
// @ts-expect-error — the drift check's kernel, plain JS with no types
import { walkBundle } from '../../../scripts/lib/edgeBundle.mjs'

/**
 * The schedule's PR 14b, calls 1 and 2: the kernels the portals' reads run on the edge are a generated copy of `src`
 * (`scripts/edge-kernels.mjs` into `supabase/functions/_shared/gcKernels/`). The copy on disk must equal a regenerate,
 * so a change to any file in it is a regenerate in the same PR; its list of importers must match the functions whose
 * bundles reach it, so `check:edge-drift` and the header name the same functions; and what the edge cannot run is
 * refused by file.
 */
type Io = { readFile: (p: string) => string; exists: (p: string) => boolean }
const g = generator as {
  OUT_DIR: string
  IMPORTERS: string[]
  ENTRIES: Record<string, unknown>
  generateEdgeKernels: (root: string, io?: Io) => { files: Map<string, string>; problems: string[] }
  copyDifferences: (root: string, copy: Map<string, string>) => string[]
}
const walk = walkBundle as (root: string, entry: string, io: Io) => { files: string[]; unresolved: string[] }

const ROOT = resolve(__dirname, '../../..')
const disk: Io = { readFile: (p) => readFileSync(p, 'utf8'), exists: existsSync }

describe('the copy of the kernels', () => {
  const { files, problems } = g.generateEdgeKernels(ROOT)

  it('is refused nothing, and holds the entries and every file they reach', () => {
    expect(problems).toEqual([])
    for (const entry of Object.keys(g.ENTRIES)) expect(files.has(entry), entry).toBe(true)
    expect(files.has('index.ts')).toBe(true)
  })

  it('equals a regenerate: change a file in it, then run `npm run gen:edge-kernels`', () => {
    expect(g.copyDifferences(ROOT, files)).toEqual([])
  })

  it('names as its importers exactly the functions whose bundles reach it', () => {
    const slugs = readdirSync(join(ROOT, 'supabase/functions'), { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('_') && existsSync(join(ROOT, 'supabase/functions', e.name, 'index.ts')))
      .map((e) => e.name)
    const reaching = slugs.filter((slug) => walk(ROOT, `supabase/functions/${slug}/index.ts`, disk).files.some((f) => f.startsWith(`${g.OUT_DIR}/`))).sort()
    expect(reaching).toEqual([...g.IMPORTERS].sort())
    for (const [path, content] of files) expect(content, path).toContain(`Imported by ${g.IMPORTERS.join(', ')}`)
  })

  it('loads on the edge: every relative value import ends in .ts and resolves inside the copy', () => {
    const io: Io = { readFile: (p) => files.get(p.slice(ROOT.length + g.OUT_DIR.length + 2)) ?? '', exists: (p) => files.has(p.slice(ROOT.length + g.OUT_DIR.length + 2)) }
    const bundle = walk(ROOT, `${g.OUT_DIR}/index.ts`, io)
    expect(bundle.unresolved).toEqual([])
    expect(bundle.files).toHaveLength(files.size)
  })
})

describe('what the generator refuses and rewrites, on planted files', () => {
  const plant = (entry: string, body: string, more: Record<string, string> = {}) => {
    const fake: Record<string, string> = Object.fromEntries(Object.keys(g.ENTRIES).map((e) => [`/repo/src/${e}`, 'export const x = 1\n']))
    fake[`/repo/src/${entry}`] = body
    for (const [p, b] of Object.entries(more)) fake[`/repo/src/${p}`] = b
    return g.generateEdgeKernels('/repo', { readFile: (p) => fake[p] ?? '', exists: (p) => p in fake })
  }
  const entry = Object.keys(g.ENTRIES)[0]!

  it('refuses a package import, a browser global, a dynamic import and an import it cannot find, by file', () => {
    expect(plant(entry, "import { useState } from 'react'\n").problems).toEqual([`src/${entry}: a package import ('react')`])
    expect(plant(entry, 'export const t = () => document.title\n').problems[0]).toMatch(new RegExp(`^src/${entry}: a browser global`))
    expect(plant(entry, "export const m = () => import('./later')\n").problems).toContain(`src/${entry}: a dynamic import`)
    expect(plant(entry, "import { a } from './nowhere'\n").problems).toEqual([`src/${entry}: cannot find './nowhere'`])
  })

  it('takes a package type, and a comment that says "document." freely', () => {
    expect(plant(entry, "import type { ReactNode } from 'react'\n// the document.title is not read here\n").problems).toEqual([])
  })

  it('adds .ts to a value import, keeps the layout, and points types outside the copy back at src', () => {
    const { files } = plant(entry, "import { b } from './helper'\nimport { type T } from './onlyTypes'\nexport { b }\n", {
      [entry.replace(/[^/]+$/, 'helper.ts')]: 'export const b = 2\n',
      [entry.replace(/[^/]+$/, 'onlyTypes.ts')]: 'export type T = number\n',
    })
    const out = files.get(entry)!
    expect(out).toContain("import { b } from './helper.ts'")
    expect(out).toMatch(/import type \{ T \} from '(\.\.\/)+src\/.*onlyTypes'/)
    expect(files.has(entry.replace(/[^/]+$/, 'helper.ts'))).toBe(true)
    expect(files.has(entry.replace(/[^/]+$/, 'onlyTypes.ts'))).toBe(false)
  })
})
