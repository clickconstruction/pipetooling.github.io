/**
 * Materials on site: Edit a box (the owner's ask, 2026-11-13). Until this a box's name, its kind and its where
 * line were typed once in Add a container and never again: a name that said too much (`G70 NO CONTAINER`), a
 * pile saved as a cage because Cage was the sheet's first choice, or a where line nobody filled in meant retire
 * the box and make another, which changes its code and so its printed label.
 *
 * The label's code is cut from the box's own id, never from its name, so a rename leaves every printed label
 * opening the same box. Only the large words on the tape are old until it is printed again, and the words here
 * say so. The database keeps the old name, the new one, who and when by itself (`job_container_names`, the
 * trigger of `20261113020000_box_stickers.sql`).
 *
 * Pure rules and words only. The write is `editContainer` in `onSiteStore.ts`.
 */
import type { Container, ContainerKind } from './onSite'

/** `job_containers.label`'s own limit. */
export const BOX_NAME_MAX = 24
/** `job_containers.where_note`'s own limit. */
export const BOX_WHERE_MAX = 120

/** The kinds a person may pick. Unsorted is the app's own row and is never offered. */
export const BOX_KIND_CHOICES = ['cage', 'box', 'loose'] as const
export type BoxKindChoice = (typeof BOX_KIND_CHOICES)[number]

/** A kind as a choice reads: *Cage*, *Box*, *Loose pile*. */
export function boxKindWords(kind: ContainerKind): string {
  return kind === 'cage' ? 'Cage' : kind === 'box' ? 'Box' : kind === 'loose' ? 'Loose pile' : 'Unsorted'
}

/** A kind inside a sentence: *a cage*, *a box*, *a loose pile*. */
function aKind(kind: ContainerKind): string {
  return `a ${boxKindWords(kind).toLowerCase()}`
}

/** What the sheet holds while someone types. */
export type BoxDraft = { label: string; kind: ContainerKind; where: string }

export function boxDraftOf(c: Pick<Container, 'label' | 'kind' | 'where'>): BoxDraft {
  return { label: c.label, kind: c.kind, where: c.where }
}

/** A name as it is saved: trimmed, one space between words, capitals, as Add a container saves it. */
export function cleanBoxName(typed: string): string {
  return typed.trim().replace(/\s+/g, ' ').toUpperCase()
}

/** A where line as it is saved. */
export function cleanBoxWhere(typed: string): string {
  return typed.trim().replace(/\s+/g, ' ')
}

/** The database's own rule for one live name a job: `lower(trim(label))`. */
const nameKey = (label: string) => label.trim().toLowerCase()

/** Only what changed, so a press sends nothing it did not mean to. */
export type BoxPatch = { label?: string; kind?: BoxKindChoice; where?: string }

export type EditBoxVerdict =
  | { ok: true; patch: BoxPatch; renamed: boolean }
  | { ok: false; reason: 'gone' | 'unsorted' | 'retired' | 'no-name' | 'long-name' | 'taken' | 'long-where' | 'same'; words: string }

/**
 * Whether the draft can be saved, and the words when it cannot. `same` carries no words: nothing was changed
 * yet, so the press is dead and there is nothing to say.
 */
export function editBoxVerdict(containers: ReadonlyArray<Container>, id: string, draft: BoxDraft): EditBoxVerdict {
  const box = containers.find((c) => c.id === id)
  if (!box) return { ok: false, reason: 'gone', words: 'That box is not on this job.' }
  if (box.kind === 'unsorted') return { ok: false, reason: 'unsorted', words: 'Unsorted is the app’s own row. It cannot be changed.' }
  if (box.retiredAt) return { ok: false, reason: 'retired', words: `${box.label} is retired. Bring it back first.` }
  const label = cleanBoxName(draft.label)
  const where = cleanBoxWhere(draft.where)
  if (!label) return { ok: false, reason: 'no-name', words: 'Give it a name.' }
  if (label.length > BOX_NAME_MAX) return { ok: false, reason: 'long-name', words: `A name holds ${BOX_NAME_MAX} characters. This one is ${label.length}.` }
  const clash = containers.find((c) => c.id !== id && c.jobId === box.jobId && !c.retiredAt && nameKey(c.label) === nameKey(label))
  if (clash) return { ok: false, reason: 'taken', words: `${label} is already on this job. Pick another name.` }
  if (where.length > BOX_WHERE_MAX) return { ok: false, reason: 'long-where', words: `The where line holds ${BOX_WHERE_MAX} characters. This one is ${where.length}.` }
  const patch: BoxPatch = {}
  if (label !== box.label) patch.label = label
  if (draft.kind !== box.kind && (BOX_KIND_CHOICES as readonly string[]).includes(draft.kind)) patch.kind = draft.kind as BoxKindChoice
  if (where !== box.where) patch.where = where
  if (Object.keys(patch).length === 0) return { ok: false, reason: 'same', words: '' }
  return { ok: true, patch, renamed: patch.label !== undefined }
}

/** The sheet's title: *Edit G70*. */
export function editBoxTitle(c: Pick<Container, 'label'>): string {
  return `Edit ${c.label}`
}

/** The one line under the title, so a rename is not used to start a box over. */
export const EDIT_BOX_HINT = 'Same things inside? Rename it. Different things? Retire it and add a new one.'

/** The press: *Rename to G70* when the name changes, *Save G70* otherwise. */
export function editBoxPressLabel(box: Pick<Container, 'label'>, draft: BoxDraft): string {
  const label = cleanBoxName(draft.label)
  if (!label) return 'Save'
  return label !== box.label ? `Rename to ${label}` : `Save ${label}`
}

/** Under the name while it differs: what happens to a label that is already stuck on. */
export function renameLabelNote(box: Pick<Container, 'label'>): string {
  return `A label printed as ${box.label} still opens this box. Print it again to show the new name.`
}

/** The toast after a save. A rename is the news when there is one. */
export function editedBoxWords(before: Pick<Container, 'label' | 'kind'>, patch: BoxPatch): string {
  if (patch.label !== undefined) return `${before.label} is now ${patch.label}. Its printed label still opens it.`
  if (patch.kind !== undefined) return `${before.label} is ${aKind(patch.kind)} now.`
  return `${before.label} saved.`
}
