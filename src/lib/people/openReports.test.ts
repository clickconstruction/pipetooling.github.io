import { describe, expect, it } from 'vitest'
import { buildPersonLedger, type LedgerOffset, type LedgerStub } from './personLedger'
import {
  RESIDUE_UNDER,
  allocateOldestFirst,
  countOpenReports,
  moveOverpaymentPlan,
  moveOverpaymentWords,
  offReportOffsets,
  openReportRows,
  openReportState,
  openReportsCaption,
  residueSettlementDeduction,
  settleUp,
  settleUpSentence,
  splitPaymentMemo,
  splitSend,
  type MovePlan,
  type OpenReportPayment,
  type OpenReportRow,
} from './openReports'

const money = (n: number) => `$${Math.abs(n).toFixed(2)}`
const whole = (n: number) => `$${Math.round(Math.abs(n))}`

// Malachi's summer, as the live ledger had it on 2026-09-21: a $2,309.20 week,
// five partly paid, nine untouched. Trimmed to the weeks the rules need.
const NET = 2309.2
const stub = (id: string, start: string, end: string, gross = NET): LedgerStub => ({ id, person_name: 'Malachi', period_start: start, period_end: end, hours_total: 40, gross_pay: gross })
const pay = (id: string, stubId: string, amount: number, paid_at: string, memo: string | null = null) => ({ id, pay_stub_id: stubId, amount, paid_at, memo })

const stubs = [
  stub('w23', '2026-06-07', '2026-06-13'),
  stub('w25', '2026-06-21', '2026-06-27'),
  stub('w27', '2026-07-05', '2026-07-11'),
  stub('w22', '2026-05-31', '2026-06-06'),
]
const payments = [
  pay('p1', 'w25', 800, '2026-07-02', 'Paid via cash off a job'),
  pay('p2', 'w27', 2000, '2026-07-15', 'Cash App #D-D2ZX1EJ25 "Cashapp to Jessica"'),
  pay('p3', 'w22', 2309.2, '2026-06-08', 'Mercury'),
]
const ledger = buildPersonLedger({ name: 'Malachi', stubs, payments, deductions: [], additional: [], offsets: [] })
const byStub = (ps: typeof payments): Record<string, OpenReportPayment[]> => {
  const out: Record<string, OpenReportPayment[]> = {}
  for (const p of ps) (out[p.pay_stub_id] ??= []).push({ id: p.id, paid_at: p.paid_at, amount: p.amount, memo: p.memo })
  return out
}
const rows = openReportRows({ stubs, stubPay: ledger.stubPay, paymentsByStubId: byStub(payments) })

describe('openReportState', () => {
  it('names the four open states and paid', () => {
    expect(openReportState(100, 0)).toBe('unpaid')
    expect(openReportState(100, 40)).toBe('partial')
    expect(openReportState(100, 97)).toBe('residue')
    expect(openReportState(4.74, 0)).toBe('residue') // a tiny untouched report is fees-scale money, not debt
    expect(openReportState(100, 100)).toBe('paid')
    expect(openReportState(100, 100.004)).toBe('paid')
    expect(openReportState(100, 120)).toBe('overpaid')
    expect(RESIDUE_UNDER).toBe(5)
  })
  it('takes a caller threshold', () => {
    expect(openReportState(100, 90, 20)).toBe('residue')
    expect(openReportState(100, 90, 5)).toBe('partial')
  })
})

