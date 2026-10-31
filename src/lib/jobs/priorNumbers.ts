/**
 * The numbers a job answered to before (v2.6226; the owner, combining the Gun Dog import shells: *HCP 550,
 * 549, 548, 422, 178 and 130 were all House Call Pro numbers from the old system, so we don't want to lose
 * the House Call Pro number*). `jobs_ledger.prior_numbers` holds them as 'HCP 550' / 'C# 543'; the combine
 * fills it from the source, `search_jobs_ledger` matches them, and the screens read them as *also JP550,
 * JP549*. Pure: the entry shape and the words.
 */
import { formatJobLedgerNumberLabel } from '../ledgerDisplayPrefixes'

export type PriorNumberKind = 'hcp' | 'click'
export type PriorNumber = { kind: PriorNumberKind; number: string }

/** The entry as the database holds it: 'HCP 550' or 'C# 543'. */
export function priorNumberEntry(kind: PriorNumberKind, number: string): string {
  return `${kind === 'hcp' ? 'HCP' : 'C#'} ${number.trim()}`
}

/** 'HCP 550' → the HCP number 550; 'C# 543' → the Click number 543; an entry in neither shape reads as an HCP number. */
export function parsePriorNumber(entry: string): PriorNumber | null {
  const m = entry.trim().match(/^(HCP|C#)\s+(.+)$/i)
  if (m) return { kind: m[1]!.toUpperCase() === 'HCP' ? 'hcp' : 'click', number: m[2]!.trim() }
  const bare = entry.trim()
  return bare ? { kind: 'hcp', number: bare } : null
}

/** The labels the app shows, in the job's own prefix: 'HCP 550' on a plumbing job reads JP550. */
export function priorNumberLabels(entries: readonly string[] | null | undefined, prefix: string | null | undefined): string[] {
  const out: string[] = []
  for (const e of entries ?? []) {
    const p = parsePriorNumber(e)
    if (!p) continue
    const label = formatJobLedgerNumberLabel(prefix ?? null, p.kind === 'hcp' ? p.number : null, p.kind === 'click' ? p.number : null)
    if (label && !out.includes(label)) out.push(label)
  }
  return out
}

/** The line under a number: *also JP550, JP549*; '' with none. */
export function priorNumbersWords(labels: readonly string[]): string {
  return labels.length ? `also ${labels.join(', ')}` : ''
}

/** The bare numbers for a chip's tail: *also 550 · 549*. */
export function priorNumbersBare(entries: readonly string[] | null | undefined): string {
  const nums = (entries ?? []).map((e) => parsePriorNumber(e)?.number).filter((n): n is string => !!n)
  return nums.length ? `also ${nums.join(' · ')}` : ''
}
