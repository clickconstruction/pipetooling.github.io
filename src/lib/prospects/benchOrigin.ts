/**
 * Where a bench company came from (v2.5807, punch list #153, PR 1): a sub that landed on the bench
 * from Prospects → Subs carries its call record with it, so Trade partners' line under the name
 * reads *from Prospects · Marisol, Thu Oct 29 · answered 1 of 2 calls* until the company's first
 * quote replaces it, and *new to us* is never blank on a company we talked to. Pure; the read is
 * `benchOriginIo.ts`.
 */

export interface BenchOrigin {
  prospectId: string
  /** Who pressed Add to the bench ✓, by name. Null when the row names nobody. */
  who: string | null
  /** When they did, as the landing comment's time. */
  when: string | null
  /** Calls logged on the lane before the landing, and how many were answered. */
  calls: number
  answered: number
}

type OriginProspect = { id: string; converted_gc_company_id: string | null }
type OriginComment = { prospect_id: string; interaction_type: string; created_at: string | null; who: string | null }

/** One origin a company, from the lane's rows and their comments. A company landed twice keeps the newest landing. */
export function benchOriginsFrom(prospects: readonly OriginProspect[], comments: readonly OriginComment[]): Record<string, BenchOrigin> {
  const byProspect = new Map<string, BenchOrigin>()
  for (const p of prospects) {
    if (!p.converted_gc_company_id) continue
    byProspect.set(p.id, { prospectId: p.id, who: null, when: null, calls: 0, answered: 0 })
  }
  for (const c of comments) {
    const o = byProspect.get(c.prospect_id)
    if (!o) continue
    if (c.interaction_type === 'converted') {
      if (!o.when || (c.created_at ?? '') > o.when) {
        o.when = c.created_at
        o.who = (c.who ?? '').trim() || null
      }
    } else if (c.interaction_type === 'answered') {
      o.calls += 1
      o.answered += 1
    } else if (c.interaction_type === 'didnt_answer') {
      o.calls += 1
    }
  }
  const out: Record<string, BenchOrigin> = {}
  for (const p of prospects) {
    const o = byProspect.get(p.id)
    if (!o || !p.converted_gc_company_id) continue
    const was = out[p.converted_gc_company_id]
    if (!was || (o.when ?? '') > (was.when ?? '')) out[p.converted_gc_company_id] = o
  }
  return out
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dayWords(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

/** The line under the company's name on Trade partners. */
export function benchOriginWords(o: BenchOrigin): string {
  const parts = ['from Prospects']
  const day = o.when ? dayWords(o.when) : null
  if (o.who && day) parts.push(`${o.who}, ${day}`)
  else if (o.who) parts.push(o.who)
  else if (day) parts.push(day)
  if (o.calls > 0) parts.push(`answered ${o.answered} of ${o.calls} ${o.calls === 1 ? 'call' : 'calls'}`)
  return parts.join(' · ')
}

/** The line shows until the company's first quote; after that the bench's own record speaks. */
export function showsBenchOrigin(partner: { bids: number }, origin: BenchOrigin | undefined): origin is BenchOrigin {
  return !!origin && partner.bids === 0
}