describe('openReportRows', () => {
  it('lists the not-settled reports oldest first with paid, balance, state and the running pay-to-here', () => {
    expect(rows.map((r) => r.stubId)).toEqual(['w23', 'w25', 'w27'])
    expect(rows.map((r) => r.state)).toEqual(['unpaid', 'partial', 'partial'])
    expect(rows.map((r) => r.paid)).toEqual([0, 800, 2000])
    expect(rows.map((r) => r.balance)).toEqual([2309.2, 1509.2, 309.2])
    expect(rows.map((r) => r.payToHere)).toEqual([2309.2, 3818.4, 4127.6])
    expect(rows[1]!.payments).toEqual([{ id: 'p1', paid_at: '2026-07-02', amount: 800, memo: 'Paid via cash off a job' }])
  })
  it('drops settled reports and puts an overpaid one in with a null pay-to-here', () => {
    const over = [...payments, pay('p4', 'w27', 400, '2026-07-20', 'Cash App #D-P7Q38MJL6 "Pay"')]
    const l = buildPersonLedger({ name: 'Malachi', stubs, payments: over, deductions: [], additional: [], offsets: [] })
    const r = openReportRows({ stubs, stubPay: l.stubPay, paymentsByStubId: byStub(over) })
    const w27 = r.find((x) => x.stubId === 'w27')!
    expect(w27.state).toBe('overpaid')
    expect(w27.balance).toBe(-90.8)
    expect(w27.payToHere).toBeNull()
    expect(r.find((x) => x.stubId === 'w22')).toBeUndefined()
    expect(countOpenReports(r)).toEqual({ unpaid: 1, partial: 1, residue: 0, overpaid: 1 })
  })
  it('a Less line added after paying turns the week overpaid', () => {
    const l = buildPersonLedger({ name: 'Malachi', stubs, payments, deductions: [{ pay_stub_id: 'w22', description: 'Advance', amount: 200 }], additional: [], offsets: [] })
    const r = openReportRows({ stubs, stubPay: l.stubPay, paymentsByStubId: byStub(payments) })
    expect(r.find((x) => x.stubId === 'w22')).toMatchObject({ state: 'overpaid', net: 2109.2, paid: 2309.2, balance: -200 })
  })
})

describe('offReportOffsets', () => {
  it('keeps only offsets with no report, typed charge or credit, oldest first', () => {
    const offsets: LedgerOffset[] = [
      { id: 'o2', person_name: 'Tristen', type: 'damage', amount: 1800, occurred_date: '2025-10-20', description: "Drove skid steer into back of Trace's truck", pay_stub_id: null },
      { id: 'o1', person_name: 'Tristen', type: 'backcharge', amount: 3500, occurred_date: '2025-10-17', description: 'Cantrell law offices', pay_stub_id: null },
      { id: 'o3', person_name: 'Tristen', type: 'employee_credit', amount: 50, occurred_date: '2026-01-05', description: null, pay_stub_id: null },
      { id: 'o4', person_name: 'Tristen', type: 'advance', amount: 100, occurred_date: '2026-02-01', description: null, pay_stub_id: 'w10' },
    ]
    expect(offReportOffsets(offsets).map((o) => [o.id, o.kind, o.amount])).toEqual([
      ['o1', 'charge', 3500],
      ['o2', 'charge', 1800],
      ['o3', 'credit', 50],
    ])
  })
})

