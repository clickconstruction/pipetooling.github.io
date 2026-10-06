/**
 * Sending the law firm its portal link (v2.4624, punch list #85 item 21) — the pure rules both
 * sides share. `legal-send-firm-link` checks the addresses with `legalFirmLinkAddresses`; the
 * desk's link card (`LegalPortalLinkButton.tsx`) builds the same list before it asks, and reads
 * the last send back from `sent_documents` with `legalFirmLinkSentLine`. No Deno API here:
 * `src/lib/legal/legalFirmLink.test.ts` runs it under vitest.
 */

/** `sent_documents.kind` for the welcome email; never changes once rows exist. */
export const LEGAL_FIRM_LINK_KIND = 'legal_firm_link'

/** At most this many addresses per send: the firm's address on file plus a couple of people. */
export const LEGAL_FIRM_LINK_MAX_TO = 3

const EMAIL_SHAPE = /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/

/**
 * The addresses one send goes to: the firm's address on file when ticked, then each typed address
 * (commas, semicolons, spaces or new lines between them), each once, in that order. An error names
 * the first address that is not an email, or says when there is none or too many.
 */
export function legalFirmLinkAddresses(i: { onFile?: string | null; useOnFile: boolean; typed?: string | null }): { emails: string[]; error: string | null } {
  const raw: string[] = []
  const onFile = (i.onFile ?? '').trim()
  if (i.useOnFile && onFile) raw.push(onFile)
  for (const part of (i.typed ?? '').split(/[\s,;]+/)) if (part.trim()) raw.push(part.trim())
  const emails: string[] = []
  for (const e of raw) {
    if (!EMAIL_SHAPE.test(e)) return { emails: [], error: `“${e}” is not an email address.` }
    if (!emails.some((x) => x.toLowerCase() === e.toLowerCase())) emails.push(e)
  }
  if (emails.length === 0) return { emails, error: 'Pick the address on file or type one.' }
  if (emails.length > LEGAL_FIRM_LINK_MAX_TO) return { emails: [], error: `Send to ${LEGAL_FIRM_LINK_MAX_TO} addresses at most.` }
  return { emails, error: null }
}

/** One `sent_documents` row as the card reads it. */
export type LegalFirmLinkSentRow = { recipient_emails: string[] | null; sent_at: string; sent_by_name?: string | null }

/**
 * The card's line for the newest send of the active link: *Sent to a@x.com and b@y.com on
 * 2026-10-05 by Will*. Null when this link has not been sent (a Rotate starts the line over:
 * the old link no longer opens). `ymd` turns the instant into the company's day.
 */
export function legalFirmLinkSentLine(rows: ReadonlyArray<LegalFirmLinkSentRow>, ymd: (iso: string) => string): string | null {
  const last = [...rows].sort((a, b) => (a.sent_at < b.sent_at ? 1 : a.sent_at > b.sent_at ? -1 : 0))[0]
  if (!last) return null
  const to = (last.recipient_emails ?? []).filter((e) => e.trim())
  const who = to.length <= 1 ? (to[0] ?? 'the firm') : `${to.slice(0, -1).join(', ')} and ${to[to.length - 1]}`
  const by = (last.sent_by_name ?? '').trim()
  const more = rows.length > 1 ? ` · sent ${rows.length} times` : ''
  return `Sent to ${who} on ${ymd(last.sent_at)}${by ? ` by ${by}` : ''}${more}`
}
