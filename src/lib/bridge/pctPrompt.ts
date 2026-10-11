/**
 * The percents prompt (the Bridge, v2.5245): the open jobs with a contract
 * and no percent. These are the jobs the Build card reads as half done and
 * draws grey, so the pile and the pace rest on a guess until someone sets
 * them. The strip under the stage cards counts them; its list puts the
 * biggest contract first, and each row opens the dashboard's percent modal.
 * A job set on the page stays on the list, marked set, at the bottom. Pure:
 * the page passes the Build reads and the jobs set this visit.
 */
import type { BuildJob, BuildPaceInput } from './buildPace'
import { stageUsd } from './stageFlow'

export type PctPromptRow = {
  id: string
  label: string
  contractUsd: number
  /** The percent set on the page this visit; null while the job still has none. */
  setPct: number | null
  /** The row's status cell: "no %" or "60% · set". */
  status: string
  /** The job as the dashboard's percent modal takes it. */
  modalJob: { id: string; hcpNumber: string; jobName: string; label: string }
}

export type PctPrompt = {
  /** The jobs with no percent, biggest contract first, then the ones set this visit. */
  rows: PctPromptRow[]
  /** Open jobs with a contract and no percent: the Build card's grey jobs. */
  greyCount: number
  /** Their contract, in dollars. */
  greyContractUsd: number
  /** The strip's line. */
  line: string
  /** Every open job with a contract has a percent. */
  done: boolean
}

export const PCT_PROMPT_DONE_LINE = 'Every open job with a contract has a %.'

/** The Build card's grey: an open job with a contract and no percent (`buildPace.ts` reads it as half done). */
export function isGreyJob(j: BuildJob): boolean {
  return j.revenueUsd != null && j.revenueUsd > 0 && j.pctComplete == null
}

const byContract = (a: PctPromptRow, b: PctPromptRow): number => b.contractUsd - a.contractUsd || a.label.localeCompare(b.label)

/** Null when there is nothing to show: no grey job and nothing set this visit. */
export function buildPctPrompt(openJobs: ReadonlyArray<BuildJob>, setThisVisit: ReadonlyMap<string, number>): PctPrompt | null {
  const grey: PctPromptRow[] = []
  const set: PctPromptRow[] = []
  for (const j of openJobs) {
    const pct = setThisVisit.get(j.id)
    const greyNow = isGreyJob(j)
    if (!greyNow && pct == null) continue
    const row: PctPromptRow = {
      id: j.id,
      label: j.label,
      contractUsd: j.revenueUsd ?? 0,
      setPct: greyNow ? null : (pct ?? null),
      status: greyNow ? 'no %' : `${pct}% · set`,
      // The modal's toast names the job by its number; a job with none is named by its name.
      modalJob: { id: j.id, hcpNumber: j.hcpNumber || j.jobName || j.label, jobName: j.jobName, label: j.label },
    }
    ;(greyNow ? grey : set).push(row)
  }
  if (grey.length === 0 && set.length === 0) return null
  grey.sort(byContract)
  set.sort(byContract)
  const greyContractUsd = grey.reduce((s, r) => s + r.contractUsd, 0)
  const n = grey.length
  const line = n === 0 ? PCT_PROMPT_DONE_LINE : `${n} open ${n === 1 ? 'job has' : 'jobs have'} no %. ${stageUsd(greyContractUsd)} of contract reads as half done.`
  return { rows: [...grey, ...set], greyCount: n, greyContractUsd, line, done: n === 0 }
}

/**
 * The Build reads after a percent is set on the page, without a reload: the
 * open job takes the percent and a hand-set point lands today, the way the
 * save's own percent event reads on the next load. A job created before the
 * window has no earlier point, so today's point is its baseline and nothing
 * counts as built; the grey shrinks and the known pile grows.
 */
export function withPctSet(input: BuildPaceInput, jobId: string, pct: number): BuildPaceInput {
  const i = input.openJobs.findIndex((j) => j.id === jobId)
  if (i < 0) return input
  const clamped = Math.max(0, Math.min(100, pct))
  const job: BuildJob = { ...input.openJobs[i]!, pctComplete: clamped }
  const openJobs = input.openJobs.map((j, k) => (k === i ? job : j))
  const jobsByPoint = new Map(input.jobsByPoint)
  jobsByPoint.set(jobId, job)
  const points = [...input.points, { jobId, atYmd: input.todayYmd, pct: clamped, source: 'hand' as const }]
  return { ...input, openJobs, jobsByPoint, points }
}