describe('settleUp', () => {
  const owedRows = rows // 2309.20 + 1509.20 + 309.20 = 4127.60
  it('send: open reports plus unreported weeks, less charges, plus credits — and lands even', () => {
    const s = settleUp({ rows: owedRows, offsets: [], unreportedEstimate: 1847.36, balance: 4127.6 })
    expect(s.mode).toBe('send')
    expect(s.toSend).toBe(5974.96)
    expect(s.after).toBe(0)
    expect(settleUpSentence(s, 'Malachi', money)).toBe('Send $5974.96 = open reports $4127.60 + unreported weeks est. $1847.36 → even')
  })
  it('send nets a smaller charge off the amount', () => {
    const s = settleUp({ rows: owedRows, offsets: [{ id: 'o', type: 'backcharge', kind: 'charge', amount: 500, occurred_date: '2026-06-01', description: null }], unreportedEstimate: 0, balance: 3627.6 })
    expect(s).toMatchObject({ mode: 'send', toSend: 3627.6, charges: 500, after: 0 })
    expect(settleUpSentence(s, 'Malachi', money)).toBe('Send $3627.60 = open reports $4127.60 − charges $500.00 → even')
  })
  it('charges: when charges cover the open reports, send nothing and take them out of the weeks', () => {
    // Tristen 2026-09-21: two unpaid weeks $1,501.60, four charges $6,617.50, balance −$5,115.90.
    const tStubs = [stub('a', '2026-08-23', '2026-08-29', 762.37), stub('b', '2026-08-30', '2026-09-05', 739.23)]
    const l = buildPersonLedger({ name: 'Malachi', stubs: tStubs, payments: [], deductions: [], additional: [], offsets: [] })
    const r = openReportRows({ stubs: tStubs, stubPay: l.stubPay, paymentsByStubId: {} })
    const s = settleUp({ rows: r, offsets: [{ id: 'o', type: 'backcharge', kind: 'charge', amount: 6617.5, occurred_date: '2025-10-17', description: null }], unreportedEstimate: 0, balance: -5115.9 })
    expect(s).toMatchObject({ mode: 'charges', owed: 1501.6, chargesToApply: 1501.6, toSend: 0, after: -5115.9 })
    expect(settleUpSentence(s, 'Tristen', money)).toBe('Send nothing. Charges $6617.50 cover the open reports $1501.60 → take them out of the open weeks → Tristen still owes $5115.90')
  })
  it('residue: nothing to send, mark it settled', () => {
    const pStubs = [stub('p', '2026-09-06', '2026-09-12', 968.74)]
    const pPay = [pay('x', 'p', 965.74, '2026-09-16')]
    const l = buildPersonLedger({ name: 'Malachi', stubs: pStubs, payments: pPay, deductions: [], additional: [], offsets: [] })
    const r = openReportRows({ stubs: pStubs, stubPay: l.stubPay, paymentsByStubId: byStub(pPay) })
    const s = settleUp({ rows: r, offsets: [], unreportedEstimate: 0, balance: 3 })
    expect(s).toMatchObject({ mode: 'residue', residue: 3, residueCount: 1, owed: 0, after: 3 })
    expect(settleUpSentence(s, 'Paige', money)).toBe('Nothing to send. $3.00 of residue on 1 week → mark it settled → we still owe $3.00')
  })
  it('even, and even with an overpayment to move', () => {
    expect(settleUpSentence(settleUp({ rows: [], offsets: [], unreportedEstimate: 0, balance: 0 }), 'Jesse', money)).toBe('Nothing open — even.')
    const over: OpenReportRow = { stubId: 'z', periodStart: '2026-09-06', periodEnd: '2026-09-12', hours: 31.14, net: 467.17, paid: 487.17, balance: -20, state: 'overpaid', payToHere: null, payments: [] }
    const s = settleUp({ rows: [over], offsets: [], unreportedEstimate: 0, balance: -20 })
    expect(s).toMatchObject({ mode: 'even', overpaid: 20, after: -20 })
    expect(settleUpSentence(s, 'Tristen', money)).toBe('Nothing to send. $20.00 overpaid on one week → move it → Tristen still owes $20.00')
  })
  it('an unreported week alone is a send', () => {
    const s = settleUp({ rows: [], offsets: [], unreportedEstimate: 1200, balance: 0 })
    expect(s).toMatchObject({ mode: 'send', toSend: 1200, owed: 0, unreported: 1200, after: 0 })
  })
})

describe('allocateOldestFirst', () => {
  it('fills the oldest positive balances first and reports what is left over', () => {
    expect(allocateOldestFirst(3000, rows)).toEqual({ splits: [{ stubId: 'w23', amount: 2309.2 }, { stubId: 'w25', amount: 690.8 }], leftover: 0 })
    expect(allocateOldestFirst(5000, rows)).toEqual({ splits: [{ stubId: 'w23', amount: 2309.2 }, { stubId: 'w25', amount: 1509.2 }, { stubId: 'w27', amount: 309.2 }], leftover: 872.4 })
    expect(allocateOldestFirst(0, rows)).toEqual({ splits: [], leftover: 0 })
    expect(allocateOldestFirst(-5, rows)).toEqual({ splits: [], leftover: 0 })
  })
  it('skips overpaid rows', () => {
    const over: OpenReportRow = { ...rows[0]!, stubId: 'ov', balance: -20, state: 'overpaid', payToHere: null }
    expect(allocateOldestFirst(100, [over, rows[2]!])).toEqual({ splits: [{ stubId: 'w27', amount: 100 }], leftover: 0 })
  })
})

