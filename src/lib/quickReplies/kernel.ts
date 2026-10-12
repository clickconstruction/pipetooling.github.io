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
 */

import type { ContactKind } from '../contacts/kernel'
import type { FlowKind } from '../flows/facts'
import type { FlowDef, FlowStep } from '../flows/state'

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
}

/** A step of a kind's flow as a line names it: the flow's own step, by its id and name. */
export type StepRef = Pick<FlowStep, 'id' | 'name'>

/** The flow's steps for each kind of person, in the flow's order. */
export type StepsByKind = Partial<Record<QuickReplyFor, readonly StepRef[]>>

/** The steps a line can belong to, by who it is for, from the flows (the seed until the flows table is read). Anyone's lines have none. */
export function stepsByKind(flows: Readonly<Partial<Record<FlowKind, FlowDef>>>): StepsByKind {
  const of = (kind: Exclude<QuickReplyFor, 'any'>): StepRef[] =>
    (flows[kind]?.lanes ?? []).flatMap((lane) => lane.steps.map((step) => ({ id: step.id, name: step.name })))
  return { trade: of('trade'), customer: of('customer'), arch: of('arch') }
}

/** Who a line is for, as the strip and the editor name them. */
export const QR_KINDS: Readonly<Record<QuickReplyFor, string>> = {
  trade: 'trade partners',
  customer: 'customers',
  arch: 'architects',
  any: 'anyone',
}

/** The editor's groups run in this order of who the line is for. */
export const QR_KIND_ORDER: readonly QuickReplyFor[] = ['trade', 'customer', 'arch', 'any']

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

function stepName(steps: StepsByKind, kind: QuickReplyFor, id: string | null): string | null {
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
}

/**
 * A thread's lines in their groups. A line fits when it is for their kind or for anyone and holds the narrowed words.
 * An unknown number's lines are all for anyone, so they show once, under Anyone; the prototype listed them twice, as
 * "Lines" and "Anyone", and counted them twice in the head.
 */
