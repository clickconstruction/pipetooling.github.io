import { describe, expect, it } from 'vitest'
import { buildLienPayRunway } from './lienPayRunway'
import type { LienCalendarJob } from './lienCalendar'
import { buildLienCalendarBoard } from './lienCalendarBuckets'
import { LIEN_BILLED_AGE_AMBER_DAYS, LIEN_BILLED_AGE_METER_DAYS, LIEN_BILLED_AGE_RED_DAYS, lienBilledAge, lienBilledOnYmd, lienLaterLines } from './lienBilledAge'

const bill = (id: string, amount: number, status: string, billed_at: string | null, extra: Record<string, unknown> = {}) => ({ id, amount, status, billed_at, ...extra })

describe('lienBilledOnYmd: the day the oldest bill still open went out', () => {
  it('reads the oldest open billed bill; a paid bill, a draft and a bill paid in full by its payments do not count', () => {
    const invoices = [bill('rough', 2000, 'paid', '2026-06-01T15:00:00Z'), bill('top', 2000, 'billed', '2026-08-20T15:00:00Z'), bill('final', 1000, 'billed', '2026-10-02T15:00:00Z'), bill('next', 500, 'ready_to_bill', null)]
    expect(lienBilledOnYmd({ revenue: 5500 }, invoices)).toBe('2026-08-20')
    // The older open bill is paid in full by a payment tied to it: the next one is the oldest still waiting.
    expect(lienBilledOnYmd({ revenue: 5500 }, invoices, [{ invoice_id: 'top', amount: 2000 }])).toBe('2026-10-02')
    // Part paid is still open.
    expect(lienBilledOnYmd({ revenue: 5500 }, invoices, [{ invoice_id: 'top', amount: 500 }])).toBe('2026-08-20')
  })

  it('a bill’s day is a civil day in the company’s time zone, never the first ten characters of the instant', () => {
    // 2026-08-21T02:30Z is 9:30 pm on Aug 20 in Chicago.
    expect(lienBilledOnYmd({}, [bill('a', 100, 'billed', '2026-08-21T02:30:00Z')])).toBe('2026-08-20')
  })

  it('a bill with no billed day falls back to its estimated day; a job with no bill row to its last bill date, else nothing', () => {
    expect(lienBilledOnYmd({}, [bill('a', 100, 'billed', null, { estimated_bill_date: '2026-07-07' })])).toBe('2026-07-07')
    expect(lienBilledOnYmd({ last_bill_date: '2025-09-03' }, [])).toBe('2025-09-03')
    expect(lienBilledOnYmd({ last_bill_date: null }, [])).toBeNull()
    expect(lienBilledOnYmd({}, [bill('a', 100, 'billed', null)])).toBeNull()
    // A bill row wins over the job's own date.
    expect(lienBilledOnYmd({ last_bill_date: '2025-09-03' }, [bill('a', 100, 'billed', '2026-08-24T15:00:00Z')])).toBe('2026-08-24')
  })

  it('every billed bill marked open but settled by money on the job still gives a day: the oldest billed one', () => {
    // $300 on the job with no bill picked pays both bills oldest first; neither is open, and the age is still the oldest's.
    expect(lienBilledOnYmd({ revenue: 300 }, [bill('a', 100, 'billed', '2026-08-01T15:00:00Z'), bill('b', 200, 'billed', '2026-09-01T15:00:00Z')], [{ invoice_id: null, amount: 300 }])).toBe('2026-08-01')
  })
})

describe('lienBilledAge: the words, the tone and the meter', () => {
  const TODAY = '2026-11-14'
  it('counts whole civil days and says them in a few words', () => {
    expect(lienBilledAge('2026-10-06', TODAY)).toMatchObject({ days: 39, words: '39 d ago', tone: 'amber', meterPct: 43, title: 'Billed Oct 6. The age counts from the oldest bill still open.' })
    expect(lienBilledAge('2026-11-13', TODAY)).toMatchObject({ days: 1, words: '1 d ago', tone: 'muted' })
    expect(lienBilledAge(TODAY, TODAY)).toMatchObject({ days: 0, words: 'today', meterPct: 0 })
  })
  it('is muted under thirty days, amber from thirty and red from sixty', () => {
    expect(LIEN_BILLED_AGE_AMBER_DAYS).toBe(30)
    expect(LIEN_BILLED_AGE_RED_DAYS).toBe(60)
    expect(lienBilledAge('2026-10-16', TODAY)).toMatchObject({ days: 29, tone: 'muted' })
    expect(lienBilledAge('2026-10-15', TODAY)).toMatchObject({ days: 30, tone: 'amber' })
    expect(lienBilledAge('2026-09-16', TODAY)).toMatchObject({ days: 59, tone: 'amber' })
    expect(lienBilledAge('2026-09-15', TODAY)).toMatchObject({ days: 60, tone: 'red' })
  })
  it('the meter is full at ninety days and no longer after', () => {
    expect(LIEN_BILLED_AGE_METER_DAYS).toBe(90)
    expect(lienBilledAge('2026-09-30', TODAY)!.meterPct).toBe(50)
    expect(lienBilledAge('2026-08-16', TODAY)!.meterPct).toBe(100)
    expect(lienBilledAge('2025-09-03', TODAY)).toMatchObject({ days: 437, words: '437 d ago', meterPct: 100, tone: 'red' })
  })
  it('no day gives no age; a day ahead of today reads today, never a negative count', () => {
    expect(lienBilledAge(null, TODAY)).toBeNull()
    expect(lienBilledAge('', TODAY)).toBeNull()
    expect(lienBilledAge('not a day', TODAY)).toBeNull()
    expect(lienBilledAge('2026-11-20', TODAY)).toMatchObject({ days: 0, words: 'today' })
  })
})

