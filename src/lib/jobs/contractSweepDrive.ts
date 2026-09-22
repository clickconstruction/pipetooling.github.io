/**
 * The Contract sweep's Drive pass, in the list (Contract sweep refresh — to-dos/contract-sweep-refresh).
 *
 * Some customers already have a contract with us, sitting in the jobs Drive. The scan that finds
 * them (`drive-contract-scan` + `matchDriveContracts`) used to live in a window under ⋯; the
 * sweep now runs it when it opens and hands each row its best find, so the office confirms a
 * link instead of hunting for one. This kernel picks that one find per job and words it. It
 * only ever pre-fills: a person presses File. Pure.
 */
import { signedOnFromModified, type DriveContractMatch } from './driveContractMatch'

export type DriveFind = {
  jobId: string
  link: string
  fileName: string
  folderName: string
  confidence: 'confident' | 'check'
  /** YYYY-MM-DD from the file's last change — the best date there is for paper signed long ago; '' when unknown. */
  signedOn: string
  /** The matcher's own one line: "folder names 2100 Independence Dr · signed subcontract". */
  reason: string
}

const RANK = { confident: 2, check: 1 } as const

/** One find per job: a confident match beats a check; between equals, the newest file. Files with no link, or no job, are nobody's find. */
export function bestDriveFindByJob(matches: ReadonlyArray<DriveContractMatch>): Map<string, DriveFind> {
  const best = new Map<string, DriveFind & { modified: string }>()
  for (const m of matches) {
    if (!m.jobId || m.confidence === 'none' || !m.file.webViewLink) continue
    const modified = String(m.file.modifiedTime ?? '')
    const prev = best.get(m.jobId)
    if (prev && (RANK[prev.confidence] > RANK[m.confidence] || (RANK[prev.confidence] === RANK[m.confidence] && prev.modified >= modified))) continue
    best.set(m.jobId, {
      jobId: m.jobId,
      link: m.file.webViewLink,
      fileName: m.file.name,
      folderName: m.file.folderName,
      confidence: m.confidence,
      signedOn: signedOnFromModified(m.file.modifiedTime),
      reason: m.reason,
      modified,
    })
  }
  return new Map([...best].map(([id, { modified: _modified, ...find }]) => [id, find]))
}

/** The list chip: green when the matcher is sure, amber when a person should look. */
export function driveFindChip(find: DriveFind): { text: string; tone: 'green' | 'amber'; title: string } {
  return find.confidence === 'confident'
    ? { text: '📄 in Drive', tone: 'green', title: `Looks like their contract is already in Drive — ${find.fileName}` }
    : { text: '📄 in Drive? check', tone: 'amber', title: `A file in Drive might be their contract — ${find.fileName}. Open it before filing.` }
}

/** "14 look like they are already in Drive" — the header's clause; null when the pass found nothing (or has not run). */
/**
 * Whether a find's link may be filled in for the person. Only a confident one: a "check" find is
 * often a proposal or a neighbour's file (found live 2026-09-21 — "Plumbing Proposal REVISED.pdf"
 * in a folder 23 jobs matched), and a pre-filled link with a lit File button is one click from
 * recording the wrong paper as a signed agreement. A check find is shown; the person opens it and
 * chooses to use it.
 */
export function driveFindPrefills(find: DriveFind | undefined, accepted: boolean): boolean {
  return find != null && (find.confidence === 'confident' || accepted)
}

/** Which door the pane opens on: a row with a find, or a builder's row (their paper, not ours), starts on "we already have one". */
export type SweepDoor = 'send' | 'have'
export function defaultSweepDoor(input: { find: DriveFind | undefined; isGcRow: boolean }): SweepDoor {
  return input.find || input.isGcRow ? 'have' : 'send'
}
