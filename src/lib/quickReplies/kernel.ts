/**
 * Messages, cut 3: quick replies, the lines typed every day (`to-dos/gc-mode/messages/BUILD_PLAN.md` → Cut 3). Lifted
 * from the Messages prototype v1.178 on branch spike/gc-mode (`to-dos/gc-mode/messages/prototype.html`: `qrGroups`,
 * `qrStripHtml`, `qrMark`, `findReply`, `useQuick`, `qrGuess` and `editQuick` with its versions), the words and the
 * rules, never the DOM. Pure: the caller reads `quick_replies`, counts `quick_reply_uses` per person, reads
 * `quick_reply_versions`, and passes the flow's steps for each kind of person in.
 *
 * A line says who it is for (trade partners, customers, architects or anyone) and may belong to a flow step. The strip
 * shows a thread only the lines for that kind of person: the step they are on first, then the rest of their kind,
 * then anyone's; your most used first in each, then the team's. Every change is a version with who and when, and a
 * removed line stays in the history and comes back from the Removed tab.
 *
 * Residential R3 (`RESIDENTIAL_BUILD_PLAN.md` → R3, the residential prototype v0.8's `FLOWS`, `stepName`,
 * `stepOptions` and `grouped`): a kind of person may have more than one flow. A customer has the residential flow and
 * the GC customer's, so the steps are kept per flow (`stepsByFlow`) and a step is named across the flows of its kind
 * (`qrStepName`). A line keeps only its step's id (`quick_replies.step_key`), so no two flows of one kind share an id.
 */

import type { ContactKind } from '../contacts/names'
import { flowContactKind, type FlowKind } from '../flows/facts'
import type { FlowDef, FlowStep } from '../flows/state'
import type { PhonePress } from './press'

// ---------- the line ----------

/** Who a line is for: a contact's kind (the spine's `ContactKind`), or anyone, an unknown number among them. */
export type QuickReplyFor = Exclude<ContactKind, 'unknown'> | 'any'

/** The team's lines are everyone's; a line marked just for me is on my strip only. */
export type QuickReplyScope = 'team' | 'mine'

export interface QuickReply {
  id: string
  text: string
  for: QuickReplyFor
  /** The flow step it belongs to, or null for no step. A line for anyone has none. */
  stepId: string | null
  scope: QuickReplyScope
  /** The user id that added it. */
  addedBy: string
  /** When it was added (ms); the tie-break when two lines are used as often. */
  addedAt: number
  removed: boolean
  /** Presses by user id, counted from `quick_reply_uses`. A press fills the box, so a use is a press, not a send. */
  uses: Readonly<Record<string, number>>
  lastUsed: { at: number; by: string; contactId: string | null } | null
  /**
   * R3's columns (`quick_replies.text_es`, `phone_order`, `phone_name`): the line in Spanish, its place on the tech's
   * phone, and its name there. Each is null when unset, and absent on a line read before R3. The phone's `PhoneLine`
   * holds all three as read.
   */
  textEs?: string | null
  phoneOrder?: number | null
  phoneName?: string | null
  /** Job Mode's big button this line is (v2.5573, `quick_replies.phone_press`): On my way or I'm here, one live line each. */
  phonePress?: PhonePress | null
}

/** A step of a kind's flow as a line names it: the flow's own step, by its id and name, and the flow it is on. */
export type StepRef = Pick<FlowStep, 'id' | 'name'> & { flow?: FlowKind }

/** The flow's steps for each kind of person, in the flow's order; a kind with two flows has both, one after the other. */
export type StepsByKind = Partial<Record<QuickReplyFor, readonly StepRef[]>>

/** A flow's name, where the editor says which flow a step is on. The residential prototype's words. */
export const FLOW_NAMES: Readonly<Record<Exclude<FlowKind, 'unknown'>, string>> = {
  residential: 'Residential customer',
  customer: 'GC customer',
  trade: 'Trade partner',
  arch: 'Architect',
  sub: 'Sub',
}

/** The flows a line can be on, in the editor's order: a customer's residential flow before the GC customer's. */
const FLOW_ORDER: readonly (keyof typeof FLOW_NAMES)[] = ['residential', 'customer', 'trade', 'arch', 'sub']

/** One flow's steps, as the step picker groups them under the flow's name. */
export interface FlowSteps {
  flow: FlowKind
  name: string
  steps: readonly StepRef[]
}

