import { describe, expect, it } from 'vitest'
import * as edge from '../../supabase/functions/_shared/estimateCustomerExperience'
import {
  ESTIMATE_APP_SETTING_KEYS,
  ESTIMATE_APP_SETTING_LABELS,
  ESTIMATE_EXPERIENCE_APP_KEY_LIST,
  ESTIMATE_EXPERIENCE_FIELD_MAX_LEN,
  ESTIMATE_EXPERIENCE_SETTINGS_EDITABLE_KEYS,
  builtinEstimateExperience,
  changeOrderExperienceOverlay,
  fallbackClientCustomerExperience,
  mergeEstimateExperienceStrings,
  parseCustomerExperienceClient,
  parseEstimateCustomerExperienceSnapshot,
  parseEstimateExperienceOverrides,
  resolveEstimateCustomerExperience,
  serializableSnapshot,
  substituteEstimateTemplates,
  toClientCustomerExperience,
} from './estimateCustomerExperience'

const VARS = { acceptUrl: 'https://app.example/estimate/accept?t=abc', title: 'Water heater', estimateNumber: 482 }
const row = (key: string, value_text: string | null) => ({ key, value_text })

describe('client and edge copies stay in sync', () => {
  // The header says "Keep in sync with supabase/functions/_shared/estimateCustomerExperience.ts".
  // Nothing enforced it; this does. A drift here means the email the edge function sends and
  // the page the client renders disagree.
  it('builtins, the change-order overlay and the app_settings key map are identical', () => {
    expect(edge.builtinEstimateExperience()).toEqual(builtinEstimateExperience())
    expect(edge.changeOrderExperienceOverlay()).toEqual(changeOrderExperienceOverlay())
    expect(edge.ESTIMATE_APP_SETTING_KEYS).toEqual(ESTIMATE_APP_SETTING_KEYS)
    expect(edge.ESTIMATE_EXPERIENCE_FIELD_MAX_LEN).toBe(ESTIMATE_EXPERIENCE_FIELD_MAX_LEN)
  })
  it('resolve the same inputs to the same copy', () => {
    const appRows = [row('estimate_thank_you_title', 'Thanks!'), row('estimate_doc_total_label', 'Grand total')]
    const overrides = { accept_submit_label: 'Approve', accept_page_footer: '' }
    for (const docKind of [null, 'change_order']) {
      expect(edge.resolveEstimateCustomerExperience(appRows, overrides, VARS, { docKind })).toEqual(
        resolveEstimateCustomerExperience(appRows, overrides, VARS, { docKind }),
      )
    }
  })
})

describe('substituteEstimateTemplates', () => {
  it('replaces every placeholder, everywhere it appears', () => {
    expect(substituteEstimateTemplates('{{title}} #{{estimate_number}}: {{accept_url}} ({{title}})', VARS)).toBe(
      'Water heater #482: https://app.example/estimate/accept?t=abc (Water heater)',
    )
  })
  it('an empty title reads "Your estimate"; a non-finite number reads as nothing', () => {
    expect(substituteEstimateTemplates('{{title}}', { ...VARS, title: '  ' })).toBe('Your estimate')
    expect(substituteEstimateTemplates('#{{estimate_number}}', { ...VARS, estimateNumber: Number.NaN })).toBe('#')
  })
})

describe('parseEstimateExperienceOverrides', () => {
  it('keeps only known keys with non-empty trimmed strings; the footer may be empty on purpose', () => {
    expect(parseEstimateExperienceOverrides(null)).toEqual({})
    expect(parseEstimateExperienceOverrides([])).toEqual({})
    expect(
      parseEstimateExperienceOverrides({
        accept_submit_label: '  Approve  ',
        thank_you_title: '   ',
        accept_page_footer: '  ',
        doc_total_label: 42,
        not_a_key: 'x',
      }),
    ).toEqual({ accept_submit_label: 'Approve', accept_page_footer: '' })
  })
  it('caps every field at the max length', () => {
    const long = 'x'.repeat(ESTIMATE_EXPERIENCE_FIELD_MAX_LEN + 10)
    const out = parseEstimateExperienceOverrides({ thank_you_body: long, accept_page_footer: long })
    expect(out.thank_you_body).toHaveLength(ESTIMATE_EXPERIENCE_FIELD_MAX_LEN)
    expect(out.accept_page_footer).toHaveLength(ESTIMATE_EXPERIENCE_FIELD_MAX_LEN)
  })
})

