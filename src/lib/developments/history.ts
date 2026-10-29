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
}

/** Room for a whole email: the page folds the words, MCP reads them whole (the owner, 2026-10-29: *mcp will still need to be able to read all of it*). */
export const HISTORY_BODY_MAX = 20000

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
  return { id: `history:${e.id}`, at: e.happenedAt, kind: 'entry', verb: historyVerb(e.source), about, detail: e.body, by, waitingDays: null, source: e.source, via: e.via, agent: e.via === 'mcp' ? e.agentLabel : null, withTime: true }
}

// ---- the chips that narrow -------------------------------------------------------------------

export type HistoryChip = 'all' | 'wrote' | 'happened' | 'plans' | 'stages' | 'money' | 'questions'

export const HISTORY_CHIPS: ReadonlyArray<{ key: HistoryChip; label: string; title: string }> = [
  { key: 'all', label: 'Everything', title: 'Every line, whoever or whatever wrote it' },
  { key: 'wrote', label: 'What people wrote', title: 'Notes on jobs, bids, the site and the customer' },
  { key: 'happened', label: 'What happened', title: 'Emails, calls, texts, visits and letters, kept at their time' },
  { key: 'plans', label: 'Plans', title: 'Every plan set filed, newest first: the history of plans' },
  { key: 'stages', label: 'Stages', title: 'Sends, outcomes, stage moves, new pieces' },
  { key: 'money', label: 'Money', title: 'Bills and payments' },
  { key: 'questions', label: 'Questions', title: 'Questions asked and answered' },
]

export function lineMatchesChip(line: ChangeLine, chip: HistoryChip): boolean {
  switch (chip) {
    case 'all':
      return true
    case 'wrote':
      return line.kind === 'note' || (line.kind === 'entry' && line.source === 'note')
    case 'happened':
      return line.kind === 'entry' && line.source !== 'note'
    case 'plans':
      return line.kind === 'plans'
    case 'stages':
      return line.kind === 'stage' || line.kind === 'new_job' || line.kind === 'new_bid' || line.kind === 'won' || line.kind === 'lost' || line.kind === 'sent' || line.kind === 'contact'
    case 'money':
      return line.kind === 'billed' || line.kind === 'paid'
    case 'questions':
      return line.kind === 'asked' || line.kind === 'answered'
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
