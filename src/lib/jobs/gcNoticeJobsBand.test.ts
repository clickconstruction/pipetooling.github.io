import { describe, expect, it } from 'vitest'
import { buildGcNoticeBand, buildGcNoticeBandRow, gcNoticeBandReadings, gcNoticeBandStageWords, pourGcNoticeBandLines, type GcNoticeBandJobInput, type GcNoticeJobWork } from './gcNoticeJobsBand'

const TODAY = '2026-09-25'

function work(lines: Array<[string, number, string | null]>, invoices: Array<[string, number, string]> = [], payments: Array<[number, string | null]> = []): GcNoticeJobWork {
  return {
    fixtures: lines.map(([name, price, invoice_id], i) => ({ id: `f${i}`, name, line_unit_price: price, count: 1, invoice_id, sequence_order: i })),
    invoices: invoices.map(([id, amount, status]) => ({ id, amount, status })),
    payments: payments.map(([amount, invoice_id]) => ({ amount, invoice_id })),
  }
}

// The live run on 2026-09-25 (RMC- Dudley Mason), seven of its 22 jobs — the ones that read wrong plus two that read right.
const J372: GcNoticeBandJobInput = { jobId: '372', status: 'waiting', revenue: 44000, paymentsMade: 17600, pctComplete: 80, lastWorkYmd: null, address: '1780 FM 1343, Castroville, TX 78009', work: work([['Plumbing Per Plans', 44000, null]], [['i1', 17600, 'paid'], ['i2', 17600, 'billed']], [[17600, 'i1']]) }
const J305: GcNoticeBandJobInput = { jobId: '305', status: 'waiting', revenue: 15400, paymentsMade: 0, pctComplete: 90, lastWorkYmd: null, address: '11224 Kendall Canyon, San Antonio, TX 78255', work: work([['Job total (migrated)', 15400, null]]) }
const J706: GcNoticeBandJobInput = { jobId: '706', status: 'waiting', revenue: 21000, paymentsMade: 10000, pctComplete: null, lastWorkYmd: '2026-05-26', address: '1875 Co Rd 777, Devine, TX 78016', work: work([['Rough In', 8400, null], ['Top Out', 8400, null], ['Trim Set', 4200, null]], [['i1', 10000, 'paid']], [[10000, 'i1']]) }
const J651: GcNoticeBandJobInput = { jobId: '651', status: 'working', revenue: 21950, paymentsMade: 8780, pctComplete: null, lastWorkYmd: '2026-05-18', address: '233 Palomino Trail, Natalia, TX', work: work([['Rough In', 8780, null], ['Top Out', 8780, 'i2'], ['Trim Set', 4390, null]], [['i1', 8780, 'paid'], ['i2', 8780, 'billed']], [[8780, 'i1']]) }
const J868: GcNoticeBandJobInput = { jobId: '868', status: 'billed', revenue: 2650, paymentsMade: 0, pctComplete: null, lastWorkYmd: null, address: '1875 Co Rd 777, Devine, TX 78016', work: work([['Service Visit (HCP #868)', 2650, 'i1']], [['i1', 2650, 'billed']]) }
const J273: GcNoticeBandJobInput = { jobId: '273', status: 'billed', revenue: 56365, paymentsMade: 38780, pctComplete: 80, lastWorkYmd: '2026-08-26', address: '9703 Lenox Hl San Antonio, TX 78255', work: work([['Job total (migrated)', 52200, null], ['CHANGE ORDER: washing machine', 555, 'i3'], ['Material', 110, 'i3'], ['CHANGE ORDER: gas to fire features', 3500, 'i2']], [['i1', 13420, 'billed'], ['i2', 3500, 'billed'], ['i3', 665, 'billed']]) }
const J258: GcNoticeBandJobInput = { jobId: '258', status: 'billed', revenue: 17800, paymentsMade: 8000, pctComplete: 100, lastWorkYmd: '2026-08-11', address: '628 Terrell Rd, San Antonio, TX 78209', work: work([['Trim set complete', 17800, null]], [['i1', 8000, 'paid'], ['i2', 9800, 'billed']], [[8000, 'i1']]) }

