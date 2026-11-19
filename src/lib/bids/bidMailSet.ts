/**
 * A mail's files kept as a set of plans on a bid (punch list #368, PR 2): the words and the rules of the press
 * **Keep its files on the bid…**. An addendum or a revised spec reaches a bid by mail; the press files what the mail
 * carries into the bid's own Drive folder under Plans and adds a set to the bid (`bid-plan-set-files`, PR 1). This
 * kernel says what the mail offers (a press, a *kept* mark, or nothing), fills the form from the mail, names what the
 * button will do with its count, and says what became of the files afterwards. A file we hold no copy of is named
 * and held, and never stops the rest. A file is *kept* by its own row's mark (`message_attachments.bid_plan_set_id`),
 * which the function writes only once the file is in the folder. Pure; the io is `bidMailSetIo.ts`, the press is
 * `components/bids/BidMailSetDoor.tsx`.
 */
import { countedLabel } from '../batchWords'
import { nameFromSubject } from '../papers/papers'
import { fileAgainLabel } from '../plans/planSetFiles'
import { calendarYmdInAppTzFromIso, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import { sizeWords } from '../messages/lineFiles'
import { planSetDateWords, type BidPlanSetRow } from './bidPlanSets'

/** A row of `message_attachments` as the press reads it. The last two columns are optional: a read may leave them out. */
export type BidMailFileRow = {
  id: string
  name: string
  mime: string | null
  kind: string
  bucket_path: string | null
  left_in_gmail: string | null
  size_bytes?: number | null
  bid_plan_set_id?: string | null
}

/** One of the mail's files: our copy or why it stayed in Gmail, and the set it is already filed in. */
export type BidMailFile = { id: string; name: string; mime: string | null; size: number | null; copied: boolean; leftWhy: string | null; setId: string | null }

/** The mail's files, a link left out: a link has no bytes to file. */
export function bidMailFiles(rows: ReadonlyArray<BidMailFileRow>): BidMailFile[] {
  return rows.filter((r) => r.kind === 'file').map((r) => ({ id: r.id, name: r.name, mime: r.mime, size: r.size_bytes ?? null, copied: Boolean(r.bucket_path), leftWhy: r.left_in_gmail, setId: r.bid_plan_set_id ?? null }))
}

/** *image001.png*: the picture an email program puts inside the mail's words, most often the logo in a signature. */
const SIGNATURE_PICTURE = /^image\d{0,4}\.(png|jpe?g|gif|bmp)$/i

/**
 * Gmail's picture of a Google Drive link: a long Google key, the size it was drawn at, and a picture's extension,
 * *<key>=w1200-h630-p.png*. The key is one run of letters, digits, dashes and underscores, so a name a person typed
 * (a space, a short word before the *=*) is still a file.
 */
const LINK_PREVIEW_PICTURE = /^[\w-]{20,}=w\d{2,5}-h\d{2,5}(-[a-z0-9]{1,8})*\.(png|jpe?g|gif|webp|bmp)$/i

/**
 * A picture an email program put inside the mail's words, by its name alone. Two kinds: the logo in a signature
 * (*image001.png*, v2.7556, found on the first look at real mail: most mail carries one), and the picture Gmail
 * draws of a Drive link beside the link itself (*<key>=w1200-h630-p.png*, v2.7954, found on job mail whose only
 * content was the link). Either sits on the line as a file like any other, and neither is a set of plans or a
 * paper. A mail that carries nothing else offers no press, and beside a real file it starts unticked. A person
 * can still tick it.
 */
export function isInlinePicture(f: { name: string }): boolean {
  const name = f.name.trim()
  return SIGNATURE_PICTURE.test(name) || LINK_PREVIEW_PICTURE.test(name)
}

/**
 * What the mail offers.
 *  - `none`: the mail carries no file, or nothing but a signature's picture or a Drive link's preview. It is already on the bid's history, and there is nothing to keep.
 *  - `keep`: at least one file we hold is in no set yet. The press shows.
 *  - `kept`: every file we hold is in a set. The mail says so, with the door to the set.
 *  - `left`: the mail has files and we hold a copy of none, so nothing can be filed. It says why.
 */
export type BidMailState =
  | { kind: 'none' }
  | { kind: 'keep'; ready: BidMailFile[]; kept: BidMailFile[]; left: BidMailFile[] }
  | { kind: 'kept'; kept: BidMailFile[]; left: BidMailFile[] }
  | { kind: 'left'; left: BidMailFile[] }

export function bidMailState(files: ReadonlyArray<BidMailFile>): BidMailState {
  if (files.length === 0) return { kind: 'none' }
  const kept = files.filter((f) => f.setId !== null)
  const ready = files.filter((f) => f.setId === null && f.copied)
  const left = files.filter((f) => f.setId === null && !f.copied)
  if (ready.some((f) => !isInlinePicture(f))) return { kind: 'keep', ready, kept, left }
  if (kept.length > 0) return { kind: 'kept', kept, left }
  return left.length > 0 ? { kind: 'left', left } : { kind: 'none' }
}

/** The press on the mail, wherever the mail is read. */
export const KEEP_ON_BID_LABEL = 'Keep its files on the bid…'
export const KEEP_ON_BID_TIP = 'Files what this email carries in the bid’s Drive folder, under Plans, and adds it to the bid as a set of plans.'

/** A link the app can file into is a Drive folder; a set whose link is a single file or another site's page is not offered. */
export function isDriveFolderLink(link: string | null | undefined): boolean {
  return /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/[\w-]{20,}/.test(link ?? '')
}

/** Where the files go: a new set, or one of the bid's sets by its id. */
export const INTO_NEW = 'new'

export type BidMailDraft = { into: string; name: string; planDate: string; memo: string; picked: string[] }

/**
 * Who wrote the mail, from the line's who words: the part before *to*. The company boxes' reader writes the sender as
 * the mail's own From, *Dana Whitfield <dana@ridgeway.example> to bids@*, so the address in angle brackets and any
 * quotes around the name come off (v2.7556, found on the first live look). A From with no name reads as its address.
 */
export function mailSender(who: string | null | undefined): string {
  const from = (who ?? '').split(/\s+to\s+/)[0]!.split(' · ')[0]!.trim()
  const name = from.replace(/<[^>]*>/g, ' ').replace(/["“”]/g, '').replace(/\s+/g, ' ').trim()
  return name || (/<([^>]+)>/.exec(from)?.[1] ?? '').trim()
}

/** The memo a set kept from a mail starts with: *Came by mail from Dana Whitfield, Nov 16.* */
export function cameByMailMemo(who: string | null | undefined, at: string): string {
  const sender = mailSender(who)
  const day = formatWorkDateYmdMonthDayShort(calendarYmdInAppTzFromIso(at))
  return sender ? `Came by mail from ${sender}, ${day}.` : `Came by mail, ${day}.`
}

const sameName = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * The form as the press opens it: the set's name from the subject, its date the mail's own day, a memo that says it
 * came by mail and from whom, every file we hold ticked but a signature's picture or a Drive link's preview. When the bid already has a set of that name the app can
 * file into, the files go into it, since a later mail of the same conversation carries the same subject.
 */
export function bidMailDraft(mail: { subject: string | null | undefined; who: string | null | undefined; at: string }, ready: ReadonlyArray<BidMailFile>, sets: ReadonlyArray<Pick<BidPlanSetRow, 'id' | 'name' | 'link'>>): BidMailDraft {
  const planDate = calendarYmdInAppTzFromIso(mail.at)
  const name = nameFromSubject(mail.subject ?? '') || `Mail of ${formatWorkDateYmdMonthDayShort(planDate)}`
  const same = sets.find((s) => sameName(s.name, name) && isDriveFolderLink(s.link))
  return { into: same ? same.id : INTO_NEW, name, planDate, memo: cameByMailMemo(mail.who, mail.at), picked: ready.filter((f) => !isInlinePicture(f)).map((f) => f.id) }
}

/** *Put them in*: a new set first, then the bid's sets the app can file into, each with its date. */
export function putIntoOptions(sets: ReadonlyArray<Pick<BidPlanSetRow, 'id' | 'name' | 'link' | 'plan_date'>>): Array<{ value: string; label: string }> {
  return [
    { value: INTO_NEW, label: 'A new set' },
    ...sets.filter((s) => isDriveFolderLink(s.link)).map((s) => ({ value: s.id, label: planSetDateWords(s.plan_date) ? `${s.name} · ${planSetDateWords(s.plan_date)}` : s.name })),
  ]
}

/** What the form still needs before it files; null when it can. */
export function bidMailDraftProblem(draft: BidMailDraft): string | null {
  if (draft.picked.length === 0) return 'Tick a file to keep.'
  if (draft.into !== INTO_NEW) return null
  if (!draft.name.trim()) return 'Give the set a name.'
  if (draft.planDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.planDate)) return 'Pick the date from the calendar.'
  return null
}

export type KeepPressWords = { button: string; foot: string | null; dead: boolean }

/**
 * The button, which says exactly what it will do with its count: *Keep 2 files as a set on B482*, or into a set
 * already there, *Add 1 file to Addendum 1*. The foot names the files that stay in Gmail; they never stop the rest.
 * Dead only when nothing is ticked.
 */
export function keepPressWords(picked: number, left: number, bidLabel: string, intoName: string | null): KeepPressWords {
  const noun = ['file', 'files'] as const
  const foot = left === 0 ? null : left === 1 ? '1 file stays in Gmail. We hold no copy of it.' : `${left} files stay in Gmail. We hold no copy of them.`
  if (picked <= 0) return { button: intoName ? countedLabel('Add', 0, noun) : countedLabel('Keep', 0, noun), foot: foot ?? 'Tick a file to keep.', dead: true }
  return { button: intoName ? `${countedLabel('Add', picked, noun)} to ${intoName}` : `${countedLabel('Keep', picked, noun)} as a set on ${bidLabel}`, foot, dead: false }
}

export type BidKeepResult = {
  setName: string
  /** The files joined a set that was already on the bid. */
  joined: boolean
  landed: number
  failed: ReadonlyArray<{ name: string; why: string }>
  left: ReadonlyArray<Pick<BidMailFile, 'name' | 'leftWhy'>>
}

const sentence = (s: string): string => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`)

/** What became of the mail's files once the set is on the bid. Green only when nothing stayed behind. */
export function bidKeptWords(r: BidKeepResult, bidLabel: string): { words: string; tone: 'success' | 'warning' } {
  const bits: string[] = [r.joined ? `Added to ${r.setName} on ${bidLabel}.` : `Kept on ${bidLabel} as ${r.setName}.`]
  if (r.landed === 1) bits.push('The mail’s file is in the set’s folder.')
  else if (r.landed > 1) bits.push(`The mail’s ${r.landed} files are in the set’s folder.`)
  for (const f of r.left) bits.push(`${f.name} stays in Gmail, ${f.leftWhy === 'too_big' ? 'too big for us to keep' : 'never copied here'}.`)
  if (r.failed.length > 0) bits.push(`${r.failed.length === 1 ? 'One file did not land' : `${r.failed.length} files did not land`}: ${r.failed.map((f) => sentence(`${f.name}: ${f.why}`)).join(' ')}`)
  return { words: bits.join(' '), tone: r.failed.length > 0 || r.left.length > 0 ? 'warning' : 'success' }
}

/** The press that tries the files that did not land, on the same set: *File 1 file again*. */
export const fileAgainOnBidLabel = fileAgainLabel

/** The mark a kept mail wears: *Kept as Addendum 2 on B482*, or *Kept in 2 sets on B482* when its files went two ways. */
export function mailKeptWords(setNames: ReadonlyArray<string>, bidLabel: string): string {
  const names = [...new Set(setNames.map((n) => n.trim()).filter(Boolean))]
  if (names.length === 1) return `Kept as ${names[0]} on ${bidLabel}`
  if (names.length > 1) return `Kept in ${names.length} sets on ${bidLabel}`
  return `Kept on ${bidLabel}`
}

/** On the bid's Plan sets: the chip a set made from a mail wears, and the door back to that mail in its thread. */
export const FROM_MAIL_CHIP = 'From a mail'
export const THE_MAIL_DOOR = 'The mail ›'
export const THE_MAIL_DOOR_TIP = 'Opens the mail these files came with, in its thread in Messages'

/** A file's row that points at a set, with its mail's line and who the thread is with, as the read embeds them. */
export type SetMailRow = { bid_plan_set_id: string | null; message_id: string | null; messages: { contact_id: string | null; contacts: { kind: string | null } | null } | null }

/** The mail a set came from, for its door. */
export type SetMail = { messageId: string; contactId: string; contactKind: string | null }

/** Each set's mail, from the files filed into it: the first file's mail when two mails fed one set. */
export function mailBySet(rows: ReadonlyArray<SetMailRow>): Map<string, SetMail> {
  const out = new Map<string, SetMail>()
  for (const r of rows) {
    const contactId = r.messages?.contact_id ?? null
    if (!r.bid_plan_set_id || !r.message_id || !contactId || out.has(r.bid_plan_set_id)) continue
    out.set(r.bid_plan_set_id, { messageId: r.message_id, contactId, contactKind: r.messages?.contacts?.kind ?? null })
  }
  return out
}

/** On the bid's Plan sets: the press that lists the bid's mail that carries files. */
export const FROM_A_MAIL_PRESS = '+ From a mail on this bid'
export const FROM_A_MAIL_HEAD = 'From a mail on this bid'

/** A mail on the bid as the read embeds its files. */
export type BidMailLineRow = { id: string; at: string; subject: string | null; who_text: string | null; message_attachments: Array<{ kind: string; name?: string | null }> | null }

/** A mail on the bid that carries at least one file, for the list under Plan sets. */
export type BidMailLine = { id: string; at: string; subject: string; who: string; files: number }

/** The bid's mail that carries a file, newest first as read; a mail whose only attachment is a link, a signature's picture or a Drive link's preview is left out. */
export function bidMailLines(rows: ReadonlyArray<BidMailLineRow>): BidMailLine[] {
  return rows
    .map((r) => ({ id: r.id, at: r.at, subject: (r.subject ?? '').trim() || '(no subject)', who: r.who_text ?? '', files: (r.message_attachments ?? []).filter((a) => a.kind === 'file' && !isInlinePicture({ name: a.name ?? '' })).length }))
    .filter((m) => m.files > 0)
}

/** Under a mail's subject in that list: *Dana Whitfield · Nov 16 · 3 files*. */
export function bidMailLineWords(m: Pick<BidMailLine, 'who' | 'at' | 'files'>): string {
  const day = formatWorkDateYmdMonthDayShort(calendarYmdInAppTzFromIso(m.at))
  return [mailSender(m.who) || null, day, m.files === 1 ? '1 file' : `${m.files} files`].filter((x): x is string => !!x).join(' · ')
}

/** A mail whose files all stayed in Gmail: why there is no press. */
export function nothingToKeepWords(left: number): string {
  return left === 1 ? 'This mail’s file stayed in Gmail, so there is no copy here to keep on the bid.' : `This mail’s ${left} files stayed in Gmail, so there is no copy here to keep on the bid.`
}

/**
 * A file's size as the form says it, or '' when the row holds none: the words the mail's own attachment row uses
 * (`sizeWords`, a Mac's units), so one file never reads as two sizes on one screen (v2.7556).
 */
export function fileSizeWords(bytes: number | null): string {
  return bytes != null && bytes > 0 ? sizeWords(bytes) : ''
}
