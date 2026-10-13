/**
 * Messages, cut 7f: the files on a line we sent, as the thread and the message window show them (the mock-up
 * `files-out-mockups.html`, screen 6, on branch spike/gc-mode). Each is marked how it went (cut 7a's `sent_as`): the
 * file, the picture, our link to their portal, or our link to the file. Our own link shows its opens, the time of each,
 * newest first, never who (`drive_link_views`), and can be cut off (`cut_drive_link`). A link to their portal opens with
 * the portal's own link, which is cut off from the company window, so it has neither here. Pure.
 */
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { driveOf, sizeWords } from './lineFiles'
import type { LineFile } from './lineFileTypes'
import { chicagoDay, clockTime } from './thread'

/** How a file on a line we sent went. */
export type SentWay = 'file' | 'picture' | 'portal' | 'own'

export const SENT_WORDS: Readonly<Record<SentWay, string>> = {
  file: 'sent as the file',
  picture: 'sent as the picture',
  portal: 'sent as our link to their portal',
  own: 'sent as our link to the file',
}

/** How the file went, or null for a file that came in. A link with our link's row is our own; one without is their portal. */
export function sentWay(f: LineFile): SentWay | null {
  const d = driveOf(f)
  if (!d.sentAs) return null
  if (d.sentAs === 'link') return d.driveLinkId ? 'own' : 'portal'
  return d.sentAs
}

/** Our own link as the office reads it back: cut off or ended, and its opens, newest first. */
export interface OwnLinkState {
  cutAt: string | null
  cutByName: string | null
  endsAt: string
  openedAt: readonly string[]
  /** All the opens; `openedAt` holds the newest 50. */
  opens: number
}

const DAY = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, weekday: 'short', month: 'short', day: 'numeric' })

/** "Mon Oct 12": a day as a row says it. */
export function shortDay(iso: string): string {
  return DAY.format(new Date(iso)).replace(',', '')
}

/** One open's time: "today 2:10 PM", or "Fri Oct 9, 4:42 PM". */
export function openWhen(atIso: string, nowIso: string): string {
  return chicagoDay(atIso) === chicagoDay(nowIso) ? `today ${clockTime(atIso)}` : `${shortDay(atIso)}, ${clockTime(atIso)}`
}

const TIMES = ['', 'once', 'twice']

/** "opened twice, last 2:10 PM": the day in place of the time when the last was not today. "not opened yet" with none. */
export function opensWords(state: Pick<OwnLinkState, 'opens' | 'openedAt'>, nowIso: string): string {
  const last = state.openedAt[0]
  if (!state.opens || !last) return 'not opened yet'
  const times = TIMES[state.opens] ?? `${state.opens} times`
  const when = chicagoDay(last) === chicagoDay(nowIso) ? clockTime(last) : shortDay(last)
  return `opened ${times}, last ${when}`
}

/** Each open's time, newest first: "Opens: today 2:10 PM · Fri Oct 9, 4:42 PM". Null with none. */
export function opensList(state: Pick<OwnLinkState, 'openedAt'>, nowIso: string): string | null {
  return state.openedAt.length ? `Opens: ${state.openedAt.map((at) => openWhen(at, nowIso)).join(' · ')}` : null
}

/** Why our link opens nothing now: cut off by someone, or ended. Null while it opens. */
export function linkOff(state: Pick<OwnLinkState, 'cutAt' | 'cutByName' | 'endsAt'>, nowIso: string): string | null {
  if (state.cutAt) return `cut off${state.cutByName ? ` by ${state.cutByName}` : ''} ${shortDay(state.cutAt)} · our link opens nothing now`
  if (Date.parse(state.endsAt) <= Date.parse(nowIso)) return `ended ${shortDay(state.endsAt)} · our link opens nothing now`
  return null
}

/** Whether the office can cut our link off: our own, and still opening. */
export function canCut(f: LineFile, state: OwnLinkState | null | undefined, nowIso: string): boolean {
  return sentWay(f) === 'own' && Boolean(state) && linkOff(state!, nowIso) === null
}

/** Their portal's opens since a line we sent carried a link to it (`portal_opens_since`): how many, and the last. */
export interface PortalOpens {
  opens: number
  lastOpenedAt: string | null
}

/**
 * "they opened their portal twice since, last Mon Oct 12 at 2:10 PM". A portal's views are the whole portal's, so this
 * says how often they opened their portal since the line went, never that they opened the one file.
 */
export function portalOpensWords(p: PortalOpens): string {
  if (!p.opens || !p.lastOpenedAt) return 'they have not opened their portal since'
  const times = TIMES[p.opens] ?? `${p.opens} times`
  return `they opened their portal ${times} since, last ${shortDay(p.lastOpenedAt)} at ${clockTime(p.lastOpenedAt)}`
}

/** A chip's words under a line we sent: its name and how it went. */
export function sentChipWords(f: LineFile): string | null {
  const way = sentWay(f)
  return way ? SENT_WORDS[way] : null
}

/** The message window's words beside a file on a line we sent. A link to their portal says their opens since, once read. */
export function sentRowNote(f: LineFile, state: OwnLinkState | null | undefined, nowIso: string, portal?: PortalOpens | null): string {
  const way = sentWay(f)
  if (!way) return ''
  if (way === 'file' || way === 'picture') return [sizeWords(f.size), SENT_WORDS[way], 'kept with the copy'].filter(Boolean).join(' · ')
  if (way === 'portal') return portal ? `${SENT_WORDS.portal} · ${portalOpensWords(portal)}` : SENT_WORDS.portal
  if (!state) return SENT_WORDS.own
  const off = linkOff(state, nowIso)
  return off ?? `${SENT_WORDS.own} · ${opensWords(state, nowIso)}`
}
