import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LienScanTarget } from './lienScanBatch'

const updates: Array<{ row: Record<string, unknown>; id: unknown }> = []
let failUpdateFor: string | null = null

vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      update: (row: Record<string, unknown>) => ({
        eq: async (_col: string, id: unknown) => {
          if (id === failUpdateFor) return { data: null, error: { message: 'permission denied for table job_lien_filings', code: '42501' } }
          updates.push({ row, id })
          return { data: null, error: null }
        },
      }),
    }),
  },
}))

import { saveLienScans } from './lienScanBatchIo'

afterEach(() => {
  updates.length = 0
  failUpdateFor = null
})

// Every name and number here is made up.
const target = (jobNumber: string): LienScanTarget => ({ filingId: `f-${jobNumber}`, jobId: `job-${jobNumber}`, jobNumber, jobLabel: `${jobNumber} · Sample Job`, recordingNumber: '2026-1', filedYmd: '2026-11-13', county: 'Hays', hasScan: false })
const file = (name: string) => new File([new Uint8Array(1024)], name, { type: 'application/pdf' })
const save = (key: string, jobNumber: string) => ({ key, file: file(`${key}.pdf`), target: target(jobNumber) })

describe('saveLienScans', () => {
  it('puts each scan in its own job’s folder under its own name, as it is, and links it on its filing', async () => {
    const puts: Array<{ jobId: string; where: string; name: string; size: number }> = []
    const put = vi.fn(async (jobId: string, where: string, f: File) => {
      puts.push({ jobId, where, name: f.name, size: f.size })
      return { driveFileId: `d-${jobId}`, url: `https://drive.example/${jobId}` }
    })
    const result = await saveLienScans([save('a', '2104'), save('b', '2291')], put as never)
    expect(result.failed).toEqual([])
    expect(result.done.map((d) => d.key)).toEqual(['a', 'b'])
    expect(puts).toEqual([
      { jobId: 'job-2104', where: 'sent', name: 'Lien affidavit, Job 2104, the clerk’s stamped affidavit, scanned, 2026-11-13.pdf', size: 1024 },
      { jobId: 'job-2291', where: 'sent', name: 'Lien affidavit, Job 2291, the clerk’s stamped affidavit, scanned, 2026-11-13.pdf', size: 1024 },
    ])
    expect(updates).toEqual([
      { id: 'f-2104', row: { document_url: 'https://drive.example/job-2104', document_note: 'the clerk’s stamped affidavit, scanned' } },
      { id: 'f-2291', row: { document_url: 'https://drive.example/job-2291', document_note: 'the clerk’s stamped affidavit, scanned' } },
    ])
  })

  it('keeps going past a scan that fails, and says which half failed', async () => {
    failUpdateFor = 'f-2291'
    const put = vi.fn(async (jobId: string) => {
      if (jobId === 'job-2104') throw new Error('The folder could not be reached.')
      return { driveFileId: 'd', url: `https://drive.example/${jobId}` }
    })
    const result = await saveLienScans([save('a', '2104'), save('b', '2291'), save('c', '2317')], put as never)
    expect(result.done.map((d) => d.key)).toEqual(['c'])
    expect(result.failed.map((f) => [f.save.key, f.reason])).toEqual([
      ['a', 'The folder could not be reached.'],
      ['b', 'The scan is in the job’s Drive folder, but its link was not saved on the filing: You don\'t have permission to save lien filing scan.'],
    ])
    expect(updates.map((u) => u.id)).toEqual(['f-2317'])
  })
})
