/**
 * Where a firm covers, as its window reads it (punch list #222, PR 1, v2.6195). One row per county the
 * firm covers with the cases and the open dollars in it, the cases with the firm that sit outside its
 * counties (released before the map changed), the chips' words, the nudge while no county is colored for
 * any firm, and the line the Replace panel reads when retiring would leave counties with no firm.
 *
 * The counts follow the Map view's legend (`legendCounts` in `firmMap.ts`): a case with a firm counts for
 * that firm wherever it sits; a case with no firm counts for the first call of its county. So the window's total
 * and the legend's row for the firm say the same number. Since v2.6227 (PR 3) a firm may cover a county without
 * being its first call: that row reads `also`, names the first call, and counts only the cases already with the
 * firm there. Pure.
 */
import { countyWords, firmsOfCover, type Coverage } from './firmCounties'
import type { LegalMapCase } from './firmMap'
import { formatLegalMoney } from './legalPacket'

export type FirmCoverageRow = {
  county: string
  cases: number
  balance: number
  /** `first`: the firm is the county's first call. `also`: another firm is, named in `firstCall`. */
  role: 'first' | 'also'
  firstCall: string
}

export type FirmWindowCoverage = {
  /** The firm's counties: first call ones first, then the ones it also covers; each by its open balance, then by name. */
  rows: FirmCoverageRow[]
  /** Cases with the firm in a county it no longer covers, or with no county: counted, not a row. */
  elsewhere: { cases: number; balance: number }
  counties: number
  /** How many of the counties it covers without being first call. */
  also: number
  cases: number
  balance: number
}

const round2 = (n: number): number => Math.round(n * 100) / 100

type CaseLike = Pick<LegalMapCase, 'county' | 'firmId' | 'balance'>

export function firmWindowCoverage(firmId: string, coverage: Coverage, cases: ReadonlyArray<CaseLike>): FirmWindowCoverage {
  const counties = new Set<string>()
  const rows: FirmCoverageRow[] = []
  for (const [county, cover] of coverage) {
    if (!firmsOfCover(cover).includes(firmId)) continue
    counties.add(county)
    const role = cover.first === firmId ? 'first' : 'also'
    // Under review in a shared county, a case is the first call's until the office switches; one already with this firm is this firm's.
    const here = cases.filter((c) => c.county === county && (c.firmId === firmId || (role === 'first' && c.firmId == null)))
    rows.push({ county, cases: here.length, balance: round2(here.reduce((s, c) => s + c.balance, 0)), role, firstCall: cover.first })
  }
  rows.sort((a, b) => (a.role === b.role ? 0 : a.role === 'first' ? -1 : 1) || b.balance - a.balance || b.cases - a.cases || a.county.localeCompare(b.county))
  const away = cases.filter((c) => c.firmId === firmId && !(c.county && counties.has(c.county)))
  const elsewhere = { cases: away.length, balance: round2(away.reduce((s, c) => s + c.balance, 0)) }
  const inRows = rows.reduce((s, r) => s + r.cases, 0)
  const balance = round2(rows.reduce((s, r) => s + r.balance, 0) + elsewhere.balance)
  return { rows, elsewhere, counties: rows.length, also: rows.filter((r) => r.role === 'also').length, cases: inRows + elsewhere.cases, balance }
}

/** The chip beside the heading: `5 counties`, `1 county`, or `no counties colored`. */
export function coverageCountyChip(counties: number): string {
  return counties === 0 ? 'no counties colored' : `${counties} ${counties === 1 ? 'county' : 'counties'}`
}

/** The second chip: `7 cases · $26,068.47`, or `no cases`. */
export function coverageCasesChip(cases: number, balance: number): string {
  if (cases === 0) return 'no cases'
  return `${cases} ${cases === 1 ? 'case' : 'cases'} · ${formatLegalMoney(balance)}`
}

/** The sum row's first cell: `5 counties`, `5 counties · 1 shared`, or `… · 1 case with the firm elsewhere`. */
export function coverageSumWords(c: Pick<FirmWindowCoverage, 'counties' | 'elsewhere'> & { also?: number }): string {
  const parts = [coverageCountyChip(c.counties)]
  if (c.also) parts.push(`${c.also} shared`)
  if (c.elsewhere.cases) parts.push(`${c.elsewhere.cases} ${c.elsewhere.cases === 1 ? 'case' : 'cases'} with the firm elsewhere`)
  return parts.join(' · ')
}

