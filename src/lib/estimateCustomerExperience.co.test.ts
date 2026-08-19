import { describe, expect, it } from 'vitest'
import { mergeEstimateExperienceStrings, resolveEstimateCustomerExperience } from './estimateCustomerExperience'

/** CO train (v2.1834): change-order wording overlay in the experience default chain. */
describe('change-order experience overlay', () => {
  const vars = { acceptUrl: 'https://x/a', title: 'RTU reroute', estimateNumber: 46 }

  it('estimate rows keep the estimate wording', () => {
    const r = resolveEstimateCustomerExperience(null, null, vars)
    expect(r.emailSubject).toBe('Estimate: RTU reroute')
    expect(r.docLineItemsHeading).toBe('Line items')
    expect(r.docTotalLabel).toBe('Total')
  })

  it('change orders get CO subject, headings, and total label', () => {
    const r = resolveEstimateCustomerExperience(null, null, vars, { docKind: 'change_order' })
    expect(r.emailSubject).toBe('Change order: RTU reroute')
    expect(r.docTitleFallback).toBe('Change order')
    expect(r.docLineItemsHeading).toBe('Impact on cost')
    expect(r.docTotalLabel).toBe('Net change to contract')
    expect(r.acceptCheckboxLabel).toContain('this change order')
  })

  it('org app settings tuned for estimates do NOT leak into COs; row overrides still win', () => {
    const appRows = [{ key: 'estimate_email_subject_template', value_text: 'Your estimate from Click: {{title}}' }]
    const co = mergeEstimateExperienceStrings(appRows, {}, { docKind: 'change_order' })
    expect(co.email_subject_template).toBe('Change order: {{title}}')
    const withOverride = mergeEstimateExperienceStrings(
      appRows,
      { email_subject_template: 'CO for signature: {{title}}' },
      { docKind: 'change_order' },
    )
    expect(withOverride.email_subject_template).toBe('CO for signature: {{title}}')
    const estimate = mergeEstimateExperienceStrings(appRows, {}, { docKind: 'estimate' })
    expect(estimate.email_subject_template).toBe('Your estimate from Click: {{title}}')
  })
})
