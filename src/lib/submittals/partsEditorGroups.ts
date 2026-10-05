/**
 * The row editor's words and order (Submittals → Edit on a row): the parts in three groups by
 * who sees them, the mark a part carries when the reviewer answered it, the status choices, the
 * window's title, and whether a row typed by hand has anything on it yet. Pure: the window
 * (`SubmittalItemEditDialog`, `SubmittalPartsEditor`) draws what these return.
 */
import { partPickOf, type PartDraft, type PartPick, type SubmittalPartRow } from './itemParts'
import type { ProductStatus } from './productStatus'
import { DECISION_LABELS } from './reviewDecisions'
import { asDecision, formatShortDate } from './submittalRevision'

export type PartGroup = {
  key: PartPick
  /** "The GC sees these · 3" */
  title: string
  hint: string
  /** The parts' places in the drafts, in the order they are kept. */
  indexes: number[]
}

const GROUP_WORDS: Record<PartPick, { name: string; hint: string }> = {
  gc: { name: 'The GC sees these', hint: 'in this order on the submittal' },
  order: { name: 'Order only', hint: 'bought for this fixture, never shown to the GC' },
  out: { name: 'Left out', hint: 'not submitted, not ordered · Save takes them off' },
}

/**
 * The drafts as the editor lists them: the GC's parts, then order only, then left out. A group
 * with nothing in it is not drawn. On a fixture that is order only as a whole, every part kept is
 * order only whatever its own pick.
 */
export function groupPartDrafts(drafts: ReadonlyArray<Pick<PartDraft, 'on_submittal' | 'left_out'>>, fixtureOrderOnly = false): PartGroup[] {
  const by: Record<PartPick, number[]> = { gc: [], order: [], out: [] }
  drafts.forEach((d, i) => {
    const pick = partPickOf(d)
    by[fixtureOrderOnly && pick === 'gc' ? 'order' : pick].push(i)
  })
  return (['gc', 'order', 'out'] as const)
    .filter((k) => by[k].length > 0)
    .map((k) => ({
      key: k,
      title: `${GROUP_WORDS[k].name} · ${by[k].length}`,
      hint: k === 'order' && fixtureOrderOnly ? 'every part is order only, with its fixture' : GROUP_WORDS[k].hint,
      indexes: by[k],
    }))
}

/** The part above or below this one in its own group — the one an arrow trades places with — or null at the group's edge. */
export function neighborInGroup(group: Pick<PartGroup, 'indexes'>, index: number, by: -1 | 1): number | null {
  const at = group.indexes.indexOf(index)
  if (at < 0) return null
  return group.indexes[at + by] ?? null
}

export type PartCallMark = { tone: 'approved' | 'revise' | 'rejected'; /** "Rejected Oct 2" */ words: string; note: string }

/** What the reviewer answered on one part, for the line under its name; null while it has no answer. */
export function partCallMark(p: Pick<SubmittalPartRow, 'review_decision' | 'review_note' | 'reviewed_at'>): PartCallMark | null {
  const d = asDecision(p.review_decision)
  if (!d) return null
  const day = formatShortDate(p.reviewed_at)
  return { tone: d, words: day ? `${DECISION_LABELS[d]} ${day}` : DECISION_LABELS[d], note: (p.review_note ?? '').trim() }
}

const STATUS_ORDER: ProductStatus[] = ['as_specified', 'superseded', 'equal', 'alternate', 'design_change', 'missing', 'accessory']

/**
 * The statuses the window offers. Proposed means "what we intend to install, the plans gave no
 * schedule", so it leads the list on a row with nothing specified, and stays offered on a row
 * that already is Proposed — the status a row has is always one she can see lit and go back to.
 */
export function editStatusChoices(current: ProductStatus, hasSpecified: boolean): ProductStatus[] {
  return current === 'proposed' || !hasSpecified ? ['proposed', ...STATUS_ORDER] : STATUS_ORDER
}

/** "Add a row" for a row typed by hand that is not saved yet; else "Edit LAV-1" / "Edit accessory". */
export function editWindowTitle(tag: string, isNew: boolean): string {
  if (isNew) return 'Add a row'
  return `Edit ${tag.trim() || 'accessory'}`
}

/** A row typed by hand with no tag and no product has nothing to save. */
export function newRowIsBlank(tagText: string, submittedText: string, partDrafts: ReadonlyArray<Pick<PartDraft, 'label' | 'left_out'>> | null): boolean {
  if (tagText.trim()) return false
  if (partDrafts) return !partDrafts.some((d) => !d.left_out && d.label.trim())
  return !submittedText.trim()
}
