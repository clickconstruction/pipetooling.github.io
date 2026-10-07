/**
 * GC mode, the real build, step 9: the plans as they stand at each set, read from the rows. A
 * sheet carries which set last changed it, whether a set added it and what it was called before a
 * set renamed it; a sheet a set took out stays to read, crossed out, with the set that took it
 * out (the prototype's `sheetsAtRev` and `sheetsGoneAtRev`, branch spike/gc-mode).
 */
import type { GcProjectRows } from './projectRows'

export interface SheetInSet {
  id: string
  title: string
  discipline?: string
  page?: number
  /** Null: as first issued. */
  changedInRev: number | null
  /** The index did not have it before a set added it. */
  added: boolean
  /** The title before the newest set that renamed it. */
  was?: string
}

export interface SheetGone {
  id: string
  title: string
  goneInRev: number
}

const key = (n: string) => n.toUpperCase().replace(/[-.\s]/g, '')

function walk(rows: GcProjectRows, kind: 'sheet' | 'section', rev: number): { live: SheetInSet[]; gone: SheetGone[] } {
  const live = new Map<string, SheetInSet>()
  const gone = new Map<string, SheetGone>()
  const order: string[] = []
  for (const set of [...rows.sets].filter((s) => s.rev <= rev).sort((a, b) => a.rev - b.rev)) {
    for (const it of rows.setItems.filter((x) => x.set_id === set.id && x.kind === kind).sort((a, b) => a.position - b.position)) {
      const k = key(it.number)
      const was = live.get(k)
      if (it.change === 'removed') {
        if (was) gone.set(k, { id: was.id, title: was.title, goneInRev: set.rev })
        live.delete(k)
        continue
      }
      gone.delete(k)
      const base: SheetInSet = {
        id: it.number,
        title: it.change === 'revised' && was ? was.title : it.title,
        ...(it.discipline ? { discipline: it.discipline } : was?.discipline ? { discipline: was.discipline } : {}),
        ...(it.page ? { page: it.page } : was?.page ? { page: was.page } : {}),
        changedInRev: set.rev === 0 && it.change === 'issued' ? null : set.rev,
        added: was ? was.added && it.change !== 'renamed' && it.change !== 'revised' ? was.added : it.change === 'added' : it.change === 'added',
        ...(it.change === 'renamed' ? { was: it.was_title ?? was?.title } : was?.was && it.change !== 'added' ? { was: was.was } : {}),
      }
      if (!was) order.push(k)
      live.set(k, base)
    }
  }
  return { live: order.flatMap((k) => (live.has(k) ? [live.get(k)!] : [])), gone: [...gone.values()] }
}

/** The sheets as they stand after a set, each with what the sets did to it. */
export function sheetsInSetAt(rows: GcProjectRows, rev: number): SheetInSet[] {
  return walk(rows, 'sheet', rev).live
}

/** The sheets the sets up to this one took out, as they were titled when they went. */
export function sheetsGoneAtSet(rows: GcProjectRows, rev: number): SheetGone[] {
  return walk(rows, 'sheet', rev).gone
}

export function specsInSetAt(rows: GcProjectRows, rev: number): SheetInSet[] {
  return walk(rows, 'section', rev).live
}

export function specsGoneAtSet(rows: GcProjectRows, rev: number): SheetGone[] {
  return walk(rows, 'section', rev).gone
}

/** What a set is called, by its rev. */
export function setLabelAt(rows: GcProjectRows, rev: number): string {
  return rows.sets.find((s) => s.rev === rev)?.label ?? `set ${rev}`
}

/** The set that added a scope line, by its label; null when the line came with the project. */
export function setThatAddedLine(rows: GcProjectRows, scopeId: string): string | null {
  const item = rows.scopeItems.find((x) => x.id === scopeId)
  if (!item?.added_in_set_id) return null
  return rows.sets.find((s) => s.id === item.added_in_set_id)?.label ?? null
}
