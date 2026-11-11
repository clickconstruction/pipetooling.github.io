/**
 * The bid's Files window (punch list #306, PR 5): the pure rules. The Bid Board's Links column holds five slots in one
 * order, Photos · Project folder · Plans · CountTooling · Bid submission. A blue link goes straight out, as it always
 * did. A grey icon opens this window on its row, and the photos icon always opens it, because photos live in the app.
 * Each row reads its state and offers its presses: **Open ↗** for what is there, and a press that sets or changes
 * the link in the window itself (PR 7). The project folder, the CountTooling project and the bid submission take a
 * pasted link, written to the column the bid's form writes. The project folder can also be made by the app. The
 * plans row holds the form's own plan sets field. The photos row's own rules are `bidPhotoWindow.ts`.
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
  /** The press on a row with nothing: the box for the link opens under it. */
  setLink: 'Set the link',
  /** The press on a row that has its link: the same box, holding the link the bid has now. */
  change: 'Change',
  /** The plans row's press, with sets or without: the form's plan sets field opens under it. */
  addSet: 'Add a set',
  saveLink: 'Save the link',
  saving: 'Saving…',
  makeFolder: 'Make the project folder',
  making: 'Making the folder…',
  makeFolderWhy: 'Or let the app make one in the company’s shared Drive, with the photo folder inside.',
  cancel: 'Cancel',
  done: 'Done',
  paste: 'Paste',
  /** The quiet door to the whole form, for what the window does not do: clearing a link, a second CountTooling project. */
  openEditBid: 'Open Edit bid',
  trainingWhy: 'A training account can look at a bid’s files and cannot change one.',
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
  /** Where Edit bid lands on this row's field. Null for the photos row. */
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
    ? { kind: 'folder', title: BID_FILE_TITLE.folder, there: true, line: linkedLine(drive), opens: [{ name: null, href: drive }], focus: BID_FILE_FORM_FOCUS.folder }
    : { kind: 'folder', title: BID_FILE_TITLE.folder, there: false, line: 'Not set yet', opens: [], focus: BID_FILE_FORM_FOCUS.folder }

  const sets = input.planSets.filter((s) => clean(s.link))
  const plans: BidFileRow =
    sets.length === 0
      ? { kind: 'plans', title: BID_FILE_TITLE.plans, there: false, line: 'None yet', opens: [], focus: BID_FILE_FORM_FOCUS.plans }
      : sets.length === 1
        ? { kind: 'plans', title: BID_FILE_TITLE.plans, there: true, line: sets[0]!.onBid ? linkedLine(sets[0]!.link) : sets[0]!.name, opens: [{ name: null, href: clean(sets[0]!.link) }], focus: BID_FILE_FORM_FOCUS.plans }
        : { kind: 'plans', title: BID_FILE_TITLE.plans, there: true, line: `${sets.length} ${pluralNoun(SET_NOUN, sets.length)}`, opens: sets.map((s) => ({ name: s.name, href: clean(s.link) })), focus: BID_FILE_FORM_FOCUS.plans }

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
      : { kind: 'count', title: BID_FILE_TITLE.count, there: true, line: countOpens.length === 1 ? (countOpens[0]!.name ?? 'Linked') : `${countOpens.length} ${pluralNoun(PROJECT_NOUN, countOpens.length)}`, opens: countOpens.length === 1 ? [{ name: null, href: countOpens[0]!.href }] : countOpens, focus: BID_FILE_FORM_FOCUS.count }

  const sent = clean(input.submissionLink)
  const submission: BidFileRow = sent
    ? { kind: 'submission', title: BID_FILE_TITLE.submission, there: true, line: linkedLine(sent), opens: [{ name: null, href: sent }], focus: BID_FILE_FORM_FOCUS.submission }
    : { kind: 'submission', title: BID_FILE_TITLE.submission, there: false, line: 'Nothing filed as sent yet', opens: [], focus: BID_FILE_FORM_FOCUS.submission }

  return [photos, folder, plans, count, submission]
}

/** A link kind set by pasting one address. Plans are sets, with a field of their own. */
export type PastedLinkKind = Exclude<BoardLinkKind, 'plans'>

/** The column of `bids` each pasted link is written to, the one the bid's form writes. */
export const BID_FILE_LINK_COLUMN: Record<PastedLinkKind, 'drive_link' | 'count_tooling_plans_link' | 'bid_submission_link'> = {
  folder: 'drive_link',
  count: 'count_tooling_plans_link',
  submission: 'bid_submission_link',
}

/** The words over the box a link is pasted into. */
export const BID_FILE_LINK_LABEL: Record<PastedLinkKind, string> = {
  folder: 'Link to the project folder',
  count: 'Link to the CountTooling project',
  submission: 'Link to what was sent',
}

/** What the box shows before anything is typed. */
export const BID_FILE_LINK_PLACEHOLDER: Record<PastedLinkKind, string> = {
  folder: 'https://drive.google.com/drive/folders/…',
  count: 'https://counttooling.com/?t=…',
  submission: 'https://drive.google.com/…',
}

/** The toast after a link saves. */
export const BID_FILE_LINK_SAVED: Record<PastedLinkKind, string> = {
  folder: 'The project folder is set.',
  count: 'The CountTooling project is set.',
  submission: 'The bid submission is set.',
}

/** Whether a link is a Google Drive folder, the only kind of project folder the app can file photos into. */
export function isDriveFolderLink(href: string | null | undefined): boolean {
  return /^https?:\/\/drive\.google\.com\/(?:drive\/(?:u\/\d+\/)?folders\/|open\?id=|folderview\?id=)[A-Za-z0-9_-]{10,}/i.test(clean(href))
}

/** A pasted link as the press reads it. */
export interface LinkDraft {
  /** The link as it will be written, or null while it cannot be. */
  value: string | null
  /** The press is dead: nothing typed, not a link, or the link the bid has now. */
  dead: boolean
  /** Why the press is dead, when something is typed. */
  why: string | null
  /** A caution that does not stop the save. */
  note: string | null
}

/**
 * What the box holds, judged for the press. A link starts with http:// or https://. The link the bid has now is not
 * saved again. A project folder that is not a Google Drive folder saves, with a line that photos cannot file there.
 */
export function linkDraft(kind: PastedLinkKind, raw: string, current: string | null | undefined): LinkDraft {
  const value = raw.trim()
  if (!value) return { value: null, dead: true, why: null, note: null }
  if (!/^https?:\/\/\S+$/i.test(value)) return { value: null, dead: true, why: 'A link starts with https:// and has no spaces.', note: null }
  if (value === clean(current)) return { value: null, dead: true, why: 'That is the link the bid has now.', note: null }
  const note = kind === 'folder' && !isDriveFolderLink(value) ? 'This is not a Google Drive folder. The bid’s photos cannot be filed there.' : null
  return { value, dead: false, why: null, note }
}

/** The toast after the app makes the bid's project folder. */
export function madeFolderWords(projectName: string | null | undefined): string {
  const name = clean(projectName)
  return name ? `Made the project folder: ${name}.` : 'Made the project folder.'
}

/** The window's name for a screen reader and its heading line: *Files · b598 Quarry Road Storage Bunker*. */
export function filesWindowLabel(bidLabel: string): string {
  const label = bidLabel.trim()
  return label ? `${BID_FILES_WORDS.title} · ${label}` : BID_FILES_WORDS.title
}
