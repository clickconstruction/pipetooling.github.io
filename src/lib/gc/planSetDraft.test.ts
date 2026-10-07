import { describe, expect, it } from 'vitest'
import { issueDraftForRpc, type IssuePlanSetDraft } from './planSetDraft'

describe('issueDraftForRpc', () => {
  it('spells the draft the way the function reads it, with nulls where nothing was said', () => {
    const d: IssuePlanSetDraft = {
      projectId: 'p1',
      label: 'Addendum 1',
      kind: 'Addendum',
      note: 'E-201: two more floor boxes.',
      checkedByUserId: 'u1',
      sheets: ['E-201'],
      addedSheets: [],
      removedSheets: [],
      retitledSheets: [],
      specs: [],
      addedSpecs: [],
      removedSpecs: [],
      retitledSpecs: [],
      newTrades: [{ trade: 'Fire sprinkler', budget: 0, ours: false, scope: ['Design and permit'] }],
      newLines: [{ packageId: 'pk1', label: 'Floor boxes', sheets: ['E-201'] }],
      retiedLines: [],
    }
    const out = issueDraftForRpc(d)
    expect(out.drive).toBeNull()
    expect(out.newTrades).toEqual([{ trade: 'Fire sprinkler', budget: 0, ours: false, scope: ['Design and permit'], scopeSheets: null, scopeSpecs: null, excludes: [] }])
    expect(out.newLines).toEqual(d.newLines)
    expect(out.checkedByUserId).toBe('u1')
  })
})
