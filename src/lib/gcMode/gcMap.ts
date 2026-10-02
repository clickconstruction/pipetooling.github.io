/**
 * GC mode — design spike. The map: towns, the drive, and the list of companies beside it.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
import type { GcProject, GcState, Invite, Partner, Town, TradePackage } from './gcTypes'

export const TOWNS: Town[] = [
  { name: 'Austin', lat: 30.2672, lng: -97.7431 },
  { name: 'Bandera', lat: 29.7266, lng: -99.0734 },
  { name: 'Boerne', lat: 29.7947, lng: -98.732 },
  { name: 'Corpus Christi', lat: 27.8006, lng: -97.3964 },
  { name: 'Fredericksburg', lat: 30.2752, lng: -98.872 },
  { name: 'Helotes', lat: 29.578, lng: -98.6897 },
  { name: 'Kerrville', lat: 30.0474, lng: -99.1403 },
  { name: 'Laredo', lat: 27.5306, lng: -99.4803 },
  { name: 'New Braunfels', lat: 29.703, lng: -98.1245 },
  { name: 'San Antonio', lat: 29.4241, lng: -98.4936 },
  { name: 'San Marcos', lat: 29.8833, lng: -97.9414 },
  { name: 'Seguin', lat: 29.5688, lng: -97.9647 },
  { name: 'Waco', lat: 31.5493, lng: -97.1467 },
]

/** About how far the drive is: the straight line between two towns, plus a fifth for the roads. */
export function driveMiles(from: string, to: string): number | null {
  const a = TOWNS.find((t) => t.name === from)
  const b = TOWNS.find((t) => t.name === to)
  if (!a || !b) return null
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return Math.round(3959 * 2 * Math.asin(Math.sqrt(h)) * 1.2)
}

/** One trade partner's drive to one project: how far, and whether they go that far. */
export interface Travel {
  /** Null: their coverage is not set, so nothing is known and nothing is held against them. */
  miles: number | null
  inZone: boolean
}

export function travelFor(_state: GcState, partner: Partner, project: GcProject): Travel {
  const miles = partner.base ? driveMiles(partner.base, project.town) : null
  if (miles === null) return { miles: null, inZone: true }
  return { miles, inZone: partner.maxMiles === null || miles <= partner.maxMiles }
}

/** "38 mi", or "80 mi, past their 60". Empty when the coverage is not set. */
export function travelWords(travel: Travel, partner: Partner): string {
  if (travel.miles === null) return ''
  return travel.inZone ? `${travel.miles} mi` : `${travel.miles} mi, past their ${partner.maxMiles}`
}

/** One company in the line for a trade on a project, nearest first. */
export interface LineupRow {
  partner: Partner
  travel: Travel
  invite: Invite | null
  /** 1 is the closest. Null: no coverage set, so not on the map. */
  rank: number | null
}

/** Every company that does this trade, in the order to work through them: the shortest drive first. */
export function tradeLineup(state: GcState, project: GcProject, pkg: TradePackage): LineupRow[] {
  const rows = state.partners
    .filter((p) => p.trades.includes(pkg.trade))
    .map((partner) => ({
      partner,
      travel: travelFor(state, partner, project),
      invite: pkg.invites.find((i) => i.partnerId === partner.id) ?? null,
    }))
    .sort((a, b) => (a.travel.miles ?? 9999) - (b.travel.miles ?? 9999) || a.partner.company.localeCompare(b.partner.company))
  let rank = 0
  return rows.map((row) => ({ ...row, rank: row.travel.miles === null ? null : ++rank }))
}

/** The next company to offer the trade to: the closest one in range we have not asked. */
export function nextToAsk(rows: LineupRow[]): LineupRow | null {
  return rows.find((r) => r.invite === null && r.travel.inZone) ?? null
}
