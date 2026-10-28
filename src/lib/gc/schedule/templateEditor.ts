/**
 * GC mode, the schedule builder's editor (punch list #204, PR 3, the mock-up's D2): a template as the office makes
 * or changes it, with no dates. Phases in order, rows in their phases, each row a name, a who (a trade, Us or
 * Office, the owner's call 3), its days, what it waits on with a gap, and a milestone tick. Every change is a
 * pure function on the draft, and a wait follows the row it names through a rename, a move or a removal: waits
 * are kept by name (`rowRef`), so each change resolves them to rows first and writes the names again after.
 *
 * The weeks a draft makes, its phases' days and the words under the toolbar come from the kernel of PR 1 drawn
 * on a bare job from a Monday (`rowsDraft`), so the editor says what the draw will say. The save's refusals are
 * the words `gc_schedule_template_save` holds, said here first.
 */
import { findRow, rowRef, rowsDraft, templateRows, whoWords } from './builder'
import { isWeekend } from './network'
import { daysBetween } from './schedule'
import { TEMPLATE_NAME_MAX, cleanTemplateName, templateNameProblem } from './templates'
import type { ScheduleTemplate, TemplatePhase, TemplateRow, TemplateWho } from './types'
import { addDays } from '../building'
import type { GcProject, GcState } from '../types'

/** The longest a kind may be, as the table keeps it. */
export const TEMPLATE_KIND_MAX = 40
/** The longest a phase's name may be, as the job's rows keep it. */
export const PHASE_NAME_MAX = 80

/** A Monday the editor draws from, so its weeks and phase days read as a draw from any Monday would. */
export const EDITOR_MONDAY = '2026-01-05'

/** The editor's state: a template with no dates, as the office keeps it between presses. */
export interface TemplateDraft {
  name: string
  /** Its kind in the office's word. Empty: none. */
  kind: string
  /** True: days count Monday to Friday (call 4). */
  workingDays: boolean
  phases: TemplatePhase[]
  /** In phase order, each phase's rows together. */
  rows: TemplateRow[]
}

/** A new template: nothing in it yet, counting working days (call 4). */
export function emptyTemplateDraft(): TemplateDraft {
  return { name: '', kind: '', workingDays: true, phases: [], rows: [] }
}

/** A saved template opened in the editor: its own rows, or a template saved before read as rows with the stage as the phase. */
export function templateDraftOf(t: Pick<ScheduleTemplate, 'name' | 'lines' | 'phases' | 'rows' | 'workingDays'> & { kind?: string }): TemplateDraft {
  const shape = templateRows(t)
  const order = new Map(shape.phases.map((p, i) => [p.key, i]))
  return {
    name: t.name,
    kind: t.kind ?? '',
    workingDays: shape.workingDays,
    phases: shape.phases.map((p) => ({ ...p })),
    rows: shape.rows
      .map((r, i) => ({ r, i }))
      .sort((a, b) => (order.get(a.r.phase) ?? order.size) - (order.get(b.r.phase) ?? order.size) || a.i - b.i)
      .map((x) => ({ ...x.r, after: x.r.after.map((w) => ({ ...w })) })),
  }
}

// ---------------------------------------------------------------------------------------------
// The waits, resolved and written again
// ---------------------------------------------------------------------------------------------

interface Item {
  row: TemplateRow
  waits: { on: Item; gap: number }[]
}

/** The rows with their waits resolved to the rows they name: a wait on no row, or on the row itself, is dropped. */
function itemsOf(rows: TemplateRow[]): Item[] {
  const items: Item[] = rows.map((row) => ({ row, waits: [] }))
  rows.forEach((row, i) => {
    const item = items[i]
    if (!item) return
    item.waits = row.after.flatMap((w) => {
      const hit = findRow(rows, w.row)
      const j = hit ? rows.indexOf(hit) : -1
      const on = j >= 0 ? items[j] : undefined
      return on && on !== item ? [{ on, gap: w.gap ?? 0 }] : []
    })
  })
  return items
}

