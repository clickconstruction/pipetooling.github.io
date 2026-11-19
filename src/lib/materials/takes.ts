/**
 * Take from a box, read back (v2.7828, step 4): the takes of a job as the rows tell them. A take is not a row
 * (`takeRun.ts`): it is the ledger rows and box photos that share a `take_id`. This folds them into one line a take,
 * with what was taken, its photo as found and its photo after, and says what is missing. Nothing compares two
 * pictures: the screens put the last person's photo after beside this person's photo as found (`takeAsLeft`), and a
 * person looks. Pure.
 */
import type { Movement } from './onSite'
import type { PhotoNote } from './photo'
import { TAKE_FOUND_NOTE, takeIdOf } from './takeRun'

/** A take with both photos, with one missing, with none, or with photos and nothing marked. */
export type TakeState = 'whole' | 'no-before' | 'no-after' | 'no-photos' | 'nothing-marked'

export type TakeLine = { partName: string; quantity: number }

export type Take = {
  id: string
  jobId: string
  containerId: string
  byName: string
  /** When it reads: its last ledger row, or its first photo when nothing was marked. */
  at: string
  lines: TakeLine[]
  /** Pieces taken. */
  count: number
  /** Pieces the app had not counted, recorded as found by the run. */
  found: number
  before: PhotoNote | null
  after: PhotoNote | null
  state: TakeState
}

function stateOf(count: number, before: PhotoNote | null, after: PhotoNote | null): TakeState {
  if (count === 0) return 'nothing-marked'
  if (before && after) return 'whole'
  if (!before && !after) return 'no-photos'
  return before ? 'no-after' : 'no-before'
}

/** Every take on a job, newest first. A row or a photo with no take is left out. */
export function takesOf(movements: ReadonlyArray<Movement>, photos: ReadonlyArray<PhotoNote>): Take[] {
  type Acc = { id: string; jobId: string; containerId: string; byName: string; rowAt: string; photoAt: string; lines: Map<string, TakeLine>; count: number; found: number; before: PhotoNote | null; after: PhotoNote | null }
  const acc = new Map<string, Acc>()
  const get = (id: string, jobId: string): Acc => {
    let a = acc.get(id)
    if (!a) {
      a = { id, jobId, containerId: '', byName: '', rowAt: '', photoAt: '', lines: new Map(), count: 0, found: 0, before: null, after: null }
      acc.set(id, a)
    }
    return a
  }
  for (const m of movements) {
    const id = takeIdOf(m)
    if (!id) continue
    const a = get(id, m.jobId)
    if (m.reason === 'delivered') {
      if (m.note === TAKE_FOUND_NOTE) a.found += m.quantity
      if (!a.containerId && m.toContainerId) a.containerId = m.toContainerId
      continue
    }
    if (m.fromContainerId) a.containerId = m.fromContainerId
    if (!a.byName) a.byName = m.byName
    if (m.at > a.rowAt) a.rowAt = m.at
    a.count += m.quantity
    const key = m.partName.trim().toLowerCase()
    const line = a.lines.get(key)
    if (line) line.quantity += m.quantity
    else a.lines.set(key, { partName: m.partName, quantity: m.quantity })
  }
  for (const p of photos) {
    if (!p.takeId) continue
    const a = get(p.takeId, p.jobId)
    if (!a.containerId) a.containerId = p.containerId
    if (!a.byName) a.byName = p.byName
    if (!a.photoAt || p.at < a.photoAt) a.photoAt = p.at
    // A photo taken twice: the newest of its kind stands.
    if (p.kind === 'before' && (!a.before || p.at > a.before.at)) a.before = p
    if (p.kind === 'after' && (!a.after || p.at > a.after.at)) a.after = p
  }
  const out: Take[] = []
  for (const a of acc.values()) {
    if (!a.containerId) continue
    out.push({ id: a.id, jobId: a.jobId, containerId: a.containerId, byName: a.byName, at: a.rowAt || a.photoAt, lines: [...a.lines.values()], count: a.count, found: a.found, before: a.before, after: a.after, state: stateOf(a.count, a.before, a.after) })
  }
  return out.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : x.id < y.id ? -1 : 1))
}

/** The box as the person before left it: the newest photo after of an earlier take of the same box, or null. */
export function takeAsLeft(takes: ReadonlyArray<Take>, take: Take): PhotoNote | null {
  let best: Take | null = null
  for (const t of takes) {
    if (t.id === take.id || t.containerId !== take.containerId || !t.after || t.at >= take.at) continue
    if (!best || t.at > best.at) best = t
  }
  return best?.after ?? null
}

/** The chip on a take: what the office looks for first. */
export function takeChip(state: TakeState): { words: string; tone: 'green' | 'amber' } {
  switch (state) {
    case 'whole': return { words: 'Both photos', tone: 'green' }
    case 'no-before': return { words: 'No photo as found', tone: 'amber' }
    case 'no-after': return { words: 'No photo after', tone: 'amber' }
    case 'no-photos': return { words: 'No photos', tone: 'amber' }
    case 'nothing-marked': return { words: 'Nothing marked', tone: 'amber' }
  }
}

/** "G12 · Mateo took 7", or "G12 · Mateo started a take" when nothing was marked. */
export function takeTitle(take: Take, containerLabel: string): string {
  const who = take.byName.trim() || 'Someone'
  return take.count > 0 ? `${containerLabel} · ${who} took ${take.count}` : `${containerLabel} · ${who} started a take`
}

/** "2 × Elbow · 4 × Coupling", with what was found: "· 1 recorded as found". */
export function takeLinesWords(take: Take): string {
  const lines = take.lines.map((l) => `${l.quantity} × ${l.partName}`)
  if (take.found > 0) lines.push(`${take.found} recorded as found`)
  return lines.join(' · ')
}

export type TakeFilter = 'all' | 'photo-missing' | 'nothing-marked'

export function takePasses(take: Take, filter: TakeFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'nothing-marked') return take.state === 'nothing-marked'
  return take.state === 'no-before' || take.state === 'no-after' || take.state === 'no-photos'
}

/** The filter chips with their counts: "All takes · 14", "A photo missing · 2", "Nothing marked · 1". */
export function takeFilterChips(takes: ReadonlyArray<Take>): Array<{ key: TakeFilter; words: string; n: number }> {
  const n = (f: TakeFilter) => takes.filter((t) => takePasses(t, f)).length
  return [
    { key: 'all', words: 'All takes', n: n('all') },
    { key: 'photo-missing', words: 'A photo missing', n: n('photo-missing') },
    { key: 'nothing-marked', words: 'Nothing marked', n: n('nothing-marked') },
  ]
}

/**
 * The takes behind a count: those of one box that ended at or before `at` and after `since` (the count before it),
 * newest first. A count that came up short opens on these, since they are what left the box in between.
 */
export function takesBefore(takes: ReadonlyArray<Take>, containerId: string, at: string, since: string | null = null): Take[] {
  return takes.filter((t) => t.containerId === containerId && t.at <= at && (since == null || t.at > since))
}

/** The press on a short count: "3 takes before this count", "1 take before this count". */
export function takesBeforeLabel(n: number): string {
  return `${n} ${n === 1 ? 'take' : 'takes'} before this count`
}
