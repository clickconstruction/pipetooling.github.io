/**
 * The flow panel and its rail as a model (Messages cut 4; the prototype v1.178's `flowPanelHtml` and `railHtml`): the
 * title by kind, the lanes the job reads, each step's mark, its paper marks, its day, the lapsed reason, whom it waits
 * on, whose move it is, the per-job caption's jobs, and how far along. Pure; `FlowPanel.tsx` and `FlowRail.tsx` draw it.
 */
import { whoseMove } from './card'
import { FLOW_PAPERS, docFactOf, isDocPaperId, type FactMark } from './facts'
import type { PersonFlow } from './nudges'
import {
  LANE_WORDS,
  flowProgress,
  lapsedWhy,
  moverOf,
  perJobJobs,
  stepById,
  type FactReading,
  type Lane,
  type OffFlow,
  type StepReading,
  type StepState,
} from './state'

export type PaperMarkSymbol = '✓' | '↗' | '!' | '○'

export interface PanelPaper {
  paper: string
  /** The paper's short word ("W-9", "insurance"); a library paper's is "paper" until its name is known. */
  short: string
  mark: PaperMarkSymbol
  /** In words: "their W-9: on file". */
  words: string
}

export interface PanelBox {
  stepId: string
  jobId: string | null
  name: string
  state: StepState
  /** What the mark shows: ✓ done, ! lapsed, – skipped, ↻ a loop; nothing otherwise. */
  symbol: '✓' | '!' | '–' | '↻' | ''
  loop: boolean
  fork: boolean
  aside: boolean
  /** On now or lapsed: whose move (the card's `whoseMove`). Null otherwise. */
  move: 'us' | 'them' | 'both' | 'wait' | null
  papers: PanelPaper[]
  /** The step's or the open round's day: "late 2 days", "due Fri". */
  day: { words: string; late: boolean } | null
  /** "lapsed · insurance expired" on a lapsed step. */
  lapsed: string | null
  /** The first name of whom it waits on. */
  waitingOn: string | null
  /** Why it is skipped for them. */
  skipWhy: string | null
  /** How many rounds a loop has had. */
  rounds: number
}

export interface PanelLane {
  lane: Lane
  label: string
  jobId: string | null
  boxes: PanelBox[]
}

export interface PanelJob {
  jobId: string
  name: string
  /** The step it is on, or "not started", "ended", "all done". */
  words: string
  isDefault: boolean
  picked: boolean
}

export interface FlowPanelModel {
  title: string
  off: OffFlow | null
  lanes: PanelLane[]
  progress: { done: number; of: number }
  /** The Per job lane's caption: each job with the step it is on. */
  jobs: PanelJob[]
  /** The job the Per job lane is drawn for. */
  jobId: string | null
}

const TITLES: Readonly<Record<string, string>> = {
  customer: 'Customer flow',
  trade: 'Trade partner flow',
  arch: 'Architect flow',
  unknown: 'The flow',
}

const MARK: Readonly<Record<FactMark, PaperMarkSymbol>> = { ok: '✓', wait: '↗', bad: '!', no: '○' }
const MARK_WORDS: Readonly<Record<FactMark, string>> = { ok: 'on file', wait: 'went, waiting on them', bad: 'ran out', no: 'nothing yet' }

/** The facts a step reads now: its open round's, else its own. */
const factsNow = (s: StepReading): FactReading[] => s.rounds.find((r) => r.state === 'now')?.facts ?? s.facts

/** One paper's mark on a step: the fact that reads it, else a library paper's fact on it, else nothing yet. */
function paperMark(paper: string, facts: readonly FactReading[]): PanelPaper {
  const named = FLOW_PAPERS[paper as keyof typeof FLOW_PAPERS]
  if (named) {
    const f = facts.find((x) => x.fact.paper === named.id)
    const mark = f?.mark ?? 'no'
    return { paper, short: named.short, mark: MARK[mark], words: `${named.name}: ${MARK_WORDS[mark]}` }
  }
  if (isDocPaperId(paper)) {
    const docId = paper.slice('doc:'.length)
    const f = facts.find((x) => docFactOf(String(x.fact.id))?.docId === docId)
    const mark = f?.mark ?? 'no'
    return { paper, short: 'paper', mark: MARK[mark], words: `the paper: ${MARK_WORDS[mark]}` }
  }
  return { paper, short: paper, mark: '○', words: `${paper}: nothing yet` }
}

const SYMBOL: Readonly<Partial<Record<StepState, PanelBox['symbol']>>> = { done: '✓', lapsed: '!', skipped: '–' }

/**
 * The panel for one person, its Per job lane drawn for `jobId` (else their default job, else their first). `people`
 * holds whoever a step can wait on, for their first name.
 */
export function flowPanel(person: PersonFlow, jobId: string | null, people: readonly PersonFlow[] = []): FlowPanelModel {
  const r = person.reading
  const jobs = perJobJobs(r)
  const picked = jobId && jobs.some((j) => j.jobId === jobId) ? jobId : r.defaultJobId && jobs.some((j) => j.jobId === r.defaultJobId) ? r.defaultJobId : (jobs[0]?.jobId ?? null)
  const lanes = r.lanes.filter((l) => l.lane !== 'per_job' || l.jobId === picked)
  const panelLanes: PanelLane[] = lanes.map((l) => ({
    lane: l.lane,
    label: LANE_WORDS[l.lane],
    jobId: l.jobId,
    boxes: l.steps.map((s) => {
      const def = stepById(person.flow, s.stepId)
      const placed = s.state === 'now' || s.state === 'lapsed'
      const waiting = s.waitingOn
      const day = s.day ?? s.rounds.find((x) => x.state === 'now')?.day ?? null
      return {
        stepId: s.stepId,
        jobId: s.jobId,
        name: def?.name ?? s.stepId,
        state: s.state,
        symbol: SYMBOL[s.state] ?? (def?.loop ? '↻' : ''),
        loop: Boolean(def?.loop),
        fork: Boolean(def?.fork),
        aside: Boolean(def?.aside),
        move:
          placed && def
            ? whoseMove({ who: moverOf(def, s) }, { onNow: r.nowStepId === s.stepId && (r.nowJobId ?? null) === (s.jobId ?? null), waiting: Boolean(waiting), perJob: l.lane === 'per_job', owe: person.owe, court: person.court })
            : null,
        papers: (def?.papers ?? []).map((p) => paperMark(String(p), factsNow(s))),
        day: day && s.state !== 'done' && s.state !== 'skipped' ? { words: day.words, late: day.late } : null,
        lapsed: s.state === 'lapsed' ? lapsedWhy(s, (p) => FLOW_PAPERS[p]?.short ?? p) : null,
        waitingOn: waiting ? (people.find((p) => p.id === waiting.contactId)?.first ?? null) : null,
        skipWhy: s.skip?.why ?? null,
        rounds: s.rounds.length,
      }
    }),
  }))
  const name = (id: string) => person.jobs?.[id] ?? id
  return {
    title: TITLES[person.flow.kind] ?? 'The flow',
    off: r.off,
    lanes: panelLanes,
    progress: flowProgress(person.flow, r, picked),
    jobs: jobs.map((j) => ({
      jobId: j.jobId,
      name: name(j.jobId),
      words: j.ended ? 'ended' : j.headStepId ? (stepById(person.flow, j.headStepId)?.name ?? j.headStepId) : j.started ? 'all done' : 'not started',
      isDefault: j.isDefault,
      picked: j.jobId === picked,
    })),
    jobId: picked,
  }
}
