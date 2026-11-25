/**
 * The run's one print: what it takes, what it holds, and the words on its press (punch list #362, step 6).
 *
 * The owner's answer of 2026-11-16: *one press, one stack*. The press stands under the checklist's first step and
 * prints every paper of the run that is right now. The drawing locked it until every question was settled. The build
 * follows the house rule instead (Diane's word of 2026-11-24): a batch press is dead only when nothing is ready, so
 * it prints what is right, says its count, and names what it held with the door. With nothing held it reads
 * *Print the run*.
 *
 * What it never takes: a paper left out of this run, and a paper an earlier run left out that nobody has answered
 * for. Those are a person's own holds, and the press reads the checklist's standings for them, not the papers.
 *
 * Pure: the checklist in, the plan and the words out. The documents are `lienRunPacket.ts`, the affidavits' batch
 * builder and `lienRunStack.ts`.
 */
import { batchWords, pluralNoun } from '../batchWords'
import { val } from '../valuesInPlace'
import type { LienGetItRight, LienRunLine } from './lienGetItRight'
import type { LienHelpLeftOut } from './lienHelpSheet'

export type LienRunPrintPlan = {
  /** The jobs whose notice the run counts as right and still to print: the packet is built from their notices alone. */
  noticeJobIds: ReadonlySet<string>
  /** The jobs whose affidavit the run counts as right: the batch prints their papers alone. */
  affidavitJobIds: ReadonlySet<string>
  /** The run's affidavits that do not print, each with its reason: the help sheet names them. */
  affidavitLeftOut: LienHelpLeftOut[]
  /** The lines the press holds: the open questions and the papers asked about again. */
  held: number
  /** The papers a person left out of this run. */
  leftOut: number
}

const jobLabelOf = (l: Pick<LienRunLine, 'label' | 'title'>) => (l.title.trim() ? `${l.label} · ${l.title.trim()}` : l.label)

/**
 * What the one print takes from the run. `leftOutReason` words a standing leave-out as the screen does
 * (`lienLeaveOutReasonWords`).
 */
export function lienRunPrintPlan(run: LienGetItRight, leftOutReason: (line: LienRunLine) => string): LienRunPrintPlan {
  const noticeJobIds = new Set(run.right.filter((l) => l.kind === 'notice' && l.stageKey === 'to_print').map((l) => l.jobId))
  const affidavitJobIds = new Set(run.right.filter((l) => l.kind === 'affidavit').map((l) => l.jobId))
  const affidavits = (lines: ReadonlyArray<LienRunLine>) => lines.filter((l) => l.kind === 'affidavit')
  const affidavitLeftOut: LienHelpLeftOut[] = [
    ...affidavits(run.settle).map((l) => ({ jobLabel: jobLabelOf(l), reason: `Not right yet. ${l.stage}${l.detail ? `: ${l.detail}` : ''}.` })),
    ...affidavits(run.asked).map((l) => ({ jobLabel: jobLabelOf(l), reason: 'Left out of an earlier run. Nobody has answered for this one yet.' })),
    ...affidavits(run.leftOut).map((l) => ({ jobLabel: jobLabelOf(l), reason: `Left out of this run. ${leftOutReason(l)}.` })),
  ]
  return { noticeJobIds, affidavitJobIds, affidavitLeftOut, held: run.counts.settle, leftOut: run.counts.leftOut }
}

export type LienRunPrintPressInput = {
  /** The notices the packet prints, counted from the packet itself. */
  notices: number
  /** The affidavits the batch prints, counted from the batch itself. */
  affidavits: number
  /** The lines the press holds. */
  held: number
  /** The run has notices to print and their bills are not read yet: a notice would go without its enclosures. */
  reading: boolean
  /** The notices the checklist counts as right that the packet does not print now (`lienRunNoticesStopped`). */
  stopped?: number
}

export type LienRunPrintPress = {
  /** The press's own words. */
  label: string
  dead: boolean
  /** The line under the press when it holds something or cannot run, each value marked; else null. */
  foot: string | null
  /** The papers it prints. */
  papers: number
}

const PAPER = ['paper', 'papers'] as const

