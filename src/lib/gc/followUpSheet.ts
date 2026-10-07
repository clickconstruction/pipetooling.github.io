/**
 * GC mode, the real build: how to reach a company, moved word for word from the GC mode prototype (branch spike/gc-mode,
 * `gcFollowUpSheet.ts`) by the schedule's PR 1b, which reads it. The Building lane's lift (U2) adds the rest of `gcFollowUpSheet.ts` here.
 */
import type { Partner } from './types'

export interface PartnerReach {
  /** "Greg Paulk". */
  name: string
  first: string
  phone: string
  email: string
  /** True when the record has none and a made-up one stands in. */
  madeUp: boolean
}

/** The person to reach at a company. A 555-01xx number and an .example address stand in where the record has none. */
export function partnerReach(partner: Partner): PartnerReach {
  const name = partner.contact || partner.company
  const first = name.split(/\s+/)[0] ?? name
  let h = 2166136261
  for (const c of partner.id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  const phone = partner.phone ?? `(210) 555-01${String(h % 100).padStart(2, '0')}`
  const slug = partner.company.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const email = partner.email ?? `${first.toLowerCase().replace(/[^a-z]/g, '')}@${slug}.example`
  return { name, first, phone, email, madeUp: !partner.phone || !partner.email }
}
