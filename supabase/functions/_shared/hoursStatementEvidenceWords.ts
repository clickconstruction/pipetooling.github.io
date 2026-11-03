/**
 * A signed hours statement's copy on a legal matter, the words (punch list #212, PR 4 on the desk, PR 5 through the dev
 * MCP): the title, the one line the firm reads beside it, and the file name. No imports, so the Legal desk's Add to
 * evidence (`src/lib/legal/hoursStatementEvidence.ts` re-exports them) and dev-mcp's `file_on_matter` name one copy the
 * same way.
 */

export type HoursStatementEvidenceFacts = { recordId: string; workerName: string; hours: number; periodLabel: string; withPay: boolean; statedDays: number }

/** *Signed hours statement HS-1042-0007 · Marcus Reyes*. */
export function hoursStatementEvidenceTitle(s: Pick<HoursStatementEvidenceFacts, 'recordId' | 'workerName'>): string {
  return `Signed hours statement ${s.recordId} · ${s.workerName}`
}

/** The one line the firm reads beside the title: who, how much, where, when, and that the worker signed for it. */
export function hoursStatementEvidenceShows(s: Pick<HoursStatementEvidenceFacts, 'workerName' | 'hours' | 'periodLabel' | 'withPay' | 'statedDays'>, job: { label: string; site: string | null }): string {
  const where = job.site ? ` at ${job.site}` : ''
  const hours = s.hours > 0 ? `${s.hours % 1 === 0 ? s.hours : s.hours.toFixed(1)} h` : 'the hours'
  const pay = s.withPay ? ' and what the company paid for it' : ''
  const stated = s.statedDays > 0 ? ` ${s.statedDays} ${s.statedDays === 1 ? 'day is' : 'days are'} as the worker states them, not as the company recorded them.` : ''
  return `${s.workerName} signed for ${hours} of work on job ${job.label}${where}, ${s.periodLabel}${pay}, from the clock and the pay reports as they stood.${stated}`
}

/** `HS-1042-0007 signed.pdf`. */
export function hoursStatementEvidenceFileName(recordId: string): string {
  return `${recordId.replace(/[\\/:*?"<>|]+/g, ' ').trim()} signed.pdf`
}
