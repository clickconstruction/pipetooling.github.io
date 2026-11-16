import { describe, expect, it } from 'vitest'
import {
  buildPaymentRecord,
  buildStatementOfAccount,
  buildWorkStatement,
  paperSendings,
  statementAddsWords,
  subPaperAddsUp,
  subPapersAddUp,
  SUB_PAPER_COUNSEL_SENTENCES,
  SUB_PAPER_LABELS,
  type PaperContext,
  type PaperSheet,
} from '../../../supabase/functions/_shared/subPapers'
import type { LaborJob, LaborJobPayment } from '../../types/laborJob'
import { buildSubOwedBreakdown, owedPersonById, owedView } from '../people/subOwedBreakdown'
import { subLaborJobBalance } from '../subLaborOutstanding'
import type { NeedsWorkOrderRosterPerson } from './rosterSub'
import { buildSheetPartiesLookup, sheetParties } from './sheetParties'
import { paperSheetFrom, paperSheetsFor } from './subPapersInputs'
import { buildSubStatement, type LedgerSheet } from './subPaymentsLedger'

// Made-up people, jobs and money: the mock-up's own figures (to-dos/sub-papers-statement-of-account/mockup.html).
const ROSTER: NeedsWorkOrderRosterPerson[] = [
  { id: 'harlan', name: 'Harlan Mechanical', kind: 'sub', accountRole: 'subcontractor' },
  { id: 'dana', name: 'Dana Whitlock', kind: 'sub', accountRole: 'superintendent' },
]
const NAMES: Record<string, string> = { cedar: 'Cedar Hollow Clinic', ridge: 'Ridgeway Builders, Lot 12', alder: 'Alder Court Remodel' }
const NUMBERS: Record<string, string> = { cedar: '2041', ridge: '2057', alder: '2033' }

type Pay = Partial<LaborJobPayment> & { id: string; amount: number }
function sheet(id: string, job: string, day: string, lines: Array<[string, number]>, pays: Pay[] = [], names = ['harlan']): LaborJob {
  return {
    id,
    assigned_to_name: names.map((n) => ROSTER.find((p) => p.id === n)!.name).join(' | '),
    address: '1 Made-up Way',
    job_number: NUMBERS[job] ?? null,
    job_ledger_id: job,
    labor_rate: null,
    job_date: day,
    created_at: `${day}T15:00:00Z`,
    items: lines.map(([fixture, amount]) => ({ fixture, count: 1, hrs_per_unit: 0, direct_labor_amount: amount })),
    payments: pays.map((p, i) => ({ memo: null, created_at: `${p.payment_date ?? day}T16:0${i}:00Z`, ...p })),
    payment_events: [],
  }
}

const SHEETS: LaborJob[] = [
  sheet('alder-1', 'alder', '2026-09-22', [['Repipe, two baths', 1800]], [{ id: 'p212', amount: 1800, payment_date: '2026-10-03', method: 'check', method_ref: '1167', sending_id: 'snd212', sending_no: 212 }]),
  sheet(
    'cedar-1',
    'cedar',
    '2026-10-28',
    [['Rough-in', 2400], ['Top-out', 1800]],
    [
      { id: 'p226', amount: 1500, payment_date: '2026-10-31', method: 'check', method_ref: '1182', sending_id: 'snd226', sending_no: 226 },
      { id: 'b1', amount: -100, payment_date: '2026-11-10', memo: 'cleanup after top-out' },
      { id: 'p231a', amount: 1000, payment_date: '2026-11-12', method: 'zelle', method_ref: '8841', sending_id: 'snd231', sending_no: 231, memo: 'Trim is paid in full.' },
    ],
    ['harlan', 'dana'],
  ),
  sheet('ridge-1', 'ridge', '2026-11-03', [['Slab sleeves', 2500]]),
  sheet('cedar-2', 'cedar', '2026-11-06', [['Trim', 1200]], [{ id: 'p231b', amount: 1200, payment_date: '2026-11-12', method: 'zelle', method_ref: '8841', sending_id: 'snd231', sending_no: 231 }]),
]
const ASSIGNEES = new Map(SHEETS.map((s) => [s.id, s.assigned_to_name.split(' | ').map((n) => ({ personId: ROSTER.find((p) => p.name === n)!.id, personName: n }))]))
const REGISTER = new Map([
  ['alder-1', { number: 'WS-2033-1', revision: 1 }],
  ['cedar-1', { number: 'WS-2041-1', revision: 2, replacesCopyOf: '2026-10-29', confirm: { revision: 1, amount: 4200, at: 'Nov 7, 2026 at 3:12 pm', from: 'their portal' } }],
  ['ridge-1', { number: 'WS-2057-1', revision: 1 }],
  ['cedar-2', { number: 'WS-2041-2', revision: 1 }],
])
const CTX: PaperContext = { company: { name: 'Your Company Name', lines: ['100 Example Way, Suite 4'] }, sub: { name: 'Harlan Mechanical', lines: ['22 Foundry Row'] }, today: '2026-11-13', preparedAt: 'Nov 13, 2026 at 2:40 pm', zone: 'Central time' }