/** The rows again, each wait written by the name its row has now; a wait on a row that is gone goes with it. */
function rowsOf(items: Item[]): TemplateRow[] {
  const bare = items.map((it) => ({ ...it.row, after: [] as TemplateRow['after'] }))
  return items.map((it, i) => ({
    ...bare[i]!,
    after: it.waits.flatMap((w) => {
      const j = items.indexOf(w.on)
      const target = bare[j]
      return j >= 0 && target ? [{ row: rowRef(bare, target), ...(w.gap !== 0 ? { gap: w.gap } : {}) }] : []
    }),
  }))
}

function edit(d: TemplateDraft, change: (items: Item[]) => Item[]): TemplateDraft {
  return { ...d, rows: rowsOf(change(itemsOf(d.rows))) }
}

// ---------------------------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------------------------

/** A phase's key from its name: letters and digits, unique among the keys taken. */
export function phaseKeyFor(name: string, taken: Iterable<string>): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'phase'
  const had = new Set(taken)
  if (!had.has(base)) return base
  let n = 2
  while (had.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/** A phase added at the end. A blank name reads "Phase N". */
export function addPhase(d: TemplateDraft, name: string): TemplateDraft {
  const clean = cleanName(name) || `Phase ${d.phases.length + 1}`
  const key = phaseKeyFor(clean, d.phases.map((p) => p.key))
  return { ...d, phases: [...d.phases, { key, name: clean }] }
}

/** A phase's new name. Its key stays, so its rows stay with it. */
export function renamePhase(d: TemplateDraft, key: string, name: string): TemplateDraft {
  return { ...d, phases: d.phases.map((p) => (p.key === key ? { ...p, name: cleanName(name) } : p)) }
}

/** The index of each row in a phase, in order. */
export function rowIndexesOf(d: TemplateDraft, key: string): number[] {
  return d.rows.flatMap((r, i) => (r.phase === key ? [i] : []))
}

/** A phase moved up or down, its rows with it. At an end: unchanged. */
export function movePhase(d: TemplateDraft, key: string, dir: 'up' | 'down'): TemplateDraft {
  const i = d.phases.findIndex((p) => p.key === key)
  const j = dir === 'up' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= d.phases.length) return d
  const phases = [...d.phases]
  const [moved] = phases.splice(i, 1)
  if (!moved) return d
  phases.splice(j, 0, moved)
  return edit({ ...d, phases }, (items) => {
    const order = new Map(phases.map((p, k) => [p.key, k]))
    return [...items].sort((a, b) => (order.get(a.row.phase) ?? order.size) - (order.get(b.row.phase) ?? order.size))
  })
}

/** Why a phase cannot be taken off: its rows. Null: it can go. */
export function phaseRemoveProblem(d: TemplateDraft, key: string): string | null {
  const n = rowIndexesOf(d, key).length
  if (n === 0) return null
  return n === 1 ? 'Move its row to another phase first, or take it off.' : `Move its ${n} rows to another phase first, or take them off.`
}

/** A phase with no rows taken off. One with rows: unchanged. */
export function removePhase(d: TemplateDraft, key: string): TemplateDraft {
  if (phaseRemoveProblem(d, key)) return d
  return { ...d, phases: d.phases.filter((p) => p.key !== key) }
}

// ---------------------------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------------------------

/** Where a row of a phase goes: after the phase's last row, or where the phase's rows would be among the others. */
function insertAt(d: TemplateDraft, phaseKey: string): number {
  const own = rowIndexesOf(d, phaseKey)
  const last = own[own.length - 1]
  if (last !== undefined) return last + 1
  const order = new Map(d.phases.map((p, i) => [p.key, i]))
  const at = order.get(phaseKey) ?? order.size
  const before = d.rows.filter((r) => (order.get(r.phase) ?? order.size) <= at).length
  return before
}

/** A row added to a phase: an Office row of one day with nothing to wait on, unless the press says more. */
export function addRow(d: TemplateDraft, phaseKey: string, more: Partial<Omit<TemplateRow, 'phase'>> = {}): TemplateDraft {
  if (!d.phases.some((p) => p.key === phaseKey)) return d
  const row: TemplateRow = { phase: phaseKey, label: '', who: { kind: 'office' }, days: 1, after: [], offset: 0, milestone: false, ...more }
  const at = insertAt(d, phaseKey)
  return edit(d, (items) => {
    const out = [...items]
    out.splice(at, 0, { row, waits: [] })
    return out
  })
}

