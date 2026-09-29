/**
 * The bid's plans folder (v2.4162): where an estimator puts the plans so the robots can read
 * them, and how the app helps — the division bid folder to open, the name to copy, and the
 * lookup by that name that fills the link in. Plans are always a Drive link, never an
 * upload (the owner, 2026-09-29).
 *
 * The house rule for the folder's name is the job folder's (`jobFolderName`: the project
 * name), so a bid's plans folder and the job folder drive-intake makes later are the same
 * name. The three division folders are the office's — shared with the robots once, every
 * folder made inside them is readable without a share step.
 */
import { jobFolderName } from '../../../supabase/functions/_shared/submittalDriveNames'

export type DivisionKey = 'plumbing' | 'electrical' | 'hvac'

export type DivisionBidFolder = { key: DivisionKey; label: string; folderId: string; url: string }

export function driveFolderUrl(id: string): string {
  return `https://drive.google.com/drive/folders/${id}`
}

/** The office's three bid folders, one per division (the links the bid form has carried since the Project Folder field). */
export const DIVISION_BID_FOLDERS: ReadonlyArray<DivisionBidFolder> = [
  { key: 'plumbing', label: 'plumbing', folderId: '1HRAnLDgQ-0__1o4umf59w6zpfW3rFvtB', url: driveFolderUrl('1HRAnLDgQ-0__1o4umf59w6zpfW3rFvtB') },
  { key: 'electrical', label: 'electrical', folderId: '10gkh2r2xtyy2vlT3p_HnqgJI28vNN1q2', url: driveFolderUrl('10gkh2r2xtyy2vlT3p_HnqgJI28vNN1q2') },
  { key: 'hvac', label: 'HVAC', folderId: '1PU1lRZOxSwm--bCQ1LcQ7eXYu5GTDKOL', url: driveFolderUrl('1PU1lRZOxSwm--bCQ1LcQ7eXYu5GTDKOL') },
]

/** The division folder a service type's bids live in; null until a service type is picked or when it is none of the three. */
export function divisionBidFolderFor(serviceTypeName: string | null | undefined): DivisionBidFolder | null {
  const n = (serviceTypeName ?? '').trim().toLowerCase()
  if (!n) return null
  if (/plumb/.test(n)) return DIVISION_BID_FOLDERS[0]!
  if (/electric/.test(n)) return DIVISION_BID_FOLDERS[1]!
  if (/hvac|heat|air/.test(n)) return DIVISION_BID_FOLDERS[2]!
  return null
}

/** The name the estimator copies and gives the folder: the project name, the way the job folder is named. */
export function bidPlansFolderName(bid: { project_name: string | null; bid_number: string | null; id: string }): string {
  return jobFolderName(bid)
}

/** What `plan-fetch` answers a `find_folder` ask with. */
export type FindFolderResult = { found: true; id: string; link: string; pdfs: number } | { found: false }

/** The line under Find, in plain words. */
export function findFolderWords(r: FindFolderResult | { error: string }, name: string): string {
  if ('error' in r) return `Could not look just now: ${r.error}. Tap Find again.`
  if (!r.found) return `Not there yet. Is the folder named exactly “${name}”, inside the division folder? Make it, then tap Find again.`
  return r.pdfs === 0 ? 'Found the folder. It has no PDF in it yet. Put the plans in, then tap Find again.' : `Found the folder · ${r.pdfs} PDF${r.pdfs === 1 ? '' : 's'}. The link is filled in.`
}

/**
 * The live plumbing bids the robots are waiting on for plans (v2.4165): unsent, not opted
 * out, in a division the robots bid, with no plans link. The Bid Board's waiting line
 * counts them; the Robot Board lists them with their doors.
 */
export function plansWaitingBids<B extends { bid_date_sent: string | null; plans_link: string | null; service_type_id: string | null; project_name?: string | null; robot_opt_out?: boolean | null; outcome?: string | null; working_board_archived_at?: string | null }>(
  bids: ReadonlyArray<B>,
  serviceTypes: ReadonlyArray<{ id: string; name: string }>,
): B[] {
  const plumbing = new Set(serviceTypes.filter((st) => /plumb/i.test(st.name)).map((st) => st.id))
  // Live the way `isShadowEligibleLiveBid` reads it, minus the plans link: unsent, undecided, not archived off
  // the working board, not a "ZZ " sandbox bid, not opted out — and plumbing, the division the robots bid.
  return bids.filter(
    (b) =>
      !b.bid_date_sent &&
      !b.outcome &&
      !b.working_board_archived_at &&
      !/^zz /i.test((b.project_name ?? '').trimStart()) &&
      !b.robot_opt_out &&
      !!b.service_type_id &&
      plumbing.has(b.service_type_id) &&
      !(b.plans_link ?? '').trim(),
  )
}

/** The line on the Bid Board, in plain words. */
export function plansWaitingWords(n: number): string {
  return `${n} bid${n === 1 ? ' is' : 's are'} waiting on plans. Put the PDF in ${n === 1 ? 'its' : 'each one’s'} folder and a robot prices ${n === 1 ? 'it' : 'each one'} tonight. About a minute each.`
}
