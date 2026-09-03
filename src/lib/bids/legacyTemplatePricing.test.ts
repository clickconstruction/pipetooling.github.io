import { describe, expect, it } from 'vitest'
import { pickLegacyDataTemplateId } from './legacyTemplatePricing'

describe('pickLegacyDataTemplateId', () => {
  const templates = ['tDefault', 'tWendi', 'tRsmeans']

  it('returns the template that holds the bid’s rows', () => {
    const refs = ['tDefault', 'tDefault', 'tDefault', 'tDefault']
    expect(pickLegacyDataTemplateId({ referencedVersionIds: refs, templateIds: templates, bidPricingIds: [] })).toBe('tDefault')
  })

  it('picks the template with the most rows when several are referenced', () => {
    const refs = ['tWendi', 'tDefault', 'tWendi', 'tWendi', null, undefined]
    expect(pickLegacyDataTemplateId({ referencedVersionIds: refs, templateIds: templates, bidPricingIds: [] })).toBe('tWendi')
  })

  it('breaks a tie by template display order', () => {
    const refs = ['tRsmeans', 'tDefault']
    expect(pickLegacyDataTemplateId({ referencedVersionIds: refs, templateIds: templates, bidPricingIds: [] })).toBe('tDefault')
  })

  it('never answers with the bid’s own copy, even when its rows point there', () => {
    const refs = ['own1', 'own1', 'own1', 'tDefault']
    expect(pickLegacyDataTemplateId({ referencedVersionIds: refs, templateIds: templates, bidPricingIds: ['own1'] })).toBe('tDefault')
    expect(pickLegacyDataTemplateId({ referencedVersionIds: ['own1', 'own1'], templateIds: templates, bidPricingIds: ['own1'] })).toBeNull()
  })

  it('ignores ids that are neither a template nor a copy (deleted scenarios)', () => {
    expect(pickLegacyDataTemplateId({ referencedVersionIds: ['gone', 'gone'], templateIds: templates, bidPricingIds: [] })).toBeNull()
  })

  it('returns null with nothing to go on', () => {
    expect(pickLegacyDataTemplateId({ referencedVersionIds: [], templateIds: templates, bidPricingIds: [] })).toBeNull()
    expect(pickLegacyDataTemplateId({ referencedVersionIds: ['tDefault'], templateIds: [], bidPricingIds: [] })).toBeNull()
  })
})
