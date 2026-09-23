import { describe, expect, it } from 'vitest'
import { parseLienDeskDraftFields } from './lienNoticeDraft'

const notice = { noticeDate: '2026-09-23', projectDescription: '9703 Lenox Hl', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'RMC- Dudley Mason', contractedWithIfDifferent: '', claimAmount: '7902.00', contactPerson: 'Robert Douglas, Master Plumber', claimantAddress: '5501 Balcones Dr' }

describe('parseLienDeskDraftFields · months dated from the job’s creation (v2.3747)', () => {
  it('keeps the flag when the item carries it and drops it otherwise, so older drafts read as before', () => {
    expect(parseLienDeskDraftFields({ notice, gcEmail: '', monthsDatedFromCreation: true })).toMatchObject({ monthsDatedFromCreation: true })
    expect(parseLienDeskDraftFields({ notice, gcEmail: '' })).not.toHaveProperty('monthsDatedFromCreation')
    expect(parseLienDeskDraftFields({ notice, gcEmail: '', monthsDatedFromCreation: 'yes' })).not.toHaveProperty('monthsDatedFromCreation')
  })
})