describe('lienLaterLines: the Later bucket as lines, oldest bill first', () => {
  const TODAY = '2026-10-01'
  const base = { todayYmd: TODAY, propertyKind: 'residential', expectedPayYmd: null, filedYmd: null, releasedYmd: null }
  function job(over: Partial<LienCalendarJob> & { jobId: string; r?: Record<string, unknown> }): LienCalendarJob {
    const { r, ...rest } = over
    const isSub = Boolean(rest.gcId)
    return { number: rest.jobId.toUpperCase(), name: `Job ${rest.jobId}`, customer: '', gcId: null, gcName: null, address: `${rest.jobId} Beechwood Ave`, openBalance: 1000, isSub, runway: buildLienPayRunway({ ...base, openBalance: rest.openBalance ?? 1000, lastWorkYmd: '2026-09-10', isSub, ...r }), ...rest }
  }
  const later = (rows: LienCalendarJob[]) => buildLienCalendarBoard(rows, '', TODAY).buckets[3]!

  it('sorts by the age of the bill, a job with no bill day last; each line says who, the lien’s day and what comes first', () => {
    const rows = [
      job({ jobId: 'new', billedOnYmd: '2026-09-25', openBalance: 9000 }),
      job({ jobId: 'none', billedOnYmd: null }),
      job({ jobId: 'old', billedOnYmd: '2026-07-20', gcId: 'gc1', gcName: 'Lowbeck Contracting', r: { lastWorkYmd: '2026-10-01' } }),
      job({ jobId: 'filed', billedOnYmd: '2026-08-15', r: { filedYmd: '2026-09-03' } }),
    ]
    const lines = lienLaterLines(later(rows), TODAY)
    expect(lines.map((l) => l.job.jobId)).toEqual(['old', 'filed', 'new', 'none'])
    expect(lines.map((l) => l.billed?.words ?? null)).toEqual(['73 d ago', '47 d ago', '6 d ago', null])
    expect(lines.map((l) => l.who)).toEqual(['Lowbeck Contracting', 'direct', 'direct', 'direct'])
    // October's work on a house under a GC: the notice is due Dec 15, the lien Jan 15.
    expect(lines[0]).toMatchObject({ lienBy: 'Jan 15 · 106 d', first: 'notice by Dec 15', closed: false })
    // A lien on file says so in the runway's own words.
    expect(lines[1]!.lienBy).toBe(rows[3]!.runway.lines[0])
    expect(lines[1]!.first).toBe('')
    expect(lines[2]).toMatchObject({ lienBy: 'Dec 15 · 75 d', first: '' })
  })

  it('two bills of one age keep the tighter date first', () => {
    const rows = [job({ jobId: 'b', billedOnYmd: '2026-09-01', r: { propertyKind: 'non_residential' } }), job({ jobId: 'a', billedOnYmd: '2026-09-01' })]
    expect(lienLaterLines(later(rows), TODAY).map((l) => l.job.jobId)).toEqual(['a', 'b'])
  })

  it('an overdue job listed with its property stays under the job that hosts it, greyed', () => {
    const rows = [
      job({ jobId: 'host', billedOnYmd: '2026-09-20', address: '12 Oak St, Seguin, TX' }),
      job({ jobId: 'older', billedOnYmd: '2026-08-01' }),
      job({ jobId: 'gone', billedOnYmd: '2026-04-01', address: '12 Oak St, Seguin', r: { lastWorkYmd: '2026-03-10' } }),
    ]
    const board = buildLienCalendarBoard(rows, '', TODAY)
    expect(board.buckets[0]!.summary).toBe('0 listed here · 1 is listed under Later')
    const lines = lienLaterLines(board.buckets[3]!, TODAY)
    expect(lines.map((l) => `${l.job.jobId}${l.closed ? ' closed' : ''}`)).toEqual(['older', 'host', 'gone closed'])
    expect(lines[2]!.lienBy).toBe(rows[2]!.runway.lines.join(' · '))
  })
})
