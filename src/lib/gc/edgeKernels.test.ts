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
 * bundles reach it, so `check:edge-drift` and `IMPORTERS` name the same functions; no file in it names them, so a new
 * importer asks for no redeploy (v2.6348); and what the edge cannot run is refused by file.
 */
type Io = { readFile: (p: string) => string; exists: (p: string) => boolean; list?: (dir: string) => string[] }
type Member = { name: string; lines: string[] }
type Parts = { before: string[]; sections: { name: string; members: Member[] }[]; after: string[] }
type Counts = { Tables: number; Views: number; Functions: number }
const g = generator as {
  OUT_DIR: string
  DATABASE_TYPES: string
  IMPORTERS: string[]
  ENTRIES: Record<string, unknown>
  generateEdgeKernels: (root: string, io?: Io) => { files: Map<string, string>; problems: string[]; typeFiles: string[]; typeReaders: string[] }
  copyDifferences: (root: string, copy: Map<string, string>) => string[]
  stringWords: (source: string) => Set<string>
  databaseParts: (source: string) => Parts | null
  slimDatabase: (source: string, words: Set<string>) => { text: string; kept: Counts; of: Counts } | null
}
const walk = walkBundle as (root: string, entry: string, io: Io) => { files: string[]; unresolved: string[] }

const ROOT = resolve(__dirname, '../../..')
const disk: Io = { readFile: (p) => readFileSync(p, 'utf8'), exists: existsSync }
/** The entries the index exports nothing of: the dev seat reads them by their own path. */
const offIndexEntries = () =>
  Object.entries(g.ENTRIES as Record<string, { values: string[]; types: string[] }>)
    .filter(([, e]) => e.values.length === 0 && e.types.length === 0)
    .map(([entry]) => entry)

describe('the copy of the kernels', () => {
  const { files, problems, typeFiles } = g.generateEdgeKernels(ROOT)

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
  })

  it('names no importer, so a function joining IMPORTERS changes no file in the copy and no deployed bundle (v2.6348)', () => {
    g.IMPORTERS.push('zz-one-more-importer')
    try {
      const again = g.generateEdgeKernels(ROOT).files
      expect([...again].filter(([path, content]) => files.get(path) !== content).map(([path]) => path)).toEqual([])
    } finally {
      g.IMPORTERS.pop()
    }
  })

  it('loads on the edge: every relative value import ends in .ts and resolves inside the copy or at a kernel already on the edge, the files of types aside', () => {
    const inCopy = (p: string) => p.slice(ROOT.length + g.OUT_DIR.length + 2)
    // A kernel src re-exports from `supabase/functions/_shared/` is pointed at where it is (v2.5881), so the walk reads it from disk.
    const onEdge = (p: string) => p.startsWith(join(ROOT, 'supabase/functions/_shared/')) && !p.startsWith(join(ROOT, g.OUT_DIR) + '/')
    const io: Io = { readFile: (p) => files.get(inCopy(p)) ?? (onEdge(p) && existsSync(p) ? readFileSync(p, 'utf8') : ''), exists: (p) => files.has(inCopy(p)) || (onEdge(p) && existsSync(p)) }
    const bundle = walk(ROOT, `${g.OUT_DIR}/index.ts`, io)
    expect(bundle.unresolved).toEqual([])
    // An entry the index exports nothing of is read by its own path (the dev seat's submittal kernels), so the walk
    // starts there too: every file of the copy still resolves, from the index or from one of those.
    const offIndex = offIndexEntries()
    const byPath = offIndex.map((entry) => walk(ROOT, `${g.OUT_DIR}/${entry}`, io))
    expect(byPath.flatMap((b) => b.unresolved)).toEqual([])
    const reached = new Set([...bundle.files, ...byPath.flatMap((b) => b.files)].filter((f) => f.startsWith(`${g.OUT_DIR}/`)))
    expect(reached.size).toBe(files.size - typeFiles.length)
    expect(bundle.files.some((f) => f === 'supabase/functions/_shared/billTruth.ts')).toBe(true)
    // The thread's file type sits in its own types file, so the Quo kernels take it without lineFiles.ts's code.
    // The Bids row aliases are types alone (v2.6804): the submittal kernels the dev seat reads take them from src's own file.
    // The database's types are held slim (v2.7256), for their types alone.
    expect(typeFiles).toEqual(['lib/bids/bidPricingEngineTypes.ts', 'lib/gc/types.ts', 'lib/messages/lineFileTypes.ts', 'types/bids.ts', 'types/database.ts'])
  })
})

