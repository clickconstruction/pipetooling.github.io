import { describe, expect, it } from 'vitest'
import type { LaborJobPayment, LaborJobPaymentEvent } from '../../types/laborJob'
import {
  buildLedgerLines,
  buildLedgerTraces,
  buildSubStatement,
  ledgerBySub,
  ledgerBySubTotals,
  ledgerHowPaidWords,
  ledgerSpanWords,
  ledgerSubKeyFromParam,
  ledgerSubParam,
  overPaidWords,
  sendingTagWords,
  statementCheckWords,
  subStatementCsv,
  subStatementCsvFileName,
  subStatementHtml,
  SUB_STATEMENT_CSV_HEAD,
  weOweWords,
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
    expect(whole).toEqual({ payments: 7, paidTotal: 10050, backcharges: 1, backchargeTotal: 150, people: 4, undated: 1, creditKept: 0, creditUsed: 0 })
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
    expect(rows[1]).toBe('2026-11-12,date sent,Calloway Tile,no,2104 Larkspur Lot 14,418 Larkspur Bend,Payment,,,Zelle · final on tile,2400.00,0.00,,')
    expect(rows.find((r) => r.includes('Broken vanity top'))).toBe('2026-11-06,day recorded,Marco Estrada,no,2090 Pinecrest Remodel,7 Pinecrest Ct,Back-charge,,,Broken vanity top,-150.00,0.00,,')
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

describe('how a line was sent', () => {
  const checked = buildLedgerLines([
    sheet({ agreed: 900, payments: [{ ...pay('k1', 400, '2026-11-02', '2026-11-02T15:00:00Z', 'draw'), method: 'check', method_ref: ' 1187 ' }, { ...pay('k2', 100, '2026-11-03', '2026-11-03T15:00:00Z'), method: 'zelle', method_ref: null }, { ...pay('k3', 50, '2026-11-04', '2026-11-04T15:00:00Z'), method: 'wire', method_ref: 'x' }] }),
  ])
  it('a line carries its method as the chip reads and its reference, and a method off the list reads as none', () => {
    expect(checked.map((l) => ledgerHowPaidWords(l))).toEqual(['Check 1187', 'Zelle', ''])
    expect(checked[2]).toMatchObject({ method: '', methodRef: '' })
  })
  it('the search finds a check by its number, and the CSV has a column for each', () => {
    expect(filterLedger(checked, { search: '1187' }).map((l) => l.id)).toEqual(['k1'])
    expect(filterLedger(checked, { search: 'zelle' }).map((l) => l.id)).toEqual(['k2'])
    expect(subPaymentsCsv(checked).split('\r\n')[1]).toBe('2026-11-02,date sent,Calloway Tile,no,2104 Larkspur Lot 14,418 Larkspur Bend,Payment,Check,1187,draw,400.00,500.00,,')
  })
})

describe('ledgerBySub', () => {
  it('gives one row per person: the period’s payments, their first and last day, and what we owe today', () => {
    const rows = ledgerBySub(ALL, lines)
    expect(rows.map((r) => r.name)).toEqual(['Brightline Electric LLC', 'Calloway Tile', 'Luis Ortega', 'Marco Estrada'])
    expect(rows.find((r) => r.key === 'id:brightline')).toMatchObject({ sheets: 1, payments: 2, firstYmd: '2026-10-21', lastYmd: '2026-11-10', paid: 4500, backcharged: 0, weOwe: 1500 })
    expect(rows.find((r) => r.key === 'id:marco')).toMatchObject({ payments: 2, paid: 1350, backcharges: 1, backcharged: 150, weOwe: 0 })
    // A payment with no Date sent counts on the day it was recorded.
    expect(rows.find((r) => r.key === 'id:calloway')).toMatchObject({ firstYmd: '2026-10-28', lastYmd: '2026-11-12', weOwe: 0 })
  })

  it('crew pay has a row and no We owe, and the foot leaves it out', () => {
    const rows = ledgerBySub(ALL, lines)
    expect(rows.find((r) => r.key === 'id:luis')).toMatchObject({ crew: true, paid: 600, weOwe: null })
    expect(ledgerBySubTotals(rows)).toEqual({ people: 4, payments: 7, paid: 10050, backcharged: 150, weOwe: 1500, over: 0, credit: 0 })
  })

  it('We owe reads every sheet to today, whatever the period shows', () => {
    const november = filterLedger(lines, { from: '2026-11-01', to: '2026-11-31' })
    const rows = ledgerBySub(ALL, november)
    expect(rows.find((r) => r.key === 'id:brightline')).toMatchObject({ payments: 1, paid: 3000, firstYmd: '2026-11-10', lastYmd: '2026-11-10', weOwe: 1500 })
  })

  it('a person with nothing paid in the period keeps a row while we owe them, and drops out once settled', () => {
    const unpaid = sheet({ id: 'new', paidTo: 'Harlow Drywall', paidToKey: 'id:harlow', agreed: 800 })
    const none = ledgerBySub([...ALL, unpaid], filterLedger(lines, { from: '2027-01-01', to: '2027-01-31' }))
    expect(none.map((r) => [r.name, r.payments, r.weOwe])).toEqual([['Brightline Electric LLC', 0, 1500], ['Harlow Drywall', 0, 800]])
    // A search that names nobody owed leaves only the people it found lines for.
    expect(ledgerBySub([...ALL, unpaid], filterLedger(lines, { search: 'zelle' }), { search: 'zelle' }).map((r) => r.name)).toEqual(['Calloway Tile', 'Luis Ortega', 'Marco Estrada'])
    expect(ledgerBySub([...ALL, unpaid], [], { search: 'harlow' }).map((r) => r.name)).toEqual(['Harlow Drywall'])
    expect(ledgerBySub([...ALL, unpaid], lines, { paidToKey: 'id:marco' }).map((r) => r.name)).toEqual(['Marco Estrada'])
  })

  it('a sheet paid past its total is kept apart: We owe is what is still open, as the Pay view counts it', () => {
    const open = sheet({ id: 'o1', paidTo: 'Harlow Drywall', paidToKey: 'id:harlow', agreed: 500 })
    const over = sheet({ id: 'o2', paidTo: 'Harlow Drywall', paidToKey: 'id:harlow', agreed: 300, payments: [pay('h1', 320, '2026-11-02', '2026-11-02T15:00:00Z')] })
    const rows = ledgerBySub([open, over], buildLedgerLines([open, over]))
    expect(rows[0]).toMatchObject({ weOwe: 500, over: 20 })
    expect(ledgerBySubTotals(rows)).toMatchObject({ weOwe: 500, over: 20 })
    expect(overPaidWords(20)).toBe('over by $20.00 on a sheet')
    expect(overPaidWords(0)).toBe('')
  })

  it('says a span of days and what is owed in words', () => {
    expect(ledgerSpanWords('2026-10-21', '2026-11-10')).toBe('Oct 21 to Nov 10')
    expect(ledgerSpanWords('2026-11-10', '2026-11-10')).toBe('Nov 10')
    expect(ledgerSpanWords('', '')).toBe('')
    expect([weOweWords(1500), weOweWords(0), weOweWords(-20)]).toEqual(['$1,500.00', 'settled', 'over by $20.00'])
  })

  it('a statement’s address is the person’s own id, read back against the people the ledger knows', () => {
    expect(ledgerSubParam('id:marco')).toBe('marco')
    expect(ledgerSubParam('two subs')).toBe('two subs')
    const keys = ['id:marco', 'two subs']
    expect(ledgerSubKeyFromParam('marco', keys)).toBe('id:marco')
    expect(ledgerSubKeyFromParam('two subs', keys)).toBe('two subs')
    expect(ledgerSubKeyFromParam('nobody', keys)).toBe('')
    expect(ledgerSubKeyFromParam(null, keys)).toBe('')
  })
})

describe('buildSubStatement', () => {
  const second = sheet({ id: 'trim2', paidTo: 'Marco Estrada', paidToKey: 'id:marco', job: '2131 Juniper Flats', address: '12 Juniper Way', agreed: 2000, day: '2026-11-08', payments: [pay('m4', 700, '2026-11-11', '2026-11-11T15:00:00Z', 'Zelle')] })
  const marcoSheets = [{ ...trim, day: '2026-10-20' }, second]

  it('runs oldest first: a sheet adds what was agreed, a payment and a back-charge take away', () => {
    const st = buildSubStatement(marcoSheets, 'id:marco')
    expect(st.entries.map((e) => [e.ymd, e.kind, e.amount, e.owed])).toEqual([
      // The sheet is dated Oct 20 and its first payment went out Oct 14, so the sheet leads on the 14th.
      ['2026-10-14', 'sheet', 1500, 1500],
      ['2026-10-14', 'payment', 500, 1000],
      ['2026-11-05', 'payment', 850, 150],
      ['2026-11-06', 'backcharge', 150, 0],
      ['2026-11-08', 'sheet', 2000, 2000],
      ['2026-11-11', 'payment', 700, 1300],
    ])
    expect(st).toMatchObject({ name: 'Marco Estrada', opening: 0, agreed: 3500, paid: 2050, payments: 3, backcharged: 150, closing: 1300, owedToday: 1300, openOnSheets: 1300, overPaid: 0, endsToday: true })
  })

  it('ends on what the sheets owe, for every person and every date', () => {
    for (const s of [...ALL, second]) {
      const mine = [...ALL, second].filter((x) => x.paidToKey === s.paidToKey)
      const owed = mine.reduce((sum, x) => sum + x.agreed - x.payments.reduce((p, y) => p + Math.abs(Number(y.amount)), 0), 0)
      const st = buildSubStatement([...ALL, second], s.paidToKey)
      expect(st.closing).toBe(owed)
      expect(st.owedToday).toBe(owed)
    }
  })

  it('a period brings forward what was owed before it and stops at its last day', () => {
    const st = buildSubStatement(marcoSheets, 'id:marco', { from: '2026-11-01', to: '2026-11-09' })
    expect(st.opening).toBe(1000)
    expect(st.entries.map((e) => e.id)).toEqual(['m2', 'm3', 'sheet:trim2'])
    expect(st).toMatchObject({ agreed: 2000, paid: 850, backcharged: 150, closing: 2000, owedToday: 1300, endsToday: false })
  })

  it('a sheet paid past its total is told apart from what is still open', () => {
    const over = sheet({ id: 'over', paidTo: 'Marco Estrada', paidToKey: 'id:marco', job: '2140 Cedar', agreed: 300, day: '2026-11-01', payments: [pay('o1', 320, '2026-11-02', '2026-11-02T15:00:00Z')] })
    const st = buildSubStatement([...marcoSheets, over], 'id:marco')
    expect(st).toMatchObject({ owedToday: 1280, openOnSheets: 1300, overPaid: 20 })
    expect(statementCheckWords(st, 1300)).toEqual({ agrees: true, words: 'Agrees with People → Subs, where Balance due reads $1,300.00. $1,300.00 is still open on sheets and $20.00 was paid past a sheet\'s total.' })
  })

  it('the foot checks the roster’s Balance due, and says so when it differs or is not known', () => {
    const st = buildSubStatement(marcoSheets, 'id:marco')
    expect(statementCheckWords(st, 1300)).toEqual({ agrees: true, words: 'Agrees with People → Subs, where Balance due reads $1,300.00.' })
    const off = statementCheckWords(st, 900)
    expect(off.agrees).toBe(false)
    expect(off.words).toContain('People → Subs reads $900.00 for Balance due and these sheets come to $1,300.00.')
    expect(statementCheckWords(st, undefined)).toEqual({ agrees: null, words: 'We owe Marco Estrada $1,300.00 today.' })
  })

  it('a person the ledger does not know gets an empty statement', () => {
    expect(buildSubStatement(ALL, 'id:nobody')).toMatchObject({ name: '', entries: [], closing: 0, owedToday: 0 })
  })

  it('goes out as a spreadsheet and as a page, with text made safe', () => {
    const st = buildSubStatement(marcoSheets, 'id:marco', { from: '2026-11-01' })
    const rows = subStatementCsv(st).trimEnd().split('\r\n')
    expect(rows[0]).toBe(SUB_STATEMENT_CSV_HEAD.join(','))
    expect(rows[1]).toBe('2026-11-01,Brought forward,,,,,,,1000.00')
    expect(rows[2]).toBe('2026-11-05,Payment,2090 Pinecrest Remodel,,,Cash App,,850.00,150.00')
    expect(rows[4]).toBe('2026-11-08,Sheet agreed,2131 Juniper Flats,,,,2000.00,,2000.00')
    expect(subStatementCsvFileName('Marco Estrada', '2026-11-13')).toBe('sub-statement-marco-estrada-2026-11-13.csv')
    expect(subStatementCsvFileName('  ', '2026-11-13')).toBe('sub-statement-sub-2026-11-13.csv')
    const html = subStatementHtml(st, { periodWords: 'From Nov 1, 2026.', checkWords: 'Agrees.', printedWords: 'Nov 13, 2026' })
    expect(html).toContain('<h1>Marco Estrada</h1>')
    expect(html).toContain('Brought forward')
    expect(html).toContain('<b>Back-charge</b> · Broken vanity top')
    expect(html).toContain('We owe today')
    expect(html).toContain('$1,300.00')
    const unsafe = subStatementHtml(buildSubStatement([sheet({ paidTo: '<i>x</i>', job: '<script>', agreed: 5 })], 'id:calloway'), { periodWords: '', checkWords: '', printedWords: '' })
    expect(unsafe).not.toContain('<script>')
    expect(unsafe).toContain('&lt;i&gt;x&lt;/i&gt;')
  })
})

describe('a credit and a sending (v2.7235)', () => {
  // One check of 1,200: 1,000 on the first sheet, 200 kept. Later 150 of the credit pays part of a second sheet.
  const first = sheet({ id: 'c1', agreed: 1000, day: '2026-11-01', payments: [{ ...pay('k1', 1000, '2026-11-02', '2026-11-02T15:00:00Z', 'final'), method: 'check', method_ref: '1187', sending_id: 's1', sending_no: 12, credit_kept: 200 }] })
  const second = sheet({ id: 'c2', job: '2131 Juniper Flats', agreed: 500, day: '2026-11-08', payments: [{ ...pay('u1', 150, '2026-11-10', '2026-11-10T15:00:00Z'), method: 'credit' }] })
  const both = [first, second]
  const all = buildLedgerLines(both)

  it('a line knows what left the bank: its amount and the credit kept, and nothing for a line paid from credit', () => {
    expect(all.find((l) => l.id === 'k1')).toMatchObject({ amount: 1000, creditKept: 200, sent: 1200, fromCredit: false, sendingNo: 12, method: 'Check' })
    expect(all.find((l) => l.id === 'u1')).toMatchObject({ amount: 150, creditKept: 0, sent: 0, fromCredit: true, sendingNo: null, method: 'From credit', leftOnSheet: 350 })
    expect(sendingTagWords(12)).toBe('sending 12')
    expect(sendingTagWords(null)).toBe('')
  })

  it('Paid counts what was sent and leaves out what was paid from credit', () => {
    expect(ledgerTotals(all)).toEqual({ payments: 1, paidTotal: 1200, backcharges: 0, backchargeTotal: 0, people: 1, undated: 0, creditKept: 200, creditUsed: 150 })
    expect(ledgerMonths(all)[0]!.totals.paidTotal).toBe(1200)
  })

  it('the search finds a sending by its number and by what was sent, and the CSV carries both', () => {
    expect(filterLedger(all, { search: 'sending 12' }).map((l) => l.id)).toEqual(['k1'])
    expect(filterLedger(all, { search: '1200.00' }).map((l) => l.id)).toEqual(['k1'])
    const rows = subPaymentsCsv(all).trimEnd().split('\r\n')
    expect(rows[1]).toBe('2026-11-02,date sent,Calloway Tile,no,2104 Larkspur Lot 14,418 Larkspur Bend,Payment,Check,1187,final,1000.00,0.00,12,200.00')
    expect(rows[2]).toBe('2026-11-10,date sent,Calloway Tile,no,2131 Juniper Flats,418 Larkspur Bend,From credit,,,,150.00,350.00,,')
  })

  it('By sub shows what was sent, the credit they still hold, and what is open', () => {
    const rows = ledgerBySub(both, all)
    expect(rows[0]).toMatchObject({ payments: 1, paid: 1200, weOwe: 350, over: 0, credit: 50 })
    expect(ledgerBySubTotals(rows)).toMatchObject({ paid: 1200, weOwe: 350, credit: 50 })
    // Settled, holding a credit, and nothing in the period: they keep their row.
    const held = sheet({ id: 'h1', paidTo: 'Harlow Drywall', paidToKey: 'id:harlow', agreed: 100, payments: [{ ...pay('h', 100, '2026-01-05', '2026-01-05T15:00:00Z'), credit_kept: 40 }] })
    expect(ledgerBySub([held], []).map((r) => [r.name, r.weOwe, r.credit])).toEqual([['Harlow Drywall', 0, 40]])
  })

  it('the statement runs it through: credit kept takes away, credit used changes nothing', () => {
    const st = buildSubStatement(both, 'id:calloway')
    expect(st.entries.map((e) => [e.kind, e.amount, e.owed])).toEqual([
      ['sheet', 1000, 1000],
      ['payment', 1000, 0],
      ['credit-kept', 200, -200],
      ['sheet', 500, 300],
      ['credit-used', 150, 300],
    ])
    // Paid is the money that left: 1,200. What we owe is the open 350 less the 50 of credit still held.
    expect(st).toMatchObject({ paid: 1200, payments: 1, credit: 50, openOnSheets: 350, overPaid: 0, owedToday: 300, closing: 300 })
    expect(statementCheckWords(st, 350)).toEqual({ agrees: true, words: 'Agrees with People → Subs, where Balance due reads $350.00. They hold a credit of $50.00.' })
    const rows = subStatementCsv(st).trimEnd().split('\r\n')
    expect(rows[3]).toBe('2026-11-02,Credit kept,2104 Larkspur Lot 14,Check,1187,,,200.00,-200.00')
    expect(rows[5]).toBe('2026-11-10,Credit used,2131 Juniper Flats,From credit,,,,,300.00')
    const html = subStatementHtml(st, { periodWords: '', checkWords: '', printedWords: '' })
    expect(html).toContain('<b>Credit kept</b>')
    expect(html).toContain('<b>Credit used</b> · $150.00')
  })
})