describe('moveOverpaymentPlan', () => {
  const label = (r: OpenReportRow) => r.periodStart
  it('shrinks the newest payment and inserts the extra on the oldest open week, memo saying where it came from', () => {
    const over: OpenReportRow = {
      stubId: 'w36', periodStart: '2026-09-06', periodEnd: '2026-09-12', hours: 31.14, net: 467.17, paid: 487.17, balance: -20, state: 'overpaid', payToHere: null,
      payments: [{ id: 'a', paid_at: '2026-09-17T12:00:00Z', amount: 467.17, memo: 'Apple Pay "Tristen" · 2 of 2' }, { id: 'b', paid_at: '2026-09-17T13:00:00Z', amount: 20, memo: 'Apple Pay "Tristen"' }],
    }
    const plan = moveOverpaymentPlan(over, [rows[0]!, over], label)
    expect(plan).toEqual({
      from: 'w36',
      amount: 20,
      to: 'w23',
      ops: [{ kind: 'delete', paymentId: 'b' }],
      insert: { pay_stub_id: 'w23', amount: 20, paid_at: '2026-09-17T13:00:00Z', memo: 'Apple Pay "Tristen" · moved from week of 2026-09-06' },
    })
  })
  it('spans payments when the newest is smaller than the extra, and has no target when nothing is open', () => {
    const over: OpenReportRow = {
      stubId: 'x', periodStart: '2026-09-06', periodEnd: '2026-09-12', hours: 1, net: 100, paid: 130, balance: -30, state: 'overpaid', payToHere: null,
      payments: [{ id: 'a', paid_at: '2026-09-10', amount: 110, memo: 'Mercury' }, { id: 'b', paid_at: '2026-09-11', amount: 20, memo: null }],
    }
    const plan = moveOverpaymentPlan(over, [over], label)!
    expect(plan.ops).toEqual([{ kind: 'delete', paymentId: 'b' }, { kind: 'update', paymentId: 'a', amount: 100 }])
    expect(plan.to).toBeNull()
    expect(plan.insert).toBeNull()
  })
  it('is null for a row that is not overpaid', () => {
    expect(moveOverpaymentPlan(rows[0]!, rows, label)).toBeNull()
  })
})

describe('openReportsCaption', () => {
  it('reads open · owed · the states that apply · unreported · charges/credits', () => {
    expect(openReportsCaption({ rows, offsets: [], unreportedCount: 1, stubCount: 25, money: whole })).toBe('3 open · $4128 · 1 unpaid · 2 partial · 1 week unreported')
    expect(openReportsCaption({ rows: rows.slice(0, 1), offsets: [], unreportedCount: 0, stubCount: 25, money: whole })).toBe('1 open · $2309')
    expect(openReportsCaption({ rows: [], offsets: [{ id: 'c', type: 'employee_credit', kind: 'credit', amount: 1436.02, occurred_date: '2026-08-17', description: null }], unreportedCount: 0, stubCount: 3, money: whole })).toBe('nothing open · 1 credit +$1436')
    expect(openReportsCaption({ rows: [], offsets: [], unreportedCount: 0, stubCount: 8, money: whole })).toBe('8 reports · all paid')
    expect(openReportsCaption({ rows: [], offsets: [], unreportedCount: 0, stubCount: 0, money: whole })).toBe('no reports')
  })
  it('names residue and overpaid', () => {
    const res: OpenReportRow = { ...rows[0]!, balance: 3, paid: 2306.2, state: 'residue' }
    expect(openReportsCaption({ rows: [res], offsets: [], unreportedCount: 0, stubCount: 24, money: whole })).toBe('1 open · $3 residue')
    const over: OpenReportRow = { ...rows[0]!, balance: -20, paid: 2329.2, state: 'overpaid', payToHere: null }
    expect(openReportsCaption({ rows: [rows[0]!, over], offsets: [{ id: 'o', type: 'damage', kind: 'charge', amount: 6617.5, occurred_date: '2025-10-17', description: null }], unreportedCount: 0, stubCount: 25, money: whole })).toBe('2 open · $2309 · 1 unpaid · 1 overpaid · 1 charge −$6618')
  })
})

