/**
 * GC mode, the office's Trade portals card (P1b-ii-b, to-dos/gc-mode/PORTAL_REAL_BUILD.md, decision 3): where each
 * company's portal link stands, from its rows in `gc_trade_portal_links` and the outside visits `gc-trade-portal`
 * counted in `public_page_views`. The prototype's `tradePortalStatus` read made-up links; this reads the real ones.
 * Pure. A dev makes the links until the door.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { shortDate } from './words'

/** A company's link row, as a dev reads it. */
export interface TradeLinkRow {
  company_id: string
  token: string | null
  created_at: string
  revoked_at: string | null
}

/** The company's outside visits: the office's preview and a signed-in teammate never count. */
export interface TradeLinkVisits {
  opens: number
  lastAt: string | null
}

/** none: never had a link. off: its last link was turned off. waiting: on, not opened yet. active: they opened it. */
export type TradeLinkState = 'none' | 'off' | 'waiting' | 'active'

export interface TradeLinkStatus {
  state: TradeLinkState
  /** The chip's word. */
  word: string
  /** One sentence under it. */
  words: string
  /** The link that is on. Null when none is. */
  token: string | null
}

// The office's day for a moment, so an evening in Central time is not read as the next day.
const day = (iso: string | null): string => (iso ? shortDate(calendarYmdInAppTzFromIso(iso)) : '')

/** Where one company's link stands. */
export function tradeLinkStatus(rows: TradeLinkRow[], companyId: string, visits: TradeLinkVisits | null): TradeLinkStatus {
  const mine = rows.filter((r) => r.company_id === companyId).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const on = mine.find((r) => r.revoked_at === null && r.token)
  if (!on) {
    const last = mine[0]
    return last
      ? { state: 'off', word: 'turned off', words: `Its link was turned off ${day(last.revoked_at)}. Make a new link to send it one.`, token: null }
      : { state: 'none', word: 'no link yet', words: 'Make the link, then send it with the ask to quote.', token: null }
  }
  const opens = visits?.opens ?? 0
  if (opens === 0) return { state: 'waiting', word: 'not opened yet', words: `Made ${day(on.created_at)}. They have not opened it yet.`, token: on.token }
  return { state: 'active', word: 'active', words: `Opened ${opens === 1 ? 'once' : `${opens} times`}, last ${day(visits?.lastAt ?? null)}.`, token: on.token }
}

/** Visit rows to each company's count and latest, counting only those since its link that is on was made. */
export function tradeLinkVisits(views: { entity_id: string | null; occurred_at: string }[], rows: TradeLinkRow[]): Record<string, TradeLinkVisits> {
  const since = new Map(rows.filter((r) => r.revoked_at === null).map((r) => [r.company_id, r.created_at]))
  const out: Record<string, TradeLinkVisits> = {}
  for (const v of views) {
    const id = v.entity_id ?? ''
    const from = since.get(id)
    if (!from || v.occurred_at < from) continue
    const was = out[id] ?? { opens: 0, lastAt: null }
    out[id] = { opens: was.opens + 1, lastAt: was.lastAt && was.lastAt > v.occurred_at ? was.lastAt : v.occurred_at }
  }
  return out
}
