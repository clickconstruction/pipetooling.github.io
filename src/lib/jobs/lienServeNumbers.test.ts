import { describe, expect, it } from 'vitest'
import type { JobLienFilingRow } from './lienDeadlines'
import { lienServeDraftFor, lienServeDraftWith, lienServeHasContractor, lienServeRecordOutcome, lienServeRecordWords, lienServeWrites, type LienServeDraft } from './lienServeNumbers'
import type { LienServeJob } from './lienServePackets'

// Every name and number here is made up.
const job = (number: string, over: Record<string, unknown> = {}, isSub = true): LienServeJob => ({
  jobId: `job-${number}`,
  jobNumber: number,
  jobLabel: `${number} · Sample Job`,
  isSub,
  filing: { id: `f-${number}`, job_id: `job-${number}`, kind: 'affidavit', fields: {}, filed_at: '2026-11-13', serve_due: '2026-11-18', served_at: null, voided_at: null, sends: [], ...over } as unknown as JobLienFilingRow,
})

describe('a lien’s draft', () => {
  it('opens on what the filing already holds, not yet ticked', () => {
    const d = lienServeDraftFor(job('1', { sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9589 0001', receipt_url: 'https://drive.example/r1' }] }))
    expect(d).toEqual({ mailed: false, owner: { tracking: '9589 0001', receiptUrl: 'https://drive.example/r1' }, contractor: { tracking: '', receiptUrl: '' } })
  })

  it('has one copy on a job contracted with the owner, by the paper’s own answer first', () => {
    expect(lienServeDraftFor(job('1', {}, false)).contractor).toBeNull()
    expect(lienServeHasContractor(job('1', { fields: { isSub: false } }, true))).toBe(false)
    expect(lienServeHasContractor(job('1', { fields: { isSub: true } }, false))).toBe(true)
  })

  it('ticks Mailed as soon as a number or a photo is typed', () => {
    const start = lienServeDraftFor(job('1'))
    const typed = lienServeDraftWith(start, 'owner', { tracking: '9589 0002', receiptUrl: '' })
    expect(typed.mailed).toBe(true)
    expect(lienServeDraftWith(start, 'original_contractor', { tracking: '', receiptUrl: 'https://drive.example/r2' }).mailed).toBe(true)
    // Clearing a number does not untick a box: only a hand does.
    expect(lienServeDraftWith(typed, 'owner', { tracking: '', receiptUrl: '' }).mailed).toBe(true)
    expect(lienServeDraftWith(start, 'owner', { tracking: ' ', receiptUrl: '' }).mailed).toBe(false)
  })
})

describe('lienServeWrites', () => {
  const jobs = [job('1'), job('2', {}, false), job('3')]
  const drafts: Record<string, LienServeDraft> = {
    'f-1': { mailed: true, owner: { tracking: ' 9589 0001 ', receiptUrl: '' }, contractor: { tracking: '9589 0002', receiptUrl: 'https://drive.example/r' } },
    'f-2': { mailed: true, owner: { tracking: '', receiptUrl: '' }, contractor: null },
    'f-3': { mailed: false, owner: { tracking: '', receiptUrl: '' }, contractor: { tracking: '', receiptUrl: '' } },
  }

  it('writes each ticked lien as Record service… writes it, and leaves the rest alone', () => {
    expect(lienServeWrites(jobs, drafts, '2026-11-16')).toEqual([
      {
        filingId: 'f-1',
        jobId: 'job-1',
        jobLabel: '1 · Sample Job',
        servedOn: '2026-11-16',
        sends: [
          { recipient: 'owner', method: 'certified_mail', tracking: '9589 0001', sent_on: '2026-11-16' },
          { recipient: 'original_contractor', method: 'certified_mail', tracking: '9589 0002', sent_on: '2026-11-16', receipt_url: 'https://drive.example/r' },
        ],
      },
      // Mailed with no number yet: the day alone, as the Lien window records it.
      { filingId: 'f-2', jobId: 'job-2', jobLabel: '2 · Sample Job', servedOn: '2026-11-16', sends: [] },
    ])
  })

  it('writes nothing with no day', () => {
    expect(lienServeWrites(jobs, drafts, '')).toEqual([])
  })
})

describe('the press and its outcome', () => {
  it('counts the liens it records and is dead at none, with the reason', () => {
    expect(lienServeRecordWords(11, true)).toEqual({ button: 'Record 11 liens served', dead: false, why: '' })
    expect(lienServeRecordWords(1, true).button).toBe('Record 1 lien served')
    expect(lienServeRecordWords(0, true)).toEqual({ button: 'Record liens served', dead: true, why: 'Tick Mailed on each lien whose copies went out, or type a mail number.' })
    expect(lienServeRecordWords(3, false)).toMatchObject({ dead: true, why: 'Set the day the copies were mailed.' })
  })

  it('says what took and what did not', () => {
    expect(lienServeRecordOutcome(11, 0)).toEqual({ line: 'Recorded 11 liens served.', head: null, tone: 'success' })
    expect(lienServeRecordOutcome(2, 1)).toMatchObject({ line: 'Recorded 2 liens served. 1 did not record.', tone: 'warning' })
  })
})
