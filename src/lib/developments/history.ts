/**
 * The site's history (punch list #208, design spike; the owner's pick A of `history-mockup.html`:
 * *write about events and leave ourselves notes of things at specific times and dates like an email
 * came in we want to memorialise*). An entry is a dated line that never changes, kept by a person or a
 * robot about something that happened, at the time it happened, about the site, a job, a bid or the
 * customer, from a source (an email, a call, a text, a visit, a letter, a note). The What changed
 * card draws the entries among the record lines as one stream, *History*; the chips here narrow it
 * by kind or by piece. Pure: the row shapes, the words and the rules; the one write is
 * `historyWrites.ts`, the read is the page's fetch. The MCP verbs come with PR 2m.
 */
import type { ChangeAbout, ChangeLine, HistorySource } from './whatChanged'
import type { MemberBid, MemberJob, Members } from './overview'
import { samePlanLink } from '../bids/bidPlanSets'
import { isInlinePicture } from '../bids/bidMailSet'

export type { HistorySource } from './whatChanged'

export const HISTORY_SOURCES: ReadonlyArray<{ key: HistorySource; label: string; glyph: string; hint: string }> = [
  { key: 'email', label: 'Email', glyph: '✉', hint: 'An email came in or went out' },
  { key: 'call', label: 'Call', glyph: '☎', hint: 'A call, either way' },
  { key: 'text', label: 'Text', glyph: '✆', hint: 'A text message' },
  { key: 'on_site', label: 'On site', glyph: '⌂', hint: 'Seen or said on the site' },
  { key: 'letter', label: 'Letter', glyph: '✍', hint: 'Paper: a letter, a notice, a form' },
  { key: 'note', label: 'Note', glyph: '✎', hint: 'A note to ourselves' },
]

export const HISTORY_SOURCE = Object.fromEntries(HISTORY_SOURCES.map((s) => [s.key, s])) as Record<HistorySource, (typeof HISTORY_SOURCES)[number]>

/** The verb the line leads with, from the source. */
export const historyVerb = (source: HistorySource): string => (source === 'note' ? 'Note' : HISTORY_SOURCE[source].label)

export type HistoryAbout = { kind: 'site' } | { kind: 'job'; id: string } | { kind: 'bid'; id: string } | { kind: 'customer'; id: string }

export type HistoryEntry = {
  id: string
  developmentId: string
  about: HistoryAbout
  /** When it happened, ISO; set by the writer, which may be days before it was kept. */
  happenedAt: string
  source: HistorySource
  body: string
  byUserId: string | null
  byName: string | null
  via: 'app' | 'mcp'
  /** The key's name when a robot wrote it (*the inbox robot*). */
  agentLabel: string | null
  createdAt: string
  /**
   * The whole body's length when `body` is only its head (punch list #280: the page reads the first
   * `HISTORY_HEAD_CHARS` characters and the rest on *more ›* or for a search); absent when `body` is whole.
   */
  bodyChars?: number
}

/** Room for a whole email: the page folds the words, MCP reads them whole (the owner, 2026-10-29: *mcp will still need to be able to read all of it*). */
export const HISTORY_BODY_MAX = 20000

/** A line's words past this many fold behind *more ›*, which opens the whole of it in a window (the owner, 2026-10-29: *only show so much and show the rest in a modal if the user clicks on it*). */
export const HISTORY_FOLD_AT = 260

/**
 * How many characters of a body the page's list reads (punch list #280, v2.6735): the view
 * `development_history_heads` cuts the body at this many (`left(body, 400)`) and says how long the
 * whole is, so the list folds a long line without carrying its words. Past `HISTORY_FOLD_AT`, so a
 * head always has the words the fold shows.
 */
export const HISTORY_HEAD_CHARS = 400

export type HistoryDraft = { about: HistoryAbout; happenedAt: string; source: HistorySource; body: string }

