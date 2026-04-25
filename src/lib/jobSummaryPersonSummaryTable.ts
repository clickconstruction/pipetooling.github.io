import type { PartsPerPersonCostRow } from './partsPerPersonCostSummary'
import { normalizePersonNameKey } from './personNameKey'

export type TeamLaborPersonCostLite = { personName: string; cost: number; hours?: number }

export type JobSummaryPersonSummaryRow = {
  normKey: string
  displayName: string
  hours: number
  teamLabor: number
  card: number
}

/**
 * Merges team labor per person with per-person card amounts from `buildPartsPerPersonCostRows` rows
 * (card column only; tally-only people without team labor are excluded unless they have card).
 */
export function buildJobSummaryPersonSummaryRows(args: {
  teamBreakdown: TeamLaborPersonCostLite[]
  ppRows: PartsPerPersonCostRow[]
}): JobSummaryPersonSummaryRow[] {
  const { teamBreakdown, ppRows } = args
  const map = new Map<string, { displayName: string; hours: number; teamLabor: number; card: number }>()

  for (const b of teamBreakdown) {
    const k = normalizePersonNameKey(b.personName)
    const ex = map.get(k)
    const cost = Number(b.cost) || 0
    const hrs = Number(b.hours) || 0
    if (ex) {
      ex.teamLabor += cost
      ex.hours += hrs
    } else {
      map.set(k, {
        displayName: (b.personName ?? '').trim() || 'Unknown',
        hours: hrs,
        teamLabor: cost,
        card: 0,
      })
    }
  }

  for (const r of ppRows) {
    if (r.key === 'g:job') continue
    const k = normalizePersonNameKey(r.displayName)
    const cardAmt = Math.abs(Number(r.cardCharges) || 0)
    const ex = map.get(k)
    if (ex) {
      ex.card += cardAmt
    } else if (cardAmt > 0) {
      map.set(k, {
        displayName: (r.displayName ?? '').trim() || 'Unknown',
        hours: 0,
        teamLabor: 0,
        card: cardAmt,
      })
    }
  }

  const rows: JobSummaryPersonSummaryRow[] = [...map.entries()].map(([normKey, v]) => ({
    normKey,
    displayName: v.displayName,
    hours: v.hours,
    teamLabor: v.teamLabor,
    card: v.card,
  }))

  rows.sort((a, b) => {
    const aUn = a.displayName.trim().toLowerCase() === 'unattributed'
    const bUn = b.displayName.trim().toLowerCase() === 'unattributed'
    if (aUn !== bUn) return aUn ? 1 : -1
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
  })

  return rows
}
