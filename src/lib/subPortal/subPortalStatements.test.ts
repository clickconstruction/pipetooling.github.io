/**
 * The sub's Statements view as rows (punch list #371, step 2): what the page lists, and what a paper saved from the
 * page says about itself. The page never gives out a number, and never lists a set that does not add up.
 */
import { describe, expect, it } from 'vitest'
import * as pdfLib from 'pdf-lib'
import type { PdfLibLike } from '../../../supabase/functions/_shared/jobContractPdf'
import { buildWorkStatement } from '../../../supabase/functions/_shared/subPapers'
import { subPaperFingerprint } from '../../../supabase/functions/_shared/subPaperMarks'
import { buildPaymentRecordPdf, buildStatementOfAccountPdf, buildWorkStatementPdf } from '../../../supabase/functions/_shared/subPapersPdf'
import { buildSubPortalPapers, portalPaperSet, portalPaperSheets } from '../../../supabase/functions/_shared/subPortalPapers'
import { subPaperAttachmentName } from '../subWorkOrders/subPaperSend'
import { parseSubPortalPapers, type SubPortalPapersReady } from './subPortalPapersPayload'
import { ALDER_1, CEDAR_1, CEDAR_2, PAY_SEP_CASH, PAY_SEP_HIDDEN, SENDING_226, SENDING_231, harlanRows, registerRows } from './subPortalPapersFixture'
import { pagePaperContext, pageStatementOfAccount, statementRangeFrom, subPortalHowWords, subPortalStatementsView, ymdFromPaperDay } from './subPortalStatements'

const WHO = { subName: 'Harlan Mechanical', company: { name: 'Your Company Name', lines: ['100 Example Way, Suite 4', '(555) 010-0100'] }, officePhone: '(555) 010-0100', now: new Date('2026-11-16T15:30:00Z') }

/** The block as the function sends it and the page reads it: built, sent as JSON, parsed. `cedar-1` is as the office issued it. */
function papers(acks: Parameters<typeof harlanRows>[0] = {}): SubPortalPapersReady {
  const ctx = portalPaperSet(harlanRows(), WHO).ctx
  const print = subPaperFingerprint(buildWorkStatement(portalPaperSheets(harlanRows()).find((s) => s.id === CEDAR_1)!, ctx))
  const block = parseSubPortalPapers(JSON.parse(JSON.stringify(buildSubPortalPapers(harlanRows({ register: registerRows(print), ...acks }), WHO))))
  if (!block || !block.ok) throw new Error('the block did not parse')
  return block
}
const ready = (p: SubPortalPapersReady, ctx = p.ctx) => {
  const view = subPortalStatementsView(p, ctx)
  if (view.kind !== 'ready') throw new Error('the set did not add up')
  return view
}

describe('what the page lists', () => {
  const view = ready(papers({ acks: [{ kind: 'received', paper_id: null, labor_job_id: null, sending_id: SENDING_226, payment_id: null, note: null, created_at: '2026-11-02T18:00:00Z' }] }))

  it('Still open is the statement of account to date, and the last payment is the newest sending', () => {
    expect(view.stillOpen).toBe(1500)
    expect(view.lastPayment).toEqual({ amount: 2200, ymd: '2026-11-12' })
  })

  it('work statements: open first, then paid, newest first, each with what it comes to, what was paid and what is open', () => {
    expect(view.work.map((w) => [w.sheetId, w.number, w.job, w.comesTo, w.paid, w.open])).toEqual([
      [CEDAR_1, 'WS-2041-1', '#2041 Cedar Hollow Clinic', 4000, 2500, 1500],
      [CEDAR_2, 'WS-2041-2', '#2041 Cedar Hollow Clinic', 1200, 1200, 0],
      [ALDER_1, '', '#2033 Alder Court Remodel', 1800, 1800, 0],
    ])
  })

  it('payments: one line for each check or transfer, newest first, with what went to each statement', () => {
    expect(view.payments.map((p) => [p.key, p.number, p.ymd, p.recorded, p.how, p.amount, p.creditKept, p.received])).toEqual([
      [SENDING_231, 'PR-0231', '2026-11-12', false, 'Zelle 8841', 2200, 0, ''],
      [SENDING_226, 'PR-0226', '2026-10-31', false, 'Check 1182', 1500, 0, '2026-11-02'],
      [`row:${PAY_SEP_CASH}`, '', '2026-09-20', false, 'Cash', 950, 50, ''],
      [`row:${PAY_SEP_HIDDEN}`, '', '2026-09-02', true, 'Check 1140', 900, 0, ''],
    ])
    expect(view.payments[0]!.applied.map((a) => [a.number, a.amount]).sort()).toEqual([
      ['WS-2041-1', 1000],
      ['WS-2041-2', 1200],
    ])
    // A statement with no number is named by the day its sheet is dated.
    expect(view.payments[2]!.applied).toEqual([{ sheetId: ALDER_1, number: '', day: '2026-09-01', amount: 900 }])
  })

  it('a payment the sub marked received says so on its record', () => {
    expect(view.payments.find((p) => p.key === SENDING_226)!.paper.received).toBe('Harlan Mechanical marked this received on Nov 2, 2026.')
    expect(view.payments.find((p) => p.key === SENDING_231)!.paper.received).toContain('Not marked yet')
  })
})

