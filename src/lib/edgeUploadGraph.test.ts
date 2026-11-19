import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
// @ts-expect-error — the walker runs on bare Node, so it is plain JS with no types
import * as kernel from '../../scripts/lib/edgeUploadGraph.mjs'

type Upload = { files: string[]; bytes: number; via: (path: string) => string[] | null; biggest: (n: number) => [string, number][] }
type Row = { slug: string; files: number; bytes: number; biggest: [string, number][] }
const edgeUpload = kernel.edgeUpload as (entry: string, root?: string) => Upload
const edgeUploads = kernel.edgeUploads as (dir?: string, root?: string) => Row[]
const uploadReport = kernel.uploadReport as (rows: Row[], ceiling?: number) => { over: string[]; lines: string[]; biggest: string[]; ceiling: string }
const CEILING = kernel.UPLOAD_CEILING_BYTES as number

/**
 * v2.7135: `supabase functions deploy` uploads a function's index.ts and every file reached by a relative import,
 * type-only ones included, and the API refuses an upload over 5 MB with HTTP 413. legal-portal was refused on
 * 2026-11-12 at about 4.74 MB because it imported `_shared/customerSampleFixtures.ts` for one sample, and that file's
 * graph reaches the GC kernels copy and the generated database types. The legal sample now lives in
 * `_shared/customerSampleLegal.ts`.
 */