describe('mergeEstimateExperienceStrings — precedence', () => {
  it('builtins < app_settings < change-order overlay < per-row overrides', () => {
    const appRows = [
      row('estimate_doc_total_label', 'Org total'),
      row('estimate_thank_you_title', 'Org thanks'),
      row('estimate_accept_submit_label', ''), // empty app value is ignored
      row('estimate_doc_terms_heading', null),
    ]
    const overrides = { thank_you_title: 'Row thanks' }
    const est = mergeEstimateExperienceStrings(appRows, overrides)
    expect(est.doc_total_label).toBe('Org total')
    expect(est.thank_you_title).toBe('Row thanks')
    expect(est.accept_submit_label).toBe('Submit acceptance')
    expect(est.doc_terms_heading).toBe('Terms')
    expect(est.doc_title_fallback).toBe('Estimate')

    const co = mergeEstimateExperienceStrings(appRows, overrides, { docKind: 'change_order' })
    expect(co.doc_total_label).toBe('Net change to contract') // overlay beats the org setting
    expect(co.doc_title_fallback).toBe('Change order')
    expect(co.doc_line_items_heading).toBe('Impact on cost')
    expect(co.thank_you_title).toBe('Row thanks') // the row still wins over the overlay
    expect(co.accept_section_title).toBe('Accept') // untouched by the overlay
  })
  it('an unknown docKind behaves like an estimate', () => {
    expect(mergeEstimateExperienceStrings(null, null, { docKind: 'proposal' })).toEqual(builtinEstimateExperience())
    expect(mergeEstimateExperienceStrings(null, null)).toEqual(builtinEstimateExperience())
  })
})

describe('resolveEstimateCustomerExperience', () => {
  it('substitutes the email templates and maps every field to camelCase', () => {
    const r = resolveEstimateCustomerExperience(null, null, VARS)
    expect(r.emailSubject).toBe('Estimate: Water heater')
    expect(r.emailBody).toContain(VARS.acceptUrl)
    expect(r.acceptSubmitLabel).toBe('Submit acceptance')
    expect(r.docTotalLabel).toBe('Total')
    expect(r.acceptPageFooter).toContain('Regulated by the Texas State Board of Plumbing Examiners')
    const co = resolveEstimateCustomerExperience(null, null, VARS, { docKind: 'change_order' })
    expect(co.emailSubject).toBe('Change order: Water heater')
  })
  it('caps the substituted email at the max length', () => {
    const r = resolveEstimateCustomerExperience(null, { email_body_template: '{{accept_url}}'.repeat(3000) }, VARS)
    expect(r.emailBody).toHaveLength(ESTIMATE_EXPERIENCE_FIELD_MAX_LEN)
  })
})

describe('snapshots and the client shape', () => {
  const resolved = resolveEstimateCustomerExperience(null, { accept_page_footer: '' }, VARS)

  it('serializableSnapshot round-trips through parseEstimateCustomerExperienceSnapshot', () => {
    const snap = serializableSnapshot(resolved)
    expect(Object.keys(snap)).toHaveLength(16)
    expect(parseEstimateCustomerExperienceSnapshot(snap)).toEqual(resolved)
  })
  it('the snapshot parser refuses a missing or blank field, but allows an empty footer', () => {
    const snap = serializableSnapshot(resolved)
    expect(parseEstimateCustomerExperienceSnapshot({ ...snap, docTotalLabel: ' ' })).toBeNull()
    expect(parseEstimateCustomerExperienceSnapshot({ ...snap, emailBody: undefined })).toBeNull()
    expect(parseEstimateCustomerExperienceSnapshot({ ...snap, acceptPageFooter: 12 })).toBeNull()
    expect(parseEstimateCustomerExperienceSnapshot({ ...snap, acceptPageFooter: '' })?.acceptPageFooter).toBe('')
    expect(parseEstimateCustomerExperienceSnapshot(null)).toBeNull()
    expect(parseEstimateCustomerExperienceSnapshot([])).toBeNull()
  })
  it('toClientCustomerExperience drops only the email fields', () => {
    const client = toClientCustomerExperience(resolved)
    expect('emailSubject' in client).toBe(false)
    expect('emailBody' in client).toBe(false)
    expect(Object.keys(client)).toHaveLength(14)
  })
  it('parseCustomerExperienceClient is strict on the 13 labels and defaults a missing footer to the builtin', () => {
    const client = toClientCustomerExperience(resolved)
    expect(parseCustomerExperienceClient(client)).toEqual(client)
    const { acceptPageFooter: _f, ...noFooter } = client
    expect(parseCustomerExperienceClient(noFooter)?.acceptPageFooter).toBe(builtinEstimateExperience().accept_page_footer)
    expect(parseCustomerExperienceClient({ ...client, acceptPageFooter: 3 })).toBeNull()
    expect(parseCustomerExperienceClient({ ...client, thankYouTitle: '' })).toBeNull()
    expect(parseCustomerExperienceClient('x')).toBeNull()
  })
  it('fallbackClientCustomerExperience is the builtin copy with the email stripped', () => {
    const fb = fallbackClientCustomerExperience()
    expect(fb.acceptSectionTitle).toBe('Accept')
    expect(fb.acceptPageFooter).toBe(builtinEstimateExperience().accept_page_footer)
    expect('emailSubject' in fb).toBe(false)
  })
})

describe('Settings form key lists', () => {
  it('every app_settings key has a label; the subject template is fetched but not editable', () => {
    expect(ESTIMATE_EXPERIENCE_APP_KEY_LIST).toHaveLength(16)
    for (const k of ESTIMATE_EXPERIENCE_APP_KEY_LIST) expect(ESTIMATE_APP_SETTING_LABELS[k]).toBeTruthy()
    expect(ESTIMATE_EXPERIENCE_SETTINGS_EDITABLE_KEYS).toHaveLength(15)
    expect(ESTIMATE_EXPERIENCE_SETTINGS_EDITABLE_KEYS).not.toContain('estimate_email_subject_template')
  })
})
