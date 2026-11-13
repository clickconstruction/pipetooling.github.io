import { describe, expect, it } from 'vitest'
import type { LaborJobPayment, LaborJobPaymentEvent } from '../../types/laborJob'
import {
  buildLedgerLines,
  buildLedgerTraces,
  filterLedger,
  ledgerDayWords,
  ledgerMonths,
  ledgerPaidToOptions,
  ledgerPaidWords,
  ledgerPeriodRange,
  ledgerTotals,
  leftOnSheetWords,
  subPaymentsCsv,
  subPaymentsCsvFileName,
  subPaymentsLedgerHtml,
  SUB_PAYMENTS_CSV_HEAD,
  type LedgerRow,
  type LedgerSheet,
} from './subPaymentsLedger'

const pay = (id: string, amount: number, sent: string | null, made: string, memo: string | null = null): LaborJobPayment => ({ id, amount, memo, created_at: made, payment_date: sent })
const event = (over: Partial<LaborJobPaymentEvent>): LaborJobPaymentEvent => ({
  id: 'e1',
  kind: 'moved',
  payment_id: 'p',
  from_job_id: null,
  to_job_id: null,
  amount: 0,
  memo: null,
  payment_date: null,
  reason: null,
  actor_name: null,
  restored_event_id: null,
  created_at: '2026-10-15T16:00:00Z',
  ...over,
})
const sheet = (over: Partial<LedgerSheet>): LedgerSheet => ({ id: 's', paidTo: 'Calloway Tile', paidToKey: 'id:calloway', crew: false, job: '2104 Larkspur Lot 14', address: '418 Larkspur Bend', agreed: 0, payments: [], events: [], ...over })

// Made-up sheets, the mock-up's own.
const tile = sheet({
  id: 'tile',
  agreed: 3600,
  payments: [pay('t2', 2400, '2026-11-12', '2026-11-12T17:00:00Z', 'Zelle · final on tile'), pay('t1', 1200, null, '2026-10-29T03:30:00Z', 'deposit')],
})
const rough = sheet({
  id: 'rough',
  paidTo: 'Brightline Electric LLC',
  paidToKey: 'id:brightline',
  job: '2117 Alder Street Dental',
  address: '90 Alder St',
  agreed: 6000,
  payments: [pay('r1', 1500, '2026-10-21', '2026-10-21T15:00:00Z', 'Check 1162'), pay('r2', 3000, '2026-11-10', '2026-11-11T15:00:00Z', 'Check 1187 · rough-in draw')],
})
const trim = sheet({
  id: 'trim',
  paidTo: 'Marco Estrada',
  paidToKey: 'id:marco',
  job: '2090 Pinecrest Remodel',
  address: '7 Pinecrest Ct',
  agreed: 1500,
  payments: [pay('m1', 500, '2026-10-14', '2026-10-14T15:00:00Z', 'Zelle'), pay('m2', 850, '2026-11-05', '2026-11-05T15:00:00Z', 'Cash App'), pay('m3', -150, null, '2026-11-06T18:00:00Z', 'Broken vanity top')],
  events: [event({ id: 'mv', kind: 'moved', from_job_id: 'rough', to_job_id: 'trim', amount: 500, actor_name: 'Dana Whitfield', reason: 'wrong sheet' })],
})
const crew = sheet({ id: 'crew', paidTo: 'Luis Ortega', paidToKey: 'id:luis', crew: true, agreed: 600, payments: [pay('c1', 600, '2026-11-03', '2026-11-03T15:00:00Z', 'Zelle')] })
const ALL = [tile, rough, trim, crew]
const lines = buildLedgerLines(ALL)
const byId = (id: string) => lines.find((l) => l.id === id)!

