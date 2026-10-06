/**
 * Sent copies (v2.4554) — the rules, pure. Each time the company sends someone something, one
 * row in `sent_documents` says what went, to whom, how, when and by whom, and points at the
 * exact copy. A print counts as a send (the owner, 2026-10-05). The reads and the writes are
 * `sentCopiesIo.ts`; the list of what files a copy and what does not yet is `docs/SENT_COPIES.md`.
 */

export type SentHow = 'print' | 'email' | 'hand' | 'mail' | 'link' | 'download'

export const SENT_HOWS: ReadonlyArray<SentHow> = ['print', 'email', 'hand', 'mail', 'link', 'download']

/** How it went, as the list says it. */
export const SENT_HOW_WORDS: Record<SentHow, string> = {
  print: 'Printed',
  email: 'Emailed',
  hand: 'Handed over',
  mail: 'Mailed',
  link: 'Link sent',
  download: 'Saved as a file',
}

/** Who reads the copies: the office (dev, master, assistant, controller), as the table's SELECT policy. */
export function canReadSentCopies(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'controller'
}

/** What a send says about itself when it files a copy. */
export type SentFiling = {
  /** What it is, as the code names it: lower case, digits and underscores (`owner_records_packet`). */
  kind: string
  /** What it is, as a person reads it ("Records for 9703 Lenox Hill"). */
  title: string
  how: SentHow
  recipientName?: string | null
  recipientEmails?: ReadonlyArray<string>
  subject?: string | null
  /** The jobs it is about: one, several, or none. */
  jobIds?: ReadonlyArray<string | null | undefined>
  customerId?: string | null
  bidId?: string | null
  personId?: string | null
  /** The record the paper was drawn from, so its own row can link to the copy. */
  source?: { table: string; id: string | null } | null
  /**
   * What that record said when the copy went (v2.4714): a pay application files its lines and
   * the G702's totals, so a later change to the saved record can be named against what went.
   * Left out by most papers. Written with the row; a database without the column drops it.
   */
  sourceSnapshot?: Record<string, unknown> | null
}

/** The copy itself: a page as it was drawn, or a file's bytes. */
export type SentCopyBody = { html: string } | { blob: Blob; fileName: string; contentType: string }

const KIND_SHAPE = /^[a-z][a-z0-9_]{1,60}$/
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const uuidOrNull = (v: string | null | undefined): string | null => (v && UUID_SHAPE.test(v.trim()) ? v.trim() : null)

/** A file name the bucket takes: the name's own letters, digits, dots and dashes, never a path. */
export function sentCopyFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? ''
  const clean = base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|-+$/g, '').slice(0, 80)
  return clean || 'copy'
}

/** Where a row's copy lives in the bucket: `<row id>/<file>`. */
export function sentCopyPath(rowId: string, body: SentCopyBody): string {
  return 'html' in body ? `${rowId}/copy.html` : `${rowId}/${sentCopyFileName(body.fileName)}`
}

export type SentCopyStored = { path: string; type: string; hash: string; bytes: number }

/**
 * The row a filing writes, or null when the filing cannot be kept (a kind the table would
 * refuse). Ids that are not ids are dropped, never sent: a filing must not fail on one.
 */
export function sentDocumentInsert(id: string, filing: SentFiling, stored: SentCopyStored | null): Record<string, unknown> | null {
  if (!KIND_SHAPE.test(filing.kind) || !SENT_HOWS.includes(filing.how)) return null
  const jobIds = [...new Set((filing.jobIds ?? []).map(uuidOrNull).filter((x): x is string => !!x))]
  const emails = [...new Set((filing.recipientEmails ?? []).map((e) => e.trim()).filter(Boolean))]
  return {
    id,
    kind: filing.kind,
    title: filing.title.trim().slice(0, 300),
    how: filing.how,
    recipient_name: (filing.recipientName ?? '').trim().slice(0, 300),
    recipient_emails: emails,
    subject: (filing.subject ?? '').trim().slice(0, 500),
    job_ids: jobIds,
    customer_id: uuidOrNull(filing.customerId),
    bid_id: uuidOrNull(filing.bidId),
    person_id: uuidOrNull(filing.personId),
    source_table: filing.source?.id ? filing.source.table.trim() : '',
    source_id: uuidOrNull(filing.source?.id),
    copy_path: stored?.path ?? null,
    copy_type: stored?.type ?? '',
    copy_hash: stored?.hash ?? '',
    copy_bytes: stored?.bytes ?? null,
    ...(filing.sourceSnapshot && typeof filing.sourceSnapshot === 'object' ? { source_snapshot: filing.sourceSnapshot } : {}),
  }
}