/** What a row's own fields may change to. Its waits change through `setRowWaits`, its phase through `moveRowToPhase`. */
export type RowPatch = Partial<Pick<TemplateRow, 'label' | 'who' | 'days' | 'milestone' | 'offset' | 'place'>>

/** A row changed: its name, who, days, milestone tick, offset or place. The waits that name it follow its new name. */
export function updateRow(d: TemplateDraft, index: number, patch: RowPatch): TemplateDraft {
  if (!d.rows[index]) return d
  return edit(d, (items) =>
    items.map((it, i) => {
      if (i !== index) return it
      const row: TemplateRow = { ...it.row, ...patch, ...('label' in patch ? { label: cleanName(patch.label ?? '') } : {}) }
      if ('place' in patch && !patch.place) delete row.place
      it.row = row
      return it
    }),
  )
}

/** What a row waits on, each by the name `rowRef` gives it, with a gap. A name no row answers to is dropped. */
export function setRowWaits(d: TemplateDraft, index: number, after: { row: string; gap?: number }[]): TemplateDraft {
  const row = d.rows[index]
  if (!row) return d
  const rows = d.rows.map((r, i) => (i === index ? { ...r, after: after.map((w) => ({ row: w.row, ...(w.gap ? { gap: w.gap } : {}) })) } : r))
  return edit({ ...d, rows }, (items) => items)
}

/** A row moved up or down within its phase. At an end of its phase: unchanged. */
export function moveRow(d: TemplateDraft, index: number, dir: 'up' | 'down'): TemplateDraft {
  const row = d.rows[index]
  if (!row) return d
  const own = rowIndexesOf(d, row.phase)
  const k = own.indexOf(index)
  const other = own[dir === 'up' ? k - 1 : k + 1]
  if (other === undefined) return d
  return edit(d, (items) => {
    const out = [...items]
    const a = out[index]
    const b = out[other]
    if (!a || !b) return items
    out[index] = b
    out[other] = a
    return out
  })
}

/** A row moved to the end of another phase. */
export function moveRowToPhase(d: TemplateDraft, index: number, phaseKey: string): TemplateDraft {
  const row = d.rows[index]
  if (!row || row.phase === phaseKey || !d.phases.some((p) => p.key === phaseKey)) return d
  return edit(d, (items) => {
    const out = [...items]
    const [moved] = out.splice(index, 1)
    if (!moved) return items
    moved.row = { ...moved.row, phase: phaseKey }
    const without: TemplateDraft = { ...d, rows: out.map((it) => it.row) }
    out.splice(insertAt(without, phaseKey), 0, moved)
    return out
  })
}

/** A row taken off. Every wait on it goes with it. */
export function removeRow(d: TemplateDraft, index: number): TemplateDraft {
  if (!d.rows[index]) return d
  return edit(d, (items) => items.filter((_, i) => i !== index))
}

/** The rows a row may wait on, each by the name a wait writes and the words the editor shows: every other row. */
export function rowWaitChoices(d: TemplateDraft, index: number): { ref: string; words: string }[] {
  const phase = new Map(d.phases.map((p) => [p.key, p.name]))
  return d.rows.flatMap((r, i) => {
    if (i === index) return []
    const ref = rowRef(d.rows, r)
    const words = r.label ? `${ref}${r.phase !== d.rows[index]?.phase ? ` (${phase.get(r.phase) ?? r.phase})` : ''}` : `Row ${i + 1}, unnamed`
    return [{ ref, words }]
  })
}

/** What a row waits on, in the editor's column: "the start day", a row's name, or the first with how many more. */
export function waitWords(row: TemplateRow): string {
  const first = row.after[0]
  if (!first) return 'the start day'
  const more = row.after.length - 1
  return more === 0 ? first.row : `${first.row} and ${more} more`
}

/** The gap in the editor's column: the first wait's. */
export function gapOf(row: TemplateRow): number {
  return row.after[0]?.gap ?? 0
}

// ---------------------------------------------------------------------------------------------
// What it makes
// ---------------------------------------------------------------------------------------------

/** A job with nothing on it, for the draw the editor reads: every trade row lands with no company, as it would on a new job. */
function bareProject(): GcProject {
  return {
    id: 'template',
    name: '',
    address: '',
    town: '',
    ourBidSentOn: null,
    ownerContractSignedOn: null,
    permitOn: null,
    startDate: null,
    startedOn: null,
    customerId: '',
    owner: '',
    ownerBilling: null,
    architectId: '',
    architect: '',
    questions: [],
    stage: 'buyout',
    bidDue: null,
    sizeNote: '',
    planSets: [],
    packages: [],
    generalConditions: 0,
    contingencyPct: 0,
    feePct: 0,
  }
}

