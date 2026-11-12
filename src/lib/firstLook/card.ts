/**
 * First look on a thread (punch list #319 PR 1): what the look's card draws above a person's lines. One card a look
 * that is still open: who asked and when, whether the link was opened, what came in through the page, the pictures
 * and videos they texted in since the ask, their own words, and the presses. Pure: the rows are read by `threadIo.ts`
 * and drawn by `components/firstLook/FirstLookCard.tsx`.
 */
import type { ThreadMessage } from '../messages/thread'
import { driveFolderUrl, lookDriveLine } from './drive'
import { firstLookCountWords, firstLookState, type FirstLookKind } from './look'

/** A look as the thread reads it. */
export interface ThreadLook {
  id: string
  contact_id: string | null
  asked_by_name: string
  made_at: string
  expires_at: string
  opened_at: string | null
  sent_at: string | null
  looked_at: string | null
  closed_at: string | null
  place: string | null
  words: string | null
  /** The look's own folder in Drive, once the sweep has made it (PR 2). Absent on a read from before the column. */
  drive_folder_id?: string | null
}

/** A file that came in through the page, finished and not removed. */
export interface ThreadLookFile {
  id: string
  look_id: string
  kind: FirstLookKind
  mime: string
  storage_path: string
  bytes: number | null
  seconds: number | null
  finished_at: string | null
  /** Its copy in Drive, and why the last try did not file it (PR 2). Absent on a read from before the columns. */
  drive_file_id?: string | null
  fail_why?: string | null
}

/** A picture or a video they texted in, off a line of the thread. */
export interface TextedFile {
  /** The `message_attachments` row. */
  id: string
  kind: FirstLookKind
  name: string
  at: string
}

export interface LookCard {
  look: ThreadLook
  files: ThreadLookFile[]
  texted: TextedFile[]
}

/** The kind of a file that came on a line, or null for one a look does not draw (a PDF, a link, a file not copied). */
export function textedKind(file: { mime: string | null; kept: string; name: string }): FirstLookKind | null {
  if (file.kept !== 'copy') return null
  const mime = (file.mime ?? '').toLowerCase()
  if (mime.startsWith('image/')) return 'photo'
  if (mime.startsWith('video/')) return 'video'
  if (/\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name)) return 'photo'
  if (/\.(mp4|mov|m4v|webm|3gp)$/i.test(file.name)) return 'video'
  return null
}

