/**
 * Quickfill's checklist boxes (Office Arriving, Office Leaving, Assistant Dailys): the list a
 * dev edits, kept as JSON `[{ id, label }]` in `app_settings`. A box's ticks are rows keyed on
 * its id, so a box keeps its past only while it keeps its id (v2.5829): rewording a box changes
 * its words in place, and removing a box drops it from the list without touching its rows.
 * Pure: the sections save what this returns.
 */

export type ChecklistItem = { id: string; label: string }

/**
 * The list with one box's words changed and its id and place kept. Null when there is nothing
 * to save: the new words are empty or the same, or the box is no longer on the list.
 */
export function renameChecklistItem(items: ReadonlyArray<ChecklistItem>, id: string, label: string): ChecklistItem[] | null {
  const next = label.trim()
  if (!next) return null
  const current = items.find((i) => i.id === id)
  if (!current || current.label === next) return null
  return items.map((i) => (i.id === id ? { ...i, label: next } : i))
}

/** Whether a draft would save as a rename: some words, and not the box's own. */
export function checklistRenameReady(currentLabel: string, draft: string): boolean {
  const next = draft.trim()
  return next !== '' && next !== currentLabel
}
