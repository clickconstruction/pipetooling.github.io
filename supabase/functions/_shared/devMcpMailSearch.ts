/**
 * The dev seat's mail search (v2.6565, server 0.28.0): `search_mail` runs one Gmail search across the company's own
 * mailboxes under the service account's domain-wide delegation, as each account, with the **read-only** scope and no
 * other, and hands back each hit's headers and Gmail's snippet; `read_mail` reads one hit whole. The pure half: the
 * arguments resolved against the Workspace's accounts, a hit from a message's headers, the reply, and Google's
 * refusals in words. Nothing here, or in the verbs, writes, labels, trashes or deletes a mail: the scope Google
 * grants the token cannot.
 */
import type { EmailAddress, EmailIn, GmailMessage } from './gcKernels/lib/emailIn/gmailMessage.ts'
import { fileKeep } from './gcKernels/lib/emailIn/emailLine.ts'

/** The one scope the search asks for: Gmail refuses every write under it. The admin grants it on the Workspace. */
export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
/** Hits an account hands back when `max` is left out, and the most it ever hands back. */
export const MAIL_SEARCH_MAX_DEFAULT = 20
export const MAIL_SEARCH_MAX_CAP = 100
/** The most accounts one call searches: the Workspace's logins fit; a bigger ask names the accounts. */
export const MAIL_SEARCH_ACCOUNTS_CAP = 40
export const MAIL_SEARCH_QUERY_MAX = 500
/** The words `read_mail` keeps of a very long mail; the rest stays in Gmail. */
export const MAIL_READ_TEXT_MAX = 30_000
/** The headers a hit carries. */
export const MAIL_HIT_HEADERS: readonly string[] = ['From', 'To', 'Cc', 'Subject', 'Date']

/** A login of the Workspace as `users` holds it. */
export interface MailAccount {
  email: string
  name: string | null
  archived: boolean
}

export interface MailSearchArgs {
  /** The Gmail query as a person would type it in the search box, with `after:` / `before:` for `since` / `until`. */
  q: string
  accounts: MailAccount[]
  max: number
  /** The call log's target: the one address, or how many accounts. */
  target: string
}

/** The Workspace the delegation covers, read off the reader's address (`GMAIL_IMPERSONATE_USER`, bids@…). */
export function mailDomain(readerAddress: string | undefined | null): string | null {
  const at = (readerAddress ?? '').trim().toLowerCase().lastIndexOf('@')
  if (at < 1) return null
  const domain = (readerAddress ?? '').trim().toLowerCase().slice(at + 1)
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ? domain : null
}

const YMD = /^\d{4}-\d{2}-\d{2}$/
const gmailDay = (ymd: string): string => ymd.replace(/-/g, '/')

/**
 * The search's arguments against the accounts the reader may search: `q` (1–500 characters), `accounts?` (addresses,
 * local parts or the names People uses; every login when left out), `include_archived?`, `since?` / `until?`
 * (YYYY-MM-DD), `max?` (1–100 an account, 20 when left out).
 */
