/**
 * The bid's Files window (punch list #306, PR 5): the pure rules. The Bid Board's Links column holds five slots in one
 * order, Photos · Project folder · Plans · CountTooling · Bid submission. A blue link goes straight out, as it always
 * did. A grey icon opens this window on its row, and the photos icon always opens it, because photos live in the app.
 * Each row reads its state and offers its press: **Open ↗** for what is there, and for what is not, the door into
 * Edit bid landed on the field that sets it. The photos row's own rules are `bidPhotoWindow.ts`.
 */
import { pluralNoun } from '../batchWords'
import { BOARD_LINK_ORDER, type BoardLinkKind } from './bidBoardLinkSlots'
import type { BidFormFocus } from './bidFormFocus'
import type { PlanSetItem } from './bidPlanSets'

/** A row of the window: the photos, or one of the four link kinds. */
export type BidFileKind = 'photos' | BoardLinkKind

/** The rows top to bottom, the column's own order. */
export const BID_FILE_ORDER: readonly BidFileKind[] = ['photos', ...BOARD_LINK_ORDER]

const PHOTO_NOUN = ['photo', 'photos'] as const
const SET_NOUN = ['set', 'sets'] as const
const PROJECT_NOUN = ['project', 'projects'] as const

export const BID_FILES_WORDS = {
  title: 'Files',
  open: 'Open ↗',
  /** The press on a row with nothing: it opens Edit bid on the field. The gear on the board is named Edit bid. */
  setOnBid: 'Set it in Edit bid',
  addPhotos: 'Add photos',
  showPhotos: 'Show the photos',
  close: 'Close',
} as const

/** Each row's name, as the bid's form names the field. */
export const BID_FILE_TITLE: Record<BidFileKind, string> = {
  photos: 'Photos',
  folder: 'Project folder',
  plans: 'Plans',
  count: 'CountTooling',
  submission: 'Bid submission',
}

/** The name a grey icon wears on hover and to a screen reader: what the bid does not have yet. */
export const BOARD_LINK_MISSING_TITLE: Record<BoardLinkKind, string> = {
  folder: 'No project folder yet',
  plans: 'No plans yet',
  count: 'No CountTooling project yet',
  submission: 'No bid submission yet',
}

/** Where Edit bid lands to set a link the bid does not have. */
export const BID_FILE_FORM_FOCUS: Record<BoardLinkKind, BidFormFocus> = {
  folder: 'driveLink',
  plans: 'plansLink',
  count: 'countLink',
  submission: 'submissionLink',
}

/** One thing a row opens: a set of plans, a CountTooling project, the folder. */
export interface BidFileOpen {
  /** What it is, when the row holds more than one: the set's name, the project's name. Null for a row's only link. */
  name: string | null
  href: string
}

export interface BidFileRow {
  kind: BidFileKind
  title: string
  /** Whether the bid has it: blue on the board, and the row offers Open. */
  there: boolean
  /** The row's state in a few words: *12 photos*, *3 sets*, *Not set yet*. */
  line: string
  /** What the row opens, in order. Empty for the photos row and for a row with nothing. */
  opens: BidFileOpen[]
  /** Where Edit bid lands to set it. Null for the photos row and for a row that has its link. */
  focus: BidFormFocus | null
}

/** Where a link leads, in a word a person knows: *Google Drive*, *CountTooling*, or the site's name. */
export function linkPlaceWords(href: string | null | undefined): string | null {
  const raw = (href ?? '').trim()
  if (!raw) return null
  let host: string
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
  if (!host) return null
  if (host === 'drive.google.com' || host === 'docs.google.com') return 'Google Drive'
  if (host === 'counttooling.com' || host.endsWith('.counttooling.com')) return 'CountTooling'
  if (host.endsWith('dropbox.com')) return 'Dropbox'
  return host
}

function linkedLine(href: string): string {
  const place = linkPlaceWords(href)
  return place ? `Linked · ${place}` : 'Linked'
}

/** The photos row's line: *None yet*, *12 photos*, or nothing while the count has not read. */
export function photosRowLine(count: number | null | undefined): string {
  if (count == null || !Number.isFinite(count)) return ''
  const n = Math.max(0, Math.floor(count))
  return n === 0 ? 'None yet' : `${n} ${pluralNoun(PHOTO_NOUN, n)}`
}

export interface BidFilesInput {
  /** How many photos the bid has; null while the count has not read. */
  photoCount: number | null | undefined
  driveLink: string | null | undefined
  /** The bid's plan sets as the board reads them (`planSetsForBid`). */
  planSets: ReadonlyArray<Pick<PlanSetItem, 'name' | 'link' | 'onBid'>>
  countLink: string | null | undefined
  /** Every CountTooling project behind the bid's counts, the bid's own link among them or not. */
  countSources?: ReadonlyArray<{ link: string; project_name: string | null }>
  submissionLink: string | null | undefined
}

