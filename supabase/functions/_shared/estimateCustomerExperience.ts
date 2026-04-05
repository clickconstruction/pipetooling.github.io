/** Merge dev defaults (app_settings), per-estimate overrides, and template vars into customer-facing copy. Keep in sync with `src/lib/estimateCustomerExperience.ts`. */

export const ESTIMATE_EXPERIENCE_FIELD_MAX_LEN = 8000

export type EstimateCustomerExperienceResolved = {
  emailSubject: string
  emailBody: string
  acceptSectionTitle: string
  acceptInstructions: string
  acceptNameFieldLabel: string
  acceptCheckboxLabel: string
  acceptSubmitLabel: string
  acceptSubmittingLabel: string
  thankYouTitle: string
  thankYouBody: string
  docTitleFallback: string
  docValidThroughPrefix: string
  docLineItemsHeading: string
  docTermsHeading: string
  docTotalLabel: string
  /** Multi-line footer below accept form; empty string = omit footer on acceptance page. */
  acceptPageFooter: string
}

/** Public accept page JSON: omits email (link was emailed separately). */
export type EstimateCustomerExperienceClient = Omit<
  EstimateCustomerExperienceResolved,
  'emailSubject' | 'emailBody'
>

/** Keys inside customer_experience_overrides jsonb (snake_case). */
export type EstimateExperienceOverrideKey =
  | 'email_subject_template'
  | 'email_body_template'
  | 'accept_section_title'
  | 'accept_instructions'
  | 'accept_name_field_label'
  | 'accept_checkbox_label'
  | 'accept_submit_label'
  | 'accept_submitting_label'
  | 'thank_you_title'
  | 'thank_you_body'
  | 'doc_title_fallback'
  | 'doc_valid_through_prefix'
  | 'doc_line_items_heading'
  | 'doc_terms_heading'
  | 'doc_total_label'
  | 'accept_page_footer'

export const ESTIMATE_APP_SETTING_KEYS: Record<EstimateExperienceOverrideKey, string> = {
  email_subject_template: 'estimate_email_subject_template',
  email_body_template: 'estimate_email_body_template',
  accept_section_title: 'estimate_accept_section_title',
  accept_instructions: 'estimate_accept_instructions',
  accept_name_field_label: 'estimate_accept_name_field_label',
  accept_checkbox_label: 'estimate_accept_checkbox_label',
  accept_submit_label: 'estimate_accept_submit_label',
  accept_submitting_label: 'estimate_accept_submitting_label',
  thank_you_title: 'estimate_thank_you_title',
  thank_you_body: 'estimate_thank_you_body',
  doc_title_fallback: 'estimate_doc_title_fallback',
  doc_valid_through_prefix: 'estimate_doc_valid_through_prefix',
  doc_line_items_heading: 'estimate_doc_line_items_heading',
  doc_terms_heading: 'estimate_doc_terms_heading',
  doc_total_label: 'estimate_doc_total_label',
  accept_page_footer: 'estimate_accept_page_footer',
}

const OVERRIDE_KEYS = Object.keys(ESTIMATE_APP_SETTING_KEYS) as EstimateExperienceOverrideKey[]

const BUILTIN_ACCEPT_PAGE_FOOTER =
  'Reliable plumbing today, innovative solutions for tomorrow.\n' +
  'Click Plumbing and Electrical\n' +
  '12925 FM 20, Kingsbury, TX 78638\n' +
  'Ph: 512-360-0599\n' +
  'Malachi Whites RMP M-41130\n' +
  '\n' +
  'Regulated by the Texas State Board of Plumbing Examiners\n' +
  '929 E 41st St, Austin, TX 78751 (512) 936-5200'

export function builtinEstimateExperience(): Record<EstimateExperienceOverrideKey, string> {
  return {
    email_subject_template: 'Estimate: {{title}}',
    email_body_template:
      'Please review and accept your estimate.\n\nOpen this link:\n{{accept_url}}\n\nThank you.',
    accept_section_title: 'Accept',
    accept_instructions:
      'Type your full name and confirm you agree to the estimate and terms above.',
    accept_name_field_label: 'Full name',
    accept_checkbox_label:
      'I agree to conduct business electronically with Click Plumbing and Electrical and have read and agree to this estimate and the terms above.',
    accept_submit_label: 'Submit acceptance',
    accept_submitting_label: 'Submitting…',
    thank_you_title: 'Thank you',
    thank_you_body: 'Your response has been recorded. The contractor will follow up with you.',
    doc_title_fallback: 'Estimate',
    doc_valid_through_prefix: 'Expires on: ',
    doc_line_items_heading: 'Line items',
    doc_terms_heading: 'Terms',
    doc_total_label: 'Total',
    accept_page_footer: BUILTIN_ACCEPT_PAGE_FOOTER,
  }
}

