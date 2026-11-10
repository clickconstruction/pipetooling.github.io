import { describe, expect, it } from 'vitest'
import { LIEN_AFFIDAVIT_SHORT_FORM_MARK, lienAffidavitFormForItem, lienAffidavitFormForItems } from './lienAffidavitForm'
import { parseLienDeskDraftFields } from './lienNoticeDraft'

const notice = { noticeDate: '2026-11-10', projectDescription: '', claimantName: 'Sample Plumbing LLC', laborMaterialsType: '', originalContractorName: '', contractedWithIfDifferent: '', claimAmount: '0.00', contactPerson: '', claimantAddress: '' }
const item = (over: Record<string, unknown> = {}) => ({ kind: 'affidavit', status: 'approved', fields: { notice, gcEmail: '' }, voided_at: null, created_at: '2026-11-09T17:54:00Z', ...over })

describe('lienAffidavitFormForItem · a paper keeps the form it was drafted on (punch list #305)', () => {
  it('a job with no draft is drawn on the short form', () => {
    expect(lienAffidavitFormForItem(null)).toBe('short')
    expect(lienAffidavitFormForItem(undefined)).toBe('short')
  })

  it('a draft made before the short form carries no mark and keeps the earlier form, whatever its status', () => {
    for (const status of ['drafted', 'awaiting_approval', 'approved', 'held', 'sent']) expect(lienAffidavitFormForItem(item({ status }))).toBe('long')
    expect(lienAffidavitFormForItem(item({ fields: null }))).toBe('long')
    expect(lienAffidavitFormForItem(item({ fields: { affidavitForm: 'long' } }))).toBe('long')
  })

  it('a draft that carries the mark is on the short form', () => {
    expect(lienAffidavitFormForItem(item({ fields: { notice, gcEmail: '', ...LIEN_AFFIDAVIT_SHORT_FORM_MARK } }))).toBe('short')
  })

  it('a voided draft is no draft', () => {
    expect(lienAffidavitFormForItem(item({ voided_at: '2026-11-10T15:00:00Z' }))).toBe('short')
  })

  it('the mark survives the desk’s own parse, so a later save of the fields keeps it', () => {
    expect(parseLienDeskDraftFields({ notice, gcEmail: '', affidavitForm: 'short' })?.affidavitForm).toBe('short')
    expect(parseLienDeskDraftFields({ notice, gcEmail: '' })?.affidavitForm).toBeUndefined()
    expect(parseLienDeskDraftFields({ notice, gcEmail: '', affidavitForm: 'anything' })?.affidavitForm).toBeUndefined()
  })
})

describe('lienAffidavitFormForItems · the Lien window’s read of the job', () => {
  it('no affidavit item on the job: the short form', () => {
    expect(lienAffidavitFormForItems([])).toBe('short')
    expect(lienAffidavitFormForItems(null)).toBe('short')
    expect(lienAffidavitFormForItems([item({ kind: 'notice_53_056' })])).toBe('short')
  })

  it('the newest live affidavit item decides; a voided one and a missed window’s note do not', () => {
    const marked = { notice, gcEmail: '', affidavitForm: 'short' }
    expect(lienAffidavitFormForItems([item()])).toBe('long')
    expect(lienAffidavitFormForItems([item({ created_at: '2026-09-01T00:00:00Z' }), item({ created_at: '2026-11-12T00:00:00Z', fields: marked, status: 'drafted' })])).toBe('short')
    expect(lienAffidavitFormForItems([item({ created_at: '2026-11-12T00:00:00Z', fields: marked }), item({ created_at: '2026-09-01T00:00:00Z' })])).toBe('short')
    expect(lienAffidavitFormForItems([item({ voided_at: '2026-11-10T15:00:00Z' }), item({ status: 'missed' })])).toBe('short')
  })
})
