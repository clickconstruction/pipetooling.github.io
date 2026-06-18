import { describe, expect, it } from 'vitest'
import { resolveCurrentPriceBookTemplateId } from './resolveCurrentPriceBookTemplateId'

describe('resolveCurrentPriceBookTemplateId', () => {
  const templateIds = ['tmpl-default', 'tmpl-wendi']

  it('returns the source template of an active bid-owned copy', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'copy-1',
        bidPricings: [{ id: 'copy-1', source_version_id: 'tmpl-wendi' }],
        templateIds,
      }),
    ).toBe('tmpl-wendi')
  })

  it('returns the template id when the active pricing IS a template (Default fallback)', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'tmpl-default',
        bidPricings: [],
        templateIds,
      }),
    ).toBe('tmpl-default')
  })

  it('returns null when no pricing is selected', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: null,
        bidPricings: [{ id: 'copy-1', source_version_id: 'tmpl-wendi' }],
        templateIds,
      }),
    ).toBeNull()
  })

  it('returns null for a bid-owned copy with no recorded source (e.g. built blank)', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'copy-blank',
        bidPricings: [{ id: 'copy-blank', source_version_id: null }],
        templateIds,
      }),
    ).toBeNull()
  })

  it('prefers the owned-copy lineage even if the id also looks like a template list member', () => {
    // A copy is matched before the template-id check, so its source wins.
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'copy-2',
        bidPricings: [{ id: 'copy-2', source_version_id: 'tmpl-default' }],
        templateIds,
      }),
    ).toBe('tmpl-default')
  })

  it('returns null when the active id is neither an owned copy nor a known template', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'tmpl-deleted',
        bidPricings: [],
        templateIds,
      }),
    ).toBeNull()
  })
})