export type EstimateTemplateVars = {
  acceptUrl: string
  /** Shown in email subject; empty title becomes "Your estimate" for {{title}}. */
  title: string
  estimateNumber: number
}

function clampLen(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max)
}

/** Substitute {{accept_url}}, {{title}}, {{estimate_number}}. */
export function substituteEstimateTemplates(template: string, vars: EstimateTemplateVars): string {
  const titleDisplay = (vars.title || '').trim() || 'Your estimate'
  const num = String(Number.isFinite(vars.estimateNumber) ? vars.estimateNumber : '')
  return template
    .replace(/\{\{accept_url\}\}/g, vars.acceptUrl)
    .replace(/\{\{title\}\}/g, titleDisplay)
    .replace(/\{\{estimate_number\}\}/g, num)
}

function appSettingsToMap(rows: { key: string; value_text: string | null }[] | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!rows) return out
  for (const r of rows) {
    if (r.value_text != null && r.value_text !== '') out[r.key] = r.value_text
  }
  return out
}

export function parseEstimateExperienceOverrides(raw: unknown): Partial<Record<EstimateExperienceOverrideKey, string>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  const out: Partial<Record<EstimateExperienceOverrideKey, string>> = {}
  for (const k of OVERRIDE_KEYS) {
    const v = o[k]
    if (typeof v !== 'string') continue
    if (k === 'accept_page_footer') {
      out[k] = clampLen(v.trim(), ESTIMATE_EXPERIENCE_FIELD_MAX_LEN)
      continue
    }
    const t = v.trim()
    if (t !== '') out[k] = clampLen(t, ESTIMATE_EXPERIENCE_FIELD_MAX_LEN)
  }
  return out
}

export function mergeEstimateExperienceStrings(
  appRows: { key: string; value_text: string | null }[] | null,
  overridesJson: unknown,
): Record<EstimateExperienceOverrideKey, string> {
  const builtins = builtinEstimateExperience()
  const settingsMap = appSettingsToMap(appRows)
  const overrides = parseEstimateExperienceOverrides(overridesJson)
  const merged = { ...builtins }
  for (const k of OVERRIDE_KEYS) {
    const appKey = ESTIMATE_APP_SETTING_KEYS[k]
    const fromApp = settingsMap[appKey]
    if (fromApp != null && fromApp !== '') merged[k] = clampLen(fromApp, ESTIMATE_EXPERIENCE_FIELD_MAX_LEN)
  }
  for (const k of OVERRIDE_KEYS) {
    const o = overrides[k]
    if (o != null) merged[k] = o
  }
  return merged
}

export function resolveEstimateCustomerExperience(
  appRows: { key: string; value_text: string | null }[] | null,
  overridesJson: unknown,
  vars: EstimateTemplateVars,
): EstimateCustomerExperienceResolved {
  const m = mergeEstimateExperienceStrings(appRows, overridesJson)
  const emailSubject = substituteEstimateTemplates(m.email_subject_template, vars)
  const emailBody = substituteEstimateTemplates(m.email_body_template, vars)
  return {
    emailSubject: clampLen(emailSubject, ESTIMATE_EXPERIENCE_FIELD_MAX_LEN),
    emailBody: clampLen(emailBody, ESTIMATE_EXPERIENCE_FIELD_MAX_LEN),
    acceptSectionTitle: m.accept_section_title,
    acceptInstructions: m.accept_instructions,
    acceptNameFieldLabel: m.accept_name_field_label,
    acceptCheckboxLabel: m.accept_checkbox_label,
    acceptSubmitLabel: m.accept_submit_label,
    acceptSubmittingLabel: m.accept_submitting_label,
    thankYouTitle: m.thank_you_title,
    thankYouBody: m.thank_you_body,
    docTitleFallback: m.doc_title_fallback,
    docValidThroughPrefix: m.doc_valid_through_prefix,
    docLineItemsHeading: m.doc_line_items_heading,
    docTermsHeading: m.doc_terms_heading,
    docTotalLabel: m.doc_total_label,
    acceptPageFooter: m.accept_page_footer,
  }
}

const RESOLVED_KEYS: (keyof EstimateCustomerExperienceResolved)[] = [
  'emailSubject',
  'emailBody',
  'acceptSectionTitle',
  'acceptInstructions',
  'acceptNameFieldLabel',
  'acceptCheckboxLabel',
  'acceptSubmitLabel',
  'acceptSubmittingLabel',
  'thankYouTitle',
  'thankYouBody',
  'docTitleFallback',
  'docValidThroughPrefix',
  'docLineItemsHeading',
  'docTermsHeading',
  'docTotalLabel',
  'acceptPageFooter',
]

