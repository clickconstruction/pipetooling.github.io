import { beforeEach, describe, expect, it, vi } from 'vitest'

type Call = { cols: string; kinds: string[]; how: string; jobs: string[]; limit: number }
const db = vi.hoisted(() => ({
  calls: [] as Array<{ cols: string; kinds: string[]; how: string; jobs: string[]; limit: number }>,
  answer: (_call: { cols: string; jobs: string[] }): { data: unknown[] | null; error: { code?: string } | null } => ({ data: [], error: null }),
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: (name: string) => {
      if (name !== 'sent_documents') throw new Error(`unexpected table ${name}`)
      const call: Call = { cols: '', kinds: [], how: '', jobs: [], limit: 0 }
      const q = {
        select: (cols: string) => ((call.cols = cols), q),
        in: (_col: string, kinds: string[]) => ((call.kinds = kinds), q),
        eq: (_col: string, how: string) => ((call.how = how), q),
        overlaps: (_col: string, jobs: string[]) => ((call.jobs = jobs), q),
        order: () => q,
        limit: (n: number) => {
          call.limit = n
          db.calls.push(call)
          return Promise.resolve(db.answer(call))
        },
      }
      return q
    },
  },
}))

import { lienAffidavitPrintPaper, lienPrintKey, lienPrintSourceSnapshot } from './lienPrintSworn'
import { loadLienNewestPrints } from './lienPrintsIo'

const row = (id: string, jobIds: string[], sentAt: string, unpaid?: string) => ({
  id,
  kind: 'lien_affidavit',
  title: 'Lien Affidavit',
  how: 'print',
  sent_at: sentAt,
  sent_by_name: 'ZZ Office',
  job_ids: jobIds,
  ...(unpaid ? { source_snapshot: lienPrintSourceSnapshot([lienAffidavitPrintPaper({ jobId: jobIds[0]!, fields: { unpaidAmount: unpaid } as never })]) } : {}),
})

beforeEach(() => {
  db.calls = []
  db.answer = () => ({ data: [], error: null })
})

describe('loadLienNewestPrints', () => {
  it('asks for the lien prints of these jobs, out of a printer alone', async () => {
    db.answer = () => ({ data: [row('a', ['j1'], '2026-09-10T15:00:00Z', '100.00'), row('b', ['j1'], '2026-09-12T15:00:00Z', '90.00')], error: null })
    const read = await loadLienNewestPrints(['j1', 'j1', ''])
    expect(db.calls).toHaveLength(1)
    expect(db.calls[0]).toMatchObject({ how: 'print', jobs: ['j1'] })
    expect(db.calls[0]!.kinds.sort()).toEqual(['lien_affidavit', 'lien_notice', 'lien_notice_53_056', 'lien_notice_packet'])
    expect(db.calls[0]!.cols).toContain('source_snapshot')
    expect(read!.whole).toBe(true)
    expect(read!.prints.get(lienPrintKey('affidavit', 'j1'))).toMatchObject({ copyId: 'b', printedBy: 'ZZ Office', fields: { unpaidAmount: '90.00' } })
  })

  it('reads no jobs without a call', async () => {
    expect(await loadLienNewestPrints([])).toEqual({ prints: new Map(), whole: true })
    expect(db.calls).toHaveLength(0)
  })

  it('is null when the read fails: never "nothing printed"', async () => {
    db.answer = () => ({ data: null, error: { code: '57014' } })
    expect(await loadLienNewestPrints(['j1'])).toBeNull()
  })

  it('reads again without the snapshot on a database that has no such column', async () => {
    db.answer = (call) => (call.cols.includes('source_snapshot') ? { data: null, error: { code: '42703' } } : { data: [row('a', ['j1'], '2026-09-10T15:00:00Z')], error: null })
    const read = await loadLienNewestPrints(['j1'])
    expect(db.calls).toHaveLength(2)
    expect(read!.prints.get(lienPrintKey('affidavit', 'j1'))).toMatchObject({ copyId: 'a', fields: null })
  })

  it('asks fifty jobs a read, keeps one row once, and says when a read filled its limit', async () => {
    const jobs = Array.from({ length: 120 }, (_, i) => `j${i}`)
    // One packet row names a job in each of two reads: it is one print.
    db.answer = (call) => ({ data: call.jobs.includes('j0') || call.jobs.includes('j60') ? [row('p', ['j0', 'j60'], '2026-09-10T15:00:00Z')] : [], error: null })
    const read = await loadLienNewestPrints(jobs)
    expect(db.calls.map((c) => c.jobs.length)).toEqual([50, 50, 20])
    expect(read!.whole).toBe(true)
    expect(read!.prints.size).toBe(2)

    db.calls = []
    db.answer = (call) => ({ data: Array.from({ length: call.jobs.includes('j0') ? 1000 : 0 }, (_, i) => row(`r${i}`, ['j0'], '2026-09-10T15:00:00Z')), error: null })
    expect((await loadLienNewestPrints(jobs))!.whole).toBe(false)
  })
})