/** Each kind of person's flows, in the editor's order. A customer has two. */
export type StepsByFlow = Partial<Record<QuickReplyFor, readonly FlowSteps[]>>

/**
 * The steps a line can belong to, per flow, by who the line is for, from the flows (the seed until the flows table is
 * read). A residential customer is a customer, so a line for customers may be on either customer flow. Anyone's lines
 * have none. A lead, a supply house and a candidate have no flow, so theirs are empty, and a flow with no steps is left out.
 */
export function stepsByFlow(flows: Readonly<Partial<Record<FlowKind, FlowDef>>>): StepsByFlow {
  const out: Record<Exclude<QuickReplyFor, 'any'>, FlowSteps[]> = { trade: [], customer: [], arch: [], lead: [], sub: [], team: [], supply_house: [], candidate: [] }
  for (const flow of FLOW_ORDER) {
    const steps = (flows[flow]?.lanes ?? []).flatMap((lane) => lane.steps.map((step): StepRef => ({ id: step.id, name: step.name, flow })))
    const kind = qrKindOf(flowContactKind(flow))
    if (steps.length && kind !== 'any') out[kind].push({ flow, name: FLOW_NAMES[flow], steps })
  }
  return out
}

/** The steps a line can belong to, by who it is for: every flow of the kind in one list, `stepsByFlow` flattened. */
export function stepsByKind(flows: Readonly<Partial<Record<FlowKind, FlowDef>>>): StepsByKind {
  const byFlow = stepsByFlow(flows)
  return Object.fromEntries(Object.entries(byFlow).map(([kind, list]) => [kind, list.flatMap((f) => f.steps)])) as StepsByKind
}

/** Who a line is for, as the strip and the editor name them. */
export const QR_KINDS: Readonly<Record<QuickReplyFor, string>> = {
  trade: 'trade partners',
  customer: 'customers',
  arch: 'architects',
  lead: 'leads',
  supply_house: 'supply houses',
  candidate: 'candidates',
  sub: 'subs',
  team: 'our team',
  any: 'anyone',
}

/**
 * The editor's groups run in this order of who the line is for: the three that were, then the four kinds of
 * 2026-10-13 in the Messages page's order of its filters, then anyone.
 */
export const QR_KIND_ORDER: readonly QuickReplyFor[] = ['trade', 'customer', 'arch', 'lead', 'sub', 'supply_house', 'candidate', 'any']

export function qrKindOf(kind: ContactKind): QuickReplyFor {
  return kind === 'unknown' ? 'any' : kind
}

/** Every press on the line, by anyone. */
export function qrTotal(q: QuickReply): number {
  return Object.values(q.uses).reduce((a, b) => a + b, 0)
}

/** My presses on the line. */
export function qrMine(q: QuickReply, me: string): number {
  return q.uses[me] ?? 0
}

/** The lines a person sees: the team's, and the ones they keep for themselves. A removed line is off the strip. */
export function qrVisible(lines: readonly QuickReply[], me: string): QuickReply[] {
  return lines.filter((q) => !q.removed && (q.scope === 'team' || q.addedBy === me))
}

/** The strip's order: the lines I use most first, then the team's most used, then the older line. */
export function qrOrder(me: string): (a: QuickReply, b: QuickReply) => number {
  return (a, b) => qrMine(b, me) - qrMine(a, me) || qrTotal(b) - qrTotal(a) || a.addedAt - b.addedAt || a.id.localeCompare(b.id)
}

/** A step's name, looked for on every flow of the line's kind. Null for no step, or a step no flow has now. */
export function qrStepName(steps: StepsByKind, kind: QuickReplyFor, id: string | null): string | null {
  if (!id) return null
  return steps[kind]?.find((s) => s.id === id)?.name ?? null
}

// ---------- the strip, and Find a reply ----------

export interface QrGroup {
  /** `step`: the lines for the step they are on. `kind`: the rest of their kind. `any`: anyone's. */
  key: 'step' | 'kind' | 'any'
  title: string
  /** The words after the title, in italics. */
  tag: string | null
  rows: QuickReply[]
}

