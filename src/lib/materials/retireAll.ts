/**
 * Materials on site (punch list #209, v2.7303): one press that retires every box of a job at once,
 * for the day a job is done and its cages have gone back to the yard. The owner asked on
 * 2026-11-14 whether a job's materials could be archived; this is the answer, under the app's
 * batch rule (`CLAUDE.md` → Do what is ready, never all or nothing): the press acts on the boxes
 * that are empty, holds each box that still has parts in it with the reason, keeps going past a
 * box that fails and names it afterwards, and its button says what it will do with its count.
 *
 * The rules a single Retire already keeps hold here too: a box with parts on hand is never
 * retired (the phone's refusal), the Unsorted row is never touched, and a retired box keeps its
 * stickers. Pure words and sorting only; the write is `retireContainer` in `onSiteStore.ts`, one
 * box at a time, and the way back is `unretireContainer` behind `unretireVerdict`.
 */
import { batchOutcomeWords, batchWords } from '../batchWords'
import type { Container, ContainerLine } from './onSite'

/** A live box the press holds, with the reason it stays: *G12 holds 24 toilets.* */
export type HeldBox = { box: Container; words: string }

export type RetireAllPlan = {
  /** The live, empty boxes the press retires, in the order the page lists them. */
  go: Container[]
  /** The live boxes with parts on hand, each with its reason. Unsorted is never here. */
  held: HeldBox[]
}

const kindWord = (c: Pick<Container, 'kind'>): string => (c.kind === 'cage' ? 'cage' : 'box')

/** The reason a box stays: its parts, by name when it holds one kind, by count when more. */
export function heldWords(box: Pick<Container, 'label'>, lines: ReadonlyArray<ContainerLine>): string {
  const onHand = lines.filter((l) => l.onHand > 0)
  const first = onHand[0]
  if (!first) return `${box.label} holds parts.`
  if (onHand.length === 1) return `${box.label} holds ${first.onHand} ${first.partName}.`
  const pieces = onHand.reduce((s, l) => s + l.onHand, 0)
  return `${box.label} holds ${pieces} pieces on ${onHand.length} lines.`
}

/**
 * Which live boxes go and which are held. A box is empty when no line in it has parts on hand; a
 * line with a Can't find or a shortfall and nothing left does not hold it, as the phone's Retire
 * does not. Retired boxes and the Unsorted row are left out of both lists.
 */
export function retireAllPlan(containers: ReadonlyArray<Container>, lines: ReadonlyArray<ContainerLine>): RetireAllPlan {
  const go: Container[] = []
  const held: HeldBox[] = []
  for (const c of containers) {
    if (c.retiredAt || c.kind === 'unsorted') continue
    const own = lines.filter((l) => l.containerId === c.id)
    if (own.some((l) => l.onHand > 0)) held.push({ box: c, words: heldWords(c, own) })
    else go.push(c)
  }
  return { go, held }
}

export type RetireAllWords = {
  /** The press: *Retire 3 empty boxes*, *Retire 2 empty boxes · 1 holds parts ▸*, or *Retire ▸* when dead. */
  button: string
  /** The line beside the press when something is held or nothing is ready; null otherwise. */
  foot: string | null
  /** True when no box is empty: the press is disabled. */
  dead: boolean
}

export const RETIRE_ALL_NOUN = ['empty box', 'empty boxes'] as const

/** The press's words from the plan, in the shape every batch button wears (`batchWords`). */
export function retireAllWords(plan: RetireAllPlan): RetireAllWords {
  const ready = plan.go.length
  const held = plan.held.length
  if (ready === 0 && held > 0) {
    return { button: 'Retire ▸', foot: held === 1 ? `${plan.held[0]!.box.label} still holds parts. Move them or mark them used first.` : `Every box still holds parts. Move them or mark them used first.`, dead: true }
  }
  const w = batchWords({ verb: 'Retire', ready, held, heldWhy: { one: 'holds parts', many: 'hold parts' }, noun: RETIRE_ALL_NOUN })
  return { button: w.button, foot: w.foot, dead: w.dead }
}

/** The confirm window's heading: *Retire every box on this job?* */
export const RETIRE_ALL_TITLE = 'Retire every box on this job?'

/** The confirm window's button: the verb with its count, *Retire 2 empty boxes*. */
export function retireAllConfirmLabel(plan: RetireAllPlan): string {
  const n = plan.go.length
  return `Retire ${n} ${n === 1 ? RETIRE_ALL_NOUN[0] : RETIRE_ALL_NOUN[1]}`
}

/**
 * The confirm window's words, one line a box: what goes, then what is held with its reason. The
 * window keeps the line breaks, so a job with many boxes reads as a list, not one long sentence.
 */
export function retireAllConfirmWords(plan: RetireAllPlan): string {
  const goes = plan.go.map((c) => `${c.label} ${kindWord(c)}`)
  const head = plan.go.length === 1 ? `${goes[0]} is empty and leaves this job.` : `These ${plan.go.length} are empty and leave this job:\n${goes.join('\n')}`
  const tail = plan.held.length === 0 ? '' : `\n\n${plan.held.length === 1 ? 'One stays with its parts:' : `${plan.held.length} stay with their parts:`}\n${plan.held.map((h) => h.words).join('\n')}`
  const after = `\n\nA retired box keeps its stickers and its history. Undo brings them all back for one minute.`
  return `${head}${tail}${after}`
}

export type RetireAllOutcome = {
  /** The boxes whose retire was written. */
  retired: ReadonlyArray<Container>
  /** The boxes the press held, with the reason. */
  held: ReadonlyArray<HeldBox>
  /** The boxes whose write failed on the spot, each with the reason. */
  failed: ReadonlyArray<{ box: Container; reason: string }>
}

export type RetireAllOutcomeWords = {
  /** The toast: *Retired 2 boxes. ZZ1 stays with its parts.* */
  line: string
  tone: 'success' | 'warning' | 'error'
}

/** The toast after the press ran past its failures (`batchOutcomeWords`), with the held boxes named. */
export function retireAllOutcomeWords(o: RetireAllOutcome): RetireAllOutcomeWords {
  const w = batchOutcomeWords({ verb: 'retire', past: 'Retired', done: o.retired.length, failed: o.failed.length, noun: 'box' })
  const parts: string[] = [w.line]
  if (o.held.length === 1) parts.push(`${o.held[0]!.box.label} stays with its parts.`)
  else if (o.held.length > 1) parts.push(`${o.held.length} stay with their parts.`)
  for (const f of o.failed) parts.push(`${f.box.label} did not retire: ${f.reason}`)
  return { line: parts.join(' '), tone: w.tone }
}

/** The toast after Undo brings the retired boxes back. */
export function retireAllUndoneWords(n: number): string {
  return n === 1 ? '1 box is back on the job. Its label works again.' : `${n} boxes are back on the job. Their labels work again.`
}

/** The toast when Undo could bring some back and not others: each refused one with its reason. */
export function retireAllUndoHeldWords(refused: ReadonlyArray<{ box: Container; words: string }>): string {
  return refused.map((r) => `${r.box.label} did not come back. ${r.words}`).join(' ')
}