describe('edgeUpload (what a deploy uploads)', () => {
  const root = mkdtempSync(join(tmpdir(), 'edge-upload-'))
  afterAll(() => rmSync(root, { recursive: true, force: true }))
  const put = (path: string, body: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), body)
  }

  it('follows value, type-only and re-export imports, once each, and names the chain to a file', () => {
    put('fn/a/index.ts', "import { x } from '../_shared/x.ts'\nimport type { T } from '../_shared/t.ts'\nimport 'https://deno.land/std/x.ts'\n")
    put('fn/_shared/x.ts', "export { y } from './y.ts'\nimport { x as again } from './x.ts'\nexport const x = 1\n")
    put('fn/_shared/y.ts', 'export const y = 2\n')
    put('fn/_shared/t.ts', "import type {\n  Big,\n} from './big'\nexport type T = Big\n")
    put('fn/_shared/big.ts', 'export type Big = string\n' + 'x'.repeat(1000))
    const u = edgeUpload('fn/a/index.ts', root)
    expect([...u.files].sort()).toEqual(['fn/_shared/big.ts', 'fn/_shared/t.ts', 'fn/_shared/x.ts', 'fn/_shared/y.ts', 'fn/a/index.ts'])
    expect(u.bytes).toBeGreaterThan(1000)
    expect(u.via('fn/_shared/big.ts')).toEqual(['fn/a/index.ts', 'fn/_shared/t.ts', 'fn/_shared/big.ts'])
    expect(u.via('fn/_shared/missing.ts')).toBeNull()
    expect(u.biggest(1)).toEqual([['fn/_shared/big.ts', readFileSync(join(root, 'fn/_shared/big.ts')).length]])
  })

  it('names each function past the ceiling with its biggest files, and the five biggest uploads (v2.7256)', () => {
    const row = (slug: string, bytes: number): Row => ({ slug, files: 3, bytes, biggest: [[`fn/${slug}/index.ts`, bytes - 10], ['fn/_shared/x.ts', 10]] })
    const rows = [row('small', 100), row('big', 4_600_000), row('edge', 4_500_000), row('a', 5), row('b', 6), row('c', 7)]
    const r = uploadReport(rows)
    expect(CEILING).toBe(4_500_000)
    expect(r.ceiling).toBe('4.50 MB')
    // At the ceiling passes; one byte over would not.
    expect(r.over).toEqual(['big'])
    expect(r.lines).toEqual(['  - big: 4.60 MB, 0.10 MB past the ceiling. Its biggest files:', '       4.60 MB  fn/big/index.ts', '       0.00 MB  fn/_shared/x.ts'])
    expect(r.biggest.map((l) => l.trim().split(/\s+/).pop())).toEqual(['big', 'edge', 'small', 'c', 'b'])
    expect(uploadReport(rows, 50).over).toEqual(['big', 'edge', 'small'])
  })

  it('no function uploads the whole generated database types: the copy holds the parts it names (v2.7256)', () => {
    const slugs = edgeUploads().map((u) => u.slug)
    expect(slugs.length).toBeGreaterThan(100)
    const uploading = slugs.filter((slug) => edgeUpload(`supabase/functions/${slug}/index.ts`).via('src/types/database.ts') !== null)
    expect(uploading).toEqual([])
    // dev-mcp reached the slim file through nine type imports until punch list #359 inlined their aliases: it now uploads the
    // core (every enum and helper, 7 KB) and no slim file.
    const seat = edgeUpload('supabase/functions/dev-mcp/index.ts')
    expect(seat.via('supabase/functions/_shared/gcKernels/types/database.ts')).toBeNull()
    expect(seat.via('supabase/functions/_shared/gcKernels/types/databaseCore.ts')).not.toBeNull()
    // The portals dropped it too once their four kernels wrote each row as one alias (v2.7294); the Bridge's email still
    // takes its client type from it and runs the overhead reads, so it keeps it.
    expect(edgeUpload('supabase/functions/customer-portal/index.ts').via('supabase/functions/_shared/gcKernels/types/database.ts')).toBeNull()
    expect(edgeUpload('supabase/functions/bridge-weekly-sheet/index.ts').via('supabase/functions/_shared/gcKernels/types/database.ts')).not.toBeNull()
  })

  it('dev-mcp and quo-send upload no portal translations: the language and the Spanish switch sit in portalLang.ts (v2.7289, punch list #359)', () => {
    const i18n = 'supabase/functions/_shared/gcKernels/lib/gc/portalI18n.ts'
    const lang = 'supabase/functions/_shared/gcKernels/lib/gc/portalLang.ts'
    for (const slug of ['dev-mcp', 'quo-send']) {
      const u = edgeUpload(`supabase/functions/${slug}/index.ts`)
      expect(u.via(i18n)).toBeNull()
      expect(u.via(lang)).not.toBeNull()
    }
    // The portals say the schedule in two languages, so they keep the translations, through the file that re-exports the switch.
    const portal = edgeUpload('supabase/functions/customer-portal/index.ts')
    expect(portal.via(i18n)).not.toBeNull()
    expect(portal.via(lang)?.slice(-2)).toEqual([i18n, lang])
  })

  it('dev-mcp uploads no Quo send kernel: the texts switch takes the purpose from sendPurpose.ts (v2.7290, punch list #359)', () => {
    const u = edgeUpload('supabase/functions/dev-mcp/index.ts')
    expect(u.via('supabase/functions/_shared/gcKernels/lib/quo/send.ts')).toBeNull()
    expect(u.via('supabase/functions/_shared/gcKernels/lib/quo/events.ts')).toBeNull()
    // The purpose's file imports nothing, so the copy points at it in src (the generator's rule for such a file): 1 KB.
    expect(u.via('src/lib/quo/sendPurpose.ts')?.slice(-2)).toEqual(['supabase/functions/_shared/gcKernels/lib/quo/textsSwitch.ts', 'src/lib/quo/sendPurpose.ts'])
    // quo-send sends, so it keeps the kernel and takes the purpose through it.
    expect(edgeUpload('supabase/functions/quo-send/index.ts').via('supabase/functions/_shared/gcKernels/lib/quo/send.ts')).not.toBeNull()
  })

  it('dev-mcp uploads no overhead parts reads: the accounting buckets take the line’s shape from overheadPartsDetailLine.ts (punch list #359, PR 4)', () => {
    const reads = 'supabase/functions/_shared/gcKernels/lib/overheadOfficePartsReads.ts'
    const u = edgeUpload('supabase/functions/dev-mcp/index.ts')
    expect(u.via(reads)).toBeNull()
    expect(u.via('src/lib/overheadPartsDetailLine.ts')?.slice(-2)).toEqual(['supabase/functions/_shared/gcKernels/lib/overheadPartsAccountingBuckets.ts', 'src/lib/overheadPartsDetailLine.ts'])
    // The Bridge's email reads the overhead by day, so it keeps the reads.
    expect(edgeUpload('supabase/functions/bridge-weekly-sheet/index.ts').via(reads)).not.toBeNull()
  })

  it('dev-mcp uploads neither the form schema nor the GC customer email kernel: the form values and the GC entity’s name sit in files of their own (v2.7292, punch list #359)', () => {
    const u = edgeUpload('supabase/functions/dev-mcp/index.ts')
    expect(u.via('supabase/functions/_shared/formSchema.ts')).toBeNull()
    expect(u.via('supabase/functions/_shared/formValues.ts')?.slice(-2)).toEqual(['supabase/functions/_shared/hoursStatementForm.ts', 'supabase/functions/_shared/formValues.ts'])
    expect(u.via('supabase/functions/_shared/gcCustomerEmails.ts')).toBeNull()
    expect(u.via('supabase/functions/_shared/portalCompany.ts')).not.toBeNull()
    // The signing function fills the schema, and the GC customer email frames its mail, so each keeps its file.
    expect(edgeUpload('supabase/functions/hours-statement-signing/index.ts').via('supabase/functions/_shared/formSchema.ts')).not.toBeNull()
    expect(edgeUpload('supabase/functions/gc-customer-email/index.ts').via('supabase/functions/_shared/gcCustomerEmails.ts')).not.toBeNull()
  })

  it('legal-portal uploads neither the sample fixtures, the kernel copy’s index nor the generated types', () => {
    const u = edgeUpload('supabase/functions/legal-portal/index.ts')
    expect(u.via('supabase/functions/_shared/customerSampleFixtures.ts')).toBeNull()
    // Of the copy it holds the Lien desk's off-desk rule and the two files that rule reads, by path: paid in kind
    // (v2.7259), and a job a person took off the lien path (v2.7521, `lienJobPath.ts`, which imports nothing).
    expect(u.files.filter((f) => f.includes('_shared/gcKernels/')).sort()).toEqual(['supabase/functions/_shared/gcKernels/lib/inKind/inKindLedger.ts', 'supabase/functions/_shared/gcKernels/lib/jobs/lienInKind.ts', 'supabase/functions/_shared/gcKernels/lib/jobs/lienJobPath.ts'])
    expect(u.via('src/types/database.ts')).toBeNull()
    expect(u.via('supabase/functions/_shared/customerSampleLegal.ts')).toEqual(['supabase/functions/legal-portal/index.ts', 'supabase/functions/_shared/customerSampleLegal.ts'])
    // 0.22 MB on 2026-11-13; a tenth of the limit leaves room for the portal to grow.
    expect(u.bytes).toBeLessThan(500_000)
  })

  it('the sub portal’s two #388 sample sheets ride with sub-portal alone, so their edit puts no other function behind (v2.7951)', () => {
    const SUB_SAMPLE = 'supabase/functions/_shared/customerSampleSub.ts'
    const readers = edgeUploads()
      .map((row) => row.slug)
      .filter((slug) => edgeUpload(`supabase/functions/${slug}/index.ts`).via(SUB_SAMPLE) !== null)
    expect(readers).toEqual(['sub-portal'])
    // The widely imported fixtures file knows nothing of them.
    const fixtures = readFileSync('supabase/functions/_shared/customerSampleFixtures.ts', 'utf8')
    expect(fixtures).not.toContain('usualPayWeeks')
    expect(fixtures).not.toContain('customerPaidOn')
  })

  it('the legal sample moved whole: the fixtures file re-exports it and keeps none of it', () => {
    const legal = readFileSync('supabase/functions/_shared/customerSampleLegal.ts', 'utf8')
    const fixtures = readFileSync('supabase/functions/_shared/customerSampleFixtures.ts', 'utf8')
    expect(legal).toContain('export function sampleLegalPortalResponse(company: SamplePortalCompany, todayYmd: string)')
    expect(legal).toContain('export const SAMPLE_FIRM = {')
    expect(legal).toContain('export function sampleStatutoryFifteenth(')
    expect(legal.match(/^import /gm)).toEqual(['import '])
    expect(fixtures).toContain("export { SAMPLE_FIRM, sampleLegalPortalResponse, sampleStatutoryFifteenth } from './customerSampleLegal.ts'")
    expect(fixtures).not.toContain('function sampleLegalMatter(')
    expect(fixtures).not.toContain('export const SAMPLE_FIRM')
  })
})
