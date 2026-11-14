/**
 * Materials on site: fix a part's typed name (v2.7212, the owner's ask of 2026-11-13). A name typed on site is
 * the only name its line has, and the ledger takes inserts alone, so a typo could not be fixed without counting
 * the line to zero and adding it again. A rename is now one row of `job_part_renames`; the database sets the
 * name on the job's typed ledger rows and keeps which rows it changed, so the rename can be undone
 * (`20261113230000_on_site_part_renames.sql`).
 *
 * A rename is job wide: a part moved between two boxes is one ledger row both boxes read. The words here say
 * which boxes change before the press, and when two lines would become one.
 *
 * Pure rules and words only. The write is `partRenameIo.ts`.
 */
import { compareLabels, partKey, type ContainerLine } from './onSite'

/** `job_material_movements.part_name`'s own limit. */
export const PART_NAME_MAX = 160

/** A name as it is saved: trimmed, one space between words. Its capitals stay as typed. */
export function cleanPartName(typed: string): string {
  return typed.trim().replace(/\s+/g, ' ')
}

export type PartRenameVerdict =
  | { ok: true; from: string; to: string; /** Every box on the job that holds the old name, in stencil order. */ boxes: string[]; /** The boxes where the new name is already a line, so two lines become one. */ merges: string[] }
  | { ok: false; reason: 'book' | 'empty' | 'long' | 'same'; words: string }

/** `G74`, `G74 and G12`, `G74, G12 and G40`. */
export function listWords(names: ReadonlyArray<string>): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * Whether a line's name can change to what was typed. `empty` and `same` carry no words: nothing to save yet.
 * `lines` is every line of the job, and `nameOf` a box's stencil by its id.
 */
export function partRenameVerdict(line: Pick<ContainerLine, 'partId' | 'partName' | 'partKey'>, typed: string, lines: ReadonlyArray<ContainerLine>, nameOf: (containerId: string) => string): PartRenameVerdict {
  if (line.partId) return { ok: false, reason: 'book', words: 'This part is from the parts book. Its name is the book’s.' }
  const to = cleanPartName(typed)
  if (!to) return { ok: false, reason: 'empty', words: '' }
  if (to.length > PART_NAME_MAX) return { ok: false, reason: 'long', words: `A part name holds ${PART_NAME_MAX} characters. This one is ${to.length}.` }
  if (to === line.partName) return { ok: false, reason: 'same', words: '' }
  const toKey = partKey(null, to)
  const labels = (ids: Iterable<string>) => [...new Set([...ids].map(nameOf))].sort(compareLabels)
  const boxes = labels(lines.filter((l) => l.partKey === line.partKey).map((l) => l.containerId))
  const holders = new Set(lines.filter((l) => l.partKey === line.partKey).map((l) => l.containerId))
  const merges = toKey === line.partKey ? [] : labels(lines.filter((l) => l.partKey === toKey && holders.has(l.containerId)).map((l) => l.containerId))
  return { ok: true, from: line.partName, to, boxes, merges }
}

/** The press: *Rename to 3/4 pex*. */
export function partRenamePressLabel(typed: string): string {
  const to = cleanPartName(typed)
  return to ? `Rename to ${to}` : 'Rename'
}

/** Under the field when more than one box holds the name: the rename is the job's, not this box's. */
export function partRenameScopeNote(v: Extract<PartRenameVerdict, { ok: true }>): string | null {
  return v.boxes.length > 1 ? `It changes in every box on this job that holds it: ${listWords(v.boxes)}.` : null
}

/** Under the field when the new name is already a line in a box that holds the old one. */
export function partRenameMergeNote(v: Extract<PartRenameVerdict, { ok: true }>): string | null {
  if (v.merges.length === 0) return null
  return v.merges.length === 1 ? `${v.merges[0]} already has a line named ${v.to}. The two become one line.` : `${listWords(v.merges)} already have a line named ${v.to}. The two become one line in each.`
}

/** The line after a rename, beside its Undo. */
export function renamedPartWords(from: string, to: string): string {
  return `${from} is now ${to}.`
}

/** The toast after an undo. */
export function undonePartWords(from: string): string {
  return `${from} has its name back.`
}

export const FIX_PART_NAME_LABEL = 'Fix the name'
export const UNDO_PART_RENAME_LABEL = 'Undo the rename'
