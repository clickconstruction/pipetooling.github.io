import { describe, expect, it } from 'vitest'
import { assembleLienBookInput, parseLienBookRaw, type LienBookRaw } from './lienTimelineBookAssemble'
import { buildLienTimelineBook } from './lienTimelineBook'

const TODAY = '2026-09-23'

function raw(over: Partial<LienBookRaw> = {}): LienBookRaw {
  return {
    rows: [
      { job_id: 'job-273', work_month: '2026-08', approved_hours: '12' as unknown as number, deadline: '2026-10-15', noticed: false, open_balance: '17585' as unknown as number, customer_id: 'cust-1', gc_customer_id: 'gc-1', property_kind: 'residential', has_owner: true, desk_item_id: null, desk_status: null, desk_months: null, month_source: 'hours' },
    ],
    affidavitRows: [
      { job_id: 'job-273', last_month: '2026-08', deadline: '2026-11-16', is_sub: true, noticed: false, filed: false, open_balance: 17585, customer_id: 'cust-1', gc_customer_id: 'gc-1', property_kind: 'residential', has_owner: true, has_legal: true, homestead: false, desk_item_id: null, desk_status: null } as LienBookRaw['affidavitRows'][number],
    ],
    items: [],
    filings: [],
    jobs: [{ id: 'job-273', hcp_number: '273', click_number: null, job_name: 'Dudley (Lennox)', job_address: '9703 Lenox Hl', gc_customer_id: 'gc-1', customer_address_id: 'addr-1', revenue: 20000, payments_made: 2415, last_work_date: '2026-08-27', lien_payment_bond: 'no', lien_contract_ended_on: '2026-11-30' }],
    gcs: [{ id: 'gc-1', name: 'Lenox', lien_notice_policy: null }],
    addresses: [{ id: 'addr-1', customer_id: 'cust-1', address: '9703 Lenox Hl', county: 'Bexar', county_source: null, legal_description: 'CB 4696A BLOCK 3 LOT 36', owner_mode: 'building_owner', owner_name: 'R. Dudley', owner_company: '', owner_mailing_address: '9703 Lenox Hl', parcel_id: '', parcel_source: null, parcel_tax_year: null, parcel_looked_up_at: null, homestead: false, property_kind: 'residential', is_primary: true, note: '', sequence_order: 0, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' } as unknown as LienBookRaw['addresses'][number]],
    owners: [],
    ...over,
  }
}

describe('assembleLienBookInput', () => {
  it('folds the raw rows into the kernel input: numbers coerced, the GC named, the property resolved, the retainage facts carried', () => {
    const input = assembleLienBookInput(raw(), TODAY)
    expect(input.rows[0]).toEqual(expect.objectContaining({ approved_hours: 12, open_balance: 17585 }))
    const job = input.jobs['job-273']!
    expect(job).toEqual(expect.objectContaining({ label: '273 · Dudley (Lennox)', gcName: 'Lenox', propertyKind: 'residential', county: 'Bexar', ownerName: 'R. Dudley', openBalance: 17585, isSub: true, paymentBond: 'no', contractEndedOn: '2026-11-30' }))
    expect(input.policyByCustomer['gc-1']).toBeDefined()
    expect(input.todayYmd).toBe(TODAY)
  })
  it('the same fold feeds the book: one row for the job, on the GC, the affidavit as its next step', () => {
    const book = buildLienTimelineBook(assembleLienBookInput(raw(), TODAY))
    expect(book.rows).toHaveLength(1)
    expect(book.gcs).toEqual([{ id: 'gc-1', name: 'Lenox', count: 1 }])
    expect(book.rows[0]!.timeline.next.kind).toBe('notice')
  })
  it('the demand letters ride through by job (v2.3880): the row’s strip carries the letter, a voided one is dropped, and a payload without them draws none', () => {
    const letter = (over: Record<string, unknown> = {}) =>
      ({ id: 'd1', job_id: 'job-273', amount: 8940, created_at: '2026-09-14T16:00:00Z', created_by: null, deadline_date: '2026-09-28', debtor_party: 'gc', exhibits: [], fields: {}, invoice_ids: ['i1'], recipient_address: '', recipient_email: '', recipient_name: 'Lenox', sent_at: '2026-09-14T16:10:00Z', sent_method: 'certified', tracking_number: '', voided_at: null, ...over }) as unknown as NonNullable<LienBookRaw['demandLetters']>[number]
    const input = assembleLienBookInput(raw({ demandLetters: [letter(), letter({ id: 'old', voided_at: '2026-09-15T00:00:00Z' }), letter({ id: 'other', job_id: 'job-999' })] }), TODAY)
    expect(input.demandLettersByJob?.['job-273']).toHaveLength(2)
    const t = buildLienTimelineBook(input).rows[0]!.timeline
    expect(t.steps.find((s) => s.kind === 'demand')).toMatchObject({ state: 'due', dateWords: 'reply by Sep 28', move: 'gc' })
    expect(t.waitingOn?.who).toBe('gc')
    expect(t.next.kind).toBe('notice')
    expect(buildLienTimelineBook(assembleLienBookInput(raw(), TODAY)).rows[0]!.timeline.steps.some((s) => s.kind === 'demand')).toBe(false)
  })
})

describe('parseLienBookRaw', () => {
  it('reads the function payload shape and is null for anything else', () => {
    expect(parseLienBookRaw(null)).toBeNull()
    expect(parseLienBookRaw('x')).toBeNull()
    const parsed = parseLienBookRaw({ rows: [{ job_id: 'a' }], jobs: 'nope' })
    expect(parsed?.rows).toHaveLength(1)
    expect(parsed?.jobs).toEqual([])
    expect(parsed?.items).toEqual([])
    expect(parsed?.demandLetters).toEqual([])
  })
})
