/**
 * Messages → My email (punch list #230 PR 3): how the tab's list draws a mail, the mock-up's section 1
 * (`to-dos/messages-my-email/mockup.html`). A row reads its way (↓ in, ↑ out), who with the address under the name,
 * the subject over Gmail's snippet, the day as a thread list says it (`listWhen`), the files, and its last column,
 * which is the whole point: a tagged conversation's job with ✓, the app's guess with **Yes**, a mail the boxes already
 * hold on a job, or **Tag…**. The page of rows moves by Gmail's own page tokens, one page at a time, and a page the
 * view drew nothing of while Gmail holds older mail offers **Older ›** (`emptyPageWords`). The words of a tag, a move,
 * a mail put on the job and an untag are here too, said once to the person who pressed. Pure; nothing here counts, nags
 * or marks read.
 */
import type { EmptyWords } from '../emptyWords'
import { listWhen } from '../messages/listRows'
import type { MyMailJobChip, MyMailRow, MyMailTagOk, MyMailUntagOk, MyMailView } from './contract'

/** A row's last column. */
export type MyMailRowEnd =
  /** The conversation is tagged onto a job; `messageId` is this mail's line when it has one. */
  | { kind: 'tagged'; chip: MyMailJobChip; messageId: string | null }
  /** A box already holds this mail as a line on a job, so there is nothing to tag. */
  | { kind: 'inMessages'; messageId: string }
  /** The app's guess, drawn with **Yes**; never acted on alone. */
  | { kind: 'guess'; chip: MyMailJobChip; why: string }
  /** No guess: **Tag…** opens the job picker. */
  | { kind: 'tag' }

/** What a row's last column draws, in that order: the tag, a box's line on a job, the guess, else Tag…. */
export function rowEnd(row: Pick<MyMailRow, 'tagged' | 'inMessages' | 'guess'>): MyMailRowEnd {
  if (row.tagged) return { kind: 'tagged', chip: row.tagged, messageId: row.tagged.messageId }
  if (row.inMessages?.jobKey) return { kind: 'inMessages', messageId: row.inMessages.messageId }
  if (row.guess) return { kind: 'guess', chip: row.guess, why: row.guess.why }
  return { kind: 'tag' }
}

/** A job's chip: its number and its name, either alone when the other is missing. */
export function chipWords(chip: Pick<MyMailJobChip, 'num' | 'name'>): string {
  const num = chip.num.trim()
  const name = chip.name.trim()
  return num && name ? `${num} · ${name}` : num || name || 'a job'
}

/** A job in a sentence: its number as the app shows it, else its name. */
export function jobWords(chip: Pick<MyMailJobChip, 'num' | 'name'> | null | undefined): string {
  return chip?.num.trim() || chip?.name.trim() || 'the job'
}

/** Who a row is about: the other party's name (`to …` on a mail out), with the address under it when a name stands above. */
export function whoLine(row: Pick<MyMailRow, 'direction' | 'who'>): { name: string; address: string } {
  const name = row.who.name.trim()
  const address = row.who.address.trim()
  const shown = name || address || 'Unnamed'
  return { name: row.direction === 'out' ? `to ${shown}` : shown, address: name ? address : '' }
}

/** The row's way in or out, as an arrow and the words a screen reader says for it. */
export function wayOf(row: Pick<MyMailRow, 'direction'>): { arrow: string; label: string } {
  return row.direction === 'out' ? { arrow: '↑', label: 'You sent it' } : { arrow: '↓', label: 'It came in' }
}

/** How many files, in words. */
export function filesWords(n: number): string {
  return n === 1 ? '1 file' : `${n} files`
}

/** The row's day: the time today, else the day, as a thread list says it. */
export function rowDay(row: Pick<MyMailRow, 'at'>, nowIso: string): string {
  return listWhen(row.at, nowIso)
}

// ---------- the page of rows ----------

/** Gmail's page tokens the person has walked through; the last is the page shown, null for the newest. */
export type MyMailPages = readonly (string | null)[]

/** The newest page. */
export const FIRST_PAGE: MyMailPages = [null]

/** The page shown. */
export function pageToken(pages: MyMailPages): string | null {
  return pages[pages.length - 1] ?? null
}

/** Older ›: the next page, by the token the last read gave. */
export function olderPage(pages: MyMailPages, nextPageToken: string): MyMailPages {
  return [...pages, nextPageToken]
}

/** ‹ Newer: back one page, never past the newest. */
export function newerPage(pages: MyMailPages): MyMailPages {
  return pages.length > 1 ? pages.slice(0, -1) : FIRST_PAGE
}

// ---------- the words ----------

const lines = (n: number) => (n === 1 ? '1 line' : `${n} lines`)

