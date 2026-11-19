import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import { serveDueForFiling } from './lienDeadlines'
import type { LienFilingTarget } from './lienFilingBatch'
import { recordLienFiling, type LienFilingBatchDeps } from './lienFilingBatchIo'

// Every job, county and number here is made up.
const target: LienFilingTarget = { jobId: 'job-9004', jobNumber: 'JP9004', jobLabel: '9004 · Sample Job', county: 'Alder', fileByYmd: '2026-12-15', daysLeft: 27, fields: { county: 'Alder', unpaidAmount: '9000.00' }, amount: 9000 }
const file = new File(['%PDF-made-up'], 'J9004 Lien (20260229004).pdf', { type: 'application/pdf' })

function deps(over: Partial<LienFilingBatchDeps> = {}) {
  const steps: string[] = []
  const d: LienFilingBatchDeps = {
    alreadyFiled: async () => (steps.push('read'), false),
    insert: async (row) => (steps.push(`insert:${JSON.stringify(row)}`), 'filing-1'),
    sync: async (jobId) => void steps.push(`sync:${jobId}`),
    saveScans: (async (saves: ReadonlyArray<{ target: { filingId: string; recordingNumber: string; filedYmd: string } }>) => (steps.push(`scan:${saves[0]!.target.filingId}:${saves[0]!.target.recordingNumber}:${saves[0]!.target.filedYmd}`), { done: [...saves], failed: [] })) as never,
    ...over,
  }
  return { d, steps }
}

describe('recordLienFiling', () => {
  it('reads, inserts the Lien window’s own row as the person signed in, marks the desk item, then saves the stamped file', async () => {
    const { d, steps } = deps()
    await expect(recordLienFiling({ target, number: ' 20260229004 ', filedYmd: '2026-11-18', createdBy: 'user-1', file }, d)).resolves.toEqual({ filingId: 'filing-1', scanProblem: '', scanSaved: true })
    expect(steps).toEqual([
      'read',
      `insert:${JSON.stringify({ job_id: 'job-9004', kind: 'affidavit', amount: 9000, fields: target.fields, county: 'Alder', recording_number: '20260229004', filed_at: '2026-11-18', serve_due: serveDueForFiling('2026-11-18'), created_by: 'user-1' })}`,
      'sync:job-9004',
      'scan:filing-1:20260229004:2026-11-18',
    ])
  })

  it('writes nothing for a lien someone else just recorded, and says so', async () => {
    const { d, steps } = deps({ alreadyFiled: async () => true })
    await expect(recordLienFiling({ target, number: '20260229004', filedYmd: '2026-11-18', createdBy: 'user-1' }, d)).rejects.toThrow('This lien is already on record as filed.')
    expect(steps).toEqual([])
  })

  it('keeps the filing when the desk item did not mark, and saves no file when none was chosen', async () => {
    const { d, steps } = deps({ sync: async () => { throw new Error('offline') } })
    await expect(recordLienFiling({ target, number: '20260229004', filedYmd: '2026-11-18', createdBy: null }, d)).resolves.toEqual({ filingId: 'filing-1', scanProblem: '', scanSaved: false })
    expect(steps.some((s) => s.startsWith('scan'))).toBe(false)
  })

  it('says why a stamped file did not save, with the lien still on record', async () => {
    const { d } = deps({ saveScans: (async (saves: ReadonlyArray<unknown>) => ({ done: [], failed: [{ save: saves[0], reason: 'the file was not added to the job’s folder' }] })) as never })
    await expect(recordLienFiling({ target, number: '20260229004', filedYmd: '2026-11-18', createdBy: 'user-1', file }, d)).resolves.toEqual({ filingId: 'filing-1', scanProblem: 'the file was not added to the job’s folder', scanSaved: false })
  })

  it('throws the insert’s own reason, and marks nothing', async () => {
    const { d, steps } = deps({ insert: async () => { throw { message: 'permission denied for table job_lien_filings' } } })
    await expect(recordLienFiling({ target, number: '20260229004', filedYmd: '2026-11-18', createdBy: 'user-1', file }, d)).rejects.toMatchObject({ message: 'permission denied for table job_lien_filings' })
    expect(steps).toEqual(['read'])
  })
})
