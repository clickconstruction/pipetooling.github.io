import { describe, expect, it } from 'vitest'
import { pickDefaultPriceBookTemplateId } from './pickDefaultPriceBookTemplateId'

describe('pickDefaultPriceBookTemplateId', () => {
  const templates = [
    { id: 'tmpl-default', name: 'Default' },
    { id: 'tmpl-wendi', name: 'WENDI' },
    { id: 'tmpl-trace', name: 'Trace' },
  ]

  it("prefers the user's last-selected template when it still exists", () => {
    expect(
      pickDefaultPriceBookTemplateId({ userLastTemplateId: 'tmpl-trace', templates }),
    ).toBe('tmpl-trace')
  })

  it('falls back to "Default" when the user has no preference', () => {
    expect(
      pickDefaultPriceBookTemplateId({ userLastTemplateId: null, templates }),
    ).toBe('tmpl-default')
  })

  it('falls back to "Default" when the remembered template no longer exists (stale id)', () => {
    expect(
      pickDefaultPriceBookTemplateId({ userLastTemplateId: 'tmpl-deleted', templates }),
    ).toBe('tmpl-default')
  })

  it('falls back to the first template when there is no "Default"', () => {
    const noDefault = [
      { id: 'tmpl-bill', name: 'Bill' },
      { id: 'tmpl-bryan', name: 'Bryan' },
    ]
    expect(
      pickDefaultPriceBookTemplateId({ userLastTemplateId: null, templates: noDefault }),
    ).toBe('tmpl-bill')
  })

  it('returns null when there are no templates', () => {
    expect(
      pickDefaultPriceBookTemplateId({ userLastTemplateId: 'tmpl-x', templates: [] }),
    ).toBeNull()
  })
})