export function qrGroups(lines: readonly QuickReply[], input: QrGroupsInput): QrGroup[] {
  const kind = qrKindOf(input.kind)
  const needle = (input.filter ?? '').trim().toLowerCase()
  const rows = qrVisible(lines, input.me)
    .filter((q) => (q.for === kind || q.for === 'any') && (!needle || q.text.toLowerCase().includes(needle)))
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
 * quick reply (v1.145), the editor opening on its add form with its guess at the tags.
 */
export function qrEmpty(filter: string): { words: string; add: string | null } {
  const typed = filter.trim()
  if (typed) return { words: 'No line has those words.', add: `Add “${typed}” as a quick reply` }
  return { words: 'No lines for this kind of person yet. Edit adds one.', add: null }
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
  return [`for ${QR_KINDS[tags.for]}`, `on ${stepName(steps, tags.for, tags.stepId) ?? 'no step'}`]
}

// ---------- the Edit quick replies window ----------

export type QrEditorTab = 'all' | QuickReplyFor | 'mine' | 'removed'

/** The lines the editor holds for a person: the team's and their own, removed ones too. Another person's own lines stay theirs. */
function editorLines(lines: readonly QuickReply[], me: string): QuickReply[] {
  return lines.filter((q) => q.scope === 'team' || q.addedBy === me)
}

/** The count on each tab. The prototype counted every person's own lines, which the window does not show. */
export function editorCounts(lines: readonly QuickReply[], me: string): Record<QrEditorTab, number> {
  const all = editorLines(lines, me)
  const live = all.filter((q) => !q.removed)
  return {
    all: live.length,
    trade: live.filter((q) => q.for === 'trade').length,
    customer: live.filter((q) => q.for === 'customer').length,
    arch: live.filter((q) => q.for === 'arch').length,
    any: live.filter((q) => q.for === 'any').length,
    mine: live.filter((q) => q.scope === 'mine').length,
    removed: all.filter((q) => q.removed).length,
  }
}

/** The tabs in their order; Removed shows only once something is removed. */
export function editorTabs(counts: Record<QrEditorTab, number>): Array<{ tab: QrEditorTab; label: string; count: number }> {
  const tabs: Array<[QrEditorTab, string]> = [
    ['all', 'All'],
    ['trade', 'Trade partners'],
    ['customer', 'Customers'],
    ['arch', 'Architects'],
    ['any', 'Anyone'],
    ['mine', 'Mine'],
  ]
  if (counts.removed > 0) tabs.push(['removed', 'Removed'])
  return tabs.map(([tab, label]) => ({ tab, label, count: counts[tab] }))
}

/** A tab's rows, narrowed by the search, the most used first. */
export function editorRows(lines: readonly QuickReply[], me: string, tab: QrEditorTab, search: string): QuickReply[] {
  const needle = search.trim().toLowerCase()
  return editorLines(lines, me)
    .filter((q) => (tab === 'removed' ? q.removed : !q.removed))
    .filter((q) => tab === 'all' || tab === 'removed' || (tab === 'mine' ? q.scope === 'mine' : q.for === tab))
    .filter((q) => !needle || q.text.toLowerCase().includes(needle))
    .sort((a, b) => qrTotal(b) - qrTotal(a) || a.addedAt - b.addedAt || a.id.localeCompare(b.id))
}

export interface QrEditorGroup {
  for: QuickReplyFor
  stepId: string | null
  /** "Trade partners", then the step or "no step"; a line for anyone has no step part. */
  title: string[]
  rows: QuickReply[]
}

/**
 * The editor's groups (v1.73): by who the line is for, then by the flow's steps in their order, the lines on no step
 * last, each keeping the rows' order. A line on a step its flow no longer has sits with the lines on no step.
 */
export function editorGroups(rows: readonly QuickReply[], steps: StepsByKind): QrEditorGroup[] {
  const out: QrEditorGroup[] = []
  for (const kind of QR_KIND_ORDER) {
    const ofKind = rows.filter((q) => q.for === kind)
    if (!ofKind.length) continue
    const order = (steps[kind] ?? []).map((s) => s.id)
    const byStep = new Map<string, QuickReply[]>()
    for (const q of ofKind) {
      const key = q.stepId && order.includes(q.stepId) ? q.stepId : ''
      byStep.set(key, [...(byStep.get(key) ?? []), q])
    }
    const keys = [...byStep.keys()].sort((a, b) => (a ? order.indexOf(a) : Infinity) - (b ? order.indexOf(b) : Infinity))
    for (const key of keys) {
      const label = QR_KINDS[kind].charAt(0).toUpperCase() + QR_KINDS[kind].slice(1)
      const step = key ? stepName(steps, kind, key) : null
      out.push({
        for: kind,
        stepId: key || null,
        title: [label, ...(step ? [step] : kind === 'any' ? [] : ['no step'])],
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

export type QuickReplyChange = 'added' | 'words' | 'tags' | 'removed' | 'restored'

export interface QuickReplyTags {
  for: QuickReplyFor
  stepId: string | null
}

/**
 * One change to a line, with who and when (`quick_reply_versions`). Words keep the text before and after; tags keep
 * the tags themselves, not their words, so a renamed step reads by its name today.
 */
export interface QuickReplyVersion {
  by: string
  at: number
  kind: QuickReplyChange
  fromText?: string
  toText?: string
  fromTags?: QuickReplyTags
  toTags?: QuickReplyTags
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

/** Save a line from the editor: a version for the words and one for the tags, each only when it changed. */
export function editQuickReply(q: QuickReply, change: { text: string; tags: QuickReplyTags }, by: string, at: number): QrResult {
  const text = change.text.trim()
  if (!text) return { error: 'Write something, or Cancel.' }
  const tags = tidyTags(change.tags)
  const versions: QuickReplyVersion[] = []
  if (text !== q.text) versions.push({ by, at, kind: 'words', fromText: q.text, toText: text })
  if (tags.for !== q.for || tags.stepId !== q.stepId) {
    versions.push({ by, at, kind: 'tags', fromTags: { for: q.for, stepId: q.stepId }, toTags: tags })
  }
  return {
    line: { ...q, text, for: tags.for, stepId: tags.stepId },
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

export function versionWords(v: QuickReplyVersion, steps: StepsByKind): VersionWords {
  const tags = (t: QuickReplyTags | undefined) => (t ? qrTagWords(t, steps).join(' · ') : null)
  switch (v.kind) {
    case 'added':
      return { did: 'added it', struck: null, added: v.toText ?? null, note: null }
    case 'words':
      return { did: 'changed the words', struck: v.fromText ?? null, added: v.toText ?? null, note: null }
    case 'tags':
      return { did: 'tagged it', struck: tags(v.fromTags), added: tags(v.toTags), note: null }
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

/** Who used the line and how often, the most first. */
export function usedBy(q: QuickReply): Array<{ by: string; count: number }> {
  return Object.entries(q.uses)
    .filter(([, count]) => count > 0)
    .map(([by, count]) => ({ by, count }))
    .sort((a, b) => b.count - a.count || a.by.localeCompare(b.by))
}