export interface QrGroupsInput {
  kind: ContactKind
  /** The step they are on now, the flow's read; null when nothing is on. */
  nowStepId: string | null
  /** The flow's steps for their kind, to name the step they are on. */
  steps: readonly StepRef[]
  me: string
  /** The words typed in the narrow box. */
  filter?: string
  /** The strip says "the step they are on"; Find a reply says "fits the step they are on". */
  place?: 'strip' | 'find'
  /**
   * The flow they are on, when their kind has two. The strip then leaves out a line on a step of the other flow, which
   * `steps` names by its `flow`. Find a reply keeps it. Unset, every line for their kind shows.
   */
  flow?: FlowKind
}

/**
 * A thread's lines in their groups. A line fits when it is for their kind or for anyone and holds the narrowed words.
 * An unknown number's lines are all for anyone, so they show once, under Anyone; the prototype listed them twice, as
 * "Lines" and "Anyone", and counted them twice in the head. On the strip, a line on another flow of their kind stays in
 * Find, as the residential prototype's strip leaves it. The narrowed words find a line by its English or its Spanish.
 */
export function qrGroups(lines: readonly QuickReply[], input: QrGroupsInput): QrGroup[] {
  const kind = qrKindOf(input.kind)
  const needle = (input.filter ?? '').trim().toLowerCase()
  const flowOf = (q: QuickReply) => input.steps.find((s) => s.id === q.stepId)?.flow
  const otherFlow = (q: QuickReply) => input.place !== 'find' && Boolean(input.flow) && Boolean(flowOf(q)) && flowOf(q) !== input.flow
  const rows = qrVisible(lines, input.me)
    .filter((q) => (q.for === kind || q.for === 'any') && (!needle || q.text.toLowerCase().includes(needle) || (q.textEs ?? '').toLowerCase().includes(needle)) && !otherFlow(q))
    .sort(qrOrder(input.me))
  const now = input.nowStepId
  const onStep = (q: QuickReply) => Boolean(now) && q.stepId === now
  const groups: QrGroup[] = []
  if (kind !== 'any') {
    const step = rows.filter((q) => q.for === kind && onStep(q))
    const others = rows.filter((q) => q.for === kind && !onStep(q))
    if (step.length) {
      groups.push({
        key: 'step',
        title: input.steps.find((s) => s.id === now)?.name ?? 'This step',
        tag: input.place === 'find' ? 'fits the step they are on' : 'the step they are on',
        rows: step,
      })
    }
    if (others.length) groups.push({ key: 'kind', title: `Other ${QR_KINDS[kind]}`, tag: null, rows: others })
  }
  const any = rows.filter((q) => q.for === 'any')
  if (any.length) groups.push({ key: 'any', title: 'Anyone', tag: null, rows: any })
  return groups
}

/** The strip's head: "13 for trade partners". */
export function qrStripCount(groups: readonly QrGroup[], kind: ContactKind): string {
  return `${groups.reduce((n, g) => n + g.rows.length, 0)} for ${QR_KINDS[qrKindOf(kind)]}`
}

/** The narrow box shows on the strip once the team's list is past this many lines. */
export const QR_NARROW_AFTER = 10

export function showNarrow(lines: readonly QuickReply[], me: string): boolean {
  return qrVisible(lines, me).filter((q) => q.scope === 'team').length > QR_NARROW_AFTER
}

/**
 * The words when the strip or Find a reply has no line to show: with narrowed words, a press that adds them as a
 * quick reply (v1.145), the editor opening on its add row with its guess at the tags. Find a reply says it as the
 * prototype's window did. With nothing narrowed, the strip points at its **Edit**.
 */
export function qrEmpty(filter: string, place: 'strip' | 'find' = 'strip'): { words: string; add: string | null } {
  const typed = filter.trim()
  if (typed) return { words: place === 'find' ? 'Nothing matches.' : 'No line has those words.', add: `Add “${typed}” as a quick reply` }
  return { words: 'No lines for this kind of person yet. Edit adds one.', add: null }
}

/** A line's hover on the strip ends with why the order moves. */
export const QR_PRESS_COUNTED = 'The strip counts the press, so the lines you use most come first.'

/** A group pill's hover ends with how many lines the group holds. */
export function qrLineCount(n: number): string {
  return `${n} line${n === 1 ? '' : 's'}.`
}