/** A draft can be kept when it says something, not too much, at a time that has come. */
export function draftIsKeepable(draft: Pick<HistoryDraft, 'body' | 'happenedAt'>, nowMs: number): boolean {
  const body = draft.body.trim()
  if (!body || body.length > HISTORY_BODY_MAX) return false
  const t = Date.parse(draft.happenedAt)
  return Number.isFinite(t) && t <= nowMs + 5 * 60_000
}

/** A row of `development_history_entries`, as the table keeps it. */
export type HistoryRow = {
  id: string
  development_id: string
  job_id: string | null
  bid_id: string | null
  customer_id: string | null
  happened_at: string
  source: HistorySource
  body: string
  author_user_id: string | null
  via: 'app' | 'mcp'
  agent_label: string | null
  link_url: string | null
  file_path: string | null
  created_at: string
}

/** The row a kept draft becomes (the app's path: `via = 'app'`, the keeper as the author). Kept lines never change. */
export function draftToRow(draft: HistoryDraft, developmentId: string, authorUserId: string): Omit<HistoryRow, 'id' | 'created_at'> {
  return {
    development_id: developmentId,
    job_id: draft.about.kind === 'job' ? draft.about.id : null,
    bid_id: draft.about.kind === 'bid' ? draft.about.id : null,
    customer_id: draft.about.kind === 'customer' ? draft.about.id : null,
    happened_at: new Date(Date.parse(draft.happenedAt)).toISOString(),
    source: draft.source,
    body: draft.body.trim(),
    author_user_id: authorUserId,
    via: 'app',
    agent_label: null,
    link_url: null,
    file_path: null,
  }
}

/** A row of `development_history_heads`: the table's columns with the body's head and its whole length in place of the body. */
export type HistoryHeadRow = Omit<HistoryRow, 'body'> & { body_head: string; body_chars: number }

/** The heads view's columns, as the page's read names them (`development_history_heads`, 20261108234500). */
export const HISTORY_HEAD_COLUMNS = 'id, development_id, job_id, bid_id, customer_id, happened_at, source, body_head, body_chars, author_user_id, via, agent_label, link_url, file_path, created_at'

/** An entry from a heads row: the body is its head, and `bodyChars` says how long the whole is. */
export function headRowToEntry(row: HistoryHeadRow, names: ReadonlyMap<string, string>): HistoryEntry {
  const { body_head, body_chars, ...rest } = row
  return { ...rowToEntry({ ...rest, body: body_head ?? '' }, names), bodyChars: body_chars }
}

/** Whether the entry's `body` is only its head, with the rest waiting on a read. */
export const entryBodyIsHead = (e: Pick<HistoryEntry, 'body' | 'bodyChars'>): boolean => e.bodyChars != null && e.bodyChars > e.body.length

/** The entries with the whole bodies read later swapped in (a search, or *more ›*); an entry with no body in the map keeps its head. */
export function withBodies(entries: readonly HistoryEntry[], bodies: ReadonlyMap<string, string> | null): HistoryEntry[] {
  if (!bodies || bodies.size === 0) return [...entries]
  return entries.map((e) => {
    const whole = entryBodyIsHead(e) ? bodies.get(e.id) : undefined
    return whole == null ? e : { ...e, body: whole, bodyChars: whole.length }
  })
}

/** An entry from its row, the author's name from the page's names. */
export function rowToEntry(row: HistoryRow, names: ReadonlyMap<string, string>): HistoryEntry {
  const about: HistoryAbout = row.job_id ? { kind: 'job', id: row.job_id } : row.bid_id ? { kind: 'bid', id: row.bid_id } : row.customer_id ? { kind: 'customer', id: row.customer_id } : { kind: 'site' }
  return {
    id: row.id,
    developmentId: row.development_id,
    about,
    happenedAt: row.happened_at,
    source: row.source,
    body: row.body,
    byUserId: row.author_user_id,
    byName: row.author_user_id ? names.get(row.author_user_id) ?? null : null,
    via: row.via,
    agentLabel: row.agent_label,
    createdAt: row.created_at,
  }
}

