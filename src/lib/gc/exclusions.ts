/**
 * GC mode, the real build, PR 1b: each trade's usual exclusions and the shared name for what a
 * company writes, moved word for word from the GC mode prototype (branch spike/gc-mode,
 * `gcExclusions.ts`; the owner, 2026-10-04: "various groups will have different kinds of
 * exclusions. We want to be able to track those exclusions on a per vendor basis"). The scope book
 * reads these. The cover costs' total came with the schedule's PR 1a, which reads it for a line's
 * worth; the quote's own cells and habits stay with the prototype until their step.
 */
import type { SubBid, TradePackage } from './types'

/** Exclusions any trade's quote may list, and each trade's own. The portal's form offers these as ticks. */
export const COMMON_EXCLUSIONS: { all: string[]; byTrade: Record<string, string[]> } = {
  all: ['Permits and fees', 'Bonds', 'Sales tax', 'Testing and inspections', 'Night or weekend work', 'Temporary power and water'],
  byTrade: {
    Sitework: ['Dewatering', 'Rock excavation', 'Haul off of bad soil', 'Erosion control and SWPPP'],
    Concrete: ['Rebar supply', 'Vapor barrier', 'Pump truck', 'Cold weather protection'],
    'Structural steel': ['Crane', 'Fireproofing', 'Touch-up paint'],
    Roofing: ['Roof curbs', 'Roof blocking', 'Warranty past two years'],
    HVAC: ['Controls', 'Test and balance', 'Roof curbs', 'Fire dampers'],
    Electrical: ['Fire alarm', 'Low voltage', 'Utility company fees', 'Light fixtures supply'],
    Plumbing: ['Gas piping', 'Fixtures supply', 'Tap fees', 'Water heater'],
    'Fire sprinkler': ['Fire alarm tie-in', 'Fire pump', 'Backflow preventer'],
    'Framing and drywall': ['Insulation', 'Blocking for others', 'Level 5 finish'],
    Painting: ['Exterior paint', 'Special coatings'],
    Flooring: ['Floor prep and leveling', 'Moisture testing'],
    Landscaping: ['Irrigation sleeves under paving', 'Maintenance after planting'],
  },
}

/** Words people write for the same thing, folded onto one name. */
const SAME_AS: Record<string, string> = {
  permit: 'Permits and fees',
  permits: 'Permits and fees',
  'permit fees': 'Permits and fees',
  'permits and permit fees': 'Permits and fees',
  bond: 'Bonds',
  'p and p bond': 'Bonds',
  'payment and performance bond': 'Bonds',
  tax: 'Sales tax',
  taxes: 'Sales tax',
  testing: 'Testing and inspections',
  inspections: 'Testing and inspections',
  'testing and inspection': 'Testing and inspections',
  rock: 'Rock excavation',
  'rock removal': 'Rock excavation',
  dewater: 'Dewatering',
  'after hours work': 'Night or weekend work',
  'overtime work': 'Night or weekend work',
  'temp power': 'Temporary power and water',
  'temporary power': 'Temporary power and water',
}

function fold(words: string): string {
  return words.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
}

/**
 * The exclusions a trade's form offers: its own first, then the ones every trade may have, each
 * once. With the scope book's exclusion names (`scopeBookExclusions`, New Project), the ones the
 * book has for the trade lead, most named first: what our jobs and past quotes left out.
 */
export function exclusionsFor(trade: string, book?: { trade: string; name: string }[]): string[] {
  const fromBook = (book ?? []).filter((x) => x.trade === trade).map((x) => x.name)
  return [...new Set([...fromBook, ...(COMMON_EXCLUSIONS.byTrade[trade] ?? []), ...COMMON_EXCLUSIONS.all])]
}

/** The shared name for what someone wrote: "permits" and "Permit fees" are both "Permits and fees". */
export function exclusionName(said: string): string {
  const key = fold(said)
  if (!key) return ''
  if (SAME_AS[key]) return SAME_AS[key]
  const known = [...COMMON_EXCLUSIONS.all, ...Object.values(COMMON_EXCLUSIONS.byTrade).flat()].find((n) => fold(n) === key)
  if (known) return known
  const t = said.trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** The cost to cover what a quote leaves out beyond the trade's Known exclusions: it goes into the all-in number. */
export function exclusionCoversTotal(pkg: TradePackage, bid: SubBid): number {
  const known = new Set((pkg.excludes ?? []).map((k) => fold(k.label)))
  return (bid.exclusions ?? []).filter((e) => !known.has(fold(e.name))).reduce((t, e) => t + (bid.exclusionCovers?.[e.name] ?? 0), 0)
}
