/**
 * The Legal desk's reading of a job's agreement (punch list #173, v2.6698): what *Can we sue?*
 * counts as a signed agreement, and the words the basis line and the gap read. One rule, so the
 * theory, the gap list, the steps, the Paper tab and the firm's view agree:
 *
 *   - a signed contract of ours, a paper filed as signed by them, an accepted estimate or a
 *     bid-room signature counts (as before);
 *   - their paper counts once they countersigned it or relied on it (the owner, 2026-11-08);
 *     signed by us alone it is a flagged basis beside the sworn account, and the gap says so.
 *
 * Pure; `legalPacket.ts` calls it.
 */
import type { JobContractCoverage } from '../jobs/jobContractCoverage'
import { theirPaperCountsAsSigned, theirPaperWords } from '../jobs/theirPaper'

/** Does this agreement count as signed for the theory an attorney could plead? */
export function agreementCountsForSuit(cov: JobContractCoverage | null | undefined): boolean {
  if (!cov) return false
  if (cov.kind === 'signed') return true
  if (cov.kind === 'their_paper') return theirPaperCountsAsSigned(cov.record)
  return false
}

/** Their paper that is on file but does not count yet, or null. */
export function theirPaperNotCounting(cov: JobContractCoverage | null | undefined): Extract<JobContractCoverage, { kind: 'their_paper' }> | null {
  return cov && cov.kind === 'their_paper' && !theirPaperCountsAsSigned(cov.record) ? cov : null
}

/**
 * The basis line under a *Signed contract* theory: `a signed agreement is on file` when ours is,
 * else their paper's own words — `their paper, signed by us only, relied on (their notice of
 * termination, Oct 2, 2026); backup: sworn account` — so the firm reads what it is pleading on.
 */
export function signedAgreementBasis(agreements: ReadonlyArray<JobContractCoverage>, swornHolds: boolean): string {
  if (agreements.some((c) => c.kind === 'signed')) return 'a signed agreement is on file'
  const theirs = agreements.find((c) => c.kind === 'their_paper' && theirPaperCountsAsSigned(c.record))
  if (!theirs || theirs.kind !== 'their_paper') return 'a signed agreement is on file'
  const r = theirs.record
  const how = r.theirSignedOn ? 'signed by both' : `signed by us only, relied on${r.reliedOn?.what ? ` (${r.reliedOn.what}${r.reliedOn.on ? `, ${monthDay(r.reliedOn.on)}` : ''})` : ''}`
  return `their paper, ${how}${swornHolds ? '; backup: sworn account' : ''}`
}

function monthDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, d, 12)))
}

/** The gap the desk lists for their paper that does not count yet: a note when the sworn account holds, a stop when it does not. */
export function theirPaperGapWords(cov: Extract<JobContractCoverage, { kind: 'their_paper' }>, jobLabel: string, swornMissing: ReadonlyArray<string>): { severity: 'warn' | 'stop'; label: string; detail: string } {
  const paper = theirPaperWords(cov.record)
  if (swornMissing.length === 0) {
    return {
      severity: 'warn',
      label: `Their paper on ${jobLabel} is signed by us only and not yet relied on — proceeds as a sworn account`,
      detail: `${paper} Record the day they relied on it and what for (their notice, their pay application), and it counts as the agreement.`,
    }
  }
  return {
    severity: 'stop',
    label: `Their paper on ${jobLabel} is signed by us only, and no sworn-account basis`,
    detail: `${paper} Record that they relied on it (their notice, their pay application) with the day, or fix what the sworn account is missing: ${swornMissing.join(', ')}.`,
  }
}
