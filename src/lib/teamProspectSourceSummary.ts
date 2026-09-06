/**
 * Per-source success rollup for the Prospects → Hiring board.
 *
 * `source` is free text on each candidate ("referral", "Indeed", "walk-in", ...)
 * — and, since candidates started arriving from job boards, very often the full
 * pasted URL of the candidate's profile (`https://employers.indeed.com/candidates/
 * view?id=…`, ~800 chars, unique per person). Grouping by exact string made the
 * table one row per candidate, which cannot answer "which board hires".
 *
 * So rows group by the *board*, not the spelling: URLs collapse to their host,
 * hosts and free text run through a small alias table (`SOURCE_ALIASES`), and
 * anything still unrecognized groups case-/whitespace-insensitively as before.
 * Success = hires; the rate is hired / (hired + passed) — measured against
 * decided candidates only, so a source with ten undecided people isn't punished
 * for being new.
 */

export type TeamProspectSourceInput = {
  source: string | null
  status: string
}

export type TeamProspectSourceSummaryRow = {
  /** Normalized grouping key ('' for blank source). */
  key: string
  /** Display label: board name, host, or first-seen original spelling; '(no source)' for blank. */
  label: string
  total: number
  active: number
  hired: number
  passed: number
  /** hired / (hired + passed); null when nobody from this source has been decided yet. */
  hireRate: number | null
  /** Distinct raw spellings/URLs folded into this row (first-seen order, trimmed). */
  variants: string[]
}

export const NO_SOURCE_LABEL = '(no source)'

type SourceAlias = {
  /** Display label for the group. */
  label: string
  /** Registrable domains — a host matches when it equals one or ends with `.` + one. */
  domains: readonly string[]
  /** Free-text patterns (matched against the collapsed, lower-cased source). */
  text: RegExp
}

/**
 * Known hiring sources. Order matters only when one string could match two
 * entries (first wins). Domains cover the boards people paste from; text
 * patterns cover how a hiring owner types them by hand.
 */
export const SOURCE_ALIASES: readonly SourceAlias[] = [
  { label: 'Indeed', domains: ['indeed.com', 'indeed.co.uk', 'indeed.ca'], text: /\bindeed\b/ },
  { label: 'ZipRecruiter', domains: ['ziprecruiter.com'], text: /\bzip\s?recruiter\b/ },
  { label: 'Craigslist', domains: ['craigslist.org'], text: /\bcraigs?\s?list\b/ },
  { label: 'Facebook', domains: ['facebook.com', 'fb.com', 'fb.me'], text: /\b(?:facebook|fb)\b/ },
  { label: 'LinkedIn', domains: ['linkedin.com', 'lnkd.in'], text: /\blinked\s?in\b/ },
  { label: 'Handshake', domains: ['joinhandshake.com'], text: /\bhandshake\b/ },
  { label: 'Glassdoor', domains: ['glassdoor.com'], text: /\bglass\s?door\b/ },
  { label: 'Monster', domains: ['monster.com'], text: /\bmonster\b/ },
  { label: 'CareerBuilder', domains: ['careerbuilder.com'], text: /\bcareer\s?builder\b/ },
  { label: 'Snagajob', domains: ['snagajob.com'], text: /\bsnag\s?a\s?job\b/ },
  { label: 'Nextdoor', domains: ['nextdoor.com'], text: /\bnext\s?door\b/ },
  { label: 'Instagram', domains: ['instagram.com'], text: /\binstagram\b/ },
  { label: 'Referral', domains: [], text: /\b(?:referr?al|referred|refer)\b/ },
  { label: 'Walk-in', domains: [], text: /\bwalk(?:ed)?[\s-]?ins?\b/ },
]

/** Second-level labels under which a two-letter ccTLD hangs its registrable names (co.uk, com.au, …). */
const CC_SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'])

/** Looks like a URL or a bare domain (`indeed.com`, `employers.indeed.com/x`), not a sentence. */
const HOSTLIKE_RE = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]|$)/

function collapse(source: string | null): string {
  return (source ?? '').trim().replace(/\s+/g, ' ')
}

/** Host of a URL-ish string (scheme optional), lower-cased, without `www.`; null when it isn't one. */
export function sourceHost(collapsedLower: string): string | null {
  if (!HOSTLIKE_RE.test(collapsedLower)) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(collapsedLower) ? collapsedLower : `https://${collapsedLower}`
  let host: string
  try {
    host = new URL(withScheme).hostname.toLowerCase()
  } catch {
    return null
  }
  return host.replace(/^www\./, '')
}