export function mailSearchArgs(args: Record<string, unknown>, known: readonly MailAccount[]): { ok: true; value: MailSearchArgs } | { ok: false; error: string } {
  const q = typeof args.q === 'string' ? args.q.trim() : ''
  if (!q) return { ok: false, error: "search_mail needs q — the search as a person types it in Gmail's box: from:someone@supplier.com, subject:\"invoice 4471\", \"Lot 12\" has:attachment, newer_than:30d." }
  if (q.length > MAIL_SEARCH_QUERY_MAX) return { ok: false, error: `q holds ${q.length} characters; the search takes at most ${MAIL_SEARCH_QUERY_MAX}.` }
  const parts = [q]
  for (const [key, word] of [['since', 'after'], ['until', 'before']] as const) {
    const v = args[key]
    if (v === undefined || v === null || v === '') continue
    if (typeof v !== 'string' || !YMD.test(v)) return { ok: false, error: `${key} is a day as YYYY-MM-DD.` }
    parts.push(`${word}:${gmailDay(v)}`)
  }
  let max = MAIL_SEARCH_MAX_DEFAULT
  if (args.max !== undefined && args.max !== null) {
    if (typeof args.max !== 'number' || !Number.isFinite(args.max) || args.max < 1) return { ok: false, error: `max is how many hits an account hands back, 1 to ${MAIL_SEARCH_MAX_CAP}.` }
    max = Math.min(MAIL_SEARCH_MAX_CAP, Math.floor(args.max))
  }
  const includeArchived = args.include_archived === true
  let accounts: MailAccount[]
  if (args.accounts === undefined || args.accounts === null || (Array.isArray(args.accounts) && args.accounts.length === 0)) {
    accounts = known.filter((a) => includeArchived || !a.archived)
    if (accounts.length === 0) return { ok: false, error: 'No login of the Workspace to search: users holds no account on the delegation’s domain.' }
  } else {
    if (!Array.isArray(args.accounts) || args.accounts.some((a) => typeof a !== 'string' || !a.trim())) return { ok: false, error: 'accounts is a list of the logins to search — an address, its local part, or the name People uses — or left out for every login.' }
    accounts = []
    for (const raw of args.accounts as string[]) {
      const want = raw.trim().toLowerCase()
      const found = known.find((a) => a.email.toLowerCase() === want) ?? known.find((a) => a.email.toLowerCase().split('@')[0] === want) ?? known.find((a) => (a.name ?? '').trim().toLowerCase() === want)
      if (!found) return { ok: false, error: `"${raw.trim()}" is not a login of the Workspace the delegation covers (users, by address or name). The search reads the company’s own mailboxes and no other.` }
      if (!accounts.some((a) => a.email === found.email)) accounts.push(found)
    }
  }
  if (accounts.length > MAIL_SEARCH_ACCOUNTS_CAP) return { ok: false, error: `${accounts.length} accounts; one call searches at most ${MAIL_SEARCH_ACCOUNTS_CAP} — name the accounts.` }
  const target = accounts.length === 1 ? accounts[0]!.email : `${accounts.length} accounts`
  return { ok: true, value: { q: parts.join(' '), accounts, max, target } }
}

/** One hit: the account it was found in, Gmail's ids, the headers and the snippet. Never the body. */
export interface MailHit {
  account: string
  id: string
  thread_id: string | null
  /** When Gmail took it, ISO; null when Gmail gave no time. */
  date: string | null
  from: string
  to: string
  cc: string
  subject: string
  snippet: string
  labels: string[]
}

const header = (m: GmailMessage, name: string): string => {
  const want = name.toLowerCase()
  return (m.payload?.headers ?? []).find((h) => h.name.toLowerCase() === want)?.value?.trim() ?? ''
}

const isoOf = (internalDate: string | undefined): string | null => {
  const ms = Number(internalDate ?? '')
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null
}

/** A hit from a message read with `format=metadata` and `MAIL_HIT_HEADERS`. */
export function mailHit(account: string, m: GmailMessage & { snippet?: string }): MailHit {
  return {
    account,
    id: m.id,
    thread_id: m.threadId ?? null,
    date: isoOf(m.internalDate),
    from: header(m, 'From'),
    to: header(m, 'To'),
    cc: header(m, 'Cc'),
    subject: header(m, 'Subject'),
    snippet: (m.snippet ?? '').trim(),
    labels: m.labelIds ?? [],
  }
}

/** What one account's search came to: its hits, or Google's refusal in words. */
export type MailAccountOutcome = { account: string; hits: MailHit[]; more: boolean; estimate: number | null } | { account: string; refused: string }

export interface MailSearchReply {
  q: string
  reading: string
  searched: number
  /** Every hit across the accounts, newest first. */
  hits: MailHit[]
  /** Per account: how many, and whether Gmail has more past `max`. */
  accounts: Array<{ account: string; hits: number; more: boolean; estimate: number | null }>
  refused: Array<{ account: string; why: string }>
}

const words = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

export function mailSearchReply(q: string, outcomes: readonly MailAccountOutcome[]): MailSearchReply {
  const searched = outcomes.filter((o) => 'hits' in o) as Extract<MailAccountOutcome, { hits: MailHit[] }>[]
  const refused = outcomes.filter((o) => 'refused' in o) as Extract<MailAccountOutcome, { refused: string }>[]
  const hits = searched.flatMap((o) => o.hits).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  const more = searched.filter((o) => o.more).length
  const reading = [
    `${words(hits.length, 'hit', 'hits')} across ${words(searched.length, 'mailbox', 'mailboxes')}`,
    more ? `${words(more, 'mailbox has', 'mailboxes have')} more past max` : null,
    refused.length ? `${words(refused.length, 'mailbox', 'mailboxes')} refused` : null,
  ]
    .filter(Boolean)
    .join('; ')
  return {
    q,
    reading,
    searched: searched.length,
    hits,
    accounts: searched.map((o) => ({ account: o.account, hits: o.hits.length, more: o.more, estimate: o.estimate })),
    refused: refused.map((o) => ({ account: o.account, why: o.refused })),
  }
}