/** A line's text in pieces, the narrowed words lit, the way a highlight reads in a message's window. */
export function qrMarks(text: string, needle: string): Array<{ text: string; lit: boolean }> {
  const find = needle.trim().toLowerCase()
  if (!find) return [{ text, lit: false }]
  const low = text.toLowerCase()
  const out: Array<{ text: string; lit: boolean }> = []
  let at = 0
  for (let hit = low.indexOf(find); hit >= 0; hit = low.indexOf(find, at)) {
    if (hit > at) out.push({ text: text.slice(at, hit), lit: false })
    out.push({ text: text.slice(hit, hit + find.length), lit: true })
    at = hit + find.length
  }
  if (at < text.length) out.push({ text: text.slice(at), lit: false })
  return out
}

/** Find a reply's note under its title. */
export const FIND_NOTE = 'A press on a line fills the box. Nothing sends. The lines for the step they are on come first.'

/**
 * Find a reply's "Where they are": the step they are on with whose move it is and how long it has been on, then what
 * finishes it. The flow reads the facts; this says them. The head comes back as parts. A step waiting on someone else
 * names them; the prototype read it as "both sides".
 */
export function findWhere(input: {
  step: { name: string; done: string } | null
  who: 'us' | 'them' | 'both' | 'wait'
  firstName: string
  /** Who the step waits on when `who` is wait: "Jonah". */
  waitingOn?: string | null
  daysOn: number | null
  off: boolean
}): { head: string[]; sentence: string } {
  if (input.off) return { head: [], sentence: 'Off the flow.' }
  if (!input.step) return { head: [], sentence: 'Nothing on now.' }
  const move =
    input.who === 'us'
      ? 'our move'
      : input.who === 'them'
        ? `${input.firstName}'s move`
        : input.who === 'wait'
          ? `waiting on ${input.waitingOn?.trim() || 'someone else'}`
          : 'both sides'
  const days = input.daysOn == null ? [] : [`on it ${input.daysOn} day${input.daysOn === 1 ? '' : 's'}`]
  const done = input.step.done.trim()
  return { head: [input.step.name, move, ...days], sentence: `${done.charAt(0).toUpperCase()}${done.slice(1)} finishes it.` }
}

/**
 * The line a step's ask puts in the box: the line for their kind on that step that is used most. The sentence written
 * when no line fits, with the paper and the portal link, is the step card's.
 */
export function stepLine(lines: readonly QuickReply[], kind: ContactKind, stepId: string, me: string): QuickReply | null {
  const k = qrKindOf(kind)
  return qrVisible(lines, me).filter((q) => q.for === k && q.stepId === stepId).sort(qrOrder(me))[0] ?? null
}

// ---------- a guess at the tags ----------

const GUESSES: ReadonlyArray<{ words: RegExp; for: QuickReplyFor; stepId: string }> = [
  { words: /w-9|insurance/, for: 'trade', stepId: 'papers' },
  { words: /submittal/, for: 'arch', stepId: 'submittals' },
  { words: /certify|certificate for|your certificate/, for: 'arch', stepId: 'certify' },
  { words: /pay application|pay app/, for: 'customer', stepId: 'payapp' },
  { words: /start date/, for: 'customer', stepId: 'start' },
  { words: /change order/, for: 'customer', stepId: 'co' },
  { words: /\bcontracts?\b/, for: 'customer', stepId: 'contract' },
  { words: /statement of work/, for: 'trade', stepId: 'sow' },
  { words: /\bdraws?\b/, for: 'trade', stepId: 'draws' },
  { words: /invite|plans|addendum/, for: 'trade', stepId: 'invited' },
  { words: /quote|number|portal|scope/, for: 'trade', stepId: 'ask' },
]

/**
 * A first guess at who a new line is for and its step, from its words, shown as a guess until the person sets it. The
 * first rule that matches wins, in the prototype's order. "draw" and "contract" are whole words here, so "drawings" and
 * "contractor" no longer guess Draws or the customer's contract.
 */
export function qrGuess(text: string): { for: QuickReplyFor; stepId: string | null } {
  const low = text.toLowerCase()
  const hit = GUESSES.find((g) => g.words.test(low))
  return hit ? { for: hit.for, stepId: hit.stepId } : { for: 'any', stepId: null }
}

/** The words under the add form: a guess until the person sets the tags. */
export function guessWords(text: string, setByYou: boolean): string {
  if (setByYou) return 'set by you'
  return text.trim() ? 'guessed from the words' : 'the tags are guessed from the words'
}