/** The line the stream draws for an entry; the piece's label comes from the page's own records. */
export function entryLine(e: HistoryEntry, labels: { site: string; job: (id: string) => ChangeAbout | null; bid: (id: string) => ChangeAbout | null; customer: (id: string) => string | null }): ChangeLine {
  const about: ChangeAbout =
    e.about.kind === 'job'
      ? labels.job(e.about.id) ?? { kind: 'job', id: e.about.id, label: 'a job no longer here' }
      : e.about.kind === 'bid'
        ? labels.bid(e.about.id) ?? { kind: 'bid', id: e.about.id, label: 'a bid no longer here' }
        : e.about.kind === 'customer'
          ? { kind: 'customer', id: e.about.id, label: labels.customer(e.about.id) ?? 'the customer' }
          : { kind: 'site', id: null, label: labels.site }
  // Who wrote it leads; a robot that kept it through MCP is the mark on the line, not the author.
  const by = e.byName ?? (e.via === 'mcp' ? e.agentLabel : null)
  return {
    id: `history:${e.id}`,
    at: e.happenedAt,
    kind: 'entry',
    verb: historyVerb(e.source),
    about,
    detail: e.body,
    by,
    waitingDays: null,
    source: e.source,
    via: e.via,
    agent: e.via === 'mcp' ? e.agentLabel : null,
    withTime: true,
    entryId: e.id,
    // The list read the head alone (punch list #280): the window reads the whole by `entryId`.
    ...(entryBodyIsHead(e) ? { detailIsHead: true } : {}),
  }
}

// ---- the mail tied to a bid or a job ----------------------------------------------------------

/**
 * A row of `messages` the page reads for a mail tied to one of the site's bids or jobs (v2.7479): the
 * conversation someone tagged from My email, the dev seat tagged, or a company box's reader placed. Read
 * under the reader's own policies, so the page shows no more than Messages shows them.
 */
export type TiedMailRow = {
  id: string
  contact_id: string
  bid_id: string | null
  jobs_ledger_id: string | null
  /** `in`: from them. `out`: from us. Any other word is not a mail and draws nothing. */
  direction: string
  who_user_id: string | null
  /** The words the writer kept for who: *Dana to the team box*, as the readers and the tag write them. */
  who_text: string | null
  at: string
  subject: string | null
  body: string | null
  /** Gmail's id of the mail: one mail is one row, and a second row with the same id draws nothing. */
  gmail_id?: string | null
}

/** The columns the page reads for a tied mail. */
export const TIED_MAIL_COLUMNS = 'id, contact_id, bid_id, jobs_ledger_id, direction, who_user_id, who_text, at, subject, body, gmail_id'

/** A file on a tied mail's line, as the page reads it for the bid's press (punch list #368). The mark's column may be absent on a read. */
export type TiedMailFileRow = { message_id: string; kind: string; bucket_path: string | null; name?: string | null; bid_plan_set_id?: string | null }

/** The columns the page reads of a tied mail's files, without the kept mark and with it. */
export const TIED_MAIL_FILE_COLUMNS = 'message_id, kind, bucket_path, name'
export const TIED_MAIL_FILE_COLUMNS_WITH_MARK = `${TIED_MAIL_FILE_COLUMNS}, bid_plan_set_id`

/** The press on a bid's mail line that carries files it could keep: *Keep its file…*, *Keep its 2 files…*. */
export function keepFilesDoorWords(ready: number): string {
  return ready === 1 ? 'Keep its file…' : `Keep its ${ready} files…`
}
/** What a bid's mail line says once every file we hold is in a set of plans. */
export const MAIL_KEPT_MARK = 'kept on the bid'

/** The person a tied mail is with, for the name when the row kept no words and for the door. */
export type TiedMailContact = { id: string; kind: string; name: string | null; goes_by: string | null }