const papers = (): PaperSheet[] => paperSheetsFor('id:harlan', SHEETS, ASSIGNEES, NAMES, ROSTER, { register: REGISTER })
const byId = (id: string) => papers().find((s) => s.id === id)!

describe('a part payment reads the same on all three papers', () => {
  const a = buildWorkStatement(byId('cedar-1'), CTX)
  const sending = paperSendings(papers()).find((s) => s.number === 'PR-0231')!
  const b = buildPaymentRecord(sending, papers(), CTX)
  const c = buildStatementOfAccount(papers(), { from: '2026-10-01', to: '2026-11-13' }, CTX, { number: 'SA-0058' })

  it('A · the work statement: lines, the back-charge, each payment, still open', () => {
    expect(a).toMatchObject({ number: 'WS-2041-1', revision: 2, agreed: 4200, comesTo: 4100, paidSoFar: 2500, stillOpen: 1600, over: 0 })
    expect(a.backcharges).toEqual([{ id: 'b1', day: 'Nov 10, 2026', reason: 'cleanup after top-out', amount: 100 }])
    expect(a.payments.map((p) => [p.day, p.words, p.how, p.recordNo, p.amount])).toEqual([
      ['Oct 31, 2026', 'part payment', 'Check 1182', 'PR-0226', 1500],
      ['Nov 12, 2026', 'part payment', 'Zelle 8841', 'PR-0231', 1000],
    ])
    expect(a.foot).toBe('WS-2041-1 · revision 2 · replaces the copy of Oct 29, 2026')
    expect(subPaperAddsUp(a).ok).toBe(true)
  })
  it('B · the payment record: one sending over two sheets, open before and after', () => {
    expect(b).toMatchObject({ number: 'PR-0231', sentOn: 'Nov 12, 2026', how: 'Zelle 8841', amountSent: 2200, appliedTotal: 2200, creditKept: 0, stillOpenAfter: 4100, note: 'Trim is paid in full.' })
    expect(b.applied.map((x) => [x.sheetName, x.openBefore, x.thisPayment, x.openAfter, x.words])).toEqual([
      ['WS-2041-2', 1200, 1200, 0, 'Paid in full'],
      ['WS-2041-1', 2600, 1000, 1600, 'Part payment'],
    ])
    expect(b.after.map((x) => [x.sheetName, x.open])).toEqual([['WS-2041-1', 1600], ['WS-2057-1', 2500]])
    expect(subPaperAddsUp(b).ok).toBe(true)
  })
  it('C · the statement of account: brought forward, the period, the last payments, how it adds up', () => {
    expect(c.stillOpen).toBe(4100)
    expect(c.rows.map((r) => [r.section, r.sheetName, r.comesTo, r.paid, r.open])).toEqual([
      ['forward', 'WS-2033-1', 1800, 1800, 0],
      ['period', 'WS-2041-1', 4100, 2500, 1600],
      ['period', 'WS-2057-1', 2500, 0, 2500],
      ['period', 'WS-2041-2', 1200, 1200, 0],
    ])
    expect(c.rows[0]!.words).toBe('Paid in full Oct 3, 2026')
    expect(c.rows[1]!.words).toBe('$4,200.00 agreed, less a $100.00 back-charge · 2 part payments')
    expect(c.totals).toEqual({ comesTo: 9600, paid: 5500, open: 4100 })
    expect(c.lastPayments.map((p) => [p.number, p.amount])).toEqual([['PR-0231', 2200], ['PR-0226', 1500], ['PR-0212', 1800]])
    expect(c.adds).toEqual({ opening: 1800, newWork: 7900, backcharges: 100, payments: 5500, closing: 4100 })
    expect(statementAddsWords(c, { from: '2026-10-01', to: '2026-11-13' })).toBe('Open on Oct 1, 2026 $1,800.00 + new work $7,900.00 − back-charges $100.00 − payments $5,500.00 = $4,100.00')
    expect(c.foot).toBe('SA-0058 · 4 statements · 3 payments')
    expect(subPaperAddsUp(c).ok).toBe(true)
  })
  it('the three carry the same figures: $1,600 on the sheet, $1,000 part paid, $4,100 in all', () => {
    expect(a.stillOpen).toBe(b.applied.find((x) => x.sheetName === 'WS-2041-1')!.openAfter)
    expect(a.stillOpen).toBe(c.rows.find((r) => r.sheetName === 'WS-2041-1')!.open)
    expect(b.stillOpenAfter).toBe(c.stillOpen)
  })
})

