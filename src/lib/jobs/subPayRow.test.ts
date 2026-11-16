import { describe, expect, it } from 'vitest'
import { mySubSheetsFromRpc, NO_SHEET_LINE, NO_SHEET_VALUE, subPayWords } from './subPayRow'

const sheet = (id: string, over: Record<string, unknown> = {}) => ({ id, address: '1208 Mesquite Ln', job_number: '1042', job_ledger_id: 'job-1', job_date: null, labor_rate: null, stage: 'working', stage_changed_at: null, stage_source: null, payable_after: null, pay_hold_reason: null, ...over })
const item = (jobId: string, amount: number) => ({ job_id: jobId, fixture: 'Top out', count: 1, hrs_per_unit: null, is_fixed: true, labor_rate: null, direct_labor_amount: amount, sequence_order: 0 })
const pay = (jobId: string, amount: number, day: string) => ({ job_id: jobId, amount, memo: null, payment_date: day, created_at: `${day}T15:00:00Z`, hidden_from_sub: false, sequence_order: 0 })
const answer = (over: Record<string, unknown> = {}) => ({ on_roster: true, sheets: [], items: [], payments: [], portal_slug: null, portal_token: null, ...over })
const read = (over: Record<string, unknown> = {}) => mySubSheetsFromRpc(answer(over), 'https://app.example')!

describe('mySubSheetsFromRpc', () => {
  it('reads nothing from an answer that is not the function’s', () => {
    expect(mySubSheetsFromRpc(null, 'https://app.example')).toBeNull()
    expect(mySubSheetsFromRpc([], 'https://app.example')).toBeNull()
    expect(mySubSheetsFromRpc({ sheets: [] }, 'https://app.example')).toBeNull()
  })

  it('works the money out with the portal’s kernel', () => {
    const r = read({ sheets: [sheet('s1')], items: [item('s1', 4200)], payments: [pay('s1', 2100, '2026-11-14'), pay('s1', -100, '2026-11-15')] })
    expect(r.sheets).toHaveLength(1)
    expect(r.sheets[0]).toMatchObject({ agreed: 4200, paid: 2100, backcharges: 100, open: 2000 })
    expect(r.lastPaymentYmd).toBe('2026-11-14')
  })

  it('opens their own short address, else their live link, else nothing', () => {
    expect(read({ portal_slug: 'dana', portal_token: 'tok' }).portalUrl).toMatch(/dana$/)
    expect(read({ portal_token: 'tok en' }).portalUrl).toBe('https://app.example/sub?t=tok%20en')
    expect(read().portalUrl).toBeNull()
  })
})

describe('subPayWords', () => {
  it('says so when no sheet of theirs is on the job', () => {
    expect(subPayWords(read())).toEqual({ value: NO_SHEET_VALUE, lines: [NO_SHEET_LINE] })
  })

  it('leads with what is open, then the agreed price and what has been paid, then the stage', () => {
    expect(subPayWords(read({ sheets: [sheet('s1')], items: [item('s1', 4200)] }))).toEqual({ value: '$4,200.00 open', lines: ['$4,200.00 agreed · nothing paid yet', 'Stage: Work'] })
    expect(subPayWords(read({ sheets: [sheet('s1', { stage: 'walkthrough' })], items: [item('s1', 4200)] })).lines[1]).toBe('Stage: Pre-inspection')
  })

  it('reads the day the office promised, in the portal’s words', () => {
    const words = subPayWords(read({ sheets: [sheet('s1', { stage: 'customer_pay', payable_after: '2026-11-21' })], items: [item('s1', 4200)], payments: [pay('s1', 2100, '2026-11-14')] }))
    expect(words).toEqual({ value: '$2,100.00 open', lines: ['$4,200.00 agreed · $2,100.00 paid', 'Payable after Nov 21, 2026'] })
  })

  it('reads the office’s hold before any date', () => {
    const words = subPayWords(read({ sheets: [sheet('s1', { payable_after: '2026-11-21', pay_hold_reason: 'Waiting on the W-9' })], items: [item('s1', 500)] }))
    expect(words.lines[words.lines.length - 1]).toBe('On hold: Waiting on the W-9')
  })

  it('names a back-charge beside the paid money', () => {
    const words = subPayWords(read({ sheets: [sheet('s1')], items: [item('s1', 1000)], payments: [pay('s1', 400, '2026-11-10'), pay('s1', -50, '2026-11-11')] }))
    expect(words.value).toBe('$550.00 open')
    expect(words.lines[0]).toBe('$1,000.00 agreed · $400.00 paid · $50.00 back-charged')
  })

  it('is paid in full with the day of the last payment', () => {
    const words = subPayWords(read({ sheets: [sheet('s1', { stage: 'customer_pay' })], items: [item('s1', 4200)], payments: [pay('s1', 2100, '2026-11-14'), pay('s1', 2100, '2026-11-24')] }))
    expect(words).toEqual({ value: 'Paid in full', lines: ['$4,200.00 agreed · $4,200.00 paid', 'Last payment Nov 24, 2026'] })
  })

  it('adds two sheets on one job up and says there are two', () => {
    const words = subPayWords(read({ sheets: [sheet('s1', { stage: 'customer_pay' }), sheet('s2')], items: [item('s1', 1000), item('s2', 500)], payments: [pay('s1', 1000, '2026-11-12')] }))
    // The first sheet is paid; what decides the last line is the sheet still open.
    expect(words).toEqual({ value: '$500.00 open', lines: ['2 sheets on this job', '$1,500.00 agreed · $1,000.00 paid', 'Stage: Work'] })
  })
})