export type SentCopyAttachment = { name: string; path: string; type: string }

/** A row as the list reads it. */
export type SentCopy = {
  id: string
  kind: string
  title: string
  how: SentHow
  recipientName: string
  recipientEmails: string[]
  subject: string
  sourceTable: string
  sourceId: string | null
  /** Null when the copy could not be kept: the row still says it went. */
  copyPath: string | null
  copyType: string
  copyHash: string
  attachments: SentCopyAttachment[]
  sentAt: string
  sentByName: string
  /** The source record's figures as filed with the copy (v2.4714), or null. */
  sourceSnapshot: Record<string, unknown> | null
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '')

/** A stored row, read defensively; null when it has no id or no known "how". */
export function parseSentCopy(raw: unknown): SentCopy | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const how = text(r.how) as SentHow
  if (!text(r.id) || !SENT_HOWS.includes(how)) return null
  const attachments = (Array.isArray(r.attachments) ? r.attachments : [])
    .map((a) => (a && typeof a === 'object' ? (a as Record<string, unknown>) : null))
    .filter((a): a is Record<string, unknown> => !!a && !!text(a.path))
    .map((a) => ({ name: text(a.name) || 'Attachment', path: text(a.path), type: text(a.type) }))
  return {
    id: text(r.id),
    kind: text(r.kind),
    title: text(r.title).trim() || 'Untitled',
    how,
    recipientName: text(r.recipient_name).trim(),
    recipientEmails: (Array.isArray(r.recipient_emails) ? r.recipient_emails : []).map(text).filter(Boolean),
    subject: text(r.subject).trim(),
    sourceTable: text(r.source_table),
    sourceId: text(r.source_id) || null,
    copyPath: text(r.copy_path) || null,
    copyType: text(r.copy_type),
    copyHash: text(r.copy_hash),
    attachments,
    sentAt: text(r.sent_at),
    sentByName: text(r.sent_by_name).trim(),
    sourceSnapshot: r.source_snapshot && typeof r.source_snapshot === 'object' && !Array.isArray(r.source_snapshot) ? (r.source_snapshot as Record<string, unknown>) : null,
  }
}

/** One line of the list: the newest send of a copy, and how many times that same copy went the same way. */
export type SentCopyLine = {
  /** The newest row of the group; its copy is the one the line opens. */
  row: SentCopy
  /** Every time this same copy went this same way to this same person, newest first. */
  times: string[]
}

const who = (r: SentCopy): string => (r.recipientName || r.recipientEmails.join(', ')).toLowerCase()

/**
 * The rows as lines, newest first. A page printed three times is one line that says so: rows
 * fold when the copy is the same (its hash), it is the same kind of paper, and it went the
 * same way to the same person. A row whose copy was not kept never folds.
 */
export function sentCopyLines(rows: ReadonlyArray<SentCopy>): SentCopyLine[] {
  const newestFirst = rows.slice().sort((a, b) => (a.sentAt < b.sentAt ? 1 : a.sentAt > b.sentAt ? -1 : 0))
  const lines: SentCopyLine[] = []
  const byKey = new Map<string, SentCopyLine>()
  for (const row of newestFirst) {
    const key = row.copyHash ? [row.kind, row.how, row.copyHash, who(row)].join('|') : ''
    const open = key ? byKey.get(key) : undefined
    if (open) {
      open.times.push(row.sentAt)
      continue
    }
    const line: SentCopyLine = { row, times: [row.sentAt] }
    lines.push(line)
    if (key) byKey.set(key, line)
  }
  return lines
}

/**
 * The grey words after a line's name: "Printed Oct 5, 2026, 2:30 PM · to Umar Khan · by Robert",
 * with "3 times, last" when the same copy went more than once.
 */
export function sentCopyWords(line: SentCopyLine, when: (iso: string) => string): string {
  const { row, times } = line
  const at = when(row.sentAt)
  const head = times.length > 1 ? `${SENT_HOW_WORDS[row.how]} ${times.length} times, last ${at}` : `${SENT_HOW_WORDS[row.how]} ${at}`.trim()
  const parts = [head]
  const to = row.recipientName || row.recipientEmails.join(', ')
  if (to) parts.push(`to ${to}`)
  if (row.sentByName) parts.push(`by ${row.sentByName}`)
  return parts.join(' · ')
}