/** A line's tags as words, in parts: "for trade partners", "on Asked to quote". A step the flow no longer has reads as no step. */
export function qrTagWords(tags: { for: QuickReplyFor; stepId: string | null }, steps: StepsByKind): string[] {
  return [`for ${QR_KINDS[tags.for]}`, `on ${qrStepName(steps, tags.for, tags.stepId) ?? 'no step'}`]
}

// ---------- the Edit quick replies window ----------

/** The editor's tabs. **Phone** (R3) holds the lines on the tech's phone, in their places, with its own panel. */
export type QrEditorTab = 'all' | QuickReplyFor | 'mine' | 'phone' | 'removed'

/** The lines the editor holds for a person: the team's and their own, removed ones too. Another person's own lines stay theirs. */
function editorLines(lines: readonly QuickReply[], me: string): QuickReply[] {
  return lines.filter((q) => q.scope === 'team' || q.addedBy === me)
}

/** A line on the tech's phone: the team's, for customers, not removed, with a place. As `phoneLines` reads them. */
export function onThePhone(q: QuickReply): boolean {
  return !q.removed && q.scope === 'team' && q.for === 'customer' && q.phoneOrder != null
}

/** The count on each tab. The prototype counted every person's own lines, which the window does not show. */
export function editorCounts(lines: readonly QuickReply[], me: string): Record<QrEditorTab, number> {
  const all = editorLines(lines, me)
  const live = all.filter((q) => !q.removed)
  const byKind = Object.fromEntries(QR_KIND_ORDER.map((kind) => [kind, live.filter((q) => q.for === kind).length])) as Record<QuickReplyFor, number>
  return {
    all: live.length,
    ...byKind,
    mine: live.filter((q) => q.scope === 'mine').length,
    phone: live.filter(onThePhone).length,
    removed: all.filter((q) => q.removed).length,
  }
}

/** The four kinds of 2026-10-13: each has a tab only once a line is for them. */
const TAB_ONCE_USED: readonly QuickReplyFor[] = ['lead', 'sub', 'supply_house', 'candidate']

/**
 * The tabs in their order; Removed, and a tab for one of the four newer kinds, show only once they hold a line. Phone
 * comes after Mine once a line is on the phone, so an office that writes only to GCs never sees it.
 */
export function editorTabs(counts: Record<QrEditorTab, number>): Array<{ tab: QrEditorTab; label: string; count: number }> {
  const tabs: Array<[QrEditorTab, string]> = [
    ['all', 'All'],
    ['trade', 'Trade partners'],
    ['customer', 'Customers'],
    ['arch', 'Architects'],
    ...TAB_ONCE_USED.filter((kind) => counts[kind] > 0).map((kind): [QrEditorTab, string] => [kind, QR_KINDS[kind].charAt(0).toUpperCase() + QR_KINDS[kind].slice(1)]),
    ['any', 'Anyone'],
    ['mine', 'Mine'],
  ]
  if (counts.phone > 0) tabs.push(['phone', 'Phone'])
  if (counts.removed > 0) tabs.push(['removed', 'Removed'])
  return tabs.map(([tab, label]) => ({ tab, label, count: counts[tab] }))
}

/**
 * A tab's rows, narrowed by the search in either language, the most used first. The Phone tab's rows are the lines on
 * the phone; its panel orders them by place (`phoneTab.ts`).
 */
export function editorRows(lines: readonly QuickReply[], me: string, tab: QrEditorTab, search: string): QuickReply[] {
  const needle = search.trim().toLowerCase()
  return editorLines(lines, me)
    .filter((q) => (tab === 'removed' ? q.removed : !q.removed))
    .filter((q) => tab === 'all' || tab === 'removed' || (tab === 'mine' ? q.scope === 'mine' : tab === 'phone' ? onThePhone(q) : q.for === tab))
    .filter((q) => !needle || q.text.toLowerCase().includes(needle) || (q.textEs ?? '').toLowerCase().includes(needle))
    .sort((a, b) => qrTotal(b) - qrTotal(a) || a.addedAt - b.addedAt || a.id.localeCompare(b.id))
}

export interface QrEditorGroup {
  for: QuickReplyFor
  stepId: string | null
  /**
   * "Trade partners", then the step or "no step"; a line for anyone has no step part. A kind with two flows names the
   * flow before the step: "Customers", "Residential customer", "Booked".
   */
  title: string[]
  rows: QuickReply[]
}

