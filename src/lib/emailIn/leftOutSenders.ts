/**
 * Messages, punch list #223 PR 1 (v2.6202): the senders the office marked **A notice, not a person**. The press on the
 * *Who is this?* card (`newLane.ts`'s notice guesses, `mark_notice`) puts the sender's address, or the company's whole
 * domain, on `email_left_out_senders`; the bids@ reader reads the list once per run and leaves the next mail from them
 * out before `email_place_address` ever runs, so nothing flips the thread back to waiting. Gmail is untouched, by the
 * reader's own rule. Pure; mirrored to the edge by `scripts/edge-kernels.mjs`.
 */

/** One row of the list, as the reader and the card read it. */
export interface LeftOutSenderRow {
  /** The address, or the domain, lower-case. */
  value: string
  kind: 'address' | 'domain'
  /** The box it holds for: `bids`, `team`, or null for both. */
  mailbox: string | null
}

/** Why the reader left a sender out: the list's row that matched, or null when none does. */
export type LeftOutSenderMatch = Pick<LeftOutSenderRow, 'value' | 'kind'> | null

const clean = (s: string) => s.trim().toLowerCase()

/** The domain of an address: "news.alamosurety.example" for news@news.alamosurety.example. '' with no @. */
export function domainOf(address: string): string {
  const a = clean(address)
  const at = a.lastIndexOf('@')
  return at < 0 ? '' : a.slice(at + 1)
}

/**
 * The matcher for one box: an address on the list, or one whose domain is a marked domain or under it (a list's mail
 * often comes from `news.` or `mail.` under the company's own), on a row for this box or for both. Null when the
 * sender is not marked. Built once per run from the rows.
 */
export function leftOutSenders(rows: readonly LeftOutSenderRow[], mailbox: string): (address: string) => LeftOutSenderMatch {
  const addresses = new Map<string, LeftOutSenderRow>()
  const domains = new Map<string, LeftOutSenderRow>()
  for (const r of rows) {
    if (r.mailbox && r.mailbox !== mailbox) continue
    const value = clean(r.value)
    if (!value) continue
    ;(r.kind === 'domain' ? domains : addresses).set(value, r)
  }
  return (address) => {
    const a = clean(address)
    if (!a) return null
    const hit = addresses.get(a)
    if (hit) return { value: hit.value, kind: 'address' }
    let domain = domainOf(a)
    while (domain) {
      const d = domains.get(domain)
      if (d) return { value: d.value, kind: 'domain' }
      const dot = domain.indexOf('.')
      domain = dot < 0 ? '' : domain.slice(dot + 1)
    }
    return null
  }
}

/** Mail services anyone can sign up for: a shared domain there says nothing about the sender, so the whole domain is never marked. */
export const OPEN_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'att.net',
  'sbcglobal.net',
  'comcast.net',
  'proton.me',
  'protonmail.com',
])

/** The event line the press writes on the thread, and what the undo writes. */
export const NOTICE_LINES = {
  marked: (value: string, kind: 'address' | 'domain') => (kind === 'domain' ? `Marked a notice: everything from ${value}.` : `Marked a notice: ${value}.`),
  unmarked: 'Not a notice after all.',
} as const