describe('the page never gives out a number', () => {
  const p = papers()
  const at = pagePaperContext(p, new Date('2026-11-17T02:05:00Z'))
  const view = ready(p, at)

  it('a statement of account saved from the page takes no number and says where it came from', () => {
    const soa = pageStatementOfAccount(p, { from: null, to: null }, at)
    expect(soa.number).toBe('')
    expect(soa.foot).toBe('Saved from your page Nov 16, 2026 at 8:05 pm Central time · 3 statements · 4 payments')
    expect(subPaperAttachmentName(soa)).toBe('Statement of account.pdf')
  })

  it('a work statement the office made, unchanged since, reads as the office’s copy does', () => {
    const cedar1 = view.work.find((w) => w.sheetId === CEDAR_1)!
    expect(cedar1.changedSince).toBe('')
    expect(cedar1.paper.foot).toBe('WS-2041-1 · revision 2')
  })

  it('a work statement that changed since the office’s copy keeps its number, drops the revision and says so', () => {
    const cedar2 = view.work.find((w) => w.sheetId === CEDAR_2)!
    expect(cedar2.changedSince).toBe('2026-11-05')
    expect(cedar2.paper.number).toBe('WS-2041-2')
    expect(cedar2.paper.foot).toBe("WS-2041-2 · changed since the office's copy of Nov 5, 2026 · saved from your page Nov 16, 2026 at 8:05 pm Central time")
  })

  it('a work statement the office has not made has no number', () => {
    const alder = view.work.find((w) => w.sheetId === ALDER_1)!
    expect(alder.paper.number).toBe('')
    expect(alder.paper.foot).toBe('Saved from your page Nov 16, 2026 at 8:05 pm Central time')
  })

  it('a payment record carries its sending’s own number, and one from before sendings carries none', () => {
    expect(view.payments.find((x) => x.key === SENDING_231)!.paper.foot).toBe('PR-0231')
    expect(view.payments.find((x) => x.key === `row:${PAY_SEP_CASH}`)!.paper.foot).toBe('Saved from your page Nov 16, 2026 at 8:05 pm Central time')
  })

  it('every paper the page saves draws as a PDF', async () => {
    const lib = pdfLib as unknown as PdfLibLike
    const range = { from: '2026-10-01', to: '2026-10-31' }
    const pdfs = [await buildStatementOfAccountPdf(lib, pageStatementOfAccount(p, range, at), range), ...(await Promise.all(view.work.map((w) => buildWorkStatementPdf(lib, w.paper)))), ...(await Promise.all(view.payments.map((x) => buildPaymentRecordPdf(lib, x.paper))))]
    expect(pdfs).toHaveLength(8)
    for (const bytes of pdfs) expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  })
})

describe('a set that does not add up', () => {
  it('lists nothing: the page says the office is checking', () => {
    const p = papers()
    expect(subPortalStatementsView(p, p.ctx, () => ({ ok: false, problems: ['made up'] }))).toEqual({ kind: 'checking' })
    // The kernel's own check passes these rows.
    expect(subPortalStatementsView(p).kind).toBe('ready')
  })
})

