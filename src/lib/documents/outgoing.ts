/**
 * Messages, cut 7: a file going out on a message (the Messages prototype v1.91, v1.92 and v1.148, `attachPicker`,
 * `previewFile`, `addDraftFile`, `linkLines` and the send window's file notes; `MESSAGES_PLAN.md` → *Documents, for files
 * going out*). The channel and the file decide how it goes, never a person: an email takes the file, and anything over the
 * email limit, of unknown size or a plan set goes as our link to it; a text carries every file as our link, a photo too,
 * one line per portal page. Our link opens the person's portal at the page when their portal has it, else the
 * one file in the job's Drive folder. A file picked from this computer goes into the job's Team only folder first, and a
 * photo into the job's photos, so nothing goes out that Documents does not hold.
 *
 * What changed from the prototype, and why:
 * - *Big* is decided by bytes: over 10 MB a file, over 20 MB the message's files together. The prototype set it by hand
 *   and never added the files up, so three 9 MB papers would have broken the email.
 * - A file of unknown size goes as our link, since nobody can promise it fits.
 * - A portal page counts only when that person's portal has it: a customer gets the file's link until their pages land,
 *   and an architect always does.
 * - A photo on a text goes as our link, never as the picture: Quo's API sends no picture messages (helper 3's read of its
 *   docs, 2026-10-12). The picture is an email's alone.
 * - A file is on a message once, by its key, not by its name.
 * - The words are split into plain sentences, and the made-up page counts are gone.
 *
 * Pure: the send window asks it, the edge function sends.
 */
import { PORTAL_PAGES, portalHasPage, portalWords, sizeWords, type JobFile, type JobFileKind, type PortalAudience, type PortalPage } from './jobFiles'

/** Over this, one file goes as our link on an email (the trade portal's upload cap). */
export const EMAIL_FILE_LIMIT_BYTES = 10 * 1024 * 1024

/** Over this, the files on one email together are too big, and the largest go as our links (the sent copy's cap). */
export const EMAIL_MESSAGE_LIMIT_BYTES = 20 * 1024 * 1024

export type Channel = 'email' | 'text'

/** Who the message is to, by the contact's kind, for the portal page its link may open. */
export type Audience = PortalAudience | 'arch' | 'unknown'

/** Where a file on the message came from. */
export type DraftFrom = 'job' | 'computer' | 'photo'

/** A file on the message being written. */
export interface DraftFile {
  key: string
  name: string
  bytes: number | null
  kind: JobFileKind
  from: DraftFrom
  planSet: boolean
  portalPage: PortalPage | null
}

/** How a file goes: as the file, as our link to it, or as the picture, which only an email carries. */
export type WayOut = 'file' | 'link' | 'picture'

/** Why a file goes as our link on an email. */
export type LinkWhy = 'plan_set' | 'over_limit' | 'size_unknown' | 'message_too_big'

export interface FileWay {
  file: DraftFile
  way: WayOut
  /** Why an email sends our link instead of the file. Null otherwise. */
  why: LinkWhy | null
}

/** A job's file as it goes on a message. */
export function draftFromJob(f: JobFile): DraftFile {
  return { key: f.key, name: f.name, bytes: f.bytes, kind: f.kind, from: 'job', planSet: f.planSet, portalPage: f.portalPage }
}

/** A file picked from this computer, or a photo, as it goes on a message. */
export function draftFromDevice(key: string, name: string, bytes: number, kind: JobFileKind, from: 'computer' | 'photo'): DraftFile {
  return { key, name, bytes, kind, from, planSet: false, portalPage: null }
}

/** How one file goes on its own, before the message's files are added up. */
function wayAlone(f: DraftFile, channel: Channel): FileWay {
  // Quo sends no picture messages, so a text carries every file, a photo too, as our link.
  if (channel === 'text') return { file: f, way: 'link', why: null }
  if (f.from === 'photo' && f.kind === 'image' && f.bytes != null && f.bytes <= EMAIL_FILE_LIMIT_BYTES) return { file: f, way: 'picture', why: null }
  if (f.planSet) return { file: f, way: 'link', why: 'plan_set' }
  if (f.bytes == null) return { file: f, way: 'link', why: 'size_unknown' }
  if (f.bytes > EMAIL_FILE_LIMIT_BYTES) return { file: f, way: 'link', why: 'over_limit' }
  return { file: f, way: 'file', why: null }
}

