import { describe, expect, it } from 'vitest'
import { draftForRpc, type NewProjectDraft } from './newProjectDraft'

describe('the draft as gc_create_project reads it', () => {
  it('spells the role for the table, sends the size as a number and every list, and nulls what was not said', () => {
    const draft: NewProjectDraft = {
      name: 'Hill Country Clinic',
      address: '12 Oak St, Boerne',
      customerId: null,
      ownerName: 'Cibolo Creek Partners',
      architectId: 'a1',
      architectName: 'Marsh & Vale',
      bidDue: '2026-10-20',
      sqFt: 6800,
      sizeNote: 'clinic, one story',
      setLabel: 'Bid set',
      setKind: 'Bid set',
      issuedOn: '2026-10-06',
      setNote: '',
      sheets: [{ id: 'A-101', title: 'First floor plan', page: 3 }],
      trades: [{ trade: 'Sitework', budget: 60000, ours: false, scope: ['Clearing and grading', 'Paving'], scopeSheets: [[], ['C-101']] }],
      customerRole: 'ownersRep',
      propertyOwnerName: 'Oak Street Holdings',
    }
    const rpc = draftForRpc(draft)
    expect(rpc).toMatchObject({ customerRole: 'owners_rep', sqFt: 6800, propertyOwnerId: null, propertyOwnerName: 'Oak Street Holdings', drive: null, specs: [] })
    expect(rpc.trades).toEqual([{ trade: 'Sitework', budget: 60000, ours: false, scope: ['Clearing and grading', 'Paving'], scopeSheets: [[], ['C-101']], scopeSpecs: null, excludes: [] }])
    expect(draftForRpc({ ...draft, customerRole: undefined, drive: { url: 'https://drive.google.com/drive/folders/1HcBidSetAnyoneWithTheLink', access: null, checkedOn: null } })).toMatchObject({ customerRole: 'owner', drive: { access: null } })
  })
})
