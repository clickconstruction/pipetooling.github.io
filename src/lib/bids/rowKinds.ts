/**
 * A count row's kind and tags (punch list #128, the spike).
 *
 * The kind is the app's: fixture · pipe · fitting · equipment · allowance. Until someone sets
 * it, it is the composition bar's guess from the row's words (`compositionKind`), and the
 * screens draw the guess dashed. An Equipment row is the price card's Equipment line and
 * carries no material. The tags are the estimator's own words, never read by the app and never
 * on paper; the By tag view adds them up.
 *
 * The marks live on the row (`bids_count_rows.kind`, `tags`, `split_*`, migration 20261020020000,
 * per bid version like the row; a copied version carries them) and are read and written by
 * `rowMarksIo.ts`. Pure.
 */
import { compositionKind } from './pricingComposition'

export type RowKind = 'fixture' | 'pipe' | 'fitting' | 'equipment' | 'allowance'

export const ROW_KINDS: RowKind[] = ['fixture', 'pipe', 'fitting', 'equipment', 'allowance']

export const ROW_KIND_WORDS: Record<RowKind, string> = {
  fixture: 'Fixture',
  pipe: 'Pipe',
  fitting: 'Fitting',
  equipment: 'Equipment',
  allowance: 'Allowance',
}

const EQUIPMENT = /\b(rental|rentals|equipment|lift|shoring|excavator|trencher|machine|generator|compressor|scaffold)\b/i
const ALLOWANCE = /\b(allowance|permit|bond|contingency|mobilization|per diem|travel|lodging|supervision|cleanup|freight)\b/i

/** The app's guess from the row's words: the composition bar's rule, with equipment and allowance split out of `other`. */
export function guessRowKind(rawName: string): RowKind {
  const name = (rawName ?? '').trim()
  if (EQUIPMENT.test(name)) return 'equipment'
  if (ALLOWANCE.test(name)) return 'allowance'
  const k = compositionKind(name)
  return k === 'other' ? 'allowance' : k
}

/** The row's kind: the saved pick, else the guess. */
export function rowKindOf(rawName: string, saved: RowKind | null | undefined): { kind: RowKind; guessed: boolean } {
  if (saved && (ROW_KINDS as string[]).includes(saved)) return { kind: saved, guessed: false }
  return { kind: guessRowKind(rawName), guessed: true }
}

/** A tag is lowercase words, 40 letters at most; empty when nothing is left. */
export function cleanTag(raw: string): string {
  return (raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40)
}

/** The row's typed split: material as sold (dollars for the whole row), its own markup (0.6 = +60%), and whether it is taxed; null = the rule's. */
export type RowSplitMarks = { material?: number | null; markup?: number | null; taxable?: boolean | null }

export type RowMarks = { kind?: RowKind | null; tags?: string[]; split?: RowSplitMarks | null }
export type RowMarksByRowId = Record<string, RowMarks>