/**
 * The editor's groups (v1.73): by who the line is for, then by the flow's steps in their order, the lines on no step
 * last, each keeping the rows' order. A line on a step its flow no longer has sits with the lines on no step. A kind
 * with two flows runs flow by flow, in `stepsByKind`'s order, and names the flow in each step's title.
 */
export function editorGroups(rows: readonly QuickReply[], steps: StepsByKind): QrEditorGroup[] {
  const out: QrEditorGroup[] = []
  for (const kind of QR_KIND_ORDER) {
    const ofKind = rows.filter((q) => q.for === kind)
    if (!ofKind.length) continue
    const kindSteps = steps[kind] ?? []
    const twoFlows = new Set(kindSteps.map((s) => s.flow).filter(Boolean)).size > 1
    const flowName = (id: string) => {
      const flow = kindSteps.find((s) => s.id === id)?.flow
      return twoFlows && flow && flow !== 'unknown' ? [FLOW_NAMES[flow]] : []
    }
    const order = kindSteps.map((s) => s.id)
    const byStep = new Map<string, QuickReply[]>()
    for (const q of ofKind) {
      const key = q.stepId && order.includes(q.stepId) ? q.stepId : ''
      byStep.set(key, [...(byStep.get(key) ?? []), q])
    }
    const keys = [...byStep.keys()].sort((a, b) => (a ? order.indexOf(a) : Infinity) - (b ? order.indexOf(b) : Infinity))
    for (const key of keys) {
      const label = QR_KINDS[kind].charAt(0).toUpperCase() + QR_KINDS[kind].slice(1)
      const step = key ? qrStepName(steps, kind, key) : null
      out.push({
        for: kind,
        stepId: key || null,
        title: [label, ...(step ? [...flowName(key), step] : kind === 'any' ? [] : ['no step'])],
        rows: byStep.get(key) ?? [],
      })
    }
  }
  return out
}

/** The editor's line at its foot, in parts. */
export function editorFoot(count: number, search: string): string[] {
  const typed = search.trim()
  return [`${count} line${count === 1 ? '' : 's'}${typed ? ` match “${typed}”` : ''}`, 'by who they are for, then the step, the most used first']
}

// ---------- versions ----------

/** What a version changed. `es` and `phone` are R3's: the Spanish, and the line's place or name on the tech's phone. */
export type QuickReplyChange = 'added' | 'words' | 'tags' | 'es' | 'phone' | 'removed' | 'restored'

export interface QuickReplyTags {
  for: QuickReplyFor
  stepId: string | null
}

/**
 * One change to a line, with who and when (`quick_reply_versions`). Words keep the text before and after; tags keep
 * the tags themselves, not their words, so a renamed step reads by its name today. The Spanish keeps its words before
 * and after in `fromText` and `toText`, either one left out when there was none or it was cleared. The phone keeps its
 * place before and after only when the place changed, none for off the phone; a new name alone keeps neither.
 */
export interface QuickReplyVersion {
  by: string
  at: number
  kind: QuickReplyChange
  fromText?: string
  toText?: string
  fromTags?: QuickReplyTags
  toTags?: QuickReplyTags
  fromPhoneOrder?: number | null
  toPhoneOrder?: number | null
}

/** A line for anyone has no step: the flows are per kind of person. */
function tidyTags(tags: QuickReplyTags): QuickReplyTags {
  return { for: tags.for, stepId: tags.for === 'any' ? null : tags.stepId || null }
}

export type QrResult = { line: QuickReply; versions: QuickReplyVersion[]; words: string } | { error: string }

/** Add a line, for the team or just for me, with its first version. */
export function addQuickReply(input: {
  id: string
  text: string
  tags: QuickReplyTags
  mine: boolean
  by: string
  at: number
}): QrResult {
  const text = input.text.trim()
  if (!text) return { error: 'Write the line first.' }
  const tags = tidyTags(input.tags)
  const line: QuickReply = {
    id: input.id,
    text,
    for: tags.for,
    stepId: tags.stepId,
    scope: input.mine ? 'mine' : 'team',
    addedBy: input.by,
    addedAt: input.at,
    removed: false,
    uses: {},
    lastUsed: null,
  }
  return {
    line,
    versions: [{ by: input.by, at: input.at, kind: 'added', toText: text, toTags: tags }],
    words: input.mine ? 'Added to yours, with your name and today on it.' : 'Added for the team, with your name and today on it.',
  }
}

