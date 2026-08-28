/**
 * Prospect List pipeline grouping (v2.2453).
 *
 * The list used to group by warmth, but warmth is barely used (238 of 268
 * prospects sat at warmth 0 when this shipped), so the list rendered as one
 * giant bucket. These sections follow the pipeline instead:
 *
 *   never_called → recent (<30d) → going_cold (30–90d) → cold (90d+)
 *   then the terminal states: converted, cant_reach, not_a_fit
 *
 * "Called" matches the Follow Up queue's definition (v2.2301): the prospect
 * has at least one `didnt_answer` / `answered` comment. A site-visit note or
 * email bumps `last_contact` but is not a call, so a noted-but-never-called
 * prospect stays in `never_called`.
 *
 * Recency buckets use `last_contact` age (any touch counts as contact);
 * a called prospect with no `last_contact` lands in `cold`.
 */

export type ListSectionKey =
  | 'never_called'
  | 'recent'
  | 'going_cold'
  | 'cold'
  | 'converted'
  | 'cant_reach'
  | 'not_a_fit'

export const LIST_SECTION_ORDER: readonly ListSectionKey[] = [
  'never_called',
  'recent',
  'going_cold',
  'cold',
  'converted',
  'cant_reach',
  'not_a_fit',
]

export const LIST_SECTION_LABELS: Record<ListSectionKey, string> = {
  never_called: 'Never called',
  recent: 'Recently contacted — last 30 days',
  going_cold: 'Going cold — 30–90 days',
  cold: 'Cold — 90+ days',
  converted: 'Converted',
  cant_reach: "Can't reach",
  not_a_fit: 'No longer a fit',
}

/** Short names for the count chips above the list. */
export const LIST_SECTION_CHIP_LABELS: Record<ListSectionKey, string> = {
  never_called: 'Never called',
  recent: 'Recent',
  going_cold: 'Going cold',
  cold: 'Cold',
  converted: 'Converted',
  cant_reach: "Can't reach",
  not_a_fit: 'Not a fit',
}

/** Sections that start expanded; everything else starts collapsed. */
export const LIST_SECTIONS_DEFAULT_OPEN: ReadonlySet<ListSectionKey> = new Set([
  'never_called',
  'recent',
])

const DAY_MS = 86_400_000
const RECENT_MAX_DAYS = 30
const GOING_COLD_MAX_DAYS = 90

export type ListGroupableProspect = {
  id: string
  company_name: string | null
  contact_name: string | null
  phone_number: string | null
  email: string | null
  prospect_fit_status: string | null
  last_contact: string | null
  created_at: string | null
}

export type ProspectLastCall = {
  interaction_type: string
  created_at: string | null
}

function daysSince(iso: string | null, nowMs: number): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((nowMs - t) / DAY_MS))
}

export function filterProspectsForList<T extends ListGroupableProspect>(
  prospects: readonly T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...prospects]
  return prospects.filter((p) => {
    const company = (p.company_name ?? '').toLowerCase()
    const contact = (p.contact_name ?? '').toLowerCase()
    const phone = (p.phone_number ?? '').toLowerCase()
    const email = (p.email ?? '').toLowerCase()
    return company.includes(q) || contact.includes(q) || phone.includes(q) || email.includes(q)
  })
}

export function groupProspectsForList<T extends ListGroupableProspect>(
  prospects: readonly T[],
  calledIds: ReadonlySet<string>,
  nowMs: number,
): Record<ListSectionKey, T[]> {
  const sections: Record<ListSectionKey, T[]> = {
    never_called: [],
    recent: [],
    going_cold: [],
    cold: [],
    converted: [],
    cant_reach: [],
    not_a_fit: [],
  }
  for (const p of prospects) {
    if (p.prospect_fit_status === 'converted') {
      sections.converted.push(p)
    } else if (p.prospect_fit_status === 'cant_reach') {
      sections.cant_reach.push(p)
    } else if (p.prospect_fit_status === 'not_a_fit') {
      sections.not_a_fit.push(p)
    } else if (!calledIds.has(p.id)) {
      sections.never_called.push(p)
    } else {
      const d = daysSince(p.last_contact, nowMs)
      if (d != null && d < RECENT_MAX_DAYS) sections.recent.push(p)
      else if (d != null && d < GOING_COLD_MAX_DAYS) sections.going_cold.push(p)
      else sections.cold.push(p)
    }
  }

  // Never called: oldest entry first — the same order the calling queue works them.
  sections.never_called.sort((a, b) => {
    const cmp = (a.created_at ?? '').localeCompare(b.created_at ?? '')
    if (cmp !== 0) return cmp
    return (a.company_name ?? '').localeCompare(b.company_name ?? '')
  })
  // Everything else: most recent touch first (the pre-v2.2453 list order).
  const newestFirst = (a: T, b: T) => {
    const aLc = a.last_contact ? new Date(a.last_contact).getTime() : 0
    const bLc = b.last_contact ? new Date(b.last_contact).getTime() : 0
    if (bLc !== aLc) return bLc - aLc
    return (a.company_name ?? '').localeCompare(b.company_name ?? '')
  }
  for (const key of LIST_SECTION_ORDER) {
    if (key === 'never_called') continue
    sections[key].sort(newestFirst)
  }
  return sections
}

function ageWord(days: number | null): string {
  if (days == null) return ''
  if (days === 0) return ' today'
  if (days === 1) return ' 1d ago'
  return ` ${days}d ago`
}

/**
 * "Last touch" cell: call outcome when the prospect has been called
 * ("answered 3d ago" / "didn't answer today"), otherwise the same
 * noted/added language as the queue peek (v2.2301).
 */
export function lastTouchLabel(
  p: Pick<ListGroupableProspect, 'last_contact' | 'created_at'>,
  lastCall: ProspectLastCall | undefined,
  nowMs: number,
): string {
  if (lastCall) {
    const word = lastCall.interaction_type === 'answered' ? 'answered' : "didn't answer"
    return `${word}${ageWord(daysSince(lastCall.created_at, nowMs))}`
  }
  if (p.last_contact) return `noted${ageWord(daysSince(p.last_contact, nowMs))}`
  const d = daysSince(p.created_at, nowMs)
  return d == null ? 'added' : `added${ageWord(d)}`
}