/** Days from one day to another, both counted, on the template's calendar. */
function countDays(start: string, finish: string, workingDays: boolean): number {
  if (!workingDays) return daysBetween(start, finish) + 1
  let n = 0
  for (let at = start; at <= finish; at = addDays(at, 1)) if (!isWeekend(at)) n++
  return n
}

/** A phase as the editor heads it: its rows, how many are dates to meet, and its days on the draw from a Monday. */
export interface DraftPhase {
  key: string
  name: string
  rows: number
  milestones: number
  /** Its first day to its last, on the template's calendar. 0: no rows. */
  days: number
}

/** The draft drawn on a bare job from a Monday: what the editor's numbers read from. Null: no rows yet. */
export function templateDraftDraw(d: TemplateDraft) {
  if (d.rows.length === 0) return null
  return rowsDraft(bareProject(), EDITOR_MONDAY, { phases: d.phases, rows: d.rows, workingDays: d.workingDays })
}

/** The first and last day of the rows on the draw: the bars and dates to meet drawn in a phase, never the draft's own inspection and substantial completion, which stand outside the rows. */
function rowedSpans(drawn: ReturnType<typeof templateDraftDraw>, phase?: string): { start: string; finish: string }[] {
  if (!drawn) return []
  const of = (p: string | undefined) => p !== undefined && (phase === undefined || p === phase)
  return [
    ...drawn.activities.filter((a) => of(a.phase)).map((a) => ({ start: a.start, finish: a.finish })),
    ...drawn.milestones.filter((m) => of(m.phase)).map((m) => ({ start: m.planned, finish: m.planned })),
  ]
}

function spanOf(spans: { start: string; finish: string }[]): { start: string; finish: string } | null {
  const first = spans[0]
  if (!first) return null
  return {
    start: spans.reduce((m, s) => (s.start < m ? s.start : m), first.start),
    finish: spans.reduce((m, s) => (s.finish > m ? s.finish : m), first.finish),
  }
}

/**
 * The weeks the draft makes from a Monday start: its first row's first day to its last row's last day, in whole
 * weeks, as the fit on a job counts a draw (`drawWeeks`) but over the rows alone. The draft's own final inspection
 * and substantial completion are left out: with no closeout row in the template they land on a bare job before
 * the rows end, and the editor says what the rows make. 0: no rows yet.
 */
export function templateDraftWeeks(d: TemplateDraft): number {
  const span = spanOf(rowedSpans(templateDraftDraw(d)))
  return span ? Math.ceil((daysBetween(span.start, span.finish) + 1) / 7) : 0
}

