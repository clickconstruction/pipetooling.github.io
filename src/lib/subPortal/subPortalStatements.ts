/**
 * The sub's Statements view, as rows (punch list #371, step 2): the `papers` block the function hands over, turned
 * into what the page lists and the papers it saves. The papers come from the kernel the office draws them from
 * (`_shared/subPapers.ts`), so the page and the PDF cannot disagree.
 *
 * What a paper saved from the page says about itself (the owner's call 2: the page never gives out a number):
 *
 *  - A statement of account takes no number. Its foot reads *Saved from your page* with the day and time.
 *  - A work statement carries its sheet's number where the office has made the paper. When today's figures are the
 *    ones that copy was issued with, it reads as the office's copy does. When the sheet changed since, it keeps the
 *    number, drops the revision, and says it changed since the office's copy and was saved from the page.
 *  - A payment record carries its sending's own number, which the office gave when it recorded the payment.
 *
 * The set is checked again here (`subPapersAddUp`) before anything is listed. Pure: no React, no fetch.
 */
import { paperPreparedAt } from '../../../supabase/functions/_shared/subPaperMarks'
import {
  buildPaymentRecord,
  buildStatementOfAccount,
  buildWorkStatement,
  paperDay,
  paperSendings,
  subPapersAddUp,
  type PaperContext,
  type PaymentRecord,
  type StatementOfAccount,
  type StatementRange,
  type WorkStatement,
} from '../../../supabase/functions/_shared/subPapers'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import type { SubPortalLang } from './subPortalI18n'
import type { SubPortalPapersReady } from './subPortalPapersPayload'

const YMD = /^\d{4}-\d{2}-\d{2}$/
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `Nov 13, 2026`, as the function words a day, back to `2026-11-13`. '' for anything else. */
export function ymdFromPaperDay(words: string): string {
  const m = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec(words.trim())
  const month = m ? MONTHS.indexOf(m[1]!) : -1
  return m && month >= 0 ? `${m[3]}-${String(month + 1).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}` : ''
}

/** The papers' context at the moment a paper is saved: the page's own, with the time read again. */
export function pagePaperContext(papers: SubPortalPapersReady, now: Date): PaperContext {
  return { ...papers.ctx, preparedAt: paperPreparedAt(now, APP_CALENDAR_TZ) }
}

/** `Prepared Nov 16, 2026 at 9:30 am Central time` on the office's paper is *Saved from your page …* on the sub's. */
const savedFromPage = (foot: string): string => foot.replace(/^Prepared /, 'Saved from your page ')

export type StatementsWorkRow = {
  sheetId: string
  /** The sheet's number, where the office has made the paper. '' before then. */
  number: string
  job: string
  comesTo: number
  paid: number
  open: number
  /** The day of the office's copy, when the sheet changed since it was made. '' otherwise. */
  changedSince: string
  paper: WorkStatement
}

export type StatementsPaymentRow = {
  key: string
  number: string
  /** The Date sent, else the day it was recorded (`recorded`). '' when it has neither. */
  ymd: string
  recorded: boolean
  how: string
  amount: number
  /** What went to each statement: its number where the office gave one, else the day the sheet is dated. */
  applied: Array<{ sheetId: string; number: string; day: string; amount: number }>
  creditKept: number
  /** The day the sub marked it received, `YYYY-MM-DD`. '' when not marked. */
  received: string
  paper: PaymentRecord
}

export type SubPortalStatementsView =
  /** The papers do not agree with each other. The page says the office is checking, and shows no figure. */
  | { kind: 'checking' }
  | {
      kind: 'ready'
      stillOpen: number
      lastPayment: { amount: number; ymd: string } | null
      /** Open first, then paid, newest first in each. */
      work: StatementsWorkRow[]
      /** Newest first. */
      payments: StatementsPaymentRow[]
    }

/** The work statement as the page saves it: the office's copy where the figures are that copy's, else marked as the page's own. */
function pageWorkStatement(papers: SubPortalPapersReady, sheetId: string, ctx: PaperContext): { paper: WorkStatement; changedSince: string } | null {
  const sheet = papers.sheets.find((s) => s.id === sheetId)
  if (!sheet) return null
  const paper = buildWorkStatement(sheet, ctx)
  const office = papers.numbers[sheetId]
  if (!sheet.number || !office) return { paper: { ...paper, foot: savedFromPage(paper.foot) }, changedSince: '' }
  if (office.asIssued) return { paper, changedSince: '' }
  const since = paperDay(office.issuedOn)
  return {
    paper: { ...paper, foot: [sheet.number, since ? `changed since the office's copy of ${since}` : "changed since the office's copy", `saved from your page ${ctx.preparedAt} ${ctx.zone}`].join(' · ') },
    changedSince: YMD.test(office.issuedOn) ? office.issuedOn : '',
  }
}

