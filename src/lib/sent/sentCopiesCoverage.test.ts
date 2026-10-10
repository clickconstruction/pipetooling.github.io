/**
 * Sent copies — the ratchet (v2.4554). The owner's rule: every time we send someone something,
 * a copy is kept in Documents, and a print counts as a send. This test reads the source for
 * every file that prints and holds each one to one of three answers:
 *
 *   1. it files a copy (it imports `lib/sent/sentCopiesIo`), or
 *   2. it is on `PRINTS_OWED` — it goes to someone outside and does not file yet, or
 *   3. it is on `NOT_A_SEND`, with the reason.
 *
 * A new file that prints fails here until it has an answer. `PRINTS_OWED` only shrinks: wire
 * the file with `printAndFile` and remove its row. The plan is `docs/SENT_COPIES.md`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..', '..')

/** A call that puts a page on paper. */
const PRINTS = /openHtmlPrintWindow\(|printHtmlInNewWindow\(|print:\s*true|\.print\(\)/
const FILES_A_COPY = /lib\/sent\/sentCopiesIo'|from '\.\/sentCopiesIo'/

/** Goes to someone outside the company and keeps no copy yet. Remove a row when the file is wired. */
const PRINTS_OWED: ReadonlyArray<string> = [
  // GC mode's schedule chart, Print or PDF (the schedule's PR 7a): the customer's pages go to them. A dev's only until the
  // schedule's PR 10, which files it with printAndFile before the office can print it.
  'components/gc/GcGanttPrint.tsx',
]

/** Prints that are not a send, each with why. */
const NOT_A_SEND: Readonly<Record<string, string>> = {
  'lib/jobsDocuments/printWindow.ts': 'the print helper itself',
  'lib/bidDocuments/htmlDoc.ts': 'the print helper itself',
  'lib/sent/sentCopies.ts': 'the Print button of the window a kept copy opens in',
  'lib/sent/sentCopiesIo.ts': 'printAndFile itself: the print that files',
  'lib/jobs/lienNoticePreview.ts': 'the Print button inside a preview page; the send is filed where the notice is sent',
  'components/UserReviewModal.tsx': 'our own review of a teammate',
  'components/bids/BidSubmissionFollowupTab.tsx': 'a follow-up sheet for our own account managers',
  'components/bids/BidsTakeoffTab.tsx': 'our own takeoff sheets; the schedule that goes to the GC is filed from the cover letter tab',
  'components/partnerships/PartnershipAgreementsTab.tsx': 'a partnership notice: kept on the partnership itself (notice_html), never in a list the whole office reads',
  'components/settings/ContractReaderModal.tsx': 'reading a contract in Settings; a contract that goes to someone is filed where it is sent',
  'lib/bidDocuments/costEstimatePage.ts': 'our own cost estimate: it holds cost and margin',
  'lib/bidDocuments/pricingPage.ts': 'our own pricing sheet: it holds cost and margin',
  'components/bids/BidsBuilderReviewTab.tsx': 'a call sheet for our own callers',
  'components/jobs/JobsGcReviewModal.tsx': 'a call sheet for our own callers',
  'components/jobs/JobHoursStoryModal.tsx': 'our own report on a job',
  'components/jobs/JobSummaryCostCellDrilldownModal.tsx': 'our own cost report',
  'components/jobs/JobsWeeklyMoneyModal.tsx': 'our own money report',
  'components/jobs/JobsWeeklyMovementModal.tsx': 'our own movement report',
  'components/pay/PayStubViewModal.tsx': 'a pay stub: pay stays with payroll, never in a list the whole office reads',
  'lib/peopleDocuments/buildPayStubHtml.ts': 'a pay stub: pay stays with payroll, never in a list the whole office reads',
  'components/people/teamSummary/TeamSummaryDrilldownModal.tsx': 'our own team report',
  'components/people/teamSummary/TeamSummaryInline.tsx': 'our own team report',
  'lib/peopleDocuments/buildTeamSummaryHtml.ts': 'our own team report',
  'components/jobs/legal/LegalPortalLienGrid.tsx': 'the law firm prints from its own portal page',
  'pages/CustomerPortal.tsx': 'the customer prints from their own portal page',
  'pages/HazmatNoticePublic.tsx': 'the customer prints from the public notice page',
  'pages/LegalPortal.tsx': 'the law firm prints from its own portal page',
  'pages/PartnerStatement.tsx': 'the partner prints from their own statement page',
  'pages/SubPortal.tsx': 'the sub prints from their own portal page',
  'components/gc/gcTradePortalPrint.ts': 'the trade partner prints its own list of papers from its own portal page',
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) sourceFiles(path, out)
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path)
  }
  return out
}

const printing = sourceFiles(SRC)
  .map((path) => ({ rel: relative(SRC, path).split('\\').join('/'), text: readFileSync(path, 'utf8') }))
  .filter((f) => PRINTS.test(f.text))

describe('every print has an answer', () => {
  it('a file that prints files a copy, is owed, or is not a send', () => {
    const unanswered = printing.filter((f) => !FILES_A_COPY.test(f.text) && !PRINTS_OWED.includes(f.rel) && !(f.rel in NOT_A_SEND)).map((f) => f.rel)
    expect(unanswered, 'These files print and keep no copy. File it with printAndFile (lib/sent/sentCopiesIo), or add the file to NOT_A_SEND with its reason.').toEqual([])
  })

  it('the owed list only names files that still print without filing', () => {
    const byRel = new Map(printing.map((f) => [f.rel, f]))
    const stale = PRINTS_OWED.filter((rel) => !byRel.has(rel) || FILES_A_COPY.test(byRel.get(rel)!.text))
    expect(stale, 'These files file a copy now, or no longer print. Remove their rows from PRINTS_OWED.').toEqual([])
  })

  it('no file is on both lists, and every reason is written', () => {
    expect(PRINTS_OWED.filter((rel) => rel in NOT_A_SEND)).toEqual([])
    expect(Object.entries(NOT_A_SEND).filter(([, why]) => why.trim().length < 8)).toEqual([])
    const known = new Set(printing.map((f) => f.rel))
    expect(Object.keys(NOT_A_SEND).filter((rel) => !known.has(rel)), 'These files no longer print. Remove their rows from NOT_A_SEND.').toEqual([])
  })
})