/**
 * Google's refusal of a token or a read, in words that name the door: the scope not on the grant (`unauthorized_client`)
 * names the admin step; a login Google has no mailbox for (`invalid_grant`) says so; anything else is Google's own reason.
 */
export function mailRefusal(account: string, message: string): string {
  const m = message.toLowerCase()
  if (m.includes('unauthorized_client')) return `Google refused the read-only Gmail scope for ${account}: the Workspace admin adds ${GMAIL_READONLY_SCOPE} to the service account's domain-wide delegation (docs/DRIVE_INTAKE_SETUP.md → Domain-wide delegation).`
  if (m.includes('invalid_grant') || m.includes('invalid email') || m.includes('user id')) return `Google has no mailbox for ${account} (a login the Workspace no longer holds).`
  return `Google refused ${account}: ${message}`
}

/** `read_mail`'s arguments: the account the hit was found in and Gmail's id for it. */
export function mailReadArgs(args: Record<string, unknown>, known: readonly MailAccount[]): { ok: true; account: MailAccount; id: string } | { ok: false; error: string } {
  const account = typeof args.account === 'string' ? args.account.trim().toLowerCase() : ''
  const id = typeof args.id === 'string' ? args.id.trim() : ''
  if (!account || !id) return { ok: false, error: 'read_mail needs account (the address a search_mail hit names) and id (its Gmail id).' }
  const found = known.find((a) => a.email.toLowerCase() === account)
  if (!found) return { ok: false, error: `"${args.account}" is not a login of the Workspace the delegation covers. read_mail reads the company’s own mailboxes and no other.` }
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(id)) return { ok: false, error: `"${id}" is not a Gmail message id (the id a search_mail hit carries).` }
  return { ok: true, account: found, id }
}

export interface MailReadReply {
  account: string
  id: string
  thread_id: string | null
  date: string | null
  from: string
  to: string[]
  cc: string[]
  subject: string
  labels: string[]
  /** The reader's words, plain, up to MAIL_READ_TEXT_MAX characters. */
  text: string
  truncated: boolean
  /** The files on it by name, kind and size; their bytes stay in Gmail. */
  files: Array<{ name: string; mime: string; size: number }>
}

const addressWords = (a: EmailAddress): string => (a.name ? `${a.name} <${a.address}>` : a.address)

/**
 * Whether a part of a mail is a file the seat lists, reads and files (v2.6909): everything but a small picture placed in
 * the body, a signature's logo, by the reader's own rule (`fileKeep`). Apple Mail places a PDF in the body as well
 * (`Content-Disposition: inline`), and it is still a file: until 0.62.0 `read_mail` listed one and `read_mail_file`,
 * `read_mail_file_text` and `plan_mail_file` could not pick it.
 */
export function isMailFile(file: Pick<EmailIn['files'][number], 'size' | 'inline' | 'mime'>): boolean {
  return fileKeep(file) !== 'skip'
}

/** The mail whole as `readGmailMessage` reads it, its words capped, its files named. */
export function mailReadReply(account: string, email: EmailIn): MailReadReply {
  const truncated = email.text.length > MAIL_READ_TEXT_MAX
  return {
    account,
    id: email.gmailId,
    thread_id: email.threadId,
    date: email.at,
    from: email.from ? addressWords(email.from) : '',
    to: email.to.map(addressWords),
    cc: email.cc.map(addressWords),
    subject: email.subject,
    labels: email.labels,
    text: truncated ? email.text.slice(0, MAIL_READ_TEXT_MAX) : email.text,
    truncated,
    files: email.files.filter(isMailFile).map((f) => ({ name: f.name, mime: f.mime, size: f.size })),
  }
}

/** `fn` over `items`, `width` at a time, in order. */
export async function inBatches<T, R>(items: readonly T[], width: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += width) out.push(...(await Promise.all(items.slice(i, i + width).map(fn))))
  return out
}
