import { tradeBenches } from '../gc/bench'
import { boardStateFromRows, type BoardRows } from '../gc/boardRows'
import type { GcProjectView } from '../gc/projectRows'
import { gcBenchInput, type GcBenchIn } from './gcNeeds'
import { plansChoices, type PlansChoice } from './subsStages'

/** What the Subs lane keeps of the GC board's read. */
export type BenchRead = {
  /** The bench's trades and how many companies each can count on (the Trades picks, By need). */
  benchTrades: { trade: string; dependable: number }[]
  /** The bench companies that have quoted at least once (the path strip's last box). */
  benchQuoted: Set<string>
  /** The projects a set of plans could be for (the For picker). */
  gcPlans: PlansChoice[]
  /** The bench with its open asks, and the trades we do ourselves (the needs panel). */
  gcBench: { benches: GcBenchIn[]; ownTrades: string[] }
  /** The bench's companies, for New Prospect's double check. Vetted is true when approved, false when new, unknown otherwise. */
  benchCompanies: { id: string; name: string; phone: string | null; trades: string[]; vetted?: boolean }[]
}

/**
 * The GC board's rows as the Subs lane reads them, through the board's own kernels (`boardStateFromRows`,
 * `tradeBenches`), so the lane says what the bench's own rule says. Moved out of an effect in
 * `src/pages/Prospects.tsx`, where it sat between two awaits.
 */
export function benchReadFromBoard(rows: BoardRows, projects: readonly GcProjectView[], today: string): BenchRead {
  const state = boardStateFromRows(rows)
  const benches = tradeBenches(state)
  return {
    benchTrades: benches.map((b) => ({ trade: b.trade, dependable: b.dependable })),
    benchQuoted: new Set(state.partners.filter((p) => p.bids > 0).map((p) => p.id)),
    gcPlans: plansChoices(projects.map((p) => ({ id: p.id, name: p.name, stage: p.stage, bidDue: p.bidDue, lostOn: p.lostOn, packages: p.trades.map((k) => ({ id: k.id, trade: k.trade, ours: k.ours })) })), today),
    gcBench: { benches: gcBenchInput(benches), ownTrades: state.projects.flatMap((p) => p.packages.filter((k) => k.selfPerform).map((k) => k.trade)) },
    benchCompanies: rows.companies.map((c) => ({ id: c.id, name: c.name, phone: c.phone || null, trades: c.trades, vetted: c.vetting_status === 'approved' ? true : c.vetting_status === 'new' ? false : undefined })),
  }
}