describe('buildLedgerLines', () => {
  it('reads each payment by its Date sent, and a payment with none by the day it was recorded in Central time', () => {
    expect(byId('t2')).toMatchObject({ kind: 'payment', ymd: '2026-11-12', recorded: false, amount: 2400, memo: 'Zelle · final on tile', paidTo: 'Calloway Tile' })
    // 03:30 UTC on the 29th is the evening of the 28th in Central time.
    expect(byId('t1')).toMatchObject({ ymd: '2026-10-28', recorded: true })
  })

  it('a back-charge is a line below zero, on the day it was recorded', () => {
    expect(byId('m3')).toMatchObject({ kind: 'backcharge', amount: -150, ymd: '2026-11-06', recorded: true })
  })

  it('says what the sheet still owed after each line, counting what came before it', () => {
    expect(byId('t1').leftOnSheet).toBe(2400)
    expect(byId('t2').leftOnSheet).toBe(0)
    expect(byId('r1').leftOnSheet).toBe(4500)
    expect(byId('r2').leftOnSheet).toBe(1500)
    // A back-charge takes off what is owed, the same as a payment.
    expect([byId('m1').leftOnSheet, byId('m2').leftOnSheet, byId('m3').leftOnSheet]).toEqual([1000, 150, 0])
  })

  it('a zero row is not a line, and an over-paid sheet reads below zero', () => {
    const over = buildLedgerLines([sheet({ agreed: 100, payments: [pay('a', 0, '2026-11-01', '2026-11-01T15:00:00Z'), pay('b', 120, '2026-11-02', '2026-11-02T15:00:00Z')] })])
    expect(over).toHaveLength(1)
    expect(over[0]!.leftOnSheet).toBe(-20)
    expect(leftOnSheetWords(-20)).toBe('over by $20.00')
    expect(leftOnSheetWords(0)).toBe('paid in full')
    expect(leftOnSheetWords(1500)).toBe('$1,500.00')
  })

  it('keeps cents exact across a run of payments', () => {
    const odd = buildLedgerLines([sheet({ agreed: 0.3, payments: [pay('a', 0.1, '2026-11-01', '2026-11-01T15:00:00Z'), pay('b', 0.2, '2026-11-02', '2026-11-02T15:00:00Z')] })])
    expect(odd.map((l) => l.leftOnSheet)).toEqual([0.2, 0])
  })
})

describe('buildLedgerTraces', () => {
  it('says a move once, with both sheets, who moved it and why', () => {
    // The same event hangs on both sheets in memory.
    const both = [{ ...rough, events: trim.events }, trim]
    const traces = buildLedgerTraces(both)
    expect(traces).toHaveLength(1)
    expect(traces[0]).toMatchObject({ kind: 'trace', ymd: '2026-10-15', text: 'Moved $500.00 from 2117 Alder Street Dental to 2090 Pinecrest Remodel · Dana Whitfield · "wrong sheet"' })
    expect(traces[0]!.paidToKeys.sort()).toEqual(['id:brightline', 'id:marco'])
  })

  it('a removal draws, a removal that was restored does not, and a sheet off the list reads another sheet', () => {
    const s = sheet({ id: 'x', job: '2200 Elm', events: [event({ id: 'rm', kind: 'removed', from_job_id: 'x', amount: 75, actor_name: 'Dana Whitfield' }), event({ id: 'rm2', kind: 'removed', from_job_id: 'x', amount: 10, restored_event_id: 'rs' }), event({ id: 'rs', kind: 'restored', to_job_id: 'x', amount: 10 }), event({ id: 'mv2', kind: 'moved', from_job_id: 'gone', to_job_id: 'x', amount: 40 })] })
    expect(buildLedgerTraces([s]).map((t) => t.text)).toEqual(['Removed $75.00 from 2200 Elm · Dana Whitfield', 'Moved $40.00 from another sheet to 2200 Elm'])
  })
})

