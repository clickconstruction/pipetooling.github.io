/**
 * Task cards: the Done when… lines (punch list #273, PR 1, v2.6592). The pure rules over `task_criteria` (a line on a
 * card's definition or on a roadmap task) and `task_criteria_checks` (a line's tick on one day row): which lines a
 * card carries, each line's state, the next open one, the words a tick writes on the thread, and how the dialogs read
 * the lines a person types. Nothing here reads the database.
 */

export type TaskCriterion = {
  id: string
  checklist_item_id: string | null
  roadmap_task_id: string | null
  body: string
  sort_index: number
  retired_at?: string | null
}

export type TaskCriterionCheck = {
  criterion_id: string
  instance_id: string
  checked_at: string
  checked_by: string | null
  photo_id?: string | null
}

export type LineState = {
  criterion: TaskCriterion
  checked: boolean
  checkedAt: string | null
  checkedBy: string | null
  photoId: string | null
}

/** The most lines a card takes, and the longest line. */
export const LINE_MAX = 12
export const LINE_CHARS = 200

/** The live lines a card carries, in order: its own, and its roadmap task's when the sync made it. */
export function criteriaForCard(card: { itemId: string; roadmapTaskId?: string | null }, rows: TaskCriterion[]): TaskCriterion[] {
  const seen = new Set<string>()
  const out: TaskCriterion[] = []
  for (const r of rows) {
    if (r.retired_at) continue
    const mine = r.checklist_item_id === card.itemId || (Boolean(card.roadmapTaskId) && r.roadmap_task_id === card.roadmapTaskId)
    if (!mine || seen.has(r.id)) continue
    seen.add(r.id)
    out.push(r)
  }
  return out.sort((a, b) => a.sort_index - b.sort_index || a.id.localeCompare(b.id))
}

/** Each line with its tick on this day row. */
export function lineStates(criteria: TaskCriterion[], checks: TaskCriterionCheck[], instanceId: string): LineState[] {
  const byCriterion = new Map<string, TaskCriterionCheck>()
  for (const c of checks) if (c.instance_id === instanceId) byCriterion.set(c.criterion_id, c)
  return criteria.map((criterion) => {
    const c = byCriterion.get(criterion.id)
    return {
      criterion,
      checked: Boolean(c),
      checkedAt: c?.checked_at ?? null,
      checkedBy: c?.checked_by ?? null,
      photoId: c?.photo_id ?? null,
    }
  })
}

export function tickedCount(states: LineState[]): number {
  let n = 0
  for (const s of states) if (s.checked) n++
  return n
}

/** The first open line, the one the card marks *next*. */
export function nextOpenLine(states: LineState[]): LineState | null {
  for (const s of states) if (!s.checked) return s
  return null
}

/** Ticking this line would tick the last one: the finish follows. */
export function isLastOpenLine(states: LineState[], criterionId: string): boolean {
  const open = states.filter((s) => !s.checked)
  return open.length === 1 && open[0]?.criterion.id === criterionId
}

export function allTicked(states: LineState[]): boolean {
  return states.length > 0 && states.every((s) => s.checked)
}

/** The thread's line for a tick or an untick: *✓ Pipe is racked by size* / *○ Pipe is racked by size*. */
export function criterionEventBody(lineBody: string, ticked: boolean): string {
  return `${ticked ? '✓' : '○'} ${lineBody.trim()}`
}

/** Reads a criterion event's body back: the mark and the words. */
export function parseCriterionEvent(body: string): { ticked: boolean; words: string } | null {
  const m = /^([✓○])\s+(.+)$/.exec(body.trim())
  if (!m) return null
  return { ticked: m[1] === '✓', words: m[2] ?? '' }
}

/**
 * The lines a person typed in the dialog, one a row: trimmed, empties dropped, a line typed twice kept once, at most
 * LINE_MAX lines of LINE_CHARS each. A leading bullet or dash is stripped, since people paste lists.
 */
export function parseLines(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/\s+/g, ' ').trim().slice(0, LINE_CHARS)
    if (!line) continue
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(line)
    if (out.length >= LINE_MAX) break
  }
  return out
}

/** The rows to write for a card's lines, in the order typed. */
export function criteriaRows(parent: { checklistItemId: string } | { roadmapTaskId: string }, lines: string[], createdBy: string) {
  return lines.map((body, sort_index) => ({
    checklist_item_id: 'checklistItemId' in parent ? parent.checklistItemId : null,
    roadmap_task_id: 'roadmapTaskId' in parent ? parent.roadmapTaskId : null,
    body,
    sort_index,
    created_by: createdBy,
  }))
}

/**
 * What an edit changes: lines kept by their words, new lines added at the end, lines gone retired (a ticked line keeps
 * its words for the ticks that name it). Order follows the new list.
 */
export function diffLines(existing: TaskCriterion[], next: string[]): { keep: Array<{ id: string; sort_index: number }>; add: Array<{ body: string; sort_index: number }>; retire: string[] } {
  const live = existing.filter((c) => !c.retired_at)
  const byWords = new Map<string, TaskCriterion>()
  for (const c of live) byWords.set(c.body.trim().toLowerCase(), c)
  const keep: Array<{ id: string; sort_index: number }> = []
  const add: Array<{ body: string; sort_index: number }> = []
  const used = new Set<string>()
  next.forEach((body, i) => {
    const found = byWords.get(body.trim().toLowerCase())
    if (found && !used.has(found.id)) {
      used.add(found.id)
      keep.push({ id: found.id, sort_index: i })
    } else {
      add.push({ body, sort_index: i })
    }
  })
  const retire = live.filter((c) => !used.has(c.id)).map((c) => c.id)
  return { keep, add, retire }
}