describe('the slim database types (v2.7256: a deploy uploads a type import too, and the whole file is 1.48 MB)', () => {
  const { files, typeReaders } = g.generateEdgeKernels(ROOT)
  const full = readFileSync(join(ROOT, 'src', g.DATABASE_TYPES), 'utf8')
  const slim = files.get(g.DATABASE_TYPES)!
  // The slim file is the generated one's lines with members left out, under a three-line header.
  const slimParts = g.databaseParts(slim.split('\n').slice(3).join('\n'))!
  const fullParts = g.databaseParts(full)!
  const membersOf = (parts: Parts) => new Map(parts.sections.flatMap((s) => s.members.map((m) => [`${s.name} ${m.name}`, m.lines.join('\n')] as const)))

  it('reads the generated file in its parts, and is held in the copy at its own path', () => {
    expect(fullParts).not.toBeNull()
    expect(slimParts).not.toBeNull()
    expect(slim.startsWith(`// GENERATED by scripts/edge-kernels.mjs from src/${g.DATABASE_TYPES}.`)).toBe(true)
    // Not one file of the copy reaches back to src's whole file.
    for (const [path, content] of files) expect(content.includes('src/types/database.ts\''), path).toBe(false)
  })

  it('keeps each member exactly as the generated file writes it, the helpers and Constants too, and leaves most of it out', () => {
    const fullMembers = membersOf(fullParts)
    for (const [key, text] of membersOf(slimParts)) if (!key.endsWith('[_ in never]')) expect(text, key).toBe(fullMembers.get(key))
    expect(slimParts.before).toEqual(fullParts.before)
    expect(slimParts.after).toEqual(fullParts.after)
    // Enums and composite types whole.
    for (const name of ['Enums', 'CompositeTypes']) {
      expect(slimParts.sections.find((s) => s.name === name)).toEqual(fullParts.sections.find((s) => s.name === name))
    }
    expect(slim.length).toBeLessThan(full.length / 2)
  })

  it('holds every table, view and function the copy and its type readers name by from, rpc, Tables<> or Database[…]', () => {
    const kept = membersOf(slimParts)
    const known = membersOf(fullParts)
    const sources = [...files.values(), ...typeReaders.map((p) => readFileSync(join(ROOT, p), 'utf8'))]
    const named = new Set<string>()
    for (const source of sources) {
      for (const m of source.matchAll(/\.(?:from|rpc)\(\s*['"`]([\w-]+)['"`]/g)) named.add(m[1]!)
      for (const m of source.matchAll(/\b(?:Tables|TablesInsert|TablesUpdate)<\s*['"]([\w-]+)['"]/g)) named.add(m[1]!)
      for (const m of source.matchAll(/\[\s*['"](?:Tables|Views|Functions)['"]\s*\]\s*\[\s*['"]([\w-]+)['"]\s*\]/g)) named.add(m[1]!)
    }
    const missing = [...named].filter((name) => ['Tables', 'Views', 'Functions'].some((s) => known.has(`${s} ${name}`)) && !['Tables', 'Views', 'Functions'].some((s) => kept.has(`${s} ${name}`)))
    expect(missing).toEqual([])
    // The ones each kind of read names, by name.
    expect(kept.has('Tables bids')).toBe(true)
    expect(kept.has('Views gc_change_orders_office')).toBe(true)
    expect(kept.has('Functions list_tally_parts_with_po')).toBe(true)
    expect(kept.has('Tables vehicles')).toBe(false)
  })

  it('reads the Bridge email for names: it takes its client type from the slim file, so the deploy uploads no whole file', () => {
    expect(typeReaders).toEqual(['supabase/functions/bridge-weekly-sheet/index.ts'])
    expect(readFileSync(join(ROOT, typeReaders[0]!), 'utf8')).toContain("import type { Database } from '../_shared/gcKernels/types/database.ts'")
  })
})

describe('what the index does not carry', () => {
  /** The weekly email's kernels: bridge-weekly-sheet reads them by path (your-week-email takes the send's switch the same way). */
  const SHEET_ENTRIES = [
    'lib/bridge/sheetReads.ts',
    'lib/bridge/sheetBuild.ts',
    'lib/bridge/weekMail.ts',
    'lib/bridge/moneyCard.ts',
    'lib/bridge/cashAccounts.ts',
    'lib/bridge/mercuryCash.ts',
    'lib/jobs/zzTestJobReads.ts',
    'lib/bridge/weeklySend.ts',
  ]

  it('reaches no Bridge kernel: the weekly email reads them by path, so a portal that imports the index uploads none of them (customer-portal went over the 5 MB a deploy may send a second time, punch list #318)', () => {
    expect(offIndexEntries().filter((entry) => SHEET_ENTRIES.includes(entry))).toEqual(SHEET_ENTRIES)
    const fromIndex = walk(ROOT, `${g.OUT_DIR}/index.ts`, disk).files
    expect(fromIndex.filter((f) => f.includes('/lib/bridge/'))).toEqual([])
    // And the email still reaches every one of them by its own import.
    const sheet = walk(ROOT, 'supabase/functions/bridge-weekly-sheet/index.ts', disk).files
    for (const entry of SHEET_ENTRIES) expect(sheet).toContain(`${g.OUT_DIR}/${entry}`)
    expect(sheet).not.toContain(`${g.OUT_DIR}/index.ts`)
  })

  it('reaches no submittal kernel: the dev seat reads them by path, so a portal that imports the index uploads none of them (customer-portal went over the 5 MB a deploy may send)', () => {
    const offIndex = offIndexEntries().filter((entry) => !SHEET_ENTRIES.includes(entry))
    expect(offIndex).toEqual([
      'lib/submittals/standingRows.ts',
      'lib/submittals/procurementItemSources.ts',
      'lib/submittals/procurementLog.ts',
      'lib/submittals/procurementBoard.ts',
      'lib/submittals/productStatus.ts',
      // The dev seat's plan_last_work_day (v2.7206): the Lien window's rule for a day set by hand and its table of dates.
      'lib/jobs/lienLastWorkDay.ts',
      'lib/jobs/lienLastWorkDayPreview.ts',
      // The dev seat's plan_notice_by_hand (v2.7229): the rows one mailed paper becomes, the item's day, the nine values and the signer.
      'lib/jobs/lienNoticeByHand.ts',
      'lib/jobs/lienSentAt.ts',
      'lib/jobs/lienNoticeJobFields.ts',
      'lib/jobs/lienSigner.ts',
      // The dev seat's plan_bid_update (v2.6945): the outcome line, the loss categories and the Board's sections.
      'lib/outcomeChangeBidNote.ts',
      'lib/bidLossCategories.ts',
      'lib/bids/submissionSections.ts',
      // The dev seat's plan_bid_counts (v2.6967): the Count Sheet's rules.
      'lib/bids/countSheet.ts',
      'lib/bids/countRowUnit.ts',
      'lib/bids/parseCountsImportText.ts',
      'lib/bids/pickActiveVersion.ts',
      // The dev seat's plan_bid_takeoff: the materials total and how a part is sold.
      'lib/bids/bidMaterials.ts',
      'lib/materials/orderIncrement.ts',
      // The dev seat's plan_bid_labor: the tab's cost line and the sync's fixture key.
      'lib/bids/bidTotalCostBreakdown.ts',
      'lib/bids/laborSyncPlan.ts',
      // The dev seat's priced total: the grid's projection and the tab's picks.
      'lib/bids/scenarioPricingRows.ts',
      'lib/bids/legacyTemplatePricing.ts',
      'lib/bids/pickDefaultPriceBookTemplateId.ts',
      'lib/bids/pricingWriteTarget.ts',
      // The dev seat's plan_bid_pricing: which book entry a row prices from.
      'lib/bids/resolvePricingEntry.ts',
    ])
    const fromIndex = walk(ROOT, `${g.OUT_DIR}/index.ts`, disk).files
    expect(fromIndex.filter((f) => f.includes('/lib/submittals/') || f.includes('/lib/bids/') || f.includes('/lib/rfq/'))).toEqual([])
    // And the seat still reaches every one of them by its own import.
    const seat = walk(ROOT, 'supabase/functions/dev-mcp/index.ts', disk).files
    for (const entry of offIndex) expect(seat).toContain(`${g.OUT_DIR}/${entry}`)
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

  it('points an import of a kernel that already lives on the edge at that file, and copies nothing for it (v2.5881)', () => {
    const fake: Record<string, string> = Object.fromEntries(Object.keys(g.ENTRIES).map((e) => [`/repo/src/${e}`, 'export const x = 1\n']))
    // The first entry sits three folders under src, so four `..` reach the repo's root.
    fake[`/repo/src/${entry}`] = "export * from '../../../../supabase/functions/_shared/edgeKernel'\nexport { y } from '../../../../elsewhere/thing'\n"
    fake['/repo/supabase/functions/_shared/edgeKernel.ts'] = 'export const k = 1\n'
    fake['/repo/elsewhere/thing.ts'] = 'export const y = 1\n'
    const { files, problems } = g.generateEdgeKernels('/repo', { readFile: (p) => fake[p] ?? '', exists: (p) => p in fake })
    expect(problems).toEqual([`src/${entry}: an import outside src and the edge's _shared ('../../../../elsewhere/thing')`])
    expect(files.get(entry)).toMatch(/export \* from '(\.\.\/)+edgeKernel\.ts'/)
    expect([...files.keys()].some((f) => f.includes('edgeKernel'))).toBe(false)
  })

  it('writes a package type the client needs for Deno, and leaves a package value import refused (v2.5881)', () => {
    const out = plant(entry, "import type { SupabaseClient } from '@supabase/supabase-js'\nexport const f = (db: SupabaseClient) => db\n")
    expect(out.problems).toEqual([])
    expect(out.files.get(entry)).toContain("import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'")
  })

  it('takes a package type, and a comment that says "document." freely', () => {
    expect(plant(entry, "import type { ReactNode } from 'react'\n// the document.title is not read here\n").problems).toEqual([])
  })

  it('adds .ts to a value import, keeps the layout, and points types from a file that imports nothing back at src, .ts and all', () => {
    const { files, problems } = plant(entry, "import { b } from './helper'\nimport { type T } from './onlyTypes'\nexport { b }\n", {
      [entry.replace(/[^/]+$/, 'helper.ts')]: 'export const b = 2\n',
      [entry.replace(/[^/]+$/, 'onlyTypes.ts')]: 'export type T = number\n',
    })
    const out = files.get(entry)!
    expect(problems).toEqual([])
    expect(out).toContain("import { b } from './helper.ts'")
    expect(out).toMatch(/import type \{ T \} from '(\.\.\/)+src\/.*onlyTypes\.ts'/)
    expect(files.has(entry.replace(/[^/]+$/, 'helper.ts'))).toBe(true)
    expect(files.has(entry.replace(/[^/]+$/, 'onlyTypes.ts'))).toBe(false)
  })

  it('copies a file of types whose own imports are types alone, so deno check resolves it inside the copy', () => {
    const { files, problems } = plant(entry, "import type { T } from './someTypes'\nexport const x: T = 1\n", {
      [entry.replace(/[^/]+$/, 'someTypes.ts')]: "import type { U } from './leafTypes'\nexport type T = U\n",
      [entry.replace(/[^/]+$/, 'leafTypes.ts')]: 'export type U = number\n',
    })
    expect(problems).toEqual([])
    expect(files.get(entry)).toContain("import type { T } from './someTypes.ts'")
    expect(files.has(entry.replace(/[^/]+$/, 'someTypes.ts'))).toBe(true)
    expect(files.get(entry.replace(/[^/]+$/, 'someTypes.ts'))).toMatch(/import type \{ U \} from '(\.\.\/)+src\/.*leafTypes\.ts'/)
    expect(files.has(entry.replace(/[^/]+$/, 'leafTypes.ts'))).toBe(false)
  })

  it('refuses types from a file that runs code of its own, unless the copy holds that file already', () => {
    const more = {
      [entry.replace(/[^/]+$/, 'withCode.ts')]: "import { b } from './helper'\nexport type T = number\nexport const c = b\n",
      [entry.replace(/[^/]+$/, 'helper.ts')]: 'export const b = 2\n',
    }
    expect(plant(entry, "import type { T } from './withCode'\nexport const x: T = 1\n", more).problems).toEqual([
      `src/${entry}: types from './withCode', which runs code of its own: move them to a types file`,
    ])
    const held = plant(entry, "import type { T } from './withCode'\nimport { c } from './withCode'\nexport const x: T = c\n", more)
    expect(held.problems).toEqual([])
    expect(held.files.get(entry)).toContain("import type { T } from './withCode.ts'")
  })

  // The first entry sits three folders under src, so three `..` reach src's types.
  const toTypes = '../../../types/database'

  it('holds the database types slim at their own path, reads a type reader outside the copy, and points both at it (v2.7256)', () => {
    const fake: Record<string, string> = Object.fromEntries(Object.keys(g.ENTRIES).map((e) => [`/repo/src/${e}`, 'export const x = 1\n']))
    fake[`/repo/src/${entry}`] = `import type { Database } from '${toTypes}'\nexport const id = (r: Database['public']['Tables']['bids']['Row']) => r.id\n`
    fake['/repo/src/types/database.ts'] = FAKE_DB
    fake['/repo/supabase/functions/fn/index.ts'] = "import type { Database } from '../_shared/gcKernels/types/database.ts'\nexport const q = (db: any) => db.rpc('set_fn')\n"
    fake['/repo/supabase/functions/other/index.ts'] = "export const q = (db: any) => db.from('vehicles')\n"
    const list = (dir: string) =>
      Object.keys(fake)
        .filter((p) => p.startsWith(`${dir}/`))
        .map((p) => p.slice(dir.length + 1))
    const { files, problems, typeFiles, typeReaders } = g.generateEdgeKernels('/repo', { readFile: (p) => fake[p] ?? '', exists: (p) => p in fake || Object.keys(fake).some((k) => k.startsWith(`${p}/`)), list })
    expect(problems).toEqual([])
    expect(files.get(entry)).toContain(`import type { Database } from '${toTypes}.ts'`)
    expect(typeFiles).toContain('types/database.ts')
    expect(typeReaders).toEqual(['supabase/functions/fn/index.ts'])
    const slim = files.get('types/database.ts')!
    // bids from the entry; set_fn from the reader and customers, its set's table; never vehicles, which only a
    // function that does not import the slim file names.
    expect(slim).toMatch(/^ {6}bids: \{$/m)
    expect(slim).toMatch(/^ {6}set_fn: \{$/m)
    expect(slim).toMatch(/^ {6}customers: \{$/m)
    expect(slim).not.toMatch(/^ {6}vehicles: \{$/m)
    expect(slim).toContain('the whole file: 2 tables, 0 views and 1 functions')
  })

  it('refuses a database file not in the shape the types generator writes', () => {
    const fake: Record<string, string> = Object.fromEntries(Object.keys(g.ENTRIES).map((e) => [`/repo/src/${e}`, 'export const x = 1\n']))
    fake[`/repo/src/${entry}`] = `import type { Json } from '${toTypes}'\nexport const j: Json = 1\n`
    fake['/repo/src/types/database.ts'] = 'export type Json = number\n'
    const { problems } = g.generateEdgeKernels('/repo', { readFile: (p) => fake[p] ?? '', exists: (p) => p in fake })
    expect(problems).toEqual(['src/types/database.ts: not in the shape `supabase gen types typescript` writes, so the copy cannot take its parts'])
  })
})

/** A database file in the shape `supabase gen types typescript` writes, small. */
const FAKE_DB = [
  'export type Json =',
  '  | string',
  '  | Json[]',
  '',
  'export type Database = {',
  '  __InternalSupabase: {',
  '    PostgrestVersion: "14.1"',
  '  }',
  '  graphql_public: {',
  '    Tables: {',
  '      [_ in never]: never',
  '    }',
  '  }',
  '  public: {',
  '    Tables: {',
  '      bids: {',
  '        Row: {',
  '          customer_id: string',
  '          id: string',
  '        }',
  '        Relationships: [',
  '          {',
  '            foreignKeyName: "bids_customer_id_fkey"',
  '            referencedRelation: "customers"',
  '          },',
  '        ]',
  '      }',
  '      customers: {',
  '        Row: {',
  '          id: string',
  '        }',
  '        Relationships: []',
  '      }',
  '      vehicles: {',
  '        Row: {',
  '          id: string',
  '        }',
  '        Relationships: []',
  '      }',
  '    }',
  '    Views: {',
  '      [_ in never]: never',
  '    }',
  '    Functions: {',
  '      bid_words: {',
  '        Args: { b: Database["public"]["Tables"]["vehicles"]["Row"] }',
  '        Returns: string',
  '      }',
  '      either_way:',
  '        | { Args: never; Returns: undefined }',
  '        | {',
  '            Args: { x: number }',
  '            Returns: number',
  '          }',
  '      set_fn: {',
  '        Args: never',
  '        Returns: {',
  '          id: string',
  '        }',
  '        SetofOptions: {',
  '          from: "*"',
  '          to: "customers"',
  '          isOneToOne: true',
  '          isSetofReturn: false',
  '        }',
  '      }',
  '    }',
  '    Enums: {',
  '      role: "owner" | "dev"',
  '    }',
  '    CompositeTypes: {',
  '      [_ in never]: never',
  '    }',
  '  }',
  '}',
  '',
  'export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]',
  'export const Constants = { public: { Enums: { role: ["owner", "dev"] } } } as const',
  '',
].join('\n')

describe('the words a source names in its strings (what the slim database types keep)', () => {
  it('reads strings, template text and the strings in a template’s code, never a comment or a regex', () => {
    const words = g.stringWords(
      [
        "// db.from('in_a_comment')",
        "/* db.rpc('in_a_block') */",
        "const a = db.from('jobs_ledger').select('id, payer:customers!inner(name)')",
        'const b = `left ${db.rpc("nested_fn", { k: `deeper` })} right_word`',
        "const r = /'not_a_string'/g.test(s)",
        "const half = total / 2 / 3 // 'after_division'",
        "const esc = 'two\\nwords'",
        "const url = 'https://example.com//path_word'",
        'const t: Database[\'public\'][\'Tables\'][\'bids\'][\'Row\'] = row',
      ].join('\n'),
    )
    for (const w of ['jobs_ledger', 'id', 'payer', 'customers', 'inner', 'name', 'left', 'nested_fn', 'deeper', 'right_word', 'two', 'words', 'path_word', 'public', 'Tables', 'bids', 'Row']) expect(words.has(w), w).toBe(true)
    for (const w of ['in_a_comment', 'in_a_block', 'not_a_string', 'after_division', 'twonwords', 'db', 'total']) expect(words.has(w), w).toBe(false)
  })
})

describe('the slim database file, on a planted one', () => {
  const names = (text: string) => [...text.matchAll(/^ {6}("?[\w$]+"?|\[_ in never\]):/gm)].map((m) => m[1])

  it('reads the generated shape in its parts and puts it back line for line, and refuses any other', () => {
    const parts = g.databaseParts(FAKE_DB)!
    expect(parts.sections.map((s) => [s.name, s.members.map((m) => m.name)])).toEqual([
      ['Tables', ['bids', 'customers', 'vehicles']],
      ['Views', ['[_ in never]']],
      ['Functions', ['bid_words', 'either_way', 'set_fn']],
      ['Enums', ['role']],
      ['CompositeTypes', ['[_ in never]']],
    ])
    expect(g.slimDatabase(FAKE_DB, new Set(['bids', 'customers', 'vehicles', 'bid_words', 'either_way', 'set_fn']))!.text).toBe(FAKE_DB)
    expect(g.databaseParts(FAKE_DB.replace('  public: {', '  publik: {'))).toBeNull()
    expect(g.databaseParts(FAKE_DB.replace('        Returns: string', '     Returns: string'))).toBeNull()
  })

  it('keeps what the words name, and what a kept function names in turn; a relationship pulls in no table', () => {
    const bids = g.slimDatabase(FAKE_DB, new Set(['bids', 'either_way', 'nothing_here']))!
    expect(names(bids.text)).toEqual(['[_ in never]', 'bids', '[_ in never]', 'either_way', 'role', '[_ in never]'])
    expect(bids.kept).toEqual({ Tables: 1, Views: 0, Functions: 1 })
    expect(bids.of).toEqual({ Tables: 3, Views: 0, Functions: 3 })
    // A function's argument of a table's row, and a set-returning function's table.
    expect(names(g.slimDatabase(FAKE_DB, new Set(['bid_words']))!.text)).toEqual(['[_ in never]', 'vehicles', '[_ in never]', 'bid_words', 'role', '[_ in never]'])
    expect(names(g.slimDatabase(FAKE_DB, new Set(['set_fn']))!.text)).toEqual(['[_ in never]', 'customers', '[_ in never]', 'set_fn', 'role', '[_ in never]'])
    // Nothing named: every named section is empty, as the generator writes an empty one, and the helpers stand.
    const none = g.slimDatabase(FAKE_DB, new Set())!.text
    expect(none).toContain('    Tables: {\n      [_ in never]: never\n    }')
    expect(none).toContain('export const Constants = ')
    expect(none.startsWith('export type Json =')).toBe(true)
  })
})
