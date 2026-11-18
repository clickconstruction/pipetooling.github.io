import { formatDateTime } from './prospectFormat'

/**
 * The Follow Up card's three email templates (the Customers lane): their keys, where their words are stored,
 * which blanks a template still has for a prospect, and the words with the blanks filled in.
 *
 * Moved whole out of `src/pages/Prospects.tsx`, where these were module-level helpers with no test. The rules
 * are unchanged: this file is the one place they live now.
 */

export const COPY_TEMPLATE_KEYS = ['no_response_email', 'phone_followup_email', 'just_checking_in_email'] as const
export type CopyTemplateKey = (typeof COPY_TEMPLATE_KEYS)[number]

export const COPY_TEMPLATE_LABELS: Record<CopyTemplateKey, string> = {
  no_response_email: 'No Response Email',
  phone_followup_email: 'Phone call Follow up Email',
  just_checking_in_email: 'Just checking in Email',
}

/** The `app_settings` key that holds each template's default body. */
export const APP_SETTINGS_KEYS: Record<CopyTemplateKey, string> = {
  no_response_email: 'prospect_copy_no_response_email',
  phone_followup_email: 'prospect_copy_phone_followup_email',
  just_checking_in_email: 'prospect_copy_just_checking_in_email',
}

/** The `app_settings` key that holds each template's default subject. */
export const APP_SUBJECT_SETTINGS_KEYS: Record<CopyTemplateKey, string> = {
  no_response_email: 'prospect_copy_no_response_email_subject',
  phone_followup_email: 'prospect_copy_phone_followup_email_subject',
  just_checking_in_email: 'prospect_copy_just_checking_in_email_subject',
}

/** What a template reads off the prospect. */
export type CopyProspect = {
  company_name: string | null
  contact_name: string | null
  phone_number: string | null
  email: string | null
  last_contact: string | null
}

/** What a template reads off the prospect's comments, newest first: the first `answered` one is the last successful contact. */
export type CopyComment = { interaction_type: string; created_at: string }

/**
 * The fields a template names that are still empty for this prospect and this sender. `forMail` also asks for
 * the prospect's own email, since the mail has nowhere to go without it.
 */
export function getBlankPlaceholderFields(
  template: string,
  authUserName: string,
  authUserEmail: string,
  prospect: CopyProspect,
  personPhone: string | null,
  templateKey: CopyTemplateKey,
  comments: readonly CopyComment[],
  forMail?: boolean
): string[] {
  const blank: string[] = []
  if (forMail && !prospect.email?.trim()) blank.push('Prospect email')
  const userName = (authUserName || authUserEmail || '').trim()
  if (template.includes('[User name]') && !userName) blank.push('User name')
  if (template.includes('[user email]') && !authUserEmail?.trim()) blank.push('User email')
  if (template.includes('[user phone number]') && !personPhone?.trim()) blank.push('User phone number')
  if (template.includes('[company name]') && !prospect.company_name?.trim()) blank.push('Company name')
  if (template.includes('[prospect phone number]') && !prospect.phone_number?.trim()) blank.push('Prospect phone number')
  if (template.includes('[prospect contact name]') && !prospect.contact_name?.trim()) blank.push('Prospect contact name')
  if (template.includes('[prospect last contact]') && !prospect.last_contact) blank.push('Prospect last contact')
  if (template.includes('[prospect last successful contact]') && !comments.find((c) => c.interaction_type === 'answered')) blank.push('Prospect last successful contact')
  if (template.includes('_______')) {
    if (templateKey === 'phone_followup_email' && !prospect.contact_name?.trim()) blank.push('Contact name')
    else if (templateKey === 'just_checking_in_email' && !prospect.phone_number?.trim() && !prospect.email?.trim()) blank.push('Contact info')
  }
  return blank
}

/** The blanks of a mail: the body's (with the prospect's email) and the subject's, each named once. */
export function getBlankFieldsForMail(
  body: string,
  subject: string,
  authUserName: string,
  authUserEmail: string,
  prospect: CopyProspect,
  personPhone: string | null,
  templateKey: CopyTemplateKey,
  comments: readonly CopyComment[]
): string[] {
  const bodyBlanks = getBlankPlaceholderFields(body, authUserName, authUserEmail, prospect, personPhone, templateKey, comments, true)
  const subjectBlanks = getBlankPlaceholderFields(subject, authUserName, authUserEmail, prospect, personPhone, templateKey, comments, false)
  return [...new Set([...bodyBlanks, ...subjectBlanks])]
}

