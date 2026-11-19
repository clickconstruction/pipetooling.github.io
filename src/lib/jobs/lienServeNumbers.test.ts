import { describe, expect, it } from 'vitest'
import type { JobLienFilingRow } from './lienDeadlines'
import { LIEN_SERVE_NUMBERS_WORDS, lienMailedNotSavedWords, lienMailedSavedWords, lienSendsWithMailedDay, lienServeDraftFor, lienServeDraftWith, lienServeHasContractor, lienServeNumberTicks, lienServeProofMissing, lienServeTickDay } from './lienServeNumbers'
import { setLienMailed, type LienMailedIo } from './lienServeMailedIo'
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
  it('opens on what the filing already holds, not ticked while no day is on record', () => {
    const d = lienServeDraftFor(job('1', { sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9589 0001', receipt_url: 'https://drive.example/r1' }] }))
    expect(d).toEqual({ mailed: false, owner: { tracking: '9589 0001', receiptUrl: 'https://drive.example/r1' }, contractor: { tracking: '', receiptUrl: '' } })
  })

  it('opens ticked on a lien whose mailing day is on record', () => {
    expect(lienServeDraftFor(job('1', { served_at: '2026-11-18' })).mailed).toBe(true)
  })

  it('has one copy on a job contracted with the owner, by the paper’s own answer first', () => {
    expect(lienServeDraftFor(job('1', {}, false)).contractor).toBeNull()
    expect(lienServeHasContractor(job('1', { fields: { isSub: false } }, true))).toBe(false)
    expect(lienServeHasContractor(job('1', { fields: { isSub: true } }, false))).toBe(true)
  })

  it('takes a copy’s number or receipt and never ticks the box by itself', () => {
    const start = lienServeDraftFor(job('1'))
    const typed = lienServeDraftWith(start, 'owner', { tracking: '9589 0002', receiptUrl: '' })
    expect(typed).toEqual({ mailed: false, owner: { tracking: '9589 0002', receiptUrl: '' }, contractor: { tracking: '', receiptUrl: '' } })
    expect(lienServeDraftWith(start, 'original_contractor', { tracking: '', receiptUrl: 'https://drive.example/r2' }).mailed).toBe(false)
    // A job with one copy has no contractor's row to fill.
    expect(lienServeDraftWith(lienServeDraftFor(job('2', {}, false)), 'original_contractor', { tracking: '9', receiptUrl: '' }).contractor).toBeNull()
  })
})

describe('what ticks Mailed', () => {
  const blank = lienServeDraftFor(job('1'))
  const numbered = lienServeDraftWith(blank, 'original_contractor', { tracking: '9589 0002', receiptUrl: '' })
  const filed = lienServeDraftWith(blank, 'owner', { tracking: '', receiptUrl: 'https://drive.example/r' })

  it('a mail number does, on a lien nobody has ticked by hand', () => {
    expect(lienServeNumberTicks(numbered, false)).toBe(true)
  })

  it('a file alone does not: it can be the wrong file', () => {
    expect(lienServeNumberTicks(filed, false)).toBe(false)
    expect(lienServeNumberTicks(lienServeDraftWith(blank, 'owner', { tracking: '  ', receiptUrl: '' }), false)).toBe(false)
  })

  it('a box a hand has touched is left to the hand, and a ticked one is not ticked again', () => {
    expect(lienServeNumberTicks(numbered, true)).toBe(false)
    expect(lienServeNumberTicks({ ...numbered, mailed: true }, false)).toBe(false)
  })

  it('writes the Mailed on day, and says why when the box holds none', () => {
    expect(lienServeTickDay(' 2026-11-18 ')).toEqual({ ymd: '2026-11-18', why: '' })
    expect(lienServeTickDay('')).toEqual({ ymd: null, why: 'Set the day the copies were mailed.' })
    expect(lienServeTickDay('11/18/2026').ymd).toBeNull()
  })
})

describe('lienSendsWithMailedDay', () => {
  const sends = [
    { recipient: 'owner', method: 'certified_mail', tracking: '9589 0001' },
    { recipient: 'original_contractor', method: 'certified_mail', tracking: '', receipt_url: 'https://drive.example/r' },
    { recipient: 'surety', method: 'mail', tracking: '' },
  ]

  it('puts the day on each copy the lien mails and leaves any other recipient as it is', () => {
    expect(lienSendsWithMailedDay(sends, '2026-11-18')).toEqual([
      { recipient: 'owner', method: 'certified_mail', tracking: '9589 0001', sent_on: '2026-11-18' },
      { recipient: 'original_contractor', method: 'certified_mail', tracking: '', receipt_url: 'https://drive.example/r', sent_on: '2026-11-18' },
      { recipient: 'surety', method: 'mail', tracking: '' },
    ])
  })

  it('takes the day back off, keeps the proof, and drops a copy left with nothing', () => {
    const mailed = [...lienSendsWithMailedDay(sends, '2026-11-18'), { recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-11-18' }]
    expect(lienSendsWithMailedDay(mailed, null)).toEqual(sends)
    expect(lienSendsWithMailedDay('not a list', '2026-11-18')).toEqual([])
  })
})

describe('lienServeProofMissing', () => {
  const full = { tracking: '9589 0001', receipt_url: 'https://drive.example/r', method: 'certified_mail' }

  it('is true while a copy the lien mails lacks its number or its receipt', () => {
    expect(lienServeProofMissing(job('1', { sends: [{ recipient: 'owner', ...full }] }))).toBe(true)
    expect(lienServeProofMissing(job('1', { sends: [{ recipient: 'owner', ...full }, { recipient: 'original_contractor', ...full, receipt_url: '' }] }))).toBe(true)
  })

  it('is false once every copy has both, and a job contracted with the owner has one copy', () => {
    expect(lienServeProofMissing(job('1', { sends: [{ recipient: 'owner', ...full }, { recipient: 'original_contractor', ...full }] }))).toBe(false)
    expect(lienServeProofMissing(job('1', { sends: [{ recipient: 'owner', ...full }] }, false))).toBe(false)
  })
})

describe('the words beside the box', () => {
  it('say the day that was written, and why a write did not land', () => {
    expect(lienMailedSavedWords('2026-11-18')).toBe('Mailed Nov 18. Saved.')
    expect(lienMailedNotSavedWords('the lien did not take it.')).toBe('Not saved: the lien did not take it. The box is back as the lien holds it.')
    expect(LIEN_SERVE_NUMBERS_WORDS.addReceipt).toBe('Add the mail receipt')
  })
})

describe('setLienMailed', () => {
  const io = (rows: number, held: unknown = [{ recipient: 'owner', method: 'certified_mail', tracking: '9589 0001' }]) => {
    const wrote: Array<{ filingId: string; servedOn: string | null; sends: unknown }> = []
    const fake: LienMailedIo = { read: async () => held, write: async (filingId, servedOn, sends) => (wrote.push({ filingId, servedOn, sends }), rows) }
    return { fake, wrote }
  }

  it('writes the day and the sends read fresh, with the day on each copy', async () => {
    const { fake, wrote } = io(1)
    await expect(setLienMailed({ filingId: 'f-1', servedOn: '2026-11-18' }, fake)).resolves.toEqual([{ recipient: 'owner', method: 'certified_mail', tracking: '9589 0001', sent_on: '2026-11-18' }])
    expect(wrote).toEqual([{ filingId: 'f-1', servedOn: '2026-11-18', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9589 0001', sent_on: '2026-11-18' }] }])
  })

  it('takes the day back with null', async () => {
    const { fake, wrote } = io(1, [{ recipient: 'owner', method: 'certified_mail', tracking: '9589 0001', sent_on: '2026-11-18' }])
    await setLienMailed({ filingId: 'f-1', servedOn: null }, fake)
    expect(wrote[0]).toEqual({ filingId: 'f-1', servedOn: null, sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9589 0001' }] })
  })

  it('fails in words when the database changed no row, so the window never says Saved for a write that was refused', async () => {
    await expect(setLienMailed({ filingId: 'f-1', servedOn: '2026-11-18' }, io(0).fake)).rejects.toThrow('the lien did not take it')
  })
})