export const MAIL_IN_VERB = 'Email in'
export const MAIL_OUT_VERB = 'Email out'
/** The press on a mail line: its thread in Messages, open at the mail. */
export const MAIL_DOOR_WORDS = 'Open in Messages'

/** Who a mail was from and to: the row's own words, else our person and theirs by name. */
function mailWho(row: TiedMailRow, contact: TiedMailContact | undefined, names: ReadonlyMap<string, string>): string {
  const kept = (row.who_text ?? '').trim()
  if (kept) return kept
  const them = (contact?.name ?? '').trim() || (contact?.goes_by ?? '').trim() || 'someone'
  if (row.direction === 'in') return `${them} to us`
  const ours = row.who_user_id ? (names.get(row.who_user_id) ?? '').trim() : ''
  return `${ours || 'us'} to ${them}`
}

/**
 * The lines the stream draws for the mail tied to the site's bids and jobs: one line a mail, at the
 * mail's own time, saying which way it went, the piece it is tied to, the subject, the words (the feed
 * folds a long body behind *more ›* as it folds a long entry), who it was from and to, and the door to
 * its thread in Messages. One mail draws once: a row seen twice, by its id or by Gmail's, is dropped. A
 * line someone kept by hand about the same mail (`development_history_entries`, source email) carries
 * no Gmail id, so nothing here tries to match the two: the kept line stays as it was written and the
 * tied mail draws beside it, once, from its own row. A mail whose bid or job is not on the page draws
 * nothing. `threadHref` is null for a reader who cannot open Messages, and the line has no door.
 */
export function mailLines(
  rows: readonly TiedMailRow[],
  ctx: {
    job: (id: string) => ChangeAbout | null
    bid: (id: string) => ChangeAbout | null
    contacts: readonly TiedMailContact[]
    names: ReadonlyMap<string, string>
    threadHref: ((contactKind: string | null, contactId: string, messageId: string) => string) | null
    /** The files on the bids' mail, for the press that keeps them as a set of plans; absent on a reader with none. */
    files?: ReadonlyArray<TiedMailFileRow>
    /** A bid's short label for that press: *B482*. */
    bidShort?: (id: string) => string | null
  },
): ChangeLine[] {
  const contactById = new Map(ctx.contacts.map((c) => [c.id, c]))
  // A mail's files by its line: how many we hold that are in no set yet, and how many already are. A link is no file, and a signature's picture is not one to keep (v2.7556).
  const filesByMail = new Map<string, { ready: number; kept: number }>()
  for (const f of ctx.files ?? []) {
    if (f.kind !== 'file') continue
    const n = filesByMail.get(f.message_id) ?? { ready: 0, kept: 0 }
    if (f.bid_plan_set_id) n.kept += 1
    else if (f.bucket_path && !isInlinePicture({ name: f.name ?? '' })) n.ready += 1
    filesByMail.set(f.message_id, n)
  }
  const seenIds = new Set<string>()
  const seenGmail = new Set<string>()
  const out: ChangeLine[] = []
  for (const row of rows) {
    if (row.direction !== 'in' && row.direction !== 'out') continue
    const gmailId = (row.gmail_id ?? '').trim()
    if (seenIds.has(row.id) || (gmailId && seenGmail.has(gmailId))) continue
    const about = row.bid_id ? ctx.bid(row.bid_id) : row.jobs_ledger_id ? ctx.job(row.jobs_ledger_id) : null
    if (!about) continue
    seenIds.add(row.id)
    if (gmailId) seenGmail.add(gmailId)
    const contact = contactById.get(row.contact_id)
    const subject = (row.subject ?? '').trim()
    const body = (row.body ?? '').trim()
    out.push({
      id: `mail:${row.id}`,
      at: row.at,
      kind: 'mail',
      verb: row.direction === 'in' ? MAIL_IN_VERB : MAIL_OUT_VERB,
      about,
      subject: subject || null,
      detail: body || null,
      by: mailWho(row, contact, ctx.names),
      waitingDays: null,
      withTime: true,
      ...(ctx.threadHref ? { threadHref: ctx.threadHref(contact?.kind ?? null, row.contact_id, row.id) } : {}),
      ...(row.bid_id && fileCounts(filesByMail, row.id) ? { mail: { messageId: row.id, bidId: row.bid_id, bidLabel: ctx.bidShort?.(row.bid_id) ?? 'the bid', ...fileCounts(filesByMail, row.id)! } } : {}),
    })
  }
  return out
}

