/**
 * The run's first step, **Get it right** (punch list #362, step 5; the mock-up's D, the owner's pick of 2026-11-16).
 *
 * The owner works liens as one run: get every paper accurate and current, then print them, mail them and file them
 * together. The run is every paper the Board's first tile counts: the papers still to send or file whose day is the
 * tile's day or earlier. This kernel writes that run out as one checklist:
 *
 *   - **To settle.** A paper that cannot print as it stands, as one line: the bin it stands in, the one thing it
 *     waits on, and the press that answers it. Both are the To do row's own (`buildLienNextUp`), so the checklist and
 *     the list say one thing and open one screen. Each line carries **Leave out**.
 *   - **Asked again.** A paper left out of an earlier run (`lienLeftOut.ts`), first on the list with the old reason.
 *     It is in neither count until a person answers.
 *   - **Right.** A paper that can print or is printed: an approved, signed notice, a printed notice, an affidavit
 *     ready to file.
 *   - **Left out.** A paper a person left out of this run, with who, when and why, and the way back.
 *
 * The three steps on the strip read from the same papers. Step 2 is the run's one print (step 6 of the card) and step
 * 3 is not built as one trip yet (step 8), so the strip says what waits at each. Its counts are drawn twice: once from
 * the Board's chips alone, and again with what the print and the printed read know (`lienGetItRightWithFacts`,
 * v2.8631), so a printed affidavit and a right notice the run window holds are said apart from what the press
 * prints. No press is locked by this step: a paper that is ready prints from the Board as it always has.
 *
 * Pure: the Board, the To do rows and the left-out rows in, the checklist out. It writes nothing and changes no rule
 * about when a paper may go.
 */
import { val } from '../valuesInPlace'
import { lienBoardDayWords, lienBoardStageWords, lienBoardStagesLeft, type LienBoard, type LienBoardChip } from './lienBoard'
import { lienLeftOutStandings, lienPaperKey, type LienLeftOutRow } from './lienLeftOut'
import type { LienNextUpRow } from './lienNextUp'
import { lienRowLine } from './lienRowWords'

export type LienRunStanding = 'settle' | 'asked_again' | 'right' | 'left_out'

/** One paper of the run, as one line. */
export type LienRunLine = {
  /** `notice:<jobId>` or `affidavit:<jobId>`: the paper, as its To do row and its chip name it. */
  key: string
  kind: 'notice' | 'affidavit'
  jobId: string
  /** The job's number, as its chip reads. */
  label: string
  /** The job as the desk names it. */
  title: string
  /** The bin the paper stands in, in the Board's words. */
  stage: string
  /** That bin's stage, as the Board keys it. */
  stageKey: LienBoardChip['stage']
  /** The one thing to know after the bin: the fact it waits on, the months it is for, how long it has waited. '' when the bin says it all. */
  detail: string
  dueYmd: string | null
  /** What the job still owes. */
  amount: number
  /** The Board marks it: it will not make its day as it stands. */
  atRisk: boolean
  standing: LienRunStanding
  /** The To do row whose press answers the line; null when no row stands for this paper alone. */
  rowKey: string | null
  /** That press's words; null when this viewer has no move on it. */
  press: string | null
  /** The standing leave-out: this run's on a left-out line, an earlier run's on a line asked again. */
  leftOut: LienLeftOutRow | null
  /** A left-out paper whose question is answered since: it can print, and the Board's prints take it. */
  rightNow: boolean
}

export type LienRunStepState = 'now' | 'done' | 'wait'

export type LienRunStep = { n: 1 | 2 | 3; name: string; line: string; state: LienRunStepState }