/** What a tag put on the job: the lines it wrote and tied, and the files. */
export function onTheJobWords(ok: Pick<MyMailTagOk, 'lines' | 'tied' | 'files'>): string {
  const n = ok.lines + ok.tied
  if (n === 0) return 'Every mail in it was on the job already.'
  const files = ok.files > 0 ? ` and ${filesWords(ok.files)}` : ''
  return `${lines(n)}${files} ${n === 1 && ok.files === 0 ? 'is' : 'are'} on the job now.`
}

/** The words after a tag: the job, then what is on it now. */
export function taggedWords(ok: Pick<MyMailTagOk, 'lines' | 'tied' | 'files'>, chip?: Pick<MyMailJobChip, 'num' | 'name'> | null): string {
  return `${chip ? `Tagged onto ${jobWords(chip)}.` : 'Tagged.'} ${onTheJobWords(ok)}`
}

/**
 * The press that tagged a conversation: a first tag (**Yes**, a pick), **Another job…** on a tagged one, which moves it,
 * or **Put it on the job** on a mail of one that no line holds yet. Each is `gmail-mine`'s `tag`, safe to run again.
 */
export type MyMailTagAct = 'tag' | 'move' | 'put'

/**
 * What the green bar says a tag put on the job. A move or a put that brought no line along says nothing: the chip says
 * where the conversation is, and *every mail was on the job already* would not be true of it.
 */
export function doneWords(ok: Pick<MyMailTagOk, 'lines' | 'tied' | 'files'>, act: MyMailTagAct = 'tag'): string | null {
  return act !== 'tag' && ok.lines + ok.tied === 0 ? null : onTheJobWords(ok)
}

/** The words after a tag, by the press that made it: the job, then what is on it now, when anything came along. */
export function tagActWords(act: MyMailTagAct, ok: Pick<MyMailTagOk, 'lines' | 'tied' | 'files'>, chip?: Pick<MyMailJobChip, 'num' | 'name'> | null): string {
  if (act === 'tag') return taggedWords(ok, chip)
  const job = jobWords(chip)
  const along = doneWords(ok, act)
  if (act === 'move') return along ? `Moved to ${job}. ${along}` : `Moved to ${job}.`
  return along ? `Added to ${job}. ${along}` : `Nothing new went on ${job}.`
}

/** The words after an untag: what came off the job, and the copy a legal matter keeps. */
export function untaggedWords(ok: Pick<MyMailUntagOk, 'removed' | 'keptForMatter'>): string {
  const off = ok.removed > 0 ? `Untagged. ${lines(ok.removed)} came off the job.` : 'Untagged. Nothing came off the job.'
  return ok.keptForMatter ? `${off} The legal matter keeps its own copy.` : off
}

export const MY_MAIL_LIST_WORDS = {
  views: 'Which mail to show',
  search: 'Search my mail',
  searchHint: 'Search my mail…',
  whatItReads: 'What this reads',
  reading: 'Reading your mail…',
  notRead: 'Your mail could not be read.',
  /** A read's own words for a lost signal (`OfflineRetryPanel`'s `offlineMessage`), never the write's *nothing was saved*. */
  offline: 'No connection, so your mail could not be read. It reads again when the signal is back.',
  yes: 'Yes',
  other: 'other…',
  tag: 'Tag…',
  noGuess: 'no guess',
  openLine: 'open the line ›',
  inMessages: 'already in Messages ✓',
  show: 'show',
  hide: 'hide',
  older: 'Older ›',
  newer: '‹ Newer',
  openSettings: 'Open Your account',
  tagging: 'Tagging…',
  notTagged: 'The conversation was not tagged.',
  notMoved: 'The conversation was not moved.',
  notPutOn: 'The mail was not put on the job.',
} as const

/** Why a press of the tag did not go, when the failure brings no words of its own. */
export function notTaggedWords(act: MyMailTagAct): string {
  return act === 'move' ? MY_MAIL_LIST_WORDS.notMoved : act === 'put' ? MY_MAIL_LIST_WORDS.notPutOn : MY_MAIL_LIST_WORDS.notTagged
}

/** What a view says of a page it drew nothing of, while Gmail holds older mail. */
const EMPTY_PAGE: Readonly<Record<MyMailView, string>> = {
  toTag: 'Nothing to tag on this page.',
  tagged: 'No tagged conversations on this page.',
  all: 'Only notices and newsletters on this page.',
}

/**
 * What an empty page says while Gmail holds older mail (`nextPageToken`): the view drew nothing here, which is not the
 * end of the box, so the line offers **Older ›**, the press that fills it, in `emptyWords`' data shape. The true end,
 * with no older page, keeps the view's own words (`MY_MAIL_WORDS.empty`): To tag's *Nothing waiting to tag.* is the good
 * state only there.
 */
export function emptyPageWords(view: MyMailView): EmptyWords {
  return { main: EMPTY_PAGE[view], next: MY_MAIL_LIST_WORDS.older, tail: 'shows the next fifty mails.' }
}
