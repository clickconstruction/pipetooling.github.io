/**
 * GC mode, the real build: the Building lane's day math, our crew's stages and a draw sent back, moved
 * word for word from the GC mode prototype (branch spike/gc-mode, `gcBuilding.ts`) by the schedule's
 * PR 1a, which reads them. The Building lane's lift (U2) adds the rest of `gcBuilding.ts` here.
 */
import type { DrawSentBack, Sow, TradePackage } from './types'

/**
 * How much of a trade each stage is worth, by its name (my default, owner unconfirmed): rough in
 * carries the most. A stage with another name gets an even share. The shares are scaled to 100.
 */
export const CREW_STAGE_WEIGHTS: Record<string, number> = { Underground: 20, 'Rough in': 35, 'Top out': 25, Trim: 20 }

export function crewStages(pkg: TradePackage): { lineId: string; label: string; weight: number }[] {
  const raw = pkg.scope.map((item) => ({ lineId: item.id, label: item.label, weight: CREW_STAGE_WEIGHTS[item.label] ?? 25 }))
  const total = raw.reduce((s, r) => s + r.weight, 0)
  return raw.map((r) => ({ ...r, weight: total === 0 ? 0 : (r.weight / total) * 100 }))
}

// ---------------------------------------------------------------------------------------------
// The office sends a pay application back
// ---------------------------------------------------------------------------------------------

/** The pay application we sent back that the trade has not sent again yet. Null: none waiting. */
export function sentBackOpen(sow: Sow): DrawSentBack | null {
  const next = sow.draws.length + 1
  const list = sow.sentBack ?? []
  for (let i = list.length - 1; i >= 0; i--) {
    const back = list[i]
    if (back && back.draw.number === next) return back
  }
  return null
}

/** The day after `days` days, as YYYY-MM-DD (UTC, so no time zone moves it). */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10)
}
