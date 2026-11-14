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
    const rows = [row('small', 100), row('big', 4_100_000), row('edge', 4_000_000), row('a', 5), row('b', 6), row('c', 7)]
    const r = uploadReport(rows)
    expect(CEILING).toBe(4_000_000)
    expect(r.ceiling).toBe('4.00 MB')
    // At the ceiling passes; one byte over would not.
    expect(r.over).toEqual(['big'])
    expect(r.lines).toEqual(['  - big: 4.10 MB, 0.10 MB past the ceiling. Its biggest files:', '       4.10 MB  fn/big/index.ts', '       0.00 MB  fn/_shared/x.ts'])
    expect(r.biggest.map((l) => l.trim().split(/\s+/).pop())).toEqual(['big', 'edge', 'small', 'c', 'b'])
    expect(uploadReport(rows, 50).over).toEqual(['big', 'edge', 'small'])
  })

  it('no function uploads the whole generated database types: the copy holds the parts it names (v2.7256)', () => {
    const slugs = edgeUploads().map((u) => u.slug)
    expect(slugs.length).toBeGreaterThan(100)
    const uploading = slugs.filter((slug) => edgeUpload(`supabase/functions/${slug}/index.ts`).via('src/types/database.ts') !== null)
    expect(uploading).toEqual([])
    // dev-mcp reaches the slim file through its bid kernels, a type import.
    expect(edgeUpload('supabase/functions/dev-mcp/index.ts').via('supabase/functions/_shared/gcKernels/types/database.ts')).not.toBeNull()
  })

  it('legal-portal uploads neither the sample fixtures, the kernel copy nor the generated types', () => {
    const u = edgeUpload('supabase/functions/legal-portal/index.ts')
    expect(u.via('supabase/functions/_shared/customerSampleFixtures.ts')).toBeNull()
    expect(u.files.some((f) => f.includes('_shared/gcKernels/'))).toBe(false)
    expect(u.via('src/types/database.ts')).toBeNull()
    expect(u.via('supabase/functions/_shared/customerSampleLegal.ts')).toEqual(['supabase/functions/legal-portal/index.ts', 'supabase/functions/_shared/customerSampleLegal.ts'])
    // 0.22 MB on 2026-11-13; a tenth of the limit leaves room for the portal to grow.
    expect(u.bytes).toBeLessThan(500_000)
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