describe('the set is checked before any paper is drawn', () => {
  const all = papers()
  const set = () => ({ statement: buildStatementOfAccount(all, { from: null, to: null }, CTX), work: all.map((s) => buildWorkStatement(s, CTX)), payments: paperSendings(all).map((s) => buildPaymentRecord(s, all, CTX)) })
  it('agrees across the three', () => {
    expect(subPapersAddUp(set())).toEqual({ ok: true, problems: [] })
  })
  it('refuses a set whose numbers were moved, and says which paper', () => {
    const s = set()
    s.work[1] = { ...s.work[1]!, stillOpen: 1700 }
    const check = subPapersAddUp(s)
    expect(check.ok).toBe(false)
    expect(check.problems.join(' ')).toContain('WS-2041-1')
  })
  it("ends on the roster's Balance due (#346) and on the ledger's statement (#347)", () => {
    const lookup = buildSheetPartiesLookup(ROSTER)
    const c = buildStatementOfAccount(all, { from: null, to: null }, CTX)
    const owed = buildSubOwedBreakdown(SHEETS.map((sh) => ({ sheet: sh, parties: sheetParties(sh, ASSIGNEES.get(sh.id), lookup), payWhen: null, jobId: sh.job_ledger_id ?? null, jobName: NAMES[sh.job_ledger_id ?? ''] ?? '' })))
    expect(c.stillOpen).toBe(owedView(owedPersonById(owed, 'harlan'), 'open').open)
    const ledger: LedgerSheet[] = SHEETS.map((sh) => {
      const parties = sheetParties(sh, ASSIGNEES.get(sh.id), lookup)
      return { id: sh.id, paidTo: parties.label, paidToKey: parties.key, crew: parties.crew, job: sh.job_number ?? '', address: sh.address, agreed: subLaborJobBalance(sh).totalCost, day: sh.job_date ?? '', payments: sh.payments ?? [], events: [] }
    })
    const st = buildSubStatement(ledger, 'id:harlan')
    expect(c.stillOpen).toBe(st.openOnSheets)
    expect(c.adds.closing).toBe(st.closing)
    // A period: the same opening and the same closing as the ledger's statement of the same days.
    const period = { from: '2026-11-01', to: '2026-11-11' }
    const cp = buildStatementOfAccount(all, period, CTX)
    const sp = buildSubStatement(ledger, 'id:harlan', period)
    expect([cp.adds.opening, cp.adds.closing]).toEqual([sp.opening, sp.closing])
    expect(subPaperAddsUp(cp).ok).toBe(true)
  })
})