/** How a copy opens: a kept page is drawn in a window, a kept file through a short-lived link, nothing when it was not kept. */
export function sentCopyDoor(row: Pick<SentCopy, 'copyPath' | 'copyType'>): 'page' | 'file' | 'none' {
  if (!row.copyPath) return 'none'
  return /^text\/html\b/i.test(row.copyType) || /\.html?$/i.test(row.copyPath) ? 'page' : 'file'
}

const escAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * The window a kept page opens in: one grey line saying what it is, a Print button, and the
 * page itself in a frame that runs no script. A copy is a file someone on staff stored, so it
 * is shown, never run: the frame's sandbox leaves scripts, forms and navigation off.
 */
export function sentCopyFrameHtml(copyHtml: string, label: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escAttr(label)}</title><style>
html,body{margin:0;height:100%}body{display:flex;flex-direction:column;font:13px system-ui,sans-serif;background:#f3f4f6}
.bar{display:flex;align-items:center;gap:12px;padding:8px 14px;background:#fff;border-bottom:1px solid #d1d5db;color:#374151}
.bar span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar button{font:inherit;padding:4px 12px;border:1px solid #9ca3af;border-radius:4px;background:#fff;color:#111827;cursor:pointer}
iframe{flex:1;border:0;background:#fff}
@media print{.bar{display:none}}
</style></head><body><div class="bar"><span>${escAttr(label)}</span><button type="button" id="print">Print</button></div>
<iframe id="copy" title="${escAttr(label)}" sandbox="allow-same-origin allow-modals" srcdoc="${escAttr(copyHtml)}"></iframe>
<script>document.getElementById('print').addEventListener('click',function(){var f=document.getElementById('copy');try{f.contentWindow.focus();f.contentWindow.print()}catch(e){window.print()}})</script>
</body></html>`
}

/** How the Documents page sorts what was sent: by what the paper is about. */
export type SentKindGroup = 'bills' | 'lien' | 'contracts' | 'bids' | 'statements' | 'other'

/** Each group's kinds, by how a kind begins. A kind no group claims is "other". */
const SENT_GROUP_PREFIXES: Record<Exclude<SentKindGroup, 'other'>, ReadonlyArray<string>> = {
  bills: ['bill'],
  lien: ['lien_', 'demand_letter', 'owner_records', 'legal_', 'hazmat_notice'],
  contracts: ['job_contract', 'person_contract', 'estimate', 'work_order', 'sub_labor_sheet'],
  bids: ['bid_', 'rfq', 'submittal_', 'procurement_', 'purchase_order', 'supply_house'],
  statements: ['gc_statement', 'gc_checks', 'test_report', 'field_report'],
}

export const SENT_KIND_GROUPS: ReadonlyArray<{ key: SentKindGroup | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'bills', label: 'Bills' },
  { key: 'lien', label: 'Lien and legal' },
  { key: 'contracts', label: 'Contracts and estimates' },
  { key: 'bids', label: 'Bids and suppliers' },
  { key: 'statements', label: 'Statements and reports' },
  { key: 'other', label: 'Other' },
]

export function sentKindGroup(kind: string): SentKindGroup {
  for (const [group, prefixes] of Object.entries(SENT_GROUP_PREFIXES) as Array<[Exclude<SentKindGroup, 'other'>, ReadonlyArray<string>]>) {
    if (prefixes.some((p) => kind.startsWith(p))) return group
  }
  return 'other'
}

/**
 * A group as a PostgREST filter over `kind`: an `or` list for a named group, an `and` list of
 * "not like" for "other", null for all. The prefixes are ours, so nothing here is typed by a person.
 */
export function sentKindGroupFilter(group: SentKindGroup | 'all'): { or?: string; notLike?: string[] } | null {
  if (group === 'all') return null
  if (group === 'other') return { notLike: Object.values(SENT_GROUP_PREFIXES).flat().map((p) => `${p}*`) }
  return { or: SENT_GROUP_PREFIXES[group].map((p) => `kind.like.${p}*`).join(',') }
}

/**
 * What a person typed, as a PostgREST `or` over the title, who it went to and the subject, or
 * null when there is nothing to look for. Everything a filter could read as syntax is dropped.
 */
export function sentSearchFilter(typed: string): string | null {
  const q = typed.replace(/[^A-Za-z0-9 @._#'&-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
  if (q.length < 2) return null
  const like = `*${q}*`
  return ['title', 'recipient_name', 'subject'].map((col) => `${col}.ilike.${like}`).join(',')
}