describe('the dates a sub picks', () => {
  it('are a period only when the start is not after the end and no day is past today', () => {
    const today = '2026-11-16'
    expect(statementRangeFrom({ from: '2026-10-01', to: '2026-10-31' }, today)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(statementRangeFrom({ from: '', to: '2026-10-31' }, today)).toEqual({ from: null, to: '2026-10-31' })
    expect(statementRangeFrom({ from: '2026-10-01', to: '' }, today)).toEqual({ from: '2026-10-01', to: null })
    expect(statementRangeFrom({ from: '2026-11-01', to: '2026-10-31' }, today)).toBeNull()
    expect(statementRangeFrom({ from: '', to: '2026-11-17' }, today)).toBeNull()
    expect(statementRangeFrom({ from: '2026-11-17', to: '' }, today)).toBeNull()
    expect(statementRangeFrom({ from: '', to: '' }, today)).toBeNull()
    expect(statementRangeFrom({ from: 'soon', to: '' }, today)).toBeNull()
  })

  it('a period’s statement says what was open on its last day, and the big figure stays today’s', () => {
    const p = papers()
    const october = pageStatementOfAccount(p, { from: '2026-10-01', to: '2026-10-31' }, p.ctx)
    // On Oct 31 cedar-1 had its first draw and nothing else: 4,100 agreed less 1,500 paid.
    expect(october.stillOpen).toBe(2600)
    expect(ready(p).stillOpen).toBe(1500)
  })
})

describe('small words', () => {
  it('a day the function worded reads back as a date', () => {
    expect(ymdFromPaperDay('Nov 2, 2026')).toBe('2026-11-02')
    expect(ymdFromPaperDay('Sep 13, 2026')).toBe('2026-09-13')
    expect(ymdFromPaperDay('a day not recorded')).toBe('')
    expect(ymdFromPaperDay('')).toBe('')
  })

  it('how a payment was sent reads in the page’s language, and a service keeps its name', () => {
    expect(subPortalHowWords('Check 1182', 'es')).toBe('Cheque 1182')
    expect(subPortalHowWords('Cash', 'es')).toBe('Efectivo')
    expect(subPortalHowWords('Cash App #D-3V', 'es')).toBe('Cash App #D-3V')
    expect(subPortalHowWords('Zelle 8841', 'es')).toBe('Zelle 8841')
    expect(subPortalHowWords('Client direct', 'es')).toBe('Pago directo del cliente')
    expect(subPortalHowWords('Other', 'es')).toBe('Otro')
    expect(subPortalHowWords('Check 1182', 'en')).toBe('Check 1182')
    expect(subPortalHowWords('', 'es')).toBe('')
  })
})

describe('the block, read defensively', () => {
  const sent = JSON.parse(JSON.stringify(buildSubPortalPapers(harlanRows(), WHO))) as Record<string, unknown>

  it('reads what the function sends, whole', () => {
    expect(parseSubPortalPapers(sent)).toEqual(buildSubPortalPapers(harlanRows(), WHO))
  })

  it('a page with no block, or one it cannot read, has no Statements view: never half a paper', () => {
    expect(parseSubPortalPapers(undefined)).toBeNull()
    expect(parseSubPortalPapers(null)).toBeNull()
    expect(parseSubPortalPapers('papers')).toBeNull()
    expect(parseSubPortalPapers({ ...sent, ok: 'yes' })).toBeNull()
    expect(parseSubPortalPapers({ ...sent, ctx: null })).toBeNull()
    expect(parseSubPortalPapers({ ...sent, stillOpen: '1500' })).toBeNull()
    const sheets = sent.sheets as Array<Record<string, unknown>>
    expect(parseSubPortalPapers({ ...sent, sheets: [{ ...sheets[0], money: [{ id: 'm', amount: 'ten' }] }] })).toBeNull()
    expect(parseSubPortalPapers({ ...sent, sheets: [{ ...sheets[0], lines: 'none' }] })).toBeNull()
  })

  it('papers that do not add up keep only the office’s phone', () => {
    expect(parseSubPortalPapers({ ok: false, officePhone: ' (555) 010-0100 ', sheets: sent.sheets })).toEqual({ ok: false, officePhone: '(555) 010-0100' })
  })
})
