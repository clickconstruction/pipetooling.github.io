/**
 * GC mode, the schedule builder's paste (punch list #204, PR 4, the mock-up's D): a list of rows pasted from a
 * spreadsheet into the editor, one row a line with tabs between the columns: phase, row, who, days, waits on, gap
 * and milestone. On the import kernel's pattern (`import.ts`): the reading says what it read and what it could
 * not, line by line, before anything joins the draft; a wait that names no row is dropped and said. A blank
 * phase takes the line before it. `applyPaste` puts the rows on the draft, matching a phase by name and adding
 * the rest, and writes the waits by the names the rows have then.
 */
import { findRow, rowRef } from './builder'
import { phaseKeyFor, type TemplateDraft } from './templateEditor'
import type { TemplateRow, TemplateWho } from './types'

/** The columns, in the order a line gives them. The first line may repeat them as a heading. */
export const PASTE_COLUMNS = ['Phase', 'Row', 'Who', 'Days', 'Waits on', 'Gap', 'Milestone'] as const

/** What the box says above the paste. */
export const PASTE_INTRO = [
  'One row a line, with a tab between the columns, as a spreadsheet pastes them.',
  'The columns are phase, row, who, days, waits on, gap and milestone.',
  'A blank phase takes the line before it. Who is a trade, Us or Office.',
]

/** One pasted line read as a row, before it joins the draft. */
export interface PastedRow {
  /** Its line in the paste, counting from one. */
  line: number
  /** The phase's name as typed, tidied. */
  phase: string
  label: string
  who: TemplateWho
  days: number
  milestone: boolean
  /** What it waits on: another pasted row by its index, or a row the draft has by the name a wait writes. Null: the start day. */
  wait: { on: { pasted: number } | { existing: string }; gap: number } | null
}

export interface PasteReading {
  /** The phases named, in order of first appearance, tidied. */
  phases: string[]
  rows: PastedRow[]
  /** The lines that could not be read, each with why, in the paste's order. */
  held: { line: number; why: string }[]
  /** The waits dropped: the line and the name it typed that no row answers to. */
  dropped: { line: number; waitsOn: string }[]
}

