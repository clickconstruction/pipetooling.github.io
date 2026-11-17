/**
 * The Customer experience override editor's data and rules (punch list #46 row 3, the Estimates
 * map's Stage-A row 7, moved with the section in cut 5).
 *
 * A draft can replace the organization's customer copy field by field. Only a real change is kept as
 * an override: a field cleared, or typed back to the default, drops out. One field is different —
 * the acceptance page's footer — where an empty string is itself an override: *hide the company
 * footer on this quote*.
 */
import { ESTIMATE_EXPERIENCE_FIELD_MAX_LEN, type EstimateExperienceOverrideKey } from '../estimateCustomerExperience'

export type CxOverrideFields = Partial<Record<EstimateExperienceOverrideKey, string>>

export const CX_FIELD_LABELS: Record<EstimateExperienceOverrideKey, string> = {
  email_subject_template: 'Email subject template',
  email_body_template: 'Email body template',
  accept_section_title: 'Accept section title',
  accept_instructions: 'Accept instructions',
  accept_name_field_label: 'Name field label',
  accept_checkbox_label: 'Agreement checkbox label',
  accept_submit_label: 'Submit button label',
  accept_submitting_label: 'Submitting button label',
  thank_you_title: 'Thank you heading',
  thank_you_body: 'Thank you body',
  doc_title_fallback: 'Document title fallback (empty estimate title)',
  doc_valid_through_prefix: '“Expires on” line prefix (before date)',
  doc_line_items_heading: 'Line items heading',
  doc_terms_heading: 'Terms heading',
  doc_total_label: 'Total label (before amount)',
  accept_page_footer: 'Acceptance page footer (below sign-off)',
}

export type CxOverrideSectionConfig = {
  title: string
  description?: string
  keys: EstimateExperienceOverrideKey[]
}

export const CX_OVERRIDE_SECTIONS: [CxOverrideSectionConfig, CxOverrideSectionConfig, CxOverrideSectionConfig] = [
  {
    title: 'Email',
    description:
      'The body template may include {{title}} and {{estimate_number}}. Its first paragraph opens the email; the rest sign it off below the button (a paragraph holding {{accept_url}} is replaced by the button). The subject is built for you: "Estimate #N — title — total · company". Leave blank to use organization defaults (dev: Settings → Estimate customer experience defaults).',
    keys: ['email_body_template'],
  },
  {
    title: 'Acceptance page',
    description:
      'Quote document labels (title; line items, total, terms; accept form below)—same order customers see on the public page. The expiry date line (“Expires on” + date) appears only when Expires on is set on this estimate; the prefix field below appears only when Expires on is filled in above. The document title fallback applies only when the estimate title is empty; the fallback field below appears only when the estimate title above is empty.',
    keys: [
      'doc_title_fallback',
      'doc_valid_through_prefix',
      'doc_line_items_heading',
      'doc_total_label',
      'doc_terms_heading',
      'accept_section_title',
      'accept_instructions',
      'accept_name_field_label',
      'accept_checkbox_label',
      'accept_submit_label',
      'accept_submitting_label',
      'accept_page_footer',
    ],
  },
  {
    title: 'Thank you',
    description: 'Shown after submit or if the customer opens an already-used link.',
    keys: ['thank_you_title', 'thank_you_body'],
  },
]

export function cxOverrideFieldRows(k: EstimateExperienceOverrideKey): number {
  if (k === 'email_body_template' || k === 'thank_you_body' || k === 'accept_page_footer') return 7
  return 2
}

/** The footer is hidden for this quote: the override is there, and it is empty. */
export function cxFooterHidden(fields: CxOverrideFields): boolean {
  return 'accept_page_footer' in fields && fields.accept_page_footer === ''
}

/** Tick or untick *Hide company footer on this quote*: an empty override, or none. */
export function cxWithFooterHidden(prev: CxOverrideFields, hidden: boolean): CxOverrideFields {
  if (hidden) return { ...prev, accept_page_footer: '' }
  if (!('accept_page_footer' in prev)) return prev
  const { accept_page_footer: _removed, ...rest } = prev
  return rest
}

/**
 * One field after a keystroke. Text past the cap is cut; a field cleared or typed back to the
 * organization's default is no override at all and drops out; anything else is kept.
 */
export function cxOverridesAfterEdit(prev: CxOverrideFields, key: EstimateExperienceOverrideKey, typed: string, organizationDefault: string): CxOverrideFields {
  const next = typed.slice(0, ESTIMATE_EXPERIENCE_FIELD_MAX_LEN)
  if (next.trim() === '' || next === organizationDefault) {
    if (!(key in prev)) return prev
    const { [key]: _removed, ...rest } = prev
    return rest
  }
  return { ...prev, [key]: next }
}
