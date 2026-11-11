/**
 * The homestead question on a property record (punch list #305, item 3). Pure.
 *
 * `customer_addresses.homestead` is `boolean NOT NULL DEFAULT false`, so a property nobody asked about read the same
 * as one answered no, and the Lien desk passed it as *Not a homestead*. A lien on a homestead needs a pre-work
 * contract signed by both spouses and recorded (Tex. Prop. Code § 53.254, the app's reading), so *nobody asked* must
 * not read as *no*. `homestead_answered_at` (migration 20261111160000) is NULL until a person answers yes or no on
 * the record. The desk and the Lien window hold a residential property's affidavit while it is NULL.
 *
 * The column is read softly: a row that does not carry it (read before the migration is pushed, or through a narrow
 * select) gives no answer either way, and nothing is held for it.
 */

export type HomesteadAnswer = 'yes' | 'no' | 'unanswered'

/** Whether a person answered, off a row as read: null when the row does not carry the column. */
export function homesteadAnsweredOnRow(row: unknown): boolean | null {
  if (!row || typeof row !== 'object' || !('homestead_answered_at' in row)) return null
  const v = (row as { homestead_answered_at?: unknown }).homestead_answered_at
  return typeof v === 'string' && v.trim() !== ''
}

/** What the record says. With no word on whether anyone answered, the flag alone, as before. */
export function homesteadAnswer(homestead: boolean, answered: boolean | null | undefined): HomesteadAnswer {
  if (homestead) return 'yes'
  return answered === false ? 'unanswered' : 'no'
}

/**
 * The hold: a residential property not marked homestead whose question nobody answered. A commercial property is
 * never asked, a property of unknown kind is asked its kind first, and a row that does not carry the column holds nothing.
 */
export function homesteadQuestionOpen(f: { propertyKind: string | null | undefined; homestead: boolean | null | undefined; answered: boolean | null | undefined }): boolean {
  return (f.propertyKind ?? '').trim() === 'residential' && f.homestead !== true && f.answered === false
}

/** The gate's line while the question is open, on the Affidavits pane and the Lien window's tab. */
export const HOMESTEAD_QUESTION_GATE_LABEL = "Nobody has answered whether this home is the owner's homestead. Answer yes or no on the property record"

/** The press on that line. */
export const HOMESTEAD_QUESTION_DOOR = 'Answer it ›'

/** The question as the property record asks it, and the line under it while nobody has answered. */
export const HOMESTEAD_QUESTION = "Is this the owner's homestead?"
export const HOMESTEAD_UNANSWERED_NOTE = 'Not answered yet. A lien affidavit on this home waits for a yes or a no.'