export type LienGetItRight = {
  /** The day the run counts to (YYYY-MM-DD). */
  day: string
  /** That day as the Board's tile says it: *tomorrow*, *Monday*, *Nov 20*. */
  dayWords: string
  /** Left out of an earlier run: the run asks again. First on the list. */
  asked: LienRunLine[]
  /** The open questions, the papers the Board marks first, then by day, the largest first. */
  settle: LienRunLine[]
  /** The papers that are right, the largest first. */
  right: LienRunLine[]
  /** Left out of this run, in the order they were left out. */
  leftOut: LienRunLine[]
  counts: {
    /** The papers in the run: every paper the tile counts, less the ones left out of this run. */
    papers: number
    /** Lines that want an answer: the open questions and the papers asked about again. */
    settle: number
    right: number
    leftOut: number
    /** Right papers still to print: approved notices, and affidavits ready to file (no print is recorded for one). */
    toPrint: number
    /** Printed notices still to mail. */
    toMail: number
    /** Affidavits to file: every right one until the print's facts are read, then the printed ones (the unprinted are step 2's). */
    toFile: number
    /** Right affidavits that printed and say the same today, or that a person said stand as printed: they do not print again. 0 until the print's facts are read (`lienGetItRightWithFacts`). */
    affidavitsPrinted: number
    /** Right notices the run's press does not print now: a copy that goes by Docsmit, or a hold the run window settles. 0 until the print's facts are read. */
    noticesStopped: number
  }
  totals: {
    /** What the run's jobs still owe, each job once. */
    run: number
    /** What the jobs behind the lines to settle still owe. */
    waits: number
    right: number
  }
  /** The step the run is on; null with nothing left to do in it. */
  step: 1 | 2 | 3 | null
  steps: [LienRunStep, LienRunStep, LienRunStep]
  /** *9 affidavits ready to file · 4 notices printed*: the right papers by what they are. */
  rightParts: string
}

/** The words the screen, its smokes and the guide share. */
export const LIEN_GET_IT_RIGHT_WORDS = {
  step1: 'Get it right',
  step2: 'Print',
  step3: 'Out the door',
  /** The door's press while a question is open, and once none is. */
  doorSettle: 'Get it right',
  doorOpen: 'Open the run',
  back: 'The list',
  /** Under the first step's head. */
  lead: 'Each line is one paper that cannot print as it stands. Settle it, or leave it out of this run.',
  askedLead: 'Answer each one before this run counts it.',
  allRight: 'Every paper in the run is right.',
  /** On a left-out paper whose question is answered since. */
  rightNow: 'Its question is answered. The Board’s prints take it as it stands.',
  /** Over the prints that exist, until the run has one print of its own. */
  printsLead: 'The two prints on the Board take the papers that are right.',
  notInRun: 'Not in this run',
} as const

/** A chip still to send or file on a property that takes a paper: the papers the Board's first tile counts from. */
function live(c: LienBoardChip): boolean {
  return c.stage !== 'sent' && c.stage !== 'filed' && c.stage !== 'served' && c.stage !== 'missed' && !c.publicMark
}

/** A paper that can print as it stands, or is printed: nothing about it waits on a fact, a send or the leader. */
export function lienRunPaperRight(c: Pick<LienBoardChip, 'kind' | 'stage'>): boolean {
  return c.kind === 'notice' ? c.stage === 'to_print' || c.stage === 'in_mail' : c.stage === 'ready'
}

/**
 * The run's papers: the chips the Board's first tile counts, by its own rule. The day is the soonest day ahead among
 * the live chips, and the run is every live chip due that day or earlier, so a paper past its day rides with it.
 * Null with nothing dated ahead, when the tile reads *nothing dated*.
 */