/**
 * A Save from the editor: the words and the tags, and R3's three parts. A part left out keeps what the line has. A
 * blank Spanish or name clears it, and a place of 0 or null takes the line off the phone, as `edit_quick_reply` reads them.
 */
export interface QuickReplyEdit {
  text: string
  tags: QuickReplyTags
  textEs?: string | null
  phoneOrder?: number | null
  phoneName?: string | null
  /** v2.5573: the big button this line is, or null for none. Saved apart, through `set_quick_reply_press`. */
  phonePress?: PhonePress | null
}

/** The refusal when a line that is not the team's for customers is put on the phone, in `edit_quick_reply`'s words. */
export const PHONE_ONLY_CUSTOMERS = "Only the team's lines for customers go on the phone."

/** The most characters a name on the phone holds (`quick_replies_phone_name_said`). */
export const PHONE_NAME_MAX = 60

/** The refusal when a line off the phone is made a big button, in `set_quick_reply_press`'s spirit. */
export const PRESS_NEEDS_PHONE = 'A big button is a line on the phone. Tick On the tech’s phone first.'

/**
 * Save a line from the editor: a version for each part that changed, in `edit_quick_reply`'s order. The words, the
 * tags, the Spanish, then the phone. The phone keeps its places before and after when the place changed, and neither
 * when only its name did.
 */
export function editQuickReply(q: QuickReply, change: QuickReplyEdit, by: string, at: number): QrResult {
  const text = change.text.trim()
  if (!text) return { error: 'Write something, or Cancel.' }
  const tags = tidyTags(change.tags)
  const es = change.textEs === undefined ? (q.textEs ?? null) : change.textEs?.trim() || null
  const place = change.phoneOrder === undefined ? (q.phoneOrder ?? null) : change.phoneOrder && change.phoneOrder > 0 ? change.phoneOrder : null
  const name = change.phoneName === undefined ? (q.phoneName ?? null) : change.phoneName?.trim() || null
  const press = change.phonePress === undefined ? (q.phonePress ?? null) : change.phonePress
  if (name && name.length > PHONE_NAME_MAX) return { error: `A name on the phone holds ${PHONE_NAME_MAX} characters at most.` }
  if (place != null && (q.scope !== 'team' || tags.for !== 'customer')) return { error: PHONE_ONLY_CUSTOMERS }
  if (press != null && place == null) return { error: PRESS_NEEDS_PHONE }
  const versions: QuickReplyVersion[] = []
  if (text !== q.text) versions.push({ by, at, kind: 'words', fromText: q.text, toText: text })
  if (tags.for !== q.for || tags.stepId !== q.stepId) {
    versions.push({ by, at, kind: 'tags', fromTags: { for: q.for, stepId: q.stepId }, toTags: tags })
  }
  const wasEs = q.textEs ?? null
  if (es !== wasEs) versions.push({ by, at, kind: 'es', ...(wasEs ? { fromText: wasEs } : {}), ...(es ? { toText: es } : {}) })
  const wasPlace = q.phoneOrder ?? null
  if (place !== wasPlace) versions.push({ by, at, kind: 'phone', fromPhoneOrder: wasPlace, toPhoneOrder: place })
  else if (name !== (q.phoneName ?? null) || press !== (q.phonePress ?? null)) versions.push({ by, at, kind: 'phone' })
  return {
    line: { ...q, text, for: tags.for, stepId: tags.stepId, textEs: es, phoneOrder: place, phoneName: name, phonePress: press },
    versions,
    words: versions.length ? 'Saved, with your name and today in its history.' : 'Nothing changed.',
  }
}

/** Remove a line: it leaves the strip and the list and stays in the history. */
export function removeQuickReply(q: QuickReply, by: string, at: number): QrResult {
  return { line: { ...q, removed: true }, versions: [{ by, at, kind: 'removed' }], words: 'Removed. It can be brought back from the Removed tab.' }
}

/** Bring a removed line back. */
export function restoreQuickReply(q: QuickReply, by: string, at: number): QrResult {
  return { line: { ...q, removed: false }, versions: [{ by, at, kind: 'restored' }], words: 'Back on the list.' }
}

