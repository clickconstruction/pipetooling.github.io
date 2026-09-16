/**
 * The health row on Settings → What customers see (v2.3513, PR 9 of the train): per journey
 * step, how many outside people are at it and how many are stuck, read from one
 * `journey_health_counts()` RPC, worded here. Pure: the loader hands in the jsonb.
 */

export type JourneyHealthCounts = {
  as_of?: string
  agreements?: { signed?: number; sent_unopened?: number; sent_waiting?: number; live_jobs_without?: number }
  bid_rooms?: { published?: number; never_opened?: number; signed?: number }
  portals?: { customers_with_link?: number; ever_visited?: number }
  sub_portals?: { subs_with_link?: number; ever_visited?: number }
  statements?: { gcs_with_billed_work?: number; certified_this_month?: number; sent_this_month?: number }
}

export type HealthTile = {
  id: 'agreements' | 'bid_rooms' | 'portals' | 'sub_portals' | 'statements'
  label: string
  /** The big line: "5 signed · 24 sent, unopened · 105 never sent". */
  line: string
  /** True when something on the tile is stuck and the door is the fix. */
  attention: boolean
  door: { label: string; to: string }
}

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function parseJourneyHealthCounts(raw: unknown): JourneyHealthCounts | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const section = (k: string): Record<string, number> => {
    const s = o[k]
    if (!s || typeof s !== 'object') return {}
    const out: Record<string, number> = {}
    for (const [key, v] of Object.entries(s as Record<string, unknown>)) out[key] = n(v)
    return out
  }
  return {
    as_of: typeof o.as_of === 'string' ? o.as_of : undefined,
    agreements: section('agreements'),
    bid_rooms: section('bid_rooms'),
    portals: section('portals'),
    sub_portals: section('sub_portals'),
    statements: section('statements'),
  }
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

export function healthTiles(c: JourneyHealthCounts): HealthTile[] {
  const a = c.agreements ?? {}
  const r = c.bid_rooms ?? {}
  const p = c.portals ?? {}
  const s = c.sub_portals ?? {}
  const st = c.statements ?? {}
  const unopened = n(a.sent_unopened)
  const without = n(a.live_jobs_without)
  const neverOpened = n(r.never_opened)
  const portalsNever = Math.max(0, n(p.customers_with_link) - n(p.ever_visited))
  const subsNever = Math.max(0, n(s.subs_with_link) - n(s.ever_visited))
  const uncertified = Math.max(0, n(st.gcs_with_billed_work) - n(st.certified_this_month))
  return [
    {
      id: 'agreements',
      label: 'Agreements',
      line: `${n(a.signed)} signed · ${unopened} sent, unopened 3+ days · ${without} live ${without === 1 ? 'job' : 'jobs'} with none`,
      attention: unopened > 0 || without > 0,
      door: { label: without > 0 ? 'Start the sweep' : 'Open the Pipeline', to: '/jobs?tab=pipeline' },
    },
    {
      id: 'bid_rooms',
      label: 'Bid rooms',
      line: `${plural(n(r.published), 'room')} open · ${neverOpened} sent, never opened · ${n(r.signed)} signed`,
      attention: neverOpened > 0,
      door: { label: 'Open the Bid Board', to: '/bids?tab=bid-board' },
    },
    {
      id: 'portals',
      label: 'Customer portals',
      line: `${plural(n(p.customers_with_link), 'customer')} with a link · ${n(p.ever_visited)} ever visited · ${portalsNever} never`,
      attention: portalsNever > 0,
      door: { label: 'Open Customers', to: '/customers' },
    },
    {
      id: 'sub_portals',
      label: 'Sub portals',
      line: `${plural(n(s.subs_with_link), 'sub')} with a link · ${n(s.ever_visited)} ever visited · ${subsNever} never`,
      attention: subsNever > 0,
      door: { label: 'Open People → Subs', to: '/people?tab=subs' },
    },
    {
      id: 'statements',
      label: 'GC statements',
      line: `${plural(n(st.gcs_with_billed_work), 'builder')} with billed work · ${n(st.certified_this_month)} certified this month · ${n(st.sent_this_month)} sent`,
      attention: uncertified > 0,
      door: { label: 'GC Review', to: '/jobs?tab=pipeline' },
    },
  ]
}