export function lienRunPapers(board: Pick<LienBoard, 'notices' | 'affidavits'>): { day: string; chips: LienBoardChip[] } | null {
  const chips = [...board.notices, ...board.affidavits].flatMap((b) => b.chips).filter(live)
  const day = chips.filter((c) => c.dueYmd && c.daysLeft != null && c.daysLeft >= 0).map((c) => c.dueYmd as string).sort()[0] ?? null
  if (!day) return null
  return { day, chips: chips.filter((c) => c.dueYmd && c.dueYmd <= day) }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** What a set of lines' jobs still owe, each job once: a job with two papers in the run owes its money once. */
function owed(lines: ReadonlyArray<Pick<LienRunLine, 'jobId' | 'amount'>>): number {
  const byJob = new Map<string, number>()
  for (const l of lines) if (!byJob.has(l.jobId)) byJob.set(l.jobId, l.amount)
  return [...byJob.values()].reduce((s, n) => s + n, 0)
}

export type LienGetItRightInput = {
  board: Pick<LienBoard, 'notices' | 'affidavits'> | null
  /** The To do rows, as the list under the Board has them (`buildLienNextUp`). */
  rows: ReadonlyArray<LienNextUpRow>
  /** Every standing row of `lien_run_left_out`. */
  leftOut: ReadonlyArray<LienLeftOutRow>
  todayYmd: string
  /** The job as the desk names it. */
  jobTitle: (jobId: string) => string
  /** The leader a job's paper waits on, by name; absent reads *The leader*. */
  leaderName?: (jobId: string) => string | null | undefined
}

/** What the print and the printed read know that the Board's chips do not (steps 6 and 7): the facts the strip's counts take. */
export type LienRunFacts = {
  /** Right affidavits whose newest print says the same today, or that a person said stand as printed: the run does not print them again. */
  printedAffidavitJobIds: ReadonlySet<string>
  /** Right notices the run's press does not print now, each with why: `paperless` (no copy of it is paper), `held` (the run window settles it). */
  stoppedNotices: ReadonlyArray<{ jobId: string; kind: 'paperless' | 'held' }>
}

const NO_FACTS: LienRunFacts = { printedAffidavitJobIds: new Set(), stoppedNotices: [] }

type LienRunSorted = Pick<LienGetItRight, 'asked' | 'settle' | 'right' | 'leftOut'> & { /** Every line of the run, the left-out ones too. */ lines: number }

const count = (n: number) => val('count', String(n))
/** A marked count with its noun, for the strip's lines, which the screen draws through `ValueSentence`. */
const marked = (n: number, one: string, many: string) => `${count(n)} ${n === 1 ? one : many}`

/**
 * The counts, the step and the three lines of the strip, from the sorted lines and what the print knows. With no facts
 * a right affidavit counts as to print until it is filed, and every right notice as to print: the Board's chips alone.
 */
function lienRunStrip(s: LienRunSorted, facts: LienRunFacts, known: boolean): Pick<LienGetItRight, 'counts' | 'step' | 'steps' | 'rightParts'> {
  const { asked, settle, right, leftOut } = s
  const stoppedBy = new Map(facts.stoppedNotices.map((n) => [n.jobId, n.kind] as const))
  const toMail = right.filter((l) => l.kind === 'notice' && l.stageKey === 'in_mail').length
  const affidavits = right.filter((l) => l.kind === 'affidavit')
  const affidavitsPrinted = affidavits.filter((l) => facts.printedAffidavitJobIds.has(l.jobId)).length
  const affidavitsToPrint = affidavits.length - affidavitsPrinted
  // With the print's facts, to file is the printed affidavits: the unprinted ones are step 2's. Before them, every right one.
  const toFile = known ? affidavitsPrinted : affidavits.length
  const noticesRight = right.filter((l) => l.kind === 'notice' && l.stageKey !== 'in_mail')
  const stopped = noticesRight.filter((l) => stoppedBy.has(l.jobId))
  const paperless = stopped.filter((l) => stoppedBy.get(l.jobId) === 'paperless').length
  const heldInWindow = stopped.length - paperless
  const noticesToPrint = noticesRight.length - stopped.length
  const toPrint = noticesToPrint + affidavitsToPrint
  const counts: LienGetItRight['counts'] = { papers: s.lines - leftOut.length, settle: asked.length + settle.length, right: right.length, leftOut: leftOut.length, toPrint, toMail, toFile, affidavitsPrinted, noticesStopped: stopped.length }
  const step: LienGetItRight['step'] = counts.settle > 0 ? 1 : toPrint > 0 ? 2 : toMail + affidavitsPrinted > 0 ? 3 : null

  const leftOutWords = counts.leftOut > 0 ? ` · ${count(counts.leftOut)} left out of this run` : ''
  // What the press prints, then what it does not and why: a printed affidavit, a notice the run window holds, a notice with no paper copy.
  const prints = [noticesToPrint > 0 ? `${marked(noticesToPrint, 'notice', 'notices')} to print` : '', affidavitsToPrint > 0 ? `${marked(affidavitsToPrint, 'affidavit', 'affidavits')} for the notary` : ''].filter(Boolean)
  const aside = [
    affidavitsPrinted > 0 ? `${marked(affidavitsPrinted, 'affidavit', 'affidavits')} printed` : '',
    heldInWindow > 0 ? `${count(heldInWindow)} ${heldInWindow === 1 ? 'notice waits' : 'notices wait'} in the run window` : '',
    paperless > 0 ? `${count(paperless)} ${paperless === 1 ? 'notice goes' : 'notices go'} without paper` : '',
  ].filter(Boolean)
  const steps: LienGetItRight['steps'] = [
    {
      n: 1,
      name: LIEN_GET_IT_RIGHT_WORDS.step1,
      line: counts.settle > 0 ? `${count(counts.settle)} to settle · ${count(counts.right)} of ${count(counts.papers)} ${counts.papers === 1 ? 'paper is' : 'papers are'} right${leftOutWords}` : `${count(counts.right)} right${leftOutWords}`,
      state: counts.settle > 0 ? 'now' : 'done',
    },
    {
      n: 2,
      name: LIEN_GET_IT_RIGHT_WORDS.step2,
      line: [...(prints.length > 0 ? prints : ['Nothing waits to print']), ...aside].join(' · '),
      state: step === 2 ? 'now' : step === 3 ? 'done' : 'wait',
    },
    {
      n: 3,
      name: LIEN_GET_IT_RIGHT_WORDS.step3,
      line: toMail + toFile > 0 ? [toMail > 0 ? `${count(toMail)} to mail` : '', toFile > 0 ? `${count(toFile)} to file` : ''].filter(Boolean).join(' · ') : 'Nothing waits to mail or file',
      state: step === 3 ? 'now' : 'wait',
    },
  ]

  const rightParts = [
    affidavitsToPrint > 0 ? `${plural(affidavitsToPrint, 'affidavit', 'affidavits')} ready to file` : '',
    affidavitsPrinted > 0 ? `${plural(affidavitsPrinted, 'affidavit', 'affidavits')} printed` : '',
    noticesToPrint > 0 ? `${plural(noticesToPrint, 'notice', 'notices')} to print` : '',
    stopped.length > 0 ? `${stopped.length} right ${stopped.length === 1 ? 'notice does' : 'notices do'} not print here` : '',
    toMail > 0 ? `${plural(toMail, 'notice', 'notices')} printed` : '',
  ].filter(Boolean).join(' · ')

  return { counts, step, steps, rightParts }
}

/** The checklist, or null when the Board counts no run (nothing dated ahead). */
export function buildLienGetItRight(input: LienGetItRightInput): LienGetItRight | null {
  const run = input.board ? lienRunPapers(input.board) : null
  if (!run) return null
  const rowByKey = new Map(input.rows.map((r) => [r.key, r] as const))
  const standings = lienLeftOutStandings(input.leftOut, run.day)

  const lines: LienRunLine[] = run.chips.map((c) => {
    const key = lienPaperKey(c.kind, c.jobId)
    const row = rowByKey.get(key) ?? null
    const stage = lienBoardStageWords(c.kind, c.stage)
    const right = lienRunPaperRight(c)
    const standing = standings.get(key) ?? null
    // The To do row says the one thing to know; a paper with no row of its own (one of a GC's several) says its next stage.
    const detail = row ? lienRowLine(row, { stage }).detail : right ? '' : (lienBoardStagesLeft(c, input.leaderName?.(c.jobId))[0] ?? '')
    return {
      key,
      kind: c.kind,
      jobId: c.jobId,
      label: c.label,
      title: input.jobTitle(c.jobId),
      stage,
      stageKey: c.stage,
      detail,
      dueYmd: c.dueYmd,
      amount: c.openBalance,
      atRisk: c.atRisk,
      standing: standing ? standing.state : right ? 'right' : 'settle',
      rowKey: row ? row.key : null,
      press: row && !right ? row.button : null,
      leftOut: standing ? standing.row : null,
      rightNow: Boolean(standing) && right,
    }
  })

  const byDayThenSize = (a: LienRunLine, b: LienRunLine) => (a.dueYmd ?? '9999').localeCompare(b.dueYmd ?? '9999') || b.amount - a.amount || a.label.localeCompare(b.label)
  const asked = lines.filter((l) => l.standing === 'asked_again').sort(byDayThenSize)
  const settle = lines.filter((l) => l.standing === 'settle').sort((a, b) => Number(b.atRisk) - Number(a.atRisk) || byDayThenSize(a, b))
  const right = lines.filter((l) => l.standing === 'right').sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label))
  const leftOut = lines.filter((l) => l.standing === 'left_out').sort((a, b) => (a.leftOut?.leftOutAt ?? '').localeCompare(b.leftOut?.leftOutAt ?? '') || a.label.localeCompare(b.label))

  const strip = lienRunStrip({ asked, settle, right, leftOut, lines: lines.length }, NO_FACTS, false)

  return {
    day: run.day,
    dayWords: lienBoardDayWords(input.todayYmd, run.day),
    asked,
    settle,
    right,
    leftOut,
    totals: { run: owed(lines.filter((l) => l.standing !== 'left_out')), waits: owed([...asked, ...settle]), right: owed(right) },
    ...strip,
  }
}

