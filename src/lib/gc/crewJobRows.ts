/**
 * GC mode, the real build, the Building lane's U8: our own crew's percent from its Pipeline job
 * (to-dos/gc-mode/mockups/building-u8.md on branch spike/gc-mode, calls 5, 7, 8 and 12, amendment 2). A trade our
 * own crew does names the job it runs on (`gc_trade_packages.job_ledger_id`, migration 20261010063000). Each of
 * its stage lines reads the job's stage of the same rank (`stageRank`), when every line has one and the crew has
 * reported one. Otherwise the whole trade reads the job's crew report while it is the newest word, or the job's
 * own percent. With none of them the trade keeps what it had, so a missing number never reads as a measured zero.
 */
import type { Database } from '../../types/database'
import { stageRank, type StageRank } from '../jobs/stageRecognition'
import { resolveJobSummaryPercentCompleteWithSource } from '../jobSummaryPercentComplete'
import { isoToPlainDateInAppTz } from '../personContractAppliedDate'
import { crewPctFromStages } from './building'
import type { GcState, TradePackage } from './types'
import { shortDate } from './words'

type StageProgressRow = Database['public']['Functions']['list_job_stage_progress']['Returns'][number]

/** One row of `list_job_stage_progress`. Its percent and its day are null until the crew reports the stage, whatever the generated type says. */
export type CrewStageRow = Omit<StageProgressRow, 'progress_pct' | 'progress_at'> & { progress_pct: number | null; progress_at: string | null }

/** What the page read for one linked trade. */
export interface CrewJobRead {
  packageId: string
  jobId: string
  /** The job's number as the Pipeline shows it (`jobNumberLabel`). */
  label: string
  name: string
  stages: CrewStageRow[]
  /** The crew report's percent while it is the newest word on the job (`currentReportPctByJobId`), and its day. */
  reportPct: number | null
  reportedOn: string | null
  /** The job's own percent, `jobs_ledger.pct_complete`. */
  pctComplete: number | null
}

/** Our crew's percent from its Pipeline job, and where it came from. */
export type CrewPercent =
  | {
      from: 'stages'
      /** Each scope line's percent. */
      pctByLine: Record<string, number>
      /** The whole trade's percent, weighed from the stages as `ownCrewWork` weighs them. */
      pctDone: number
      /** The day each line's stage was last reported, in the company's time zone. */
      reportedByLine: Record<string, string | null>
      /** The newest day any of it was reported. */
      reportedOn: string | null
    }
  | { from: 'report' | 'job'; pctDone: number; reportedByLine: Record<string, string | null>; reportedOn: string | null }
  | { from: 'none'; reportedByLine: Record<string, string | null>; reportedOn: null }

const newest = (days: (string | null)[]): string | null => days.reduce<string | null>((a, d) => (d && (!a || d > a) ? d : a), null)

/** A line's percent: its stages' mean, weighed by their share of the job when they have one. */
function linePct(stages: CrewStageRow[]): number {
  const total = stages.reduce((s, st) => s + Number(st.weight_pct || 0), 0)
  const pct = (st: CrewStageRow) => Number(st.progress_pct ?? 0)
  return total > 0 ? stages.reduce((s, st) => s + Number(st.weight_pct || 0) * pct(st), 0) / total : stages.reduce((s, st) => s + pct(st), 0) / stages.length
}

/** Calls 5, 7 and 8: our crew's percent from its Pipeline job. */
export function crewPercentOf(pkg: TradePackage, read: CrewJobRead): CrewPercent {
  const byRank = new Map<StageRank, CrewStageRow[]>()
  for (const st of read.stages) {
    const rank = stageRank(st.name)
    if (rank !== null) byRank.set(rank, [...(byRank.get(rank) ?? []), st])
  }
  const lines = pkg.scope.map((line) => {
    const rank = stageRank(line.label)
    return { line, stages: rank === null ? [] : (byRank.get(rank) ?? []) }
  })
  const everyLine = lines.length > 0 && lines.every((l) => l.stages.length > 0)
  if (everyLine && lines.some((l) => l.stages.some((st) => st.progress_at))) {
    const pctByLine: Record<string, number> = {}
    const reportedByLine: Record<string, string | null> = {}
    for (const { line, stages } of lines) {
      pctByLine[line.id] = linePct(stages)
      reportedByLine[line.id] = newest(stages.map((st) => isoToPlainDateInAppTz(st.progress_at)))
    }
    return { from: 'stages', pctByLine, pctDone: crewPctFromStages(pkg, pctByLine), reportedByLine, reportedOn: newest(Object.values(reportedByLine)) }
  }
  const whole = resolveJobSummaryPercentCompleteWithSource(read.reportPct, read.pctComplete)
  if (whole.pct !== null && whole.source === 'crew-report') return { from: 'report', pctDone: whole.pct, reportedByLine: {}, reportedOn: read.reportedOn }
  if (whole.pct !== null) return { from: 'job', pctDone: whole.pct, reportedByLine: {}, reportedOn: null }
  return { from: 'none', reportedByLine: {}, reportedOn: null }
}