/**
 * How each file on the message goes. On an email the files that go as files must fit together: the largest go as our links
 * until the rest fit.
 */
export function waysOut(files: readonly DraftFile[], channel: Channel): FileWay[] {
  const ways = files.map((f) => wayAlone(f, channel))
  if (channel !== 'email') return ways
  const carried = (): number => ways.reduce((sum, w) => sum + (w.way === 'link' ? 0 : (w.file.bytes ?? 0)), 0)
  const largestFirst = ways.filter((w) => w.way !== 'link').sort((a, b) => (b.file.bytes ?? 0) - (a.file.bytes ?? 0))
  for (const w of largestFirst) {
    if (carried() <= EMAIL_MESSAGE_LIMIT_BYTES) break
    w.way = 'link'
    w.why = 'message_too_big'
  }
  return ways
}

/** Where our link to a file goes. */
export type LinkTarget = { to: 'portal'; page: PortalPage; url: string } | { to: 'file'; url: string }

/** The links the app can hand out for this person: their portal's page, when they have a portal, and a file's own link. */
export interface LinkMakers {
  /** Their portal at a page. Null when they have no portal link. */
  portal: ((page: PortalPage) => string) | null
  /** Our link to the one file: the Drive handler's signed link. */
  file: (f: DraftFile) => string
}

/** Our link for a file: their portal at its page when their portal has it, else the file's own link. */
export function linkFor(f: DraftFile, audience: Audience, make: LinkMakers): LinkTarget {
  const page = f.portalPage
  if (page && make.portal && (audience === 'trade' || audience === 'customer') && portalHasPage(audience, page)) return { to: 'portal', page, url: make.portal(page) }
  return { to: 'file', url: make.file(f) }
}

/** A line a text carries under the words, for the files that go as links. */
export interface LinkLine {
  text: string
  url: string
}

/**
 * The link lines on a text: one per portal page however many files point at it (*The plans are in your portal: …*), and
 * one per file with no page, by its name. Pictures carry no line.
 */
export function linkLines(ways: readonly FileWay[], audience: Audience, make: LinkMakers): LinkLine[] {
  const out: LinkLine[] = []
  const pages = new Set<PortalPage>()
  for (const w of ways) {
    if (w.way !== 'link') continue
    const t = linkFor(w.file, audience, make)
    if (t.to === 'portal') {
      if (pages.has(t.page)) continue
      pages.add(t.page)
      out.push({ text: `${PORTAL_PAGES[t.page].line}: `, url: t.url })
    } else out.push({ text: `${w.file.name}: `, url: t.url })
  }
  return out
}

/**
 * A file's small facts on its chip in the email preview, each its own piece: how it goes when it goes as our link, then
 * its size.
 */
export function chipFacts(w: FileWay, audience: Audience, make: LinkMakers): string[] {
  const size = sizeWords(w.file.bytes)
  const link = w.way === 'link' ? (linkFor(w.file, audience, make).to === 'portal' ? 'our link to their portal' : 'our link to it in Drive') : null
  return [...(link ? [link] : []), ...(size ? [size] : [])]
}

/** The hover card on a chip under the box: where it came from, then how it goes on each channel. */
export function chipHover(f: DraftFile): string[] {
  const from = f.from === 'job' ? 'From the job.' : f.from === 'photo' ? 'A photo from this device.' : 'From this computer.'
  const alone = wayAlone(f, 'email')
  const now =
    alone.way === 'link'
      ? alone.why === 'plan_set'
        ? 'A plan set always goes as our link.'
        : "It stays in the job's Drive folder and goes as our link to it."
      : f.from === 'computer'
        ? "It goes into the job's Team only folder on the way out."
        : null
  const email = alone.way === 'picture' ? 'On an email it goes as the picture.' : alone.way === 'link' ? 'On an email it goes as our link.' : 'On an email it goes as the file.'
  const text = f.from === 'photo' ? 'On a text it goes as our link to the photo.' : 'On a text it goes as our link, to their portal when the file has a page there.'
  return [from, ...(now ? [now] : []), email, text]
}

