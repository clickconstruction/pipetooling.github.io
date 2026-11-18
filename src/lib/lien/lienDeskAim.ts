/**
 * The job a Lien desk address names, and whether its list holds it.
 *
 * `/lien-desk?tab=affidavits&job=<id>` asks one paper list to open on one job. Each list used to answer a job it
 * did not hold with its own first row: the address lost `job`, another job's pane opened and nothing said so, and
 * a press in that pane (the last day of work, a send, a signature) would land on the wrong job. A job is off a
 * list for ordinary reasons. Its day is further out than the desk's thirty days with no paper started, it was paid,
 * it is off the lien path, or the link is old.
 *
 * So the address is read as an aim: a paper list and a job. While the list holds the job the aim is spent and the
 * list goes on as it always did. While it does not, the desk opens no job on that list, says the job is not on it
 * and offers the list it is on and its Lien window. The address keeps `job` as long as that note stands, so a
 * reload says the same thing, and loses it when the reader picks a row or leaves the list. The other views (To do,
 * By date, By job) have no pane a job opens in: a job named there is no aim and the address drops it.
 *
 * Pure: the desk hands in what it holds and draws what comes back.
 */
import type { EmptyStateWords } from '../emptyWords'
import type { LienDeskKind } from './lienDeskRoute'

/** The three lists under By paper: the only views with a pane a job opens in. */
export type LienDeskPaperKind = 'notice' | 'affidavit' | 'retainage'

/** The lists in the order the desk draws their tabs. */
export const LIEN_DESK_PAPER_KINDS: ReadonlyArray<LienDeskPaperKind> = ['notice', 'affidavit', 'retainage']

/** Each list by the name on its tab. */
export const LIEN_DESK_PAPER_LIST_NAME: Record<LienDeskPaperKind, string> = {
  notice: 'Monthly notices',
  affidavit: 'Lien affidavits',
  retainage: 'Retainage notices',
}

/** One list and the job the address asked it to open on. */
export type LienDeskAim = { kind: LienDeskPaperKind; jobId: string }

/** The aim an address names: a job on one of the three paper lists. Null on a view with no pane, and with no job. */
export function lienDeskAimFrom(kind: LienDeskKind | null | undefined, jobId: string | null | undefined): LienDeskAim | null {
  const id = (jobId ?? '').trim()
  if (!id) return null
  if (kind !== 'notice' && kind !== 'affidavit' && kind !== 'retainage') return null
  return { kind, jobId: id }
}

export type LienDeskAimRead =
  /** No aim, the reader is on another view, or the reader picked another row: the list goes on by its own rules. */
  | { state: 'none' }
  /** The lists are not read yet: nothing is decided and the address is left alone. */
  | { state: 'waiting' }
  /** The list holds the job: it opens, and the aim is spent. */
  | { state: 'on_list' }
  /** The list does not hold the job: no job opens, and `elsewhere` names the other lists that hold it, in tab order. */
  | { state: 'off_list'; kind: LienDeskPaperKind; jobId: string; elsewhere: LienDeskPaperKind[] }

/**
 * Where the aim stands. `kind` is the view the desk shows, `picked` the job picked on the aimed list (null for
 * none), `loaded` whether the desk's rows are in, and `lists` every job each list holds, whatever pile or find
 * narrows what is drawn.
 */
export function readLienDeskAim(input: {
  aim: LienDeskAim | null
  kind: string
  picked: string | null
  loaded: boolean
  lists: Readonly<Record<LienDeskPaperKind, ReadonlyArray<string>>>
}): LienDeskAimRead {
  const { aim, kind, picked, loaded, lists } = input
  if (!aim || kind !== aim.kind) return { state: 'none' }
  // A row the reader picked since is theirs: the aim no longer speaks for the list.
  if (picked != null && picked !== aim.jobId) return { state: 'none' }
  if (!loaded) return { state: 'waiting' }
  if (lists[aim.kind].includes(aim.jobId)) return { state: 'on_list' }
  return { state: 'off_list', kind: aim.kind, jobId: aim.jobId, elsewhere: LIEN_DESK_PAPER_KINDS.filter((k) => k !== aim.kind && lists[k].includes(aim.jobId)) }
}

/** The aim is spent: the desk forgets it, so a job that later leaves its list is the list's own business again. */
export function lienDeskAimSpent(read: LienDeskAimRead): boolean {
  return read.state === 'none' || read.state === 'on_list'
}

/** The job the address carries for the aim: the aimed job while the note stands, else null for the list's own rule. */
export function lienDeskAimAddressJob(read: LienDeskAimRead): string | null {
  return read.state === 'off_list' ? read.jobId : null
}

/**
 * The note in the pane's place. `label` is the job as the desk names it, empty when the desk holds no row for it.
 * The first press is the list the job is on when there is one, and the job's Lien window is always offered.
 */
export function lienDeskOffListWords(
  read: Extract<LienDeskAimRead, { state: 'off_list' }>,
  label: string,
  doors: { onOpenList: (kind: LienDeskPaperKind) => void; onOpenLienWindow: () => void },
): EmptyStateWords {
  const who = label.trim() || 'The job this link names'
  const main = `${who} is not on the ${LIEN_DESK_PAPER_LIST_NAME[read.kind]} list.`
  const lienWindow = { label: 'Open its Lien window ›', onPress: doors.onOpenLienWindow }
  const other = read.elsewhere[0]
  if (!other) return { main, next: lienWindow, tail: 'shows where it stands.' }
  return { main, next: { label: `Open it on ${LIEN_DESK_PAPER_LIST_NAME[other]} ›`, onPress: () => doors.onOpenList(other) }, orNext: lienWindow }
}