/** A mail's file counts when it has a file to keep or one kept; null for a mail with neither. */
function fileCounts(byMail: ReadonlyMap<string, { ready: number; kept: number }>, messageId: string): { ready: number; kept: number } | null {
  const n = byMail.get(messageId)
  return n && n.ready + n.kept > 0 ? n : null
}

// ---- a set of plans added to a bid -----------------------------------------------------------

/** A row of `bid_plan_sets` as the History line reads it. */
export type BidSetLineRow = { id: string; bid_id: string; name: string; link: string; created_at: string; created_by: string | null; file_name?: string | null; file_count?: number | null }

/**
 * A line for each set of plans added to one of the site's bids (punch list #368): *New set · B482 · Addendum 2*, at
 * the time it was added, by whoever added it, saying *from a mail* when its files came that way. The set the robot
 * reads is left out: its filing already draws as *New plans* or *Plans again* from the bid's own ledger
 * (`buildWhatChanged`), and one filing is one line. A set on a bid the page does not hold draws nothing.
 */
export function setLines(
  rows: ReadonlyArray<BidSetLineRow>,
  ctx: { bid: (id: string) => ChangeAbout | null; robotLink: (bidId: string) => string | null; fromMail: ReadonlySet<string>; names: ReadonlyMap<string, string> },
): ChangeLine[] {
  const out: ChangeLine[] = []
  for (const row of rows) {
    const about = ctx.bid(row.bid_id)
    if (!about || samePlanLink(row.link, ctx.robotLink(row.bid_id))) continue
    const files = row.file_count && row.file_count > 1 ? `${row.file_count} PDFs` : (row.file_name ?? '').trim()
    const detail = [row.name.trim(), ctx.fromMail.has(row.id) ? 'from a mail' : null, files || null].filter((x): x is string => !!x).join(' · ')
    out.push({ id: `set:${row.id}`, at: row.created_at, kind: 'plans', verb: 'New set', about, detail, by: row.created_by ? ctx.names.get(row.created_by) ?? null : null, waitingDays: null })
  }
  return out
}

// ---- the chips that narrow -------------------------------------------------------------------

export type HistoryChip = 'all' | 'wrote' | 'happened' | 'plans' | 'stages' | 'money' | 'questions' | 'photos'

export const HISTORY_CHIPS: ReadonlyArray<{ key: HistoryChip; label: string; title: string }> = [
  { key: 'all', label: 'Everything', title: 'Every line, whoever or whatever wrote it' },
  { key: 'wrote', label: 'What people wrote', title: 'Notes on jobs, bids, the site and the customer' },
  { key: 'happened', label: 'What happened', title: 'Emails, calls, texts, visits and letters, kept at their time, the mail tied to a job or a bid, and a trip leaving and coming back' },
  { key: 'plans', label: 'Plans', title: 'Every plan set filed, newest first: the history of plans' },
  { key: 'stages', label: 'Stages', title: 'Sends, outcomes, stage moves, new jobs and bids' },
  { key: 'money', label: 'Money', title: 'Bills and payments' },
  { key: 'questions', label: 'Questions', title: 'Questions asked and answered' },
  { key: 'photos', label: 'Photos', title: 'The crews’ photos, one line per job, person and hour' },
]