/** The names in a list, the way a sentence says them. */
function andNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** What our link opens, in the send window's words. */
function linkOpens(targets: readonly LinkTarget[]): string {
  const pages = [...new Set(targets.flatMap((t) => (t.to === 'portal' ? [t.page] : [])))]
  const files = targets.some((t) => t.to === 'file')
  const parts: string[] = []
  if (pages.length) parts.push(`The link opens their portal at ${andNames(pages.map((p) => PORTAL_PAGES[p].page))}.`)
  if (files) parts.push("Our link opens that one file in the job's Drive folder.")
  parts.push('The link is ours, not Drive’s. We see when it is opened, never who, and we can cut it off.')
  return parts.join(' ')
}

/**
 * The send window's note under an email whose files go as links, a sentence per reason. Null when every file goes as
 * the file.
 */
export function emailFileNote(ways: readonly FileWay[], audience: Audience, make: LinkMakers): string | null {
  const linked = ways.filter((w) => w.way === 'link')
  if (!linked.length) return null
  const names = (why: LinkWhy) => linked.filter((w) => w.why === why).map((w) => w.file.name)
  const is = (n: string[]) => (n.length === 1 ? 'is' : 'are')
  const out: string[] = []
  const over = names('over_limit')
  if (over.length) out.push(`${andNames(over)} ${is(over)} over the email limit, so ${over.length === 1 ? 'it goes' : 'they go'} as our link.`)
  const plans = names('plan_set')
  if (plans.length) out.push(`${andNames(plans)} ${plans.length === 1 ? 'goes' : 'go'} as our link, the way a plan set always has.`)
  const unknown = names('size_unknown')
  if (unknown.length) out.push(`We do not know how big ${andNames(unknown)} ${is(unknown)} yet, so ${unknown.length === 1 ? 'it goes' : 'they go'} as our link.`)
  const tooBig = names('message_too_big')
  if (tooBig.length) out.push(`The files together are over the email limit, so ${andNames(tooBig)} ${tooBig.length === 1 ? 'goes' : 'go'} as our link.`)
  out.push(linkOpens(linked.map((w) => linkFor(w.file, audience, make))))
  return out.join(' ')
}

/** The send window's note under a text with files on it: every one goes as our link, since Quo sends no pictures. Null with none. */
export function textFileNote(ways: readonly FileWay[]): string | null {
  if (!ways.length) return null
  const photos = ways.filter((w) => w.file.from === 'photo').length
  const what = photos === ways.length ? 'a photo' : photos ? 'a file or a photo' : 'a file'
  const out = [`A text cannot carry ${what}, so each goes as our link.`]
  if (ways.some((w) => w.file.portalPage)) out.push('It opens their portal when the file has a page there.')
  return out.join(' ')
}

/** The email's foot line about its copy: *A copy of this email is kept in Documents, with its file.* */
export function sentCopyFoot(fileCount: number): string {
  if (fileCount <= 0) return 'A copy of this email is kept in Documents.'
  return `A copy of this email is kept in Documents, with its ${fileCount === 1 ? 'file' : 'files'}.`
}

/** How a file went, as the sent message keeps it (`message_attachments.sent_as`, and the link when it went as one). */
export interface SentFile {
  key: string
  name: string
  bytes: number | null
  kind: JobFileKind
  sentAs: WayOut
  link: string | null
}

/** The files as they went, for the sent copy, so the copy is the copy. */
export function sentFiles(ways: readonly FileWay[], audience: Audience, make: LinkMakers): SentFile[] {
  return ways.map((w) => ({
    key: w.file.key,
    name: w.file.name,
    bytes: w.file.bytes,
    kind: w.file.kind,
    sentAs: w.way,
    link: w.way === 'link' ? linkFor(w.file, audience, make).url : null,
  }))
}

