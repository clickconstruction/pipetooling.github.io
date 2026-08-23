/**
 * CC recipients for GC statement emails (v2.2160): Draft Message's CC row is
 * teammate chips (toggle) + a free-text field (comma / semicolon / space
 * separated). This kernel normalizes that into the `cc_emails` the two
 * statement edge functions accept: lower-cased, validated, de-duplicated,
 * never the To address, capped.
 */

export const GC_STATEMENT_CC_MAX = 10

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type CcParseResult = {
  /** Normalized, unique, valid, ≤ GC_STATEMENT_CC_MAX, never equal to `to`. */
  emails: string[]
  /** Tokens that were typed but aren't email-shaped (for the inline error). */
  invalid: string[]
  /** True when more than the cap were given (the extras were dropped). */
  overflow: boolean
}

/** Split + normalize a CC text field. `to` (the To address) is excluded case-insensitively. */
export function parseCcEmails(raw: string, to?: string | null): CcParseResult {
  const toNorm = (to ?? '').trim().toLowerCase()
  const seen = new Set<string>()
  const emails: string[] = []
  const invalid: string[] = []
  for (const tok of (raw ?? '').split(/[\s,;]+/)) {
    const t = tok.trim()
    if (!t) continue
    const e = t.toLowerCase()
    if (!EMAIL_RE.test(e)) {
      invalid.push(t)
      continue
    }
    if (e === toNorm || seen.has(e)) continue
    seen.add(e)
    emails.push(e)
  }
  const overflow = emails.length > GC_STATEMENT_CC_MAX
  return { emails: overflow ? emails.slice(0, GC_STATEMENT_CC_MAX) : emails, invalid, overflow }
}

/** Chip toggle over the CC text: adds the email if absent, removes it if present; returns the new text. */
export function toggleCcEmailInText(raw: string, email: string): string {
  const e = email.trim().toLowerCase()
  const toks = (raw ?? '').split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean)
  const has = toks.some((t) => t.toLowerCase() === e)
  const next = has ? toks.filter((t) => t.toLowerCase() !== e) : [...toks, e]
  return next.join(', ')
}

export function ccTextIncludes(raw: string, email: string): boolean {
  const e = email.trim().toLowerCase()
  return (raw ?? '').split(/[\s,;]+/).some((t) => t.trim().toLowerCase() === e)
}

/** "cc Malachi, Robert" helper for toasts — emails joined. */
export function formatCcSummary(emails: readonly string[]): string {
  return emails.length ? `cc ${emails.join(', ')}` : ''
}