function clean(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

function nameKey(s: string): string {
  return clean(s).toLowerCase()
}

/** A who as typed: Us for ours, Office for the office's, anything else a trade. Blank: Office. */
export function whoFromWords(words: string): TemplateWho {
  const w = nameKey(words)
  if (w === '' || w === 'office' || w === 'the office') return { kind: 'office' }
  if (w === 'us' || w === 'ours' || w === 'our own crew' || w === 'our crew' || w === 'we') return { kind: 'us' }
  return { kind: 'trade', trade: clean(words) }
}

/** A milestone mark as typed: yes, y, x, a tick, true, 1 or the word itself. */
function milestoneFromWords(words: string): boolean {
  return /^(yes|y|x|✓|✔|true|1|milestone|date)$/i.test(words.trim())
}

/** A whole number from a cell, or null when the cell is not one. Blank: the fallback. */
function wholeNumber(cell: string, fallback: number): number | null {
  const s = cell.trim()
  if (s === '') return fallback
  if (!/^\d+$/.test(s)) return null
  return Number(s)
}

/**
 * The paste read line by line. A line with no tab is held, since it cannot say its phase and its row apart. A
 * heading line that repeats the columns is skipped. `existing` are the draft's rows, so a wait may name one of
 * them by the name a wait writes.
 */
export function readPastedRows(text: string, existing: TemplateRow[] = []): PasteReading {
  const phases: string[] = []
  const rows: PastedRow[] = []
  const held: PasteReading['held'] = []
  const typed: { row: PastedRow; waitsOn: string; gap: number }[] = []
  let phase = ''
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  lines.forEach((raw, i) => {
    const line = i + 1
    if (raw.trim() === '') return
    const cells = raw.split('\t').map((c) => c.replace(/^"|"$/g, ''))
    if (cells.length < 2) {
      held.push({ line, why: 'has no tab between the phase and the row' })
      return
    }
    const [c0 = '', c1 = '', c2 = '', c3 = '', c4 = '', c5 = '', c6 = ''] = cells
    if (line === 1 && nameKey(c0) === 'phase' && nameKey(c1) === 'row') return
    const phaseCell = clean(c0)
    if (phaseCell) {
      phase = phaseCell
      if (!phases.some((p) => nameKey(p) === nameKey(phase))) phases.push(phase)
      else phase = phases.find((p) => nameKey(p) === nameKey(phase)) ?? phase
    }
    if (!phase) {
      held.push({ line, why: 'has no phase, and no line above it names one' })
      return
    }
    const label = clean(c1)
    if (!label) {
      held.push({ line, why: 'has no row name' })
      return
    }
    const milestone = milestoneFromWords(c6)
    const days = milestone ? 1 : wholeNumber(c3, 1)
    if (days === null || days < 1) {
      held.push({ line, why: 'needs its days as a whole number, one or more' })
      return
    }
    const gap = wholeNumber(c5, 0)
    if (gap === null) {
      held.push({ line, why: 'needs its gap as a whole number' })
      return
    }
    const row: PastedRow = { line, phase, label, who: whoFromWords(c2), days, milestone, wait: null }
    rows.push(row)
    if (clean(c4)) typed.push({ row, waitsOn: clean(c4), gap })
  })
  // The waits, once every row is read: a pasted row by name first, then one the draft has.
  const dropped: PasteReading['dropped'] = []
  for (const t of typed) {
    const key = nameKey(t.waitsOn)
    const pasted = rows.findIndex((r) => r !== t.row && (nameKey(r.label) === key || nameKey(`${whoWord(r.who)} · ${r.label}`) === key))
    if (pasted >= 0) {
      t.row.wait = { on: { pasted }, gap: t.gap }
      continue
    }
    const hit = findRow(existing, t.waitsOn)
    if (hit) {
      t.row.wait = { on: { existing: rowRef(existing, hit) }, gap: t.gap }
      continue
    }
    dropped.push({ line: t.row.line, waitsOn: t.waitsOn })
  }
  return { phases, rows, held, dropped }
}

function whoWord(who: TemplateWho): string {
  return who.kind === 'trade' ? who.trade : who.kind === 'us' ? 'Us' : 'Office'
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * What the paste read, in plain words: the rows and phases with the dates to meet, the lines held with why, and
 * the waits dropped. Each a sentence of its own.
 */
export function pasteWords(reading: PasteReading): string[] {
  const out: string[] = []
  const dates = reading.rows.filter((r) => r.milestone).length
  if (reading.rows.length === 0) out.push('No row read yet.')
  else out.push(`Read ${count(reading.rows.length, 'row')} in ${count(reading.phases.length, 'phase')}${dates > 0 ? `, ${dates === 1 ? '1 of them a date to meet' : `${dates} of them dates to meet`}` : ''}.`)
  if (reading.held.length > 0) {
    out.push(`${count(reading.held.length, 'line')} could not be read.`)
    for (const h of reading.held) out.push(`Line ${h.line} ${h.why}.`)
  }
  for (const d of reading.dropped) out.push(`Line ${d.line} waits on ${d.waitsOn}, which no row is called. It starts on the start day.`)
  return out
}

/**
 * The pasted rows on the draft: a phase the draft has by name takes its rows, the others are added in the paste's
 * order, and each row goes at the end of its phase. The waits are written by the names the rows have then.
 */
export function applyPaste(d: TemplateDraft, reading: PasteReading): TemplateDraft {
  const phases = [...d.phases]
  const keyOf = new Map<string, string>()
  for (const name of reading.phases) {
    const have = phases.find((p) => nameKey(p.name) === nameKey(name))
    if (have) keyOf.set(nameKey(name), have.key)
    else {
      const key = phaseKeyFor(name, phases.map((p) => p.key))
      phases.push({ key, name })
      keyOf.set(nameKey(name), key)
    }
  }
  // The pasted rows as rows, with their waits by name once every row is placed.
  const added: TemplateRow[] = reading.rows.map((r) => ({
    phase: keyOf.get(nameKey(r.phase)) ?? '',
    label: r.label,
    who: r.who,
    days: r.days,
    after: [],
    offset: 0,
    milestone: r.milestone,
  }))
  const order = new Map(phases.map((p, i) => [p.key, i]))
  const all = [...d.rows, ...added]
  const at = (row: TemplateRow) => order.get(row.phase) ?? order.size
  const rows = all
    .map((row, i) => ({ row, i }))
    .sort((a, b) => at(a.row) - at(b.row) || a.i - b.i)
    .map((x) => x.row)
  reading.rows.forEach((r, i) => {
    const row = added[i]
    if (!row || !r.wait) return
    const target = 'pasted' in r.wait.on ? added[r.wait.on.pasted] : findRow(d.rows, r.wait.on.existing)
    if (!target || target === row) return
    row.after = [{ row: rowRef(rows, target), ...(r.wait.gap !== 0 ? { gap: r.wait.gap } : {}) }]
  })
  return { ...d, phases, rows }
}