/**
 * The checklist again, with what the print and the printed read know (v2.8631): a right affidavit that printed and
 * says the same today, or that a person said stands, is not to print, and a right notice the run's press does not
 * print now is said apart with why. The lines, the door and the totals do not move: only the counts, the step and
 * the strip's words. Null facts (the prints not read yet, or a viewer with no one print) leave the checklist as built;
 * facts that are known, even none, make *to file* the printed affidavits and leave the unprinted ones to step 2.
 */
export function lienGetItRightWithFacts(run: LienGetItRight, facts: LienRunFacts | null): LienGetItRight {
  if (!facts) return run
  return { ...run, ...lienRunStrip({ asked: run.asked, settle: run.settle, right: run.right, leftOut: run.leftOut, lines: run.counts.papers + run.counts.leftOut }, facts, true) }
}

/**
 * The run's door, one line over the list under the Board: what the run is, how much of it waits, and the press that
 * opens the checklist. Values are marked for `ValueSentence`.
 */
export function lienRunDoor(run: Pick<LienGetItRight, 'dayWords' | 'counts'>): { line: string; button: string } {
  const { counts } = run
  const head = `This run · ${val('count', String(counts.papers))} ${counts.papers === 1 ? 'paper' : 'papers'} due by ${val('day', run.dayWords)}`
  const state = counts.settle > 0 ? `${val('count', String(counts.settle))} to settle` : LIEN_GET_IT_RIGHT_WORDS.allRight.replace(/\.$/, '')
  const out = counts.leftOut > 0 ? ` · ${val('count', String(counts.leftOut))} left out` : ''
  return { line: `${head} · ${state}${out}`, button: counts.settle > 0 ? LIEN_GET_IT_RIGHT_WORDS.doorSettle : LIEN_GET_IT_RIGHT_WORDS.doorOpen }
}

/** The head over the checklist: *This run · papers due by ⟪tomorrow⟫*. */
export function lienRunHead(run: Pick<LienGetItRight, 'dayWords'>): string {
  return `This run · papers due by ${val('day', run.dayWords)}`
}

/** *Notice* or *Affidavit*: the small word before a line's bin. */
export function lienRunKindWord(kind: LienRunLine['kind']): string {
  return kind === 'notice' ? 'Notice' : 'Affidavit'
}
