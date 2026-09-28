/**
 * The Workflow page's Superintendents strip: who can still be added to the
 * project, and what a superintendent is called on a chip and in the list.
 */

export type SuperintendentOption = { id: string; name: string | null; email: string | null }

/** On an assigned chip: the name, else the email, else "Unknown". */
export function superintendentChipLabel(s: SuperintendentOption): string {
  return s.name || s.email || 'Unknown'
}

/** In the add list: the name, else the email, else the id — never blank, so the row can be picked. */
export function superintendentOptionLabel(s: SuperintendentOption): string {
  return s.name || s.email || s.id
}

/** Every superintendent not already on the project, in the order given. */
export function unassignedSuperintendents(
  all: ReadonlyArray<SuperintendentOption>,
  assigned: ReadonlyArray<SuperintendentOption>,
): SuperintendentOption[] {
  return all.filter((s) => !assigned.some((ps) => ps.id === s.id))
}
