/**
 * Convert-tab prospect picker (v2.2454).
 *
 * Replaces the flat native <select> (268 unordered options when this
 * shipped) with a type-ahead search plus "recently answered" suggestions —
 * prospects with a recent answered call are the ones that actually become
 * customers.
 *
 * Converted prospects are excluded everywhere: converting one again is
 * almost always a mis-pick, and they already left the calling pipeline.
 */

import type { ProspectLastCall } from './prospectListGrouping'

const DAY_MS = 86_400_000
const SUGGEST_ANSWERED_WITHIN_DAYS = 30

export type ConvertSearchProspect = {
  id: string
  company_name: string | null
  contact_name: string | null
  phone_number: string | null
  email: string | null
  prospect_fit_status: string | null
}

function eligible(p: ConvertSearchProspect): boolean {
  return p.prospect_fit_status !== 'converted'
}

/**
 * Rank: company-name prefix match first, then company substring, then
 * contact/email/phone substring. Ties keep caller order. Blank query → [].
 */
export function searchConvertProspects<T extends ConvertSearchProspect>(
  prospects: readonly T[],
  query: string,
  limit = 8,
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const prefix: T[] = []
  const companySub: T[] = []
  const otherSub: T[] = []
  for (const p of prospects) {
    if (!eligible(p)) continue
    const company = (p.company_name ?? '').toLowerCase()
    if (company.startsWith(q)) {
      prefix.push(p)
      continue
    }
    if (company.includes(q)) {
      companySub.push(p)
      continue
    }
    const contact = (p.contact_name ?? '').toLowerCase()
    const email = (p.email ?? '').toLowerCase()
    const phone = (p.phone_number ?? '').toLowerCase()
    if (contact.includes(q) || email.includes(q) || phone.includes(q)) otherSub.push(p)
  }
  return [...prefix, ...companySub, ...otherSub].slice(0, limit)
}

/** Active prospects answered within the last 30 days, newest answer first. */
export function suggestRecentlyAnswered<T extends ConvertSearchProspect>(
  prospects: readonly T[],
  lastCallMap: Readonly<Record<string, ProspectLastCall>>,
  nowMs: number,
  limit = 5,
): T[] {
  const withAnswer = prospects
    .filter(eligible)
    .map((p) => {
      const call = lastCallMap[p.id]
      if (!call || call.interaction_type !== 'answered' || !call.created_at) return null
      const t = new Date(call.created_at).getTime()
      if (Number.isNaN(t) || nowMs - t > SUGGEST_ANSWERED_WITHIN_DAYS * DAY_MS) return null
      return { p, t }
    })
    .filter((x): x is { p: T; t: number } => x != null)
  withAnswer.sort((a, b) => b.t - a.t)
  return withAnswer.slice(0, limit).map((x) => x.p)
}