/** The right notices the press does not print, in a sentence: the card names each under it with its reason. */
function stoppedWords(stopped: number): string {
  return `${val('count', String(stopped))} right ${stopped === 1 ? 'notice does' : 'notices do'} not print here. ${stopped === 1 ? 'It is' : 'Each is'} named below with its reason.`
}

/**
 * The press: *Print the run · 16 papers* with nothing held, *Print 12 papers · 4 wait on step 1 ▸* with some, dead
 * with nothing to print. A right notice the packet does not print (a hold in the run window, a copy that goes by
 * Docsmit) is said under the press whatever else it says: *No paper is right yet* is said only when none is.
 */
export function lienRunPrintPress(input: LienRunPrintPressInput): LienRunPrintPress {
  const papers = input.notices + input.affidavits
  const stopped = Math.max(0, input.stopped ?? 0)
  if (input.reading) return { label: 'Print the run · reading the bills…', dead: true, foot: 'A notice prints with its unpaid bills. The press wakes once they are read.', papers }
  if (papers <= 0) {
    if (stopped > 0) {
      const more = input.held > 0 ? ` ${val('count', String(input.held))} more ${input.held === 1 ? 'waits' : 'wait'} on step 1 above.` : ''
      return { label: 'Print the run ▸', dead: true, foot: `No paper prints now. ${stoppedWords(stopped)}${more}`, papers }
    }
    return input.held > 0
      ? { label: 'Print the run ▸', dead: true, foot: `No paper is right yet. Settle the ${val('count', String(input.held))} above, or leave each out.`, papers }
      : { label: 'Print the run', dead: true, foot: null, papers }
  }
  if (input.held <= 0) return { label: `Print the run · ${papers} ${pluralNoun(PAPER, papers)}`, dead: false, foot: stopped > 0 ? stoppedWords(stopped) : null, papers }
  const words = batchWords({ verb: 'Print', ready: papers, held: input.held, heldWhy: { one: 'waits on step 1', many: 'wait on step 1' }, noun: PAPER })
  return {
    label: words.button,
    dead: false,
    foot: `${val('count', String(input.held))} ${input.held === 1 ? 'paper is' : 'papers are'} not right yet. Settle ${input.held === 1 ? 'it' : 'each'} above, or leave it out. The ${val('count', String(papers))} that ${papers === 1 ? 'is' : 'are'} right ${papers === 1 ? 'prints' : 'print'} now.${stopped > 0 ? ` ${stoppedWords(stopped)}` : ''}`,
    papers,
  }
}

/** After the press, in this sitting: *Printed at ⟪10:02 AM⟫: ⟪6⟫ notices and ⟪10⟫ affidavits.* */
export function lienRunPrintedWords(input: { notices: number; affidavits: number; atWords: string }): string {
  const n = input.notices > 0 ? `${val('count', String(input.notices))} ${input.notices === 1 ? 'notice' : 'notices'}` : ''
  const a = input.affidavits > 0 ? `${val('count', String(input.affidavits))} ${input.affidavits === 1 ? 'affidavit' : 'affidavits'}` : ''
  return `Printed at ${val('time', input.atWords)}: ${[n, a].filter(Boolean).join(' and ')}.`
}

/** The words the card, its smokes and the guide share. */
export const LIEN_RUN_PRINT_WORDS = {
  head: 'Print the run',
  /** Where the browser cannot hold both papers in one print job. */
  twoPrints: 'This browser cannot print both kinds as one stack. Print each with its own press.',
  /** When either document changed shape and the merge refused it. */
  cannotStack: 'The two papers could not be put in one stack. Print each with its own press.',
  nothing: 'Nothing waits to print.',
  /** Under the right notices that do not print, when one of them is held: where it is settled. */
  stoppedDoor: 'The Board’s Print and mail press opens the run window, where a held notice is settled.',
  blocked: 'Popup blocked. Allow popups to print the run.',
  /** Under the printed line: what the print left for the next step. */
  next: 'The notices are marked printed. The affidavits go to the notary.',
  nextNotices: 'The notices are marked printed. Their mail numbers come next.',
  nextAffidavits: 'The affidavits go to the notary, then to the county clerk.',
} as const