/** Under the heading: what covering means for a release. */
export function coverageHintWords(firmName: string): string {
  return `New releases in these counties go to ${firmName}. Changing a county affects new releases only. A matter stays with the firm it went to.`
}

export type CoverageState =
  /** The firm covers at least one county. */
  | { kind: 'covers' }
  /** No county is colored for any firm: the desk runs on the bridge (one firm takes everything) or picks nobody (several firms). */
  | { kind: 'nothing_colored'; firms: number }
  /** Other firms cover counties; this one covers none. */
  | { kind: 'none_here' }

export function coverageState(firmId: string, coverage: Coverage, activeFirms: number): CoverageState {
  for (const cover of coverage.values()) if (firmsOfCover(cover).includes(firmId)) return { kind: 'covers' }
  if (coverage.size === 0) return { kind: 'nothing_colored', firms: activeFirms }
  return { kind: 'none_here' }
}

/**
 * The nudge over the empty map. One firm and nothing colored is the bridge, and the first county colored for
 * anyone ends it; the window says so before a second firm is added. Several firms and nothing colored means
 * the desk can pick nobody.
 */
export function coverageNudgeWords(firmName: string, state: CoverageState): string | null {
  if (state.kind === 'covers') return null
  if (state.kind === 'none_here') return `${firmName} covers no county. The desk never picks it for a release until a county is colored for it.`
  if (state.firms <= 1) return `${firmName} takes every account today, by default. No county is colored for any firm, so the desk sends everything to the one firm. The first county colored for any firm ends that: an account outside a colored county has no firm. Color ${firmName}’s counties now, before a second firm is added.`
  return `No county is colored for any firm. With ${state.firms} firms and no counties, the desk cannot pick a firm for any account. Color each firm’s counties under Firms….`
}

/** The press under the nudge. */
export function coverageNudgeButton(firmName: string): string {
  return `Color ${firmName}’s counties…`
}

/**
 * Over the Save while no county is colored for any firm (punch list #222, PR 2, v2.6221): the first save ends the
 * default, and a case whose county no firm covers can no longer be released. Names up to three such cases from the
 * draft, plainly, so the dev adds their counties or saves knowing. `off` is the draft's accounts still in review
 * whose county no firm covers (`stand` is `eyes` and `effectiveStand` reads `none`); a given-up account is never released.
 */
export function bridgeEndsWords(firmName: string, off: ReadonlyArray<{ name: string; county: string | null }>): string {
  if (off.length === 0) return `Saving ends the default. Every case sits in a county ${firmName} covers.`
  const named = off.slice(0, 3).map((c) => (c.county ? `${c.name} in ${countyWords(c.county)}` : `${c.name}, whose county is unknown`))
  const more = off.length > 3 ? ` and ${off.length - 3} more` : ''
  const n = off.length
  return `Saving ends the default. ${n} ${n === 1 ? 'case sits' : 'cases sit'} where no firm covers: ${named.join(', ')}${more}. Add ${n === 1 ? 'its county' : 'their counties'} too, or the desk cannot release ${n === 1 ? 'it' : 'them'}.`
}

/** `Bell, Hays and Travis` · `Bell and Hays` · `Bell`. */
function countyList(counties: ReadonlyArray<string>): string {
  const names = counties.map((c) => countyWords(c))
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * Over the Replace panel (v2.4712) while the firm covers counties: today's replace retires the firm everywhere
 * and its counties count as uncovered until a dev colors them again. Null when the firm covers none.
 */
export function replaceLeavesUncoveredWords(firmName: string, counties: ReadonlyArray<string>): string | null {
  if (counties.length === 0) return null
  const sorted = [...counties].sort((a, b) => a.localeCompare(b))
  const n = sorted.length
  return `Replacing retires ${firmName} everywhere. ${n === 1 ? countyList(sorted) : `Its ${n} counties, ${countyList(sorted)},`} would have no firm until you color ${n === 1 ? 'it' : 'them'} for the new firm under Firms….`
}