describe('gcNoticeBandReadings — what looks wrong, in the Pipeline’s words, each naming its door', () => {
  it('a Waiting job with work done and a bill out reads as the stage the evidence says → Status', () => {
    const r = buildGcNoticeBandRow(J372, TODAY)
    expect(r.readings.map((x) => [x.key, x.label, x.tone, x.door])).toEqual([['stage', 'Waiting, but 80% done and a bill out', 'red', 'status']])
    expect(r.billedUnpaid).toBe(17600)
    expect(r.doneNotBilled).toBe(0)
    expect(r.open).toBe(26400)
  })
  it('a Waiting job 90% done with nothing billed reads the stage and the unbilled work → Status, Bill it', () => {
    const r = buildGcNoticeBandRow(J305, TODAY)
    expect(r.readings.map((x) => x.label)).toEqual(['Waiting, but 90% done', '$13,860 done, not billed'])
    expect(r.readings.map((x) => x.door)).toEqual(['status', 'bill'])
    expect(r.lines[0]!.migrated).toBe(true)
    expect(r.lines[0]!.state).toBe('done')
  })
  it('a Waiting job with a paid draw and no percent reads the stage, the missing percent and the quiet → three chips', () => {
    const r = buildGcNoticeBandRow(J706, TODAY)
    expect(r.readings.map((x) => [x.label, x.tone])).toEqual([
      ['Waiting, but a draw paid', 'red'],
      ['set % done', 'amber'],
      ['quiet 122 d', 'amber'],
    ])
  })
  it('a bill out with no percent is red (the Pipeline’s v2.3411 alert), and the invoice’s money lands on the line it names', () => {
    const r = buildGcNoticeBandRow(J651, TODAY)
    expect(r.readings[0]).toMatchObject({ key: 'pct', label: 'set % done', tone: 'red', door: 'pct' })
    expect(r.lines.map((l) => [l.name, l.state])).toEqual([
      ['Rough In', 'paid'],
      ['Top Out', 'billed'],
      ['Trim Set', 'todo'],
    ])
  })
  it('a billed job with no percent reads red even with the bill paid down to nothing else', () => {
    expect(buildGcNoticeBandRow(J868, TODAY).readings.map((x) => [x.label, x.tone])).toEqual([['set % done', 'red']])
  })
  it('a billed job with a percent and its money on bills reads right', () => {
    expect(buildGcNoticeBandRow(J273, TODAY).readings).toEqual([])
    expect(buildGcNoticeBandRow(J258, TODAY).readings).toEqual([])
  })
  it('a paid job never reads wrong; Working with everything done and billed reads the stage', () => {
    expect(gcNoticeBandReadings({ stage: 'paid', pct: null, paid: 100, billedUnpaid: 0, doneNotBilled: 0, lastWorkYmd: '2026-01-01', todayYmd: TODAY })).toEqual([])
    expect(gcNoticeBandReadings({ stage: 'working', pct: 100, paid: 0, billedUnpaid: 5000, doneNotBilled: 0, lastWorkYmd: null, todayYmd: TODAY }).map((x) => x.label)).toEqual(['Working, but 100% done and billed'])
  })
})

describe('pourGcNoticeBandLines — the money poured onto the lines', () => {
  it('pours paid, then billed, then done down the lines in order', () => {
    const lines = pourGcNoticeBandLines(work([['Rough In', 8400, null], ['Top Out', 8400, null], ['Trim Set', 4200, null]]), { paid: 10000, billedUnpaid: 0, doneNotBilled: 2000 })
    expect(lines.map((l) => [l.state, l.paid, l.billed, l.done])).toEqual([
      ['paid', 8400, 0, 0],
      ['part', 1600, 0, 2000],
      ['todo', 0, 0, 0],
    ])
  })
  it('a line half paid and half billed reads part', () => {
    const lines = pourGcNoticeBandLines(J372.work, { paid: 17600, billedUnpaid: 17600, doneNotBilled: 0 })
    expect(lines[0]).toMatchObject({ state: 'part', paid: 17600, billed: 17600 })
  })
  it('no lines → no rows; a line with no price reads todo', () => {
    expect(pourGcNoticeBandLines(null, { paid: 0, billedUnpaid: 0, doneNotBilled: 0 })).toEqual([])
    expect(pourGcNoticeBandLines(work([['Note', 0, null]]), { paid: 100, billedUnpaid: 0, doneNotBilled: 0 })[0]!.state).toBe('todo')
  })
})

describe('buildGcNoticeBand — the groups and the head line', () => {
  const jobs = [J372, J305, J706, J651, J868, J273, J258]
  it('groups by the stage on record in stage order, biggest open first inside, counting what looks wrong', () => {
    const band = buildGcNoticeBand(jobs, TODAY, 'stage')
    expect(band.groups.map((g) => [g.label, g.rows.map((r) => r.jobId), g.wrong])).toEqual([
      ['Waiting', ['372', '305', '706'], 3],
      ['Working', ['651'], 1],
      ['Billed', ['273', '258', '868'], 1],
    ])
    expect(gcNoticeBandStageWords(band)).toBe('Waiting 3 · Working 1 · Billed 3')
    expect(band.counts).toMatchObject({ jobs: 7, wrong: 5 })
    expect(band.counts.billed).toBe(band.counts.paid + band.counts.billedUnpaid)
  })
  it('biggest open first is one group; by property puts the two Devine jobs together', () => {
    expect(buildGcNoticeBand(jobs, TODAY, 'open').groups.map((g) => g.rows.map((r) => r.jobId))).toEqual([['372', '273', '305', '651', '706', '258', '868']])
    const byProperty = buildGcNoticeBand(jobs, TODAY, 'property', (id) => (id === '706' ? '1875 Co Rd 777, Devine' : ''))
    const devine = byProperty.groups.find((g) => g.rows.some((r) => r.jobId === '706'))!
    expect(devine.rows.map((r) => r.jobId)).toEqual(['706', '868'])
    expect(devine.label).toBe('1875 Co Rd 777, Devine')
  })
  it('a job with no work read still gets a row, with no lines', () => {
    const band = buildGcNoticeBand([{ ...J258, work: null }], TODAY)
    expect(band.groups[0]!.rows[0]!.lines).toEqual([])
    expect(band.counts.open).toBe(9800)
  })
})