export function lineMatchesChip(line: ChangeLine, chip: HistoryChip): boolean {
  switch (chip) {
    case 'all':
      return true
    case 'wrote':
      return line.kind === 'note' || (line.kind === 'entry' && line.source === 'note')
    case 'happened':
      return line.kind === 'mail' || line.kind === 'trip' || (line.kind === 'entry' && line.source !== 'note')
    case 'plans':
      return line.kind === 'plans'
    case 'stages':
      return line.kind === 'stage' || line.kind === 'new_job' || line.kind === 'new_bid' || line.kind === 'won' || line.kind === 'lost' || line.kind === 'sent' || line.kind === 'contact'
    case 'money':
      return line.kind === 'billed' || line.kind === 'paid'
    case 'questions':
      return line.kind === 'asked' || line.kind === 'answered'
    case 'photos':
      return line.kind === 'photos'
  }
}

/** The piece a reader narrowed to (*JP1098 only*), set from a Pieces row: the bid and the job it became, either or both. */
export type HistoryPiece = { jobId: string | null; bidId: string | null; label: string }

export function aboutIsPiece(about: ChangeAbout, piece: HistoryPiece | null): boolean {
  if (!piece) return true
  return (about.kind === 'job' && !!piece.jobId && about.id === piece.jobId) || (about.kind === 'bid' && !!piece.bidId && about.id === piece.bidId)
}

export const lineIsAbout = (line: ChangeLine, piece: HistoryPiece | null): boolean => aboutIsPiece(line.about, piece)

// ---- the notes on record ---------------------------------------------------------------------

/** An undated note a record carries: a bid's notes, a job's collections note, a customer's terms. Drawn under the chips, not in the dated stream. */
export type OnRecordNote = { key: string; label: string; about: ChangeAbout; text: string }

export function onRecordNotes(
  members: Members,
  customers: ReadonlyArray<{ id: string; name: string; payment_terms_note: string | null; lien_notice_policy_note: string | null }>,
  labels: { bidLabel: (b: MemberBid) => string; jobLabel: (j: MemberJob) => string },
): OnRecordNote[] {
  const out: OnRecordNote[] = []
  for (const b of members.bids) {
    const text = (b.notes ?? '').trim()
    if (text) out.push({ key: `bid:${b.id}`, label: 'On the bid', about: { kind: 'bid', id: b.id, label: `${labels.bidLabel(b)} ${(b.project_name ?? '').trim()}`.trim() }, text })
  }
  for (const j of members.jobs) {
    const text = (j.collections_note ?? '').trim()
    if (text) out.push({ key: `job:${j.id}`, label: 'Collections', about: { kind: 'job', id: j.id, label: `${labels.jobLabel(j)} ${(j.job_name ?? '').trim()}`.trim() }, text })
  }
  for (const c of customers) {
    const about: ChangeAbout = { kind: 'customer', id: c.id, label: c.name }
    const terms = (c.payment_terms_note ?? '').trim()
    if (terms) out.push({ key: `terms:${c.id}`, label: 'Payment terms', about, text: terms })
    const lien = (c.lien_notice_policy_note ?? '').trim()
    if (lien) out.push({ key: `lien:${c.id}`, label: 'Lien notices', about, text: lien })
  }
  return out
}

export function narrowLines(lines: readonly ChangeLine[], chip: HistoryChip, piece: HistoryPiece | null): ChangeLine[] {
  if (chip === 'all' && !piece) return [...lines]
  return lines.filter((l) => lineMatchesChip(l, chip) && lineIsAbout(l, piece))
}

/** The card's meta while narrowed: *12 of 118 lines · Plans*, *5 of 118 lines · JP1098*. */
export function narrowedWords(shownCount: number, total: number, chip: HistoryChip, piece: HistoryPiece | null): string {
  const what = [piece ? piece.label : null, chip === 'all' ? null : HISTORY_CHIPS.find((c) => c.key === chip)?.label ?? null].filter(Boolean).join(' · ')
  return `${shownCount} of ${total} ${total === 1 ? 'line' : 'lines'}${what ? ` · ${what}` : ''}`
}

// ---- the datetime-local box ----------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0')

/** The value a `datetime-local` box holds for a moment, in the device's own time. */
export function localInputValue(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