describe('residueSettlementDeduction', () => {
  it('is the Less line that closes a residue week, and nothing for any other state', () => {
    const res: OpenReportRow = { ...rows[0]!, balance: 3, paid: 2306.2, state: 'residue' }
    expect(residueSettlementDeduction(res)).toEqual({ amount: 3, description: 'Settled · residue (fees or rounding)' })
    expect(residueSettlementDeduction(rows[0]!)).toBeNull()
    expect(residueSettlementDeduction({ ...rows[0]!, balance: -20, state: 'overpaid' })).toBeNull()
  })
})

describe('moveOverpaymentWords', () => {
  const week = (id: string) => ({ w36: 'Sep 6', w23: 'Jun 7' })[id] ?? id
  it('says where the money goes and what happens to the payment that carried it', () => {
    const plan: MovePlan = { from: 'w36', amount: 20, to: 'w23', ops: [{ kind: 'delete', paymentId: 'b' }], insert: { pay_stub_id: 'w23', amount: 20, paid_at: '2026-09-17', memo: 'x' } }
    expect(moveOverpaymentWords(plan, week, money)).toBe('Move $20.00 from week of Sep 6 to week of Jun 7? This will remove the payment that carried it and record $20.00 on the week of Jun 7 under the same date and memo.')
    const shorten: MovePlan = { ...plan, ops: [{ kind: 'update', paymentId: 'a', amount: 100 }] }
    expect(moveOverpaymentWords(shorten, week, money)).toMatch(/shorten the newest payment by that much/)
    const none: MovePlan = { ...plan, to: null, insert: null }
    expect(moveOverpaymentWords(none, week, money)).toBe('Week of Sep 6 was paid $20.00 past net, and nothing is open to move it to. Remove the payment that carried it and file the $20.00 as a credit?')
  })
})

describe('splitSend', () => {
  it('fills oldest first when nothing is typed, and clamps typed boxes to what each week can take', () => {
    expect(splitSend(3000, rows)).toEqual({ splits: [{ stubId: 'w23', amount: 2309.2, balance: 2309.2 }, { stubId: 'w25', amount: 690.8, balance: 1509.2 }, { stubId: 'w27', amount: 0, balance: 309.2 }], total: 3000, leftover: 0 })
    const edited = splitSend(3000, rows, { w23: '1,000', w25: '5000', w27: 'abc' })
    expect(edited.splits.map((s) => s.amount)).toEqual([1000, 1509.2, 0])
    expect(edited.total).toBe(2509.2)
    expect(edited.leftover).toBe(490.8)
  })
  it('reports a negative leftover when the boxes add up past the send', () => {
    const over = splitSend(1000, rows, { w23: 800, w25: 800 })
    expect(over.total).toBe(1600)
    expect(over.leftover).toBe(-600)
  })
  it('skips overpaid rows and treats a bad amount as zero', () => {
    const overRow: OpenReportRow = { ...rows[0]!, stubId: 'ov', balance: -20, state: 'overpaid', payToHere: null }
    expect(splitSend(NaN, [overRow, rows[2]!]).splits).toEqual([{ stubId: 'w27', amount: 0, balance: 309.2 }])
  })
})

describe('splitPaymentMemo', () => {
  it('numbers each part of a split and leaves a single payment alone', () => {
    expect(splitPaymentMemo('Apple Pay "Tristen"', 0, 2, 1067.23)).toBe('Apple Pay "Tristen" · 1 of 2 from $1,067.23')
    expect(splitPaymentMemo('', 1, 3, 5000)).toBe('2 of 3 from $5,000.00')
    expect(splitPaymentMemo('Mercury', 0, 1, 500)).toBe('Mercury')
  })
})
