/**
 * Messages, cut 6 (email in): the files and links on a line, as the thread draws them (the prototype's chips under a
 * line and the message window's Attachments, v1.159; the mock-up `email-in-mockups.html`, screens 1 to 3, on branch
 * spike/gc-mode). A `message_attachments` row read into a file: what it is, whether we kept a copy, its size in words,
 * the note the window says beside it, and the offer to file it when it reads as a trade partner's paper. Pure.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { PAPER_GUESS_WORDS, type PaperGuess } from '../emailIn/paperGuess'
import { fileHref } from '../files/fileRoute'
import type { FileIcon, FileKept, LineFile } from './lineFileTypes'

// The types live in their own file, so the thread (and the edge copy that reads it for its types) takes them without
// this file's code.
export type { FileIcon, FileKept, LineFile } from './lineFileTypes'

/** A `message_attachments` row as the client reads it, written out until the generated types carry the table. */
export interface MessageAttachmentRow {
  id: string
  message_id: string
  sort_order: number
  kind: string
  name: string
  mime: string | null
  size_bytes: number | null
  bucket_path: string | null
  left_in_gmail: string | null
  url: string | null
  host: string | null
  paper: string | null
  paper_answer: string | null
  paper_answered_by: string | null
  paper_answered_at: string | null
}

const keptOf = (r: MessageAttachmentRow): FileKept =>
  r.kind === 'link' ? 'link' : r.bucket_path ? 'copy' : r.left_in_gmail === 'too_big' ? 'tooBig' : 'notCopied'

const iconOf = (r: MessageAttachmentRow): FileIcon =>
  r.kind === 'link' ? 'link' : /pdf/i.test(r.mime ?? '') || /\.pdf$/i.test(r.name) ? 'pdf' : /^image\//i.test(r.mime ?? '') ? 'image' : 'file'

/** The rows as each line's files, in their order. */
export function lineFilesFromRows(rows: readonly MessageAttachmentRow[]): Map<string, LineFile[]> {
  const out = new Map<string, LineFile[]>()
  const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order)
  for (const r of sorted) {
    const file: LineFile = {
      id: r.id,
      name: r.name,
      mime: r.mime,
      size: r.size_bytes,
      kept: keptOf(r),
      url: r.kind === 'link' ? r.url : null,
      icon: iconOf(r),
      paper: r.paper === 'coi' || r.paper === 'w9' ? r.paper : null,
      paperAnswer: r.paper_answer === 'filed' || r.paper_answer === 'not_it' ? r.paper_answer : null,
      paperAnsweredBy: r.paper_answered_by,
      paperAnsweredAt: r.paper_answered_at,
    }
    out.set(r.message_id, [...(out.get(r.message_id) ?? []), file])
  }
  return out
}

/** Each line with its files. A line with none stays as it was. */
export function withLineFiles<M extends { id: string }>(messages: readonly M[], files: ReadonlyMap<string, readonly LineFile[]>): (M & { files?: readonly LineFile[] })[] {
  return messages.map((m) => {
    const theirs = files.get(m.id)
    return theirs ? { ...m, files: theirs } : m
  })
}

/** A size as a person reads it, in the units a Mac shows: "512 bytes", "380 KB", "1.2 MB", "31 MB". '' with none. */
export function sizeWords(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1000) return `${bytes} bytes`
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`
  if (bytes < 10_000_000) return `${(bytes / 1_000_000).toFixed(1).replace(/\.0$/, '')} MB`
  return `${Math.round(bytes / 1_000_000)} MB`
}

/** What the message window says beside a file. */
export function fileNote(file: Pick<LineFile, 'kept'>): string {
  switch (file.kept) {
    case 'copy':
      return 'our copy kept on arrival'
    case 'link':
      return 'a link, not a file'
    case 'tooBig':
      return 'too big to keep, it stays in Gmail'
    default:
      return 'not copied, it stays in Gmail'
  }
}

/** Where Open goes: our copy through the app's lasting link, a link to its own web address. Null for a file left in Gmail. */
export function fileOpenHref(file: Pick<LineFile, 'id' | 'kept' | 'url'>): string | null {
  if (file.kept === 'copy') return fileHref('messages', file.id)
  if (file.kept === 'link') return file.url && /^https?:\/\//i.test(file.url) ? file.url : null
  return null
}

export interface PaperOffer {
  paper: PaperGuess
  /** "This reads like Hillside Excavation's certificate of insurance." */
  words: string
  /**
   * The press, into the company window at that paper. A certificate is filed there by a reader who may file one; a W-9
   * waits for a W-9 save of its own, so its press only goes to the paper.
   */
  press: string
}

/**
 * The offer under a line for a file that reads as a trade partner's paper, while nobody has answered it. Only our kept
 * copy can be filed, since its lasting link is what the paper keeps. `canFile`: the reader may file a certificate (the
 * company window's Record their insurance, a dev's while GC mode is built).
 */
export function paperOffer(file: LineFile, contact: { kind: string; company: string; name: string }, canFile: boolean): PaperOffer | null {
  if (!file.paper || file.paperAnswer || file.kept !== 'copy' || contact.kind !== 'trade') return null
  const who = contact.company || contact.name
  return {
    paper: file.paper,
    words: `This reads like ${who}’s ${PAPER_GUESS_WORDS[file.paper].paper}.`,
    press: file.paper === 'w9' ? 'Go to their W-9 paper' : canFile ? PAPER_GUESS_WORDS.coi.press : 'Go to their insurance paper',
  }
}

/** Whether any of a line's files is offered, so the thread draws the offers only under those lines. */
export function hasPaperOffer(files: readonly LineFile[] | undefined, contact: { kind: string; company: string; name: string }): boolean {
  return (files ?? []).some((f) => paperOffer(f, contact, false) !== null)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Filed as their certificate · Rosa, Oct 12": a filed paper's line, once the office filed it. Null otherwise. */
export function filedWords(file: LineFile, userNames: Readonly<Record<string, string>>): string | null {
  if (file.paperAnswer !== 'filed' || !file.paper) return null
  const paper = file.paper === 'coi' ? 'their certificate' : 'their W-9'
  const ymd = file.paperAnsweredAt ? calendarYmdInAppTzFromIso(file.paperAnsweredAt) : ''
  const day = ymd ? `${MONTHS[Number(ymd.slice(5, 7)) - 1] ?? ''} ${Number(ymd.slice(8, 10))}` : ''
  const by = (file.paperAnsweredBy && userNames[file.paperAnsweredBy]) || ''
  const tail = [by, day].filter(Boolean).join(', ')
  return tail ? `Filed as ${paper} · ${tail}` : `Filed as ${paper}`
}