const clean = (s: string | null | undefined): string => (s ?? '').trim()

/** The five rows of a bid's Files window, in the column's order. */
export function bidFileRows(input: BidFilesInput): BidFileRow[] {
  const photoCount = input.photoCount != null && Number.isFinite(input.photoCount) ? Math.max(0, Math.floor(input.photoCount)) : null
  const photos: BidFileRow = { kind: 'photos', title: BID_FILE_TITLE.photos, there: (photoCount ?? 0) > 0, line: photosRowLine(photoCount), opens: [], focus: null }

  const drive = clean(input.driveLink)
  const folder: BidFileRow = drive
    ? { kind: 'folder', title: BID_FILE_TITLE.folder, there: true, line: linkedLine(drive), opens: [{ name: null, href: drive }], focus: null }
    : { kind: 'folder', title: BID_FILE_TITLE.folder, there: false, line: 'Not set yet', opens: [], focus: BID_FILE_FORM_FOCUS.folder }

  const sets = input.planSets.filter((s) => clean(s.link))
  const plans: BidFileRow =
    sets.length === 0
      ? { kind: 'plans', title: BID_FILE_TITLE.plans, there: false, line: 'None yet', opens: [], focus: BID_FILE_FORM_FOCUS.plans }
      : sets.length === 1
        ? { kind: 'plans', title: BID_FILE_TITLE.plans, there: true, line: sets[0]!.onBid ? linkedLine(sets[0]!.link) : sets[0]!.name, opens: [{ name: null, href: clean(sets[0]!.link) }], focus: null }
        : { kind: 'plans', title: BID_FILE_TITLE.plans, there: true, line: `${sets.length} ${pluralNoun(SET_NOUN, sets.length)}`, opens: sets.map((s) => ({ name: s.name, href: clean(s.link) })), focus: null }

  const countOpens: BidFileOpen[] = []
  const own = clean(input.countLink)
  const sources = input.countSources ?? []
  if (own) countOpens.push({ name: clean(sources.find((s) => clean(s.link) === own)?.project_name) || null, href: own })
  for (const src of sources) {
    const href = clean(src.link)
    if (!href || countOpens.some((o) => o.href === href)) continue
    countOpens.push({ name: clean(src.project_name) || 'Another project', href })
  }
  if (countOpens.length > 1 && countOpens[0]!.name == null) countOpens[0] = { ...countOpens[0]!, name: 'The bid’s own project' }
  const count: BidFileRow =
    countOpens.length === 0
      ? { kind: 'count', title: BID_FILE_TITLE.count, there: false, line: 'Not linked yet', opens: [], focus: BID_FILE_FORM_FOCUS.count }
      : { kind: 'count', title: BID_FILE_TITLE.count, there: true, line: countOpens.length === 1 ? (countOpens[0]!.name ?? 'Linked') : `${countOpens.length} ${pluralNoun(PROJECT_NOUN, countOpens.length)}`, opens: countOpens.length === 1 ? [{ name: null, href: countOpens[0]!.href }] : countOpens, focus: null }

  const sent = clean(input.submissionLink)
  const submission: BidFileRow = sent
    ? { kind: 'submission', title: BID_FILE_TITLE.submission, there: true, line: linkedLine(sent), opens: [{ name: null, href: sent }], focus: null }
    : { kind: 'submission', title: BID_FILE_TITLE.submission, there: false, line: 'Nothing filed as sent yet', opens: [], focus: BID_FILE_FORM_FOCUS.submission }

  return [photos, folder, plans, count, submission]
}

/** The sentence under a row with nothing: what sets it, by the form's own names. */
export function missingRowWords(kind: BoardLinkKind): string {
  switch (kind) {
    case 'folder':
      return 'Paste the folder’s link on the bid, under Files & links.'
    case 'plans':
      return 'Add a set of plans on the bid, under Plans.'
    case 'count':
      return 'Paste the CountTooling project’s link on the bid, under Files & links.'
    case 'submission':
      return 'Paste the link to what was sent on the bid, under Files & links.'
  }
}

/** The window's name for a screen reader and its heading line: *Files · b598 Quarry Road Storage Bunker*. */
export function filesWindowLabel(bidLabel: string): string {
  const label = bidLabel.trim()
  return label ? `${BID_FILES_WORDS.title} · ${label}` : BID_FILES_WORDS.title
}