export function parseEstimateCustomerExperienceSnapshot(raw: unknown): EstimateCustomerExperienceResolved | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const out: Partial<EstimateCustomerExperienceResolved> = {}
  for (const k of RESOLVED_KEYS) {
    const v = o[k]
    if (k === 'acceptPageFooter') {
      if (typeof v !== 'string') return null
      out[k] = v
      continue
    }
    if (typeof v !== 'string' || v.trim() === '') return null
    out[k] = v
  }
  return out as EstimateCustomerExperienceResolved
}

export function toClientCustomerExperience(
  resolved: EstimateCustomerExperienceResolved,
): EstimateCustomerExperienceClient {
  const { emailSubject: _s, emailBody: _b, ...rest } = resolved
  return rest
}

type EstimateCustomerExperienceClientStrictKey = Exclude<keyof EstimateCustomerExperienceClient, 'acceptPageFooter'>

const CLIENT_EXPERIENCE_STRICT_KEYS: EstimateCustomerExperienceClientStrictKey[] = [
  'acceptSectionTitle',
  'acceptInstructions',
  'acceptNameFieldLabel',
  'acceptCheckboxLabel',
  'acceptSubmitLabel',
  'acceptSubmittingLabel',
  'thankYouTitle',
  'thankYouBody',
  'docTitleFallback',
  'docValidThroughPrefix',
  'docLineItemsHeading',
  'docTermsHeading',
  'docTotalLabel',
]

export function parseCustomerExperienceClient(raw: unknown): EstimateCustomerExperienceClient | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  for (const k of CLIENT_EXPERIENCE_STRICT_KEYS) {
    if (typeof o[k] !== 'string' || String(o[k]).trim() === '') return null
  }
  let acceptPageFooter: string
  if (o.acceptPageFooter !== undefined) {
    if (typeof o.acceptPageFooter !== 'string') return null
    acceptPageFooter = o.acceptPageFooter
  } else {
    acceptPageFooter = builtinEstimateExperience().accept_page_footer
  }
  return {
    acceptSectionTitle: o.acceptSectionTitle as string,
    acceptInstructions: o.acceptInstructions as string,
    acceptNameFieldLabel: o.acceptNameFieldLabel as string,
    acceptCheckboxLabel: o.acceptCheckboxLabel as string,
    acceptSubmitLabel: o.acceptSubmitLabel as string,
    acceptSubmittingLabel: o.acceptSubmittingLabel as string,
    thankYouTitle: o.thankYouTitle as string,
    thankYouBody: o.thankYouBody as string,
    docTitleFallback: o.docTitleFallback as string,
    docValidThroughPrefix: o.docValidThroughPrefix as string,
    docLineItemsHeading: o.docLineItemsHeading as string,
    docTermsHeading: o.docTermsHeading as string,
    docTotalLabel: o.docTotalLabel as string,
    acceptPageFooter,
  }
}

export function fallbackClientCustomerExperience(): EstimateCustomerExperienceClient {
  return toClientCustomerExperience(
    resolveEstimateCustomerExperience(null, null, {
      acceptUrl: '',
      title: '',
      estimateNumber: 0,
    }),
  )
}

export function serializableSnapshot(resolved: EstimateCustomerExperienceResolved): Record<string, string> {
  const r = resolved
  return {
    emailSubject: r.emailSubject,
    emailBody: r.emailBody,
    acceptSectionTitle: r.acceptSectionTitle,
    acceptInstructions: r.acceptInstructions,
    acceptNameFieldLabel: r.acceptNameFieldLabel,
    acceptCheckboxLabel: r.acceptCheckboxLabel,
    acceptSubmitLabel: r.acceptSubmitLabel,
    acceptSubmittingLabel: r.acceptSubmittingLabel,
    thankYouTitle: r.thankYouTitle,
    thankYouBody: r.thankYouBody,
    docTitleFallback: r.docTitleFallback,
    docValidThroughPrefix: r.docValidThroughPrefix,
    docLineItemsHeading: r.docLineItemsHeading,
    docTermsHeading: r.docTermsHeading,
    docTotalLabel: r.docTotalLabel,
    acceptPageFooter: r.acceptPageFooter,
  }
}

export const ESTIMATE_EXPERIENCE_APP_KEY_LIST = Object.values(ESTIMATE_APP_SETTING_KEYS)