/** What the page lists. `ctx` is the page's own by default; a save hands in `pagePaperContext` so the paper says when. `addUp` is the kernel's check, handed in only by a test. */
export function subPortalStatementsView(papers: SubPortalPapersReady, ctx: PaperContext = papers.ctx, addUp: typeof subPapersAddUp = subPapersAddUp): SubPortalStatementsView {
  const sheets = papers.sheets
  const sendings = paperSendings(sheets)
  const toDate = buildStatementOfAccount(sheets, { from: null, to: null }, ctx)
  const plainWork = sheets.map((s) => buildWorkStatement(s, ctx))
  const plainPayments = sendings.map((s) => buildPaymentRecord(s, sheets, ctx))
  if (!addUp({ statement: toDate, work: plainWork, payments: plainPayments }).ok) return { kind: 'checking' }

  const dayOf = new Map(sheets.map((s) => [s.id, s.day]))
  const numberOf = new Map(sheets.map((s) => [s.id, s.number]))
  const work: StatementsWorkRow[] = []
  for (const s of sheets) {
    const made = pageWorkStatement(papers, s.id, ctx)
    if (!made) continue
    work.push({ sheetId: s.id, number: s.number, job: made.paper.job.label, comesTo: made.paper.comesTo, paid: made.paper.paidSoFar, open: made.paper.stillOpen, changedSince: made.changedSince, paper: made.paper })
  }
  work.sort((a, b) => Number(b.open > 0) - Number(a.open > 0) || (dayOf.get(b.sheetId) ?? '').localeCompare(dayOf.get(a.sheetId) ?? '') || b.sheetId.localeCompare(a.sheetId))

  const payments: StatementsPaymentRow[] = sendings
    .map((snd) => {
      const received = ymdFromPaperDay(papers.received[snd.key] ?? '')
      const built = buildPaymentRecord(snd, sheets, ctx, snd.key in papers.received ? { at: papers.received[snd.key] || 'a day not recorded' } : null)
      const paper: PaymentRecord = { ...built, foot: savedFromPage(built.foot) }
      return { key: snd.key, number: snd.number, ymd: snd.ymd, recorded: snd.recorded, how: snd.how, amount: snd.amount, applied: paper.applied.map((a) => ({ sheetId: a.sheetId, number: numberOf.get(a.sheetId) ?? '', day: dayOf.get(a.sheetId) ?? '', amount: a.thisPayment })), creditKept: snd.creditKept, received: snd.key in papers.received ? received || papers.ctx.today : '', paper }
    })
    .reverse()

  const last = sendings[sendings.length - 1]
  return { kind: 'ready', stillOpen: toDate.stillOpen, lastPayment: last ? { amount: last.amount, ymd: last.ymd } : null, work, payments }
}

/** The dates a sub picked, as a period. Null while they are not a period yet: an end before the start, or a day that has not come. */
export function statementRangeFrom(dates: { from: string; to: string }, today: string): StatementRange | null {
  const from = dates.from.trim()
  const to = dates.to.trim()
  if ((from && !YMD.test(from)) || (to && !YMD.test(to))) return null
  if (!from && !to) return null
  if (to && to > today) return null
  if (from && from > (to || today)) return null
  return { from: from || null, to: to || null }
}

/** A statement of account as the page saves it: live figures, no number, *Saved from your page* at its foot. */
export function pageStatementOfAccount(papers: SubPortalPapersReady, range: StatementRange, ctx: PaperContext): StatementOfAccount {
  const paper = buildStatementOfAccount(papers.sheets, range, ctx)
  return { ...paper, number: '', foot: savedFromPage(paper.foot) }
}

/** How a payment was sent, in the page's language. The names of the services stay as they are. */
export function subPortalHowWords(how: string, lang: SubPortalLang): string {
  const words = how.trim()
  if (lang !== 'es' || !words) return words
  const swaps: Array<[RegExp, string]> = [
    [/^Check\b/, 'Cheque'],
    [/^Cash$/, 'Efectivo'],
    [/^Client direct\b/, 'Pago directo del cliente'],
    [/^Other\b/, 'Otro'],
  ]
  for (const [from, to] of swaps) if (from.test(words)) return words.replace(from, to)
  return words
}
