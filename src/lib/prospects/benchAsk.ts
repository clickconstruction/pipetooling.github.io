/**
 * The ask on landing (v2.5810, punch list #153, PR 4): a run that names a job lets Add to the bench ✓
 * ask the new company to quote it in the same press, the ask Trade partners makes
 * (`askGcCompanies` → `gc_invite_companies`). These are the tick's words and the button's. Pure.
 */

export interface BenchAsk {
  projectName: string
  trade: string
  packageId: string
}

/** The tick's words: "Ask them to quote Oak Run Clinic · Fire sprinkler now". */
export function benchAskWords(ask: BenchAsk): string {
  return `Ask them to quote ${ask.projectName} · ${ask.trade} now`
}

export const BENCH_SAVE = 'Save to the bench'
export const BENCH_SAVE_AND_ASK = 'Save to the bench and ask'

/** The run's ask for a landing: the picked project's package on the run's trade, when both are known. */
export function benchAskFor(run: { trade: string | null; packageId: string | null } | null, projectName: string | null): BenchAsk | null {
  if (!run || !run.trade || !run.packageId || !projectName) return null
  return { projectName, trade: run.trade, packageId: run.packageId }
}

/** The toast after a landing that asked: "Alamo Sprinkler Co is on the bench and asked on Oak Run Clinic". */
export function benchAskedToast(companyName: string, projectName: string, sent: boolean): string {
  const who = companyName.trim() || 'The company'
  return `${who} is on the bench and asked on ${projectName}${sent ? ', the invitation emailed' : ''}`
}