describe('periods', () => {
  it('names the first and last day of each period from today', () => {
    expect(ledgerPeriodRange('month', '2026-11-13')).toEqual({ from: '2026-11-01', to: '2026-11-31' })
    expect(ledgerPeriodRange('last-month', '2026-11-13')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(ledgerPeriodRange('last-month', '2026-01-09')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(ledgerPeriodRange('quarter', '2026-11-13')).toEqual({ from: '2026-10-01', to: '2026-12-31' })
    expect(ledgerPeriodRange('quarter', '2026-03-31')).toEqual({ from: '2026-01-01', to: '2026-03-31' })
    expect(ledgerPeriodRange('year', '2026-11-13')).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(ledgerPeriodRange('all', '2026-11-13')).toEqual({ from: null, to: null })
    expect(ledgerPeriodRange('custom', '2026-11-13', { from: '2026-10-01', to: '' })).toEqual({ from: '2026-10-01', to: null })
  })

  it('a period keeps the days inside it, both ends counted', () => {
    const nov = filterLedger(lines, ledgerPeriodRange('month', '2026-11-13'))
    expect(nov.map((l) => l.id).sort()).toEqual(['c1', 'm2', 'm3', 'r2', 't2'])
    expect(filterLedger(lines, { from: '2026-10-21', to: '2026-10-28' }).map((l) => l.id).sort()).toEqual(['r1', 't1'])
  })

  it('a row with no day shows only when the period is open', () => {
    const blank: LedgerRow[] = buildLedgerLines([sheet({ payments: [{ id: 'z', amount: 50, memo: null, created_at: '', payment_date: null }] })])
    expect(blank[0]!.ymd).toBe('')
    expect(filterLedger(blank, { from: null, to: null })).toHaveLength(1)
    expect(filterLedger(blank, { from: '2026-01-01', to: null })).toHaveLength(0)
  })
})

describe('search and Paid to', () => {
  it('finds a line by its sub, its job, its memo or its amount, every word wanted', () => {
    expect(filterLedger(lines, { search: 'brightline' }).map((l) => l.id).sort()).toEqual(['r1', 'r2'])
    expect(filterLedger(lines, { search: 'check 1187' }).map((l) => l.id)).toEqual(['r2'])
    expect(filterLedger(lines, { search: 'pinecrest zelle' }).map((l) => l.id)).toEqual(['m1'])
    expect(filterLedger(lines, { search: '2,400' }).map((l) => l.id)).toEqual(['t2'])
    expect(filterLedger(lines, { search: '2400.00' }).map((l) => l.id)).toEqual(['t2'])
    expect(filterLedger(lines, { search: 'back-charge' }).map((l) => l.id)).toEqual(['m3'])
    expect(filterLedger(lines, { search: 'nobody' })).toHaveLength(0)
  })

  it('Paid to keeps one person, and a move that touched their sheet', () => {
    expect(filterLedger(lines, { paidToKey: 'id:marco' }).map((l) => l.id).sort()).toEqual(['m1', 'm2', 'm3'])
    const traces = buildLedgerTraces([{ ...rough, events: trim.events }, trim])
    expect(filterLedger(traces, { paidToKey: 'id:marco' })).toHaveLength(1)
    expect(filterLedger(traces, { paidToKey: 'id:calloway' })).toHaveLength(0)
  })

  it('lists who was paid, by name', () => {
    expect(ledgerPaidToOptions(lines).map((o) => o.label)).toEqual(['Brightline Electric LLC', 'Calloway Tile', 'Luis Ortega', 'Marco Estrada'])
    expect(ledgerPaidToOptions(lines).find((o) => o.key === 'id:luis')!.crew).toBe(true)
  })
})

describe('months and totals', () => {
  const months = ledgerMonths([...lines, ...buildLedgerTraces(ALL)])

  it('groups newest month first, newest line first, with each month summed', () => {
    expect(months.map((m) => m.label)).toEqual(['November 2026', 'October 2026'])
    expect(months[0]!.rows.map((r) => r.id)).toEqual(['t2', 'r2', 'm3', 'm2', 'c1'])
    expect(months[0]!.totals).toMatchObject({ payments: 4, paidTotal: 6850, backcharges: 1, backchargeTotal: 150 })
    expect(months[0]!.words).toBe('4 payments · 1 back-charge')
    expect(months[1]!.rows.map((r) => r.id)).toEqual(['t1', 'r1', 'mv', 'm1'])
    expect(months[1]!.totals).toMatchObject({ payments: 3, paidTotal: 3200, backcharges: 0 })
    expect(months[1]!.words).toBe('3 payments')
  })

  it('the months add up to the whole', () => {
    const whole = ledgerTotals(lines)
    expect(whole).toEqual({ payments: 7, paidTotal: 10050, backcharges: 1, backchargeTotal: 150, people: 4, undated: 1 })
    expect(months.reduce((s, m) => s + m.totals.paidTotal, 0)).toBe(whole.paidTotal)
    expect(months.reduce((s, m) => s + m.totals.payments, 0)).toBe(whole.payments)
    expect(ledgerPaidWords(whole)).toBe('7 payments to 4 people')
    expect(ledgerPaidWords(ledgerTotals(filterLedger(lines, { paidToKey: 'id:luis' })))).toBe('1 payment')
    expect(ledgerPaidWords(ledgerTotals([]))).toBe('nothing paid')
  })

  it('rows with no day close the list under their own heading', () => {
    const blank = buildLedgerLines([sheet({ payments: [{ id: 'z', amount: 50, memo: null, created_at: '', payment_date: null }] })])
    const m = ledgerMonths([...lines, ...blank])
    expect(m[m.length - 1]).toMatchObject({ ym: '', label: 'Undated' })
  })
})

describe('out of the app', () => {
  const shown = ledgerMonths(lines).flatMap((m) => m.rows).filter((r): r is (typeof lines)[number] => r.kind !== 'trace')

  it('the CSV carries the lines in the order shown, amounts as plain numbers', () => {
    const rows = subPaymentsCsv(shown).trimEnd().split('\r\n')
    expect(rows[0]).toBe(SUB_PAYMENTS_CSV_HEAD.join(','))
    expect(rows).toHaveLength(9)
    expect(rows[1]).toBe('2026-11-12,date sent,Calloway Tile,no,2104 Larkspur Lot 14,418 Larkspur Bend,Payment,Zelle · final on tile,2400.00,0.00')
    expect(rows.find((r) => r.includes('Broken vanity top'))).toBe('2026-11-06,day recorded,Marco Estrada,no,2090 Pinecrest Remodel,7 Pinecrest Ct,Back-charge,Broken vanity top,-150.00,0.00')
    expect(subPaymentsCsvFileName('2026-11-13')).toBe('sub-payments-2026-11-13.csv')
  })

  it('a memo that opens like a formula cannot run in a spreadsheet', () => {
    const risky = buildLedgerLines([sheet({ agreed: 10, payments: [pay('f', 10, '2026-11-01', '2026-11-01T15:00:00Z', '=HYPERLINK("x")')] })])
    expect(subPaymentsCsv(risky)).toContain(`"'=HYPERLINK(""x"")"`)
  })

  it('the print page names what is shown, every month and every line, with text made safe', () => {
    const html = subPaymentsLedgerHtml(ledgerMonths([...lines, ...buildLedgerTraces(ALL)]), ledgerTotals(lines), { shownWords: 'Oct 1 to Nov 13.', printedWords: 'Nov 13, 2026' })
    expect(html).toContain('Oct 1 to Nov 13. Newest first. Paid $10,050.00 in 7 payments to 4 people, back-charged $150.00.')
    expect(html).toContain('<b>November 2026</b> <span>4 payments · 1 back-charge</span>')
    expect(html).toContain('<b>Back-charge</b> · Broken vanity top')
    expect(html).toContain('−$150.00')
    expect(html).toContain('Moved $500.00 from 2117 Alder Street Dental to 2090 Pinecrest Remodel')
    const unsafe = subPaymentsLedgerHtml(ledgerMonths(buildLedgerLines([sheet({ paidTo: '<b>Sub</b>', agreed: 5, payments: [pay('u', 5, '2026-11-01', '2026-11-01T15:00:00Z', '<script>')] })])), ledgerTotals([]), { shownWords: '', printedWords: '' })
    expect(unsafe).not.toContain('<script>')
    expect(unsafe).toContain('&lt;b&gt;Sub&lt;/b&gt;')
    expect(subPaymentsLedgerHtml([], ledgerTotals([]), { shownWords: 'This month.', printedWords: 'today' })).toContain('Nothing was paid in this period.')
  })

  it('a day reads short, with its year when asked', () => {
    expect(ledgerDayWords('2026-11-12')).toBe('Nov 12')
    expect(ledgerDayWords('2025-12-03', true)).toBe('Dec 3, 2025')
    expect(ledgerDayWords('')).toBe('undated')
  })
})