/**
 * The board with each linked crew's percent laid into `selfPerform` (`pctByLine`, `pctDone`, `source`). The page
 * lays it over the `board` itself, so every window reads one percent. A read that finds nothing leaves the trade.
 */
export function withCrewPercents(state: GcState, reads: readonly CrewJobRead[]): GcState {
  if (reads.length === 0) return state
  const byPackage = new Map(reads.map((r) => [r.packageId, r]))
  return {
    ...state,
    projects: state.projects.map((project) => {
      let laid = false
      const packages = project.packages.map((pkg) => {
        const read = byPackage.get(pkg.id)
        if (!read || !pkg.selfPerform) return pkg
        const pct = crewPercentOf(pkg, read)
        if (pct.from === 'none') return pkg
        laid = true
        const { pctByLine: _byLine, pctDone: _done, source: _source, ...self } = pkg.selfPerform
        return {
          ...pkg,
          selfPerform: {
            ...self,
            ...(pct.from === 'stages' ? { pctByLine: pct.pctByLine } : {}),
            pctDone: pct.pctDone,
            source: { from: pct.from, job: read.label, on: pct.reportedOn },
          },
        }
      })
      return laid ? { ...project, packages } : project
    }),
  }
}

/** Where the whole trade's percent comes from, in words. */
export function ownCrewWords(pkg: TradePackage, linked: boolean, read: CrewJobRead | null): string {
  if (!linked) return 'Pick the job our crew works on. Its stages give our percent. Its clock-ins give the daily log’s count.'
  const job = `Pipeline job ${read?.label ?? ''}`.trim()
  const source = pkg.selfPerform?.source
  if (source?.from === 'stages') return `Each stage reads its percent from ${job}. The whole trade follows from the stages.`
  if (source?.from === 'report') return `${job} has no stage to read for each of ours. The whole trade reads its crew report${source.on ? ` of ${shortDate(source.on)}` : ''}.`
  if (source?.from === 'job') return `${job} has no stage to read for each of ours. The whole trade reads the job’s own percent.`
  return `Nothing is reported on ${job} yet.`
}

/** A Pipeline job a crew trade holds, and how the picker names where (one job per crew trade, call 11, amendment 3). */
export interface CrewJobHeld {
  jobId: string
  packageId: string
  /** Its trade on this GC job (`Electrical`), or its trade and job on another (`Plumbing at Stone Oak`). */
  words: string
}

/** The packageId a project's general conditions hold their Pipeline job under (O11b): never a trade's id. */
export function generalConditionsHolder(projectId: string): string {
  return `general-conditions:${projectId}`
}

/**
 * Every Pipeline job a crew trade holds on the GC jobs the page read, named from the job the picker is on. With
 * `gcJobs` (Owner Billing's O11b: each project's general conditions job, which only the money team's board carries),
 * those jobs are held too, as "general conditions" on this GC job and "general conditions at Stone Oak" on another.
 */
export function crewJobsHeld(
  projects: readonly { id: string; name: string; trades: readonly { id: string; trade: string; ours: boolean; jobLedgerId?: string | null }[] }[],
  onProjectId: string | null,
  gcJobs: Readonly<Record<string, string | null | undefined>> = {},
): CrewJobHeld[] {
  return projects.flatMap((p) => {
    const here = p.id === onProjectId
    const crews = p.trades.flatMap((t) => (t.ours && t.jobLedgerId ? [{ jobId: t.jobLedgerId, packageId: t.id, words: here ? t.trade : `${t.trade} at ${p.name}` }] : []))
    const gcJob = gcJobs[p.id]
    return gcJob ? [...crews, { jobId: gcJob, packageId: generalConditionsHolder(p.id), words: here ? 'general conditions' : `general conditions at ${p.name}` }] : crews
  })
}

/** The jobs another crew trade holds, by job id: the picker shows them and does not let one be picked. */
export function heldByOthers(held: readonly CrewJobHeld[], packageId: string): Record<string, string> {
  return Object.fromEntries(held.filter((h) => h.packageId !== packageId).map((h) => [h.jobId, h.words]))
}