/** The ask before a line is removed. */
export const REMOVE_ASK = {
  title: 'Remove this line?',
  words: 'It leaves the strip and the list. It stays in the history as removed, with your name and today. The Removed tab brings it back.',
  remove: 'Remove it',
  keep: 'Keep it',
} as const

/** A press on a line fills the box and counts, so the lines a person uses most come first on their strip. */
export function pressQuickReply(q: QuickReply, by: string, contactId: string | null, at: number): QuickReply {
  return { ...q, uses: { ...q.uses, [by]: qrMine(q, by) + 1 }, lastUsed: { at, by, contactId } }
}

/** One history row's words: what was done, then the words or tags struck and added, then a note. */
export interface VersionWords {
  did: string
  struck: string | null
  added: string | null
  note: string | null
}

/** A place on the phone as the history says it: "place 2". */
const placeWords = (order: number | null | undefined) => (order == null ? null : `place ${order}`)

export function versionWords(v: QuickReplyVersion, steps: StepsByKind): VersionWords {
  const tags = (t: QuickReplyTags | undefined) => (t ? qrTagWords(t, steps).join(' · ') : null)
  switch (v.kind) {
    case 'added':
      return { did: 'added it', struck: null, added: v.toText ?? null, note: null }
    case 'words':
      return { did: 'changed the words', struck: v.fromText ?? null, added: v.toText ?? null, note: null }
    case 'tags':
      return { did: 'tagged it', struck: tags(v.fromTags), added: tags(v.toTags), note: null }
    case 'es': {
      const from = v.fromText?.trim() ? v.fromText : null
      const to = v.toText?.trim() ? v.toText : null
      const did = !from && to ? 'wrote the Spanish' : from && !to ? 'cleared the Spanish' : 'changed the Spanish'
      return { did, struck: from, added: to, note: null }
    }
    case 'phone': {
      const from = placeWords(v.fromPhoneOrder)
      const to = placeWords(v.toPhoneOrder)
      const did = !from && !to ? 'renamed it on the phone' : !from ? 'put it on the phone' : !to ? 'took it off the phone' : 'moved it on the phone'
      return { did, struck: from, added: to, note: null }
    }
    case 'removed':
      return { did: 'removed it', struck: null, added: null, note: 'It stays here and can be brought back.' }
    case 'restored':
      return { did: 'brought it back', struck: null, added: null, note: null }
  }
}

/** The history's head, in parts: how many versions and how often the line is used. */
export function historyHead(versions: readonly QuickReplyVersion[], q: QuickReply): string[] {
  const n = qrTotal(q)
  return ['History', `${versions.length} version${versions.length === 1 ? '' : 's'}`, `used ${n} time${n === 1 ? '' : 's'}`]
}

/** The newest change after the line was added, for the editor's Last change column; null when it was never changed. */
export function lastChange(versions: readonly QuickReplyVersion[]): QuickReplyVersion | null {
  const last = versions[versions.length - 1]
  return last && last.kind !== 'added' ? last : null
}

/** The editor's search box, its note under a line opened to change, and its empty list. */
export const EDITOR_WORDS = {
  search: '⌕ find a line, or words in it',
  saveNote: 'Saving keeps the old words in the history below, with your name and today.',
  removedNote: 'Bring the line back before you change it.',
  empty: (search: string) => (search.trim() ? 'No line has those words.' : 'Nothing here yet.'),
  addPlaceholder: 'The line you type every day…',
} as const

/**
 * The end of the history's *Used by* row: when the line was last pressed, and on whose thread when the window knows
 * that person's name. Only the open thread's person is named for now; a press elsewhere says the day alone.
 */
export function lastUsedWords(day: string, on: string | null): string {
  return `last used ${day}${on ? `, on ${on}` : ''}`
}

/** A user's name in the editor, or a plain word when the account is gone or unknown. */
export function nameOf(names: Readonly<Record<string, string>>, id: string | null | undefined): string {
  return (id && names[id]) || 'Someone'
}

/** Who used the line and how often, the most first. */
export function usedBy(q: QuickReply): Array<{ by: string; count: number }> {
  return Object.entries(q.uses)
    .filter(([, count]) => count > 0)
    .map(([by, count]) => ({ by, count }))
    .sort((a, b) => b.count - a.count || a.by.localeCompare(b.by))
}