/** The pictures and videos this person texted or emailed in at or after a moment, oldest first. */
export function textedSince(lines: ReadonlyArray<Pick<ThreadMessage, 'contactId' | 'direction' | 'at' | 'files'>>, contactId: string, sinceIso: string): TextedFile[] {
  const since = Date.parse(sinceIso)
  const out: TextedFile[] = []
  for (const m of lines) {
    if (m.contactId !== contactId || m.direction !== 'in' || !m.files?.length) continue
    if (!(Date.parse(m.at) >= since)) continue
    for (const f of m.files) {
      const kind = textedKind(f)
      if (kind) out.push({ id: f.id, kind, name: f.name, at: m.at })
    }
  }
  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

/**
 * The cards a thread draws, newest ask first. A closed look draws none. The newest look still taking files always
 * draws, so the office sees the ask is out. An older one draws only while it holds something, so a second ask does not
 * leave an empty card behind. A texted picture belongs to the newest look asked before it came.
 */
export function lookCards(
  looks: readonly ThreadLook[],
  files: readonly ThreadLookFile[],
  lines: ReadonlyArray<Pick<ThreadMessage, 'contactId' | 'direction' | 'at' | 'files'>>,
  contactId: string,
  nowIso: string,
): LookCard[] {
  const open = looks.filter((l) => l.contact_id === contactId && !l.closed_at).sort((a, b) => Date.parse(b.made_at) - Date.parse(a.made_at))
  const cards: LookCard[] = []
  open.forEach((look, i) => {
    const newer = open[i - 1]
    const texted = textedSince(lines, contactId, look.made_at).filter((t) => !newer || Date.parse(t.at) < Date.parse(newer.made_at))
    const mine = files.filter((f) => f.look_id === look.id && f.finished_at)
    const taking = firstLookState(look, nowIso) === 'open'
    if (mine.length + texted.length === 0 && !(i === 0 && taking)) return
    cards.push({ look, files: mine, texted })
  })
  return cards
}

export const LOOK_CARD_WORDS = {
  title: 'First look',
  startEstimate: 'Start an estimate',
  bookVisit: 'Book a visit',
  close: 'Close the look',
  closeTip: 'Takes the card off the thread and stops the link. The photos stay with the look.',
  closeAsk: 'Close this look? The card leaves the thread and the link stops taking photos.',
  closed: 'The look is closed.',
  nameFirst: 'Name them to start an estimate or book a visit. Press Who is this?',
  texted: 'texted in',
  theirWords: 'They wrote',
  notDrawn: 'This file did not open. Try Read again in a minute.',
  videoNotPlayed: 'This browser cannot play the video. Open it to save and play it.',
  open: 'Open',
} as const

/** *Asked Nov 12 by Rosa*, the day in words the caller formats. */
export function lookAskedWords(look: Pick<ThreadLook, 'asked_by_name'>, dayWords: string): string {
  const who = look.asked_by_name.trim()
  return who ? `Asked ${dayWords} by ${who}` : `Asked ${dayWords}`
}

/** How many of each kind a card holds, the page's files and the texted ones together. */
export function lookCounts(card: Pick<LookCard, 'files' | 'texted'>): { photos: number; videos: number } {
  const all = [...card.files, ...card.texted]
  return { photos: all.filter((f) => f.kind === 'photo').length, videos: all.filter((f) => f.kind === 'video').length }
}

/**
 * Where the look stands, in one line: what is in, else whether the link was opened, else that the link ran out. A file
 * in with no Send says so, since the customer may have closed the page before pressing it.
 */
export function lookStanding(card: LookCard, nowIso: string, opened: (iso: string) => string): string {
  const { photos, videos } = lookCounts(card)
  const count = firstLookCountWords(photos, videos)
  if (count) {
    const waits = card.files.length > 0 && !card.look.sent_at ? ' They have not pressed Send yet.' : ''
    return `${count} in.${waits}`
  }
  if (firstLookState(card.look, nowIso) === 'expired') return 'The link ran out with nothing sent. Ask again to send a new one.'
  if (card.look.opened_at) return `They opened the link ${opened(card.look.opened_at)}. Nothing sent yet.`
  return 'Nothing in yet. They have not opened the link.'
}

/** What a look gives the two doors: their own words from the page, else the newest words they wrote. */
export function lookWordsFor(look: Pick<ThreadLook, 'words' | 'place'>, newestInbound: string | null): string | null {
  const theirs = look.words?.trim()
  if (theirs) return look.place?.trim() ? `${look.place.trim()}: ${theirs}` : theirs
  return newestInbound
}

/** The card's Drive line for the page's own files: where they are kept, or why they are not there yet (PR 2). */
export function lookCardDriveLine(card: Pick<LookCard, 'look' | 'files'>, hasCustomer: boolean): { words: string; href: string | null } | null {
  const filed = card.files.filter((f) => f.drive_file_id).length
  const failWhy = card.files.find((f) => !f.drive_file_id && f.fail_why)?.fail_why ?? null
  return lookDriveLine({ total: card.files.length, filed, folderUrl: card.look.drive_folder_id ? driveFolderUrl(card.look.drive_folder_id) : null, hasCustomer, failWhy })
}

/** The estimate's strip (PR 5): whose look it is and when it was asked. */
export const LOOK_STRIP_WORDS = {
  head: 'Photos the customer sent',
  /** What the customer reads on a price made from their photos (the owner's call 7). */
  pricedFromPhotos: 'Priced from your photos. The tech confirms the price at your home before any work starts.',
} as const
