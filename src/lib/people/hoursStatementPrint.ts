/**
 * The signed hours statement on paper (punch list #212, PR 2): the one place the app prints it, from the window with
 * its live read or from a saved row's snapshot, so the sent-copies ratchet (`sentCopiesCoverage.test.ts`) names one
 * file. Print files no copy: the paper is signed with a pen, and the copy that goes to the worker is filed where it is
 * sent for signature, from PR 3. The window opens inside the press, so a popup blocker lets it through, and takes the
 * page once the save and the build are done.
 */
import { openHtmlWindowWhenReady } from '../jobsDocuments/printWindow'
import { buildHoursStatementHtml } from '../peopleDocuments/buildHoursStatementHtml'
import { buildHoursStatement } from './hoursStatement'
import type { HoursStatementSnapshot } from './hoursStatementsIo'

/** The paper from a snapshot, with the record id it carries (null prints as a draft). */
export function buildHoursStatementPaper(snapshot: HoursStatementSnapshot, recordId: string | null): string {
  const statement = buildHoursStatement(snapshot.input)
  return buildHoursStatementHtml({
    statement,
    recordId,
    worker: snapshot.worker,
    job: snapshot.job,
    approvedBy: snapshot.approvedBy,
    preparedBy: snapshot.preparedBy,
    preparedOn: snapshot.preparedOn,
    asOf: snapshot.asOf,
  })
}

/**
 * Print the paper: the window opens at once, inside the press, and prints the page `build` returns. False when the
 * popup was blocked or the build threw (the window is closed then).
 */
export function printHoursStatementPaper(build: () => Promise<string>): Promise<boolean> {
  return openHtmlWindowWhenReady(build, { print: true })
}