/** Each phase with its rows, its dates to meet and its days on the draw. */
export function templateDraftPhases(d: TemplateDraft): DraftPhase[] {
  const drawn = templateDraftDraw(d)
  return d.phases.map((p) => {
    const rows = d.rows.filter((r) => r.phase === p.key)
    const span = spanOf(rowedSpans(drawn, p.name))
    const days = span ? countDays(span.start, span.finish, d.workingDays) : 0
    return { key: p.key, name: p.name, rows: rows.length, milestones: rows.filter((r) => r.milestone).length, days }
  })
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** The line under the toolbar: "Makes 20 weeks from a Monday start. 50 rows, 8 phases, 6 milestones." */
export function templateDraftWords(d: TemplateDraft): string {
  const weeks = templateDraftWeeks(d)
  const head = d.rows.length === 0 ? 'Nothing to draw yet. Add a phase, then a row.' : `Makes ${count(weeks, 'week')} from a Monday start.`
  const milestones = d.rows.filter((r) => r.milestone).length
  return `${head} ${count(d.rows.length, 'row')}, ${count(d.phases.length, 'phase')}, ${count(milestones, 'milestone')}.`
}

/** "Mon to Fri" or "every day", as the Days are box reads. */
export function daysAreWords(workingDays: boolean): string {
  return workingDays ? 'Mon to Fri' : 'every day'
}

// ---------------------------------------------------------------------------------------------
// The save
// ---------------------------------------------------------------------------------------------

/**
 * Why the draft cannot be saved, in the words the save holds, or null when it can: the name (another template's
 * too, when the state is given), a phase and a row at least, every phase and row named, each row's days and who,
 * the kind's length, and a week at least.
 */
export function templateDraftProblem(d: TemplateDraft, state?: GcState, exceptId?: string): string | null {
  const name = cleanTemplateName(d.name)
  if (!name) return 'Give it a name.'
  if (name.length > TEMPLATE_NAME_MAX) return `Keep the name to ${TEMPLATE_NAME_MAX} letters.`
  if (state) {
    const taken = templateNameProblem(state, name, exceptId)
    if (taken) return taken
  }
  if (cleanName(d.kind).length > TEMPLATE_KIND_MAX) return `Keep the kind to ${TEMPLATE_KIND_MAX} letters.`
  if (d.phases.length === 0) return 'A template needs at least one phase.'
  const blankPhase = d.phases.findIndex((p) => !cleanName(p.name))
  if (blankPhase >= 0) return `Name phase ${blankPhase + 1}.`
  const longPhase = d.phases.find((p) => cleanName(p.name).length > PHASE_NAME_MAX)
  if (longPhase) return `Keep the phase's name to ${PHASE_NAME_MAX} letters: ${longPhase.name.slice(0, 20)}…`
  const names = d.phases.map((p) => cleanName(p.name).toLowerCase())
  if (new Set(names).size !== names.length) return 'Two phases have the same name. Give one another name.'
  if (d.rows.length === 0) return 'A template needs at least one row.'
  const phaseName = new Map(d.phases.map((p) => [p.key, p.name]))
  for (const p of d.phases) {
    const own = rowIndexesOf(d, p.key)
    for (let k = 0; k < own.length; k++) {
      const row = d.rows[own[k]!]
      if (!row) continue
      const where = `row ${k + 1} in ${p.name}`
      if (!cleanName(row.label)) return `Name ${where}.`
      if (!Number.isFinite(row.days) || row.days < 1) return `Give ${where} its days, one or more.`
      if (row.who.kind === 'trade' && !cleanName(row.who.trade)) return `Pick a trade for ${where}.`
    }
  }
  const lost = d.rows.find((r) => !phaseName.has(r.phase))
  if (lost) return `The row ${lost.label || '(unnamed)'} is in a phase the template does not have.`
  if (templateDraftWeeks(d) < 1) return 'It makes under a week to build. Give a row more days.'
  return null
}

/** The save, as `gc_schedule_template_save` reads `p_template`. */
export interface TemplateSaveBody {
  name: string
  kind?: string
  on: string
  workingDays: boolean
  weeks: number
  phases: TemplatePhase[]
  rows: TemplateRow[]
  lines: ScheduleTemplate['lines']
  stages: ScheduleTemplate['stages']
  from?: ScheduleTemplate['from']
}

/**
 * The draft as the save reads it, on the day given: its rows cleaned (names tidied, a milestone of one day, a
 * trade row's trade tidied), its weeks from a Monday, and, saved from a job's schedule, that job's lines, stages
 * and where it came from.
 */
export function templateSaveBody(d: TemplateDraft, on: string, fromJob?: Pick<ScheduleTemplate, 'lines' | 'stages' | 'from'>): TemplateSaveBody {
  const kind = cleanName(d.kind)
  const rows = d.rows.map((r): TemplateRow => {
    const who: TemplateWho = r.who.kind === 'trade' ? { kind: 'trade', trade: cleanName(r.who.trade) } : r.who
    return { ...r, label: cleanName(r.label), who, days: r.milestone ? 1 : Math.max(1, Math.round(r.days)) }
  })
  return {
    name: cleanTemplateName(d.name),
    ...(kind ? { kind } : {}),
    on,
    workingDays: d.workingDays,
    weeks: templateDraftWeeks({ ...d, rows }),
    phases: d.phases.map((p) => ({ key: p.key, name: cleanName(p.name) })),
    rows,
    lines: fromJob?.lines ?? [],
    stages: fromJob?.stages ?? [],
    ...(fromJob?.from ? { from: fromJob.from } : {}),
  }
}

/** "Sitework", "Us" or "Office": the Who column. */
export { whoWords }