describe('the cases the card names', () => {
  it('a period that starts after a sheet was part paid brings the open part forward', () => {
    const c = buildStatementOfAccount(papers(), { from: '2026-11-01', to: '2026-11-13' }, CTX)
    // Cedar 1 was $4,200 less $1,500 paid on Oct 31: $2,700 open on Nov 1. Alder was settled and is history.
    expect(c.adds.opening).toBe(2700)
    expect(c.rows.map((r) => [r.section, r.sheetName])).toEqual([['forward', 'WS-2041-1'], ['period', 'WS-2057-1'], ['period', 'WS-2041-2']])
    expect(c.adds).toMatchObject({ newWork: 3700, backcharges: 100, payments: 2200, closing: 4100 })
    expect(subPaperAddsUp(c).ok).toBe(true)
  })
  it('a back-charge after the sub confirmed: the confirm stands for the revision they saw', () => {
    const a = buildWorkStatement(byId('cedar-1'), CTX)
    expect(a.confirm).toEqual({ current: false, words: 'Harlan Mechanical confirmed revision 1 of this statement, at $4,200.00, on Nov 7, 2026 at 3:12 pm, from their portal. It has changed since, and this revision has not been confirmed.' })
    expect(a.sentences.map((s) => s.key)).toEqual(['notAnInvoice', 'confirmMeans', 'workOrderTerms'])
  })
  it('a back-charge before a confirm: the confirm is current', () => {
    const s = { ...byId('cedar-1'), confirm: { revision: 2, amount: 4100, at: 'Nov 11, 2026 at 9:00 am', from: 'their portal' } }
    expect(buildWorkStatement(s, CTX).confirm?.current).toBe(true)
  })
  it('one sending over three sheets, the last a part payment', () => {
    const three = [
      sheet('a', 'cedar', '2026-10-01', [['One', 500]], [{ id: 'x1', amount: 500, payment_date: '2026-10-20', sending_id: 's9', sending_no: 9, method: 'check', method_ref: '77' }]),
      sheet('b', 'cedar', '2026-10-02', [['Two', 700]], [{ id: 'x2', amount: 700, payment_date: '2026-10-20', sending_id: 's9', sending_no: 9, method: 'check', method_ref: '77' }]),
      sheet('c', 'ridge', '2026-10-03', [['Three', 900]], [{ id: 'x3', amount: 300, payment_date: '2026-10-20', sending_id: 's9', sending_no: 9, method: 'check', method_ref: '77' }]),
    ].map((j) => paperSheetFrom(j, { jobName: NAMES[j.job_ledger_id ?? ''] ?? '' }))
    const [snd] = paperSendings(three)
    const b = buildPaymentRecord(snd!, three, CTX)
    expect(b).toMatchObject({ number: 'PR-0009', amountSent: 1500, appliedTotal: 1500, stillOpenAfter: 600 })
    expect(b.applied.map((x) => x.words)).toEqual(['Paid in full', 'Paid in full', 'Part payment'])
    expect(subPaperAddsUp(b).ok).toBe(true)
  })
  it('a payment recorded before sendings is one record per row, with no number', () => {
    const old = [paperSheetFrom(sheet('o', 'alder', '2026-08-01', [['Old work', 400]], [{ id: 'o1', amount: 150 }, { id: 'o2', amount: 250, payment_date: '2026-08-20' }]), { jobName: 'Alder Court Remodel' })]
    const sendings = paperSendings(old)
    expect(sendings.map((s) => [s.key, s.number, s.recorded])).toEqual([['row:o1', '', true], ['row:o2', '', false]])
    expect(buildPaymentRecord(sendings[0]!, old, CTX).sentOn).toBe('recorded Aug 1, 2026')
    expect(buildPaymentRecord(sendings[0]!, old, CTX).foot).toBe('Prepared Nov 13, 2026 at 2:40 pm Central time')
  })
  it('a memo the office hid stays off the papers, and the amount still shows', () => {
    const hidden = paperSheetFrom(sheet('h', 'cedar', '2026-10-01', [['Work', 500]], [{ id: 'h1', amount: 200, payment_date: '2026-10-05', memo: 'short this week, rest on Friday', hidden_from_sub: true }]), { jobName: 'Cedar Hollow Clinic' })
    const b = buildPaymentRecord(paperSendings([hidden])[0]!, [hidden], CTX)
    expect(b.note).toBe('')
    expect(b.amountSent).toBe(200)
    expect(JSON.stringify(b)).not.toContain('short this week')
  })
  it('a sending past what the sheets needed keeps a credit, and the statement says so', () => {
    const over = [paperSheetFrom(sheet('k', 'cedar', '2026-10-01', [['Work', 500]], [{ id: 'k1', amount: 500, payment_date: '2026-10-05', sending_id: 's3', sending_no: 3, credit_kept: 120 }]), { jobName: 'Cedar Hollow Clinic' })]
    const b = buildPaymentRecord(paperSendings(over)[0]!, over, CTX)
    expect(b).toMatchObject({ amountSent: 620, appliedTotal: 500, creditKept: 120, stillOpenAfter: 0 })
    const c = buildStatementOfAccount(over, { from: null, to: null }, CTX)
    expect(c).toMatchObject({ stillOpen: 0, credit: 120, paidInPeriod: 620 })
    expect(c.adds.closing).toBe(-120)
    expect(statementAddsWords(c, { from: null, to: null })).toContain('less $120.00 held as credit')
    expect(subPaperAddsUp(c).ok).toBe(true)
    expect(subPaperAddsUp(b).ok).toBe(true)
  })
  it('a line with no day at all is left off a statement with a period, and counted', () => {
    const j = sheet('u', 'cedar', '2026-10-01', [['Work', 500]], [{ id: 'u1', amount: 100 }])
    j.payments![0]!.created_at = ''
    const c = buildStatementOfAccount([paperSheetFrom(j, { jobName: 'Cedar Hollow Clinic' })], { from: '2026-10-01', to: '2026-10-31' }, CTX)
    expect(c).toMatchObject({ undated: 1, stillOpen: 500 })
    expect(subPaperAddsUp(c).ok).toBe(true)
  })
  it('Paid this year leaves out a payment the customer made direct', () => {
    const j = [paperSheetFrom(sheet('y', 'cedar', '2026-03-01', [['Work', 900]], [{ id: 'y1', amount: 400, payment_date: '2026-03-10', method: 'check' }, { id: 'y2', amount: 500, payment_date: '2026-03-12', method: 'client_direct' }]), { jobName: 'Cedar Hollow Clinic' })]
    expect(buildStatementOfAccount(j, { from: null, to: null }, CTX).paidThisYear).toEqual({ year: '2026', amount: 400 })
  })
})

describe('the names on the papers', () => {
  it('no label of ours says invoice, receipt or owed', () => {
    for (const label of SUB_PAPER_LABELS) expect(label).not.toMatch(/invoice|receipt|\bowed?\b/i)
    const a = buildWorkStatement(byId('cedar-1'), CTX)
    const ours = JSON.stringify({ ...a, sentences: [] })
    expect(ours).not.toMatch(/invoice|receipt|\bowed\b/i)
  })
  it('the six sentences for counsel are drafts, and every one prints marked', () => {
    expect(Object.keys(SUB_PAPER_COUNSEL_SENTENCES)).toHaveLength(6)
    const a = buildWorkStatement(byId('cedar-1'), CTX)
    expect(a.sentences.every((s) => s.pending)).toBe(true)
    expect(a.sentences[0]!.text).toBe('Your Company Name prepared this statement from its own records. It is not an invoice from Harlan Mechanical.')
  })
})