/** Where a file from this device lands before it goes: the job's Team only folder, or the job's photos. Null for the job's own. */
export function landingFor(f: Pick<DraftFile, 'from'>): { folder: readonly string[]; words: string } | null {
  if (f.from === 'computer') return { folder: ['Team only', 'Sent by us'], words: "Kept on the message and in the job's Team only folder." }
  if (f.from === 'photo') return { folder: ['Photos'], words: "Goes as the picture on an email and as our link on a text. Saved to the job's photos." }
  return null
}

/** A file put on the message, or why not. */
export type AddResult = { ok: true; files: DraftFile[]; toast: string } | { ok: false; toast: string }

/** Puts a file on the message, once. */
export function addDraftFile(files: readonly DraftFile[], f: DraftFile): AddResult {
  if (files.some((x) => x.key === f.key)) return { ok: false, toast: 'That one is on it already.' }
  return { ok: true, files: [...files, f], toast: `${f.name} is on the message.` }
}

/** A row of the Attach picker. */
export interface AttachRow {
  key: string
  name: string
  /** The row's small facts, each its own piece. */
  facts: string[]
  /** One of the step's own papers, starred at the top. */
  starred: boolean
}

/** The Attach picker: the step's papers starred first, then the job's files, then this computer and a photo. */
export interface AttachPicker {
  starred: AttachRow[]
  /** *From B482 Boerne Retail Shell*, or why nothing can be picked from a job. */
  jobHead: string
  jobRows: AttachRow[]
  /** Shown when the job has no files yet. */
  jobEmpty: string | null
  device: AttachRow[]
}

/**
 * The Attach picker's one list. `job` is the job the message is tied to, as its badge and name, or null. `starred` are the
 * papers the step in the box still needs from them (helper 4's facts decide which), each by its form's short name.
 */
export function attachPicker(job: string | null, files: readonly JobFile[], audience: Audience, starred: readonly { paper: string; short: string }[], hasPortal: boolean): AttachPicker {
  const facts = (f: JobFile): string[] => {
    const alone = wayAlone(draftFromJob(f), 'email')
    const size = sizeWords(f.bytes)
    const goes = alone.way === 'link' ? (f.planSet ? 'a plan set, so it goes as our link' : 'stays in Drive and goes as our link') : null
    const page = f.portalPage && (audience === 'trade' || audience === 'customer') && portalHasPage(audience, f.portalPage) ? portalWords(f.portalPage) : null
    return [...(size ? [size] : []), ...(goes ? [goes] : []), ...(page ? [page] : [])]
  }
  const stepRows: AttachRow[] = starred.map((s) => ({ key: `form:${s.paper}`, name: `The ${s.short} form`, facts: ['What they fill in and send back, or upload in their portal.'], starred: true }))
  if (starred.length && hasPortal) stepRows.push({ key: 'portal:papers', name: 'Their portal link', facts: ['Uploads there land on their Documents and finish the step.'], starred: true })
  return {
    starred: stepRows,
    jobHead: job ? `From ${job}` : "This message is on nobody's job, so nothing to pick from a job.",
    jobRows: job ? files.map((f) => ({ key: f.key, name: f.name, facts: facts(f), starred: false })) : [],
    jobEmpty: job && files.length === 0 ? 'Nothing on this job yet.' : null,
    device: [
      { key: 'device:computer', name: 'A file from this computer', facts: ["Kept on the message and in the job's Team only folder."], starred: false },
      { key: 'device:photo', name: 'A photo', facts: ["Goes as the picture on an email and as our link on a text. Saved to the job's photos."], starred: false },
    ],
  }
}

/** The preview's head line under the file's name: its size, its pages when known, how it goes, and the job. */
export function previewFacts(f: JobFile, pages: number | null, jobName: string | null): string[] {
  const size = sizeWords(f.bytes)
  const alone = wayAlone(draftFromJob(f), 'email')
  return [
    ...(size ? [size] : []),
    ...(pages ? [`${pages} ${pages === 1 ? 'page' : 'pages'}`] : []),
    ...(alone.way === 'link' ? [alone.why === 'plan_set' ? 'a plan set, so it goes as our link' : alone.why === 'size_unknown' ? 'size not known yet, so it goes as our link' : 'over the email limit, so it goes as our link'] : []),
    `from ${jobName ?? 'the job'}`,
  ]
}