/** `employers.indeed.com` → `indeed.com`; `austin.craigslist.org` → `craigslist.org`; `jobs.example.co.uk` → `example.co.uk`. */
export function registrableHost(host: string): string {
  const parts = host.split('.').filter(Boolean)
  if (parts.length <= 2) return parts.join('.')
  const tld = parts[parts.length - 1]!
  const second = parts[parts.length - 2]!
  const keep = tld.length === 2 && CC_SECOND_LEVEL.has(second) && parts.length >= 3 ? 3 : 2
  return parts.slice(-keep).join('.')
}

function aliasForHost(host: string): SourceAlias | null {
  for (const alias of SOURCE_ALIASES) {
    for (const domain of alias.domains) {
      if (host === domain || host.endsWith(`.${domain}`)) return alias
    }
  }
  return null
}

function aliasForText(text: string): SourceAlias | null {
  for (const alias of SOURCE_ALIASES) {
    if (alias.text.test(text)) return alias
  }
  return null
}

export type NormalizedTeamProspectSource = {
  /** Grouping key: '' for blank, else the lower-cased label. */
  key: string
  /** What the table/autocomplete shows for this group. */
  label: string
}

/**
 * Fold one raw source string to its group. URL → registrable host → alias label
 * (unknown hosts keep the host as the label); free text → alias label when one
 * matches, else the collapsed first-seen spelling (keyed lower-case).
 */
export function normalizeTeamProspectSource(source: string | null): NormalizedTeamProspectSource {
  const collapsed = collapse(source)
  if (!collapsed) return { key: '', label: NO_SOURCE_LABEL }
  const lower = collapsed.toLowerCase()

  const host = sourceHost(lower)
  if (host) {
    const alias = aliasForHost(host)
    const label = alias ? alias.label : registrableHost(host)
    return { key: label.toLowerCase(), label }
  }

  const alias = aliasForText(lower)
  if (alias) return { key: alias.label.toLowerCase(), label: alias.label }
  return { key: lower, label: collapsed }
}

/** Grouping key only — '' for blank. */
export function normalizeSourceKey(source: string | null): string {
  return normalizeTeamProspectSource(source).key
}

/** Distinct source labels for autocomplete (board names, hosts, first-seen spellings), alphabetical. */
export function distinctTeamProspectSources(rows: TeamProspectSourceInput[]): string[] {
  const byKey = new Map<string, string>()
  for (const row of rows) {
    const { key, label } = normalizeTeamProspectSource(row.source)
    if (!key || byKey.has(key)) continue
    byKey.set(key, label)
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b))
}

/** Roll up candidates per source: most hires first, then most candidates, then A–Z. */
export function summarizeTeamProspectSources(rows: TeamProspectSourceInput[]): TeamProspectSourceSummaryRow[] {
  const byKey = new Map<string, TeamProspectSourceSummaryRow>()
  for (const row of rows) {
    const { key, label } = normalizeTeamProspectSource(row.source)
    let entry = byKey.get(key)
    if (!entry) {
      entry = { key, label, total: 0, active: 0, hired: 0, passed: 0, hireRate: null, variants: [] }
      byKey.set(key, entry)
    }
    entry.total += 1
    if (row.status === 'hired') entry.hired += 1
    else if (row.status === 'passed') entry.passed += 1
    else entry.active += 1
    const raw = collapse(row.source)
    if (raw && !entry.variants.includes(raw)) entry.variants.push(raw)
  }
  const out = [...byKey.values()]
  for (const entry of out) {
    const decided = entry.hired + entry.passed
    entry.hireRate = decided > 0 ? entry.hired / decided : null
  }
  out.sort((a, b) => {
    if (a.hired !== b.hired) return b.hired - a.hired
    if (a.total !== b.total) return b.total - a.total
    return a.label.localeCompare(b.label)
  })
  return out
}

/** Tooltip for a grouped row: how many distinct spellings/URLs it folds, with a short preview of each. */
export function describeSourceVariants(variants: string[], maxShown = 5, maxLen = 60): string | null {
  if (variants.length < 2) return null
  const shown = variants.slice(0, maxShown).map((v) => (v.length > maxLen ? `${v.slice(0, maxLen - 1)}…` : v))
  const more = variants.length - shown.length
  return `${variants.length} variants grouped here:\n${shown.join('\n')}${more > 0 ? `\n…and ${more} more` : ''}`
}