/**
 * The template's words with every bracketed name filled in. The first `_______` is the contact's name on the
 * phone follow-up, and the prospect's phone (else email) on the checking-in mail; any other template keeps it.
 */
export function substituteCopyPlaceholders(
  template: string,
  authUser: { name: string; email: string },
  prospect: CopyProspect,
  personPhone: string | null,
  templateKey: CopyTemplateKey,
  comments: readonly CopyComment[]
): string {
  const lastSuccessfulContact = comments.find((c) => c.interaction_type === 'answered')?.created_at ?? null
  let text = template
    .replace(/\[User name\]/g, authUser.name ?? '')
    .replace(/\[user email\]/g, authUser.email ?? '')
    .replace(/\[user phone number\]/g, personPhone ?? '')
    .replace(/\[company name\]/g, prospect.company_name ?? '')
    .replace(/\[prospect phone number\]/g, prospect.phone_number ?? '')
    .replace(/\[prospect contact name\]/g, prospect.contact_name ?? '')
    .replace(/\[prospect last contact\]/g, formatDateTime(prospect.last_contact))
    .replace(/\[prospect last successful contact\]/g, formatDateTime(lastSuccessfulContact))
  if (templateKey === 'phone_followup_email') {
    text = text.replace(/_______/, prospect.contact_name ?? '_______')
  } else if (templateKey === 'just_checking_in_email') {
    const contactInfo = prospect.phone_number ?? prospect.email ?? '_______'
    text = text.replace(/_______/, contactInfo)
  }
  return text
}

/** A person's own words win; an override that is missing or empty falls back to the company's default. */
export function resolveCopyText(override: string | null | undefined, fallback: string | undefined): string {
  if (override != null && override !== '') return override
  return fallback ?? ''
}

export type CopyTemplateTexts = {
  defaults: Record<CopyTemplateKey, string>
  subjectDefaults: Record<CopyTemplateKey, string>
  overrides: Record<CopyTemplateKey, string | null>
  subjectOverrides: Record<CopyTemplateKey, string | null>
}

/**
 * The two reads as the page holds them: the company's defaults out of `app_settings`, the person's overrides out
 * of `user_prospect_copy_templates`. An empty default body is skipped, an empty default subject is kept, and a
 * row for a key nobody knows is ignored.
 */
export function foldCopyTemplateRows(
  defaultRows: readonly { key: string; value_text: string | null }[],
  overrideRows: readonly { template_key: string; value_text: string | null; subject_text?: string | null }[]
): CopyTemplateTexts {
  const defaults: Record<CopyTemplateKey, string> = {
    no_response_email: '',
    phone_followup_email: '',
    just_checking_in_email: '',
  }
  const subjectDefaults: Record<CopyTemplateKey, string> = {
    no_response_email: '',
    phone_followup_email: '',
    just_checking_in_email: '',
  }
  for (const r of defaultRows) {
    const key = Object.entries(APP_SETTINGS_KEYS).find(([, v]) => v === r.key)?.[0] as CopyTemplateKey | undefined
    if (key && r.value_text) defaults[key] = r.value_text
    const subjectKey = Object.entries(APP_SUBJECT_SETTINGS_KEYS).find(([, v]) => v === r.key)?.[0] as CopyTemplateKey | undefined
    if (subjectKey && r.value_text != null) subjectDefaults[subjectKey] = r.value_text
  }
  const overrides: Record<CopyTemplateKey, string | null> = {
    no_response_email: null,
    phone_followup_email: null,
    just_checking_in_email: null,
  }
  const subjectOverrides: Record<CopyTemplateKey, string | null> = {
    no_response_email: null,
    phone_followup_email: null,
    just_checking_in_email: null,
  }
  for (const r of overrideRows) {
    if (COPY_TEMPLATE_KEYS.includes(r.template_key as CopyTemplateKey)) {
      overrides[r.template_key as CopyTemplateKey] = r.value_text
      subjectOverrides[r.template_key as CopyTemplateKey] = r.subject_text ?? null
    }
  }
  return { defaults, subjectDefaults, overrides, subjectOverrides }
}
