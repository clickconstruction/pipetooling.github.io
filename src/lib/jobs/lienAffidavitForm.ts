/**
 * Which form a job's lien affidavit is drawn on (punch list #305). Pure.
 *
 * The desk never stored an affidavit's words: every draw fills the paper from the job, so a change to the
 * paper's wording would reach an affidavit a person had already approved, days before it is filed. The rule
 * that stops it: a paper keeps the form it was drafted on. A draft made since the short form shipped carries
 * `affidavitForm: 'short'` in its `job_lien_desk_items.fields`; a draft without the mark was made on the earlier
 * ten-paragraph form and keeps it through approval, the notary and the clerk. A job with no draft yet is drawn on
 * the short form. The office moves an earlier paper to the short form on purpose, with the pane's own press,
 * and it then needs approval again.
 *
 * A filing keeps its own form inside the fields it stored (`LienAffidavitFields.form`), so this is never asked
 * of a recorded paper.
 */
export type LienAffidavitForm = 'short' | 'long'

/** The desk item, as much of it as the rule reads. */
export type LienAffidavitFormItem = { kind?: string | null; status?: string | null; fields?: unknown; voided_at?: string | null; created_at?: string | null }

/** The mark a draft on the short form carries in its fields. */
export const LIEN_AFFIDAVIT_SHORT_FORM_MARK = { affidavitForm: 'short' } as const

function carriesShortMark(fields: unknown): boolean {
  return Boolean(fields && typeof fields === 'object' && (fields as { affidavitForm?: unknown }).affidavitForm === 'short')
}

/** The form of the job's affidavit, given its desk item (null when the job has none). */
export function lienAffidavitFormForItem(item: LienAffidavitFormItem | null | undefined): LienAffidavitForm {
  if (!item || item.voided_at) return 'short'
  return carriesShortMark(item.fields) ? 'short' : 'long'
}

/**
 * The same, from every desk item on the job (the Lien window's read): the newest live affidavit item decides.
 * A voided item and a missed window's note are not a draft of anything.
 */
export function lienAffidavitFormForItems(items: ReadonlyArray<LienAffidavitFormItem> | null | undefined): LienAffidavitForm {
  const live = (items ?? []).filter((i) => (i.kind ?? 'affidavit') === 'affidavit' && !i.voided_at && i.status !== 'missed')
  if (live.length === 0) return 'short'
  const newest = live.reduce((a, b) => ((b.created_at ?? '') > (a.created_at ?? '') ? b : a))
  return lienAffidavitFormForItem(newest)
}

/** What the desk and the Lien window say under a paper still on the earlier form. */
export const LIEN_AFFIDAVIT_LONG_FORM_WORDS = 'This affidavit is on the earlier form, as it was drafted. It stays on that form until someone redraws it.'
