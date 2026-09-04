import { describe, it, expect } from 'vitest'
// Deno edge module (supabase/functions/_shared) — dependency-free, tested here.
import {
  addDaysYmd,
  attachSheetAgreements,
  buildSubDocuments,
  buildSubOffers,
  buildSubPaymentLines,
  buildSubSheets,
  buildSubTotals,
  nextPayRunYmd,
  parseScopeExtras,
  subLineLaborCost,
  type SubDocRow,
  type SubItemRow,
  type SubOfferRow,
  type SubPaymentRow,
  type SubSheetRow,
} from '../../../supabase/functions/_shared/subPortalStatement'

const TODAY = '2026-09-02'

function sheet(over: Partial<SubSheetRow> & { id: string }): SubSheetRow {
  return {
    address: '1208 Brazos St',
    job_number: 'J-1482',
    job_date: '2026-08-20',
    labor_rate: 58,
    stage: null,
    stage_changed_at: null,
    stage_source: null,
    payable_after: null,
    pay_hold_reason: null,
    ...over,
  }
}

function item(over: Partial<SubItemRow> & { job_id: string }): SubItemRow {
  return {
    fixture: 'Top out fixtures',
    count: 14,
    hrs_per_unit: 3.5,
    is_fixed: false,
    labor_rate: null,
    direct_labor_amount: null,
    sequence_order: 0,
    ...over,
  }
}

function payment(over: Partial<SubPaymentRow> & { job_id: string }): SubPaymentRow {
  return {
    amount: 1500,
    memo: 'Progress payment',
    payment_date: '2026-08-22',
    created_at: '2026-08-22T18:00:00Z',
    hidden_from_sub: false,
    sequence_order: 0,
    ...over,
  }
}

describe('subLineLaborCost', () => {
  it('multiplies count x hrs x sheet rate', () => {
    expect(subLineLaborCost({ count: 14, hrs_per_unit: 3.5, is_fixed: false, labor_rate: null, direct_labor_amount: null }, 58)).toBe(2842)
  })
  it('fixed lines ignore count', () => {
    expect(subLineLaborCost({ count: 9, hrs_per_unit: 2, is_fixed: true, labor_rate: null, direct_labor_amount: null }, 58)).toBe(116)
  })
  it('line rate overrides sheet rate; direct amount overrides everything', () => {
    expect(subLineLaborCost({ count: 2, hrs_per_unit: 1, is_fixed: false, labor_rate: 100, direct_labor_amount: null }, 58)).toBe(200)
    expect(subLineLaborCost({ count: 2, hrs_per_unit: 1, is_fixed: false, labor_rate: 100, direct_labor_amount: 278 }, 58)).toBe(278)
  })
})

describe('buildSubSheets', () => {
  it('builds the job card: items, agreed/paid/backcharges/open', () => {
    const sheets = buildSubSheets(
      [sheet({ id: 's1', stage: 'walkthrough', stage_changed_at: '2026-09-04T20:12:00Z', stage_source: 'portal', payable_after: '2026-09-05', pay_hold_reason: 'Friday pay run' })],
      [item({ job_id: 's1' }), item({ job_id: 's1', fixture: 'Water heater set', is_fixed: true, hrs_per_unit: 0, direct_labor_amount: 278, sequence_order: 1 })],
      [payment({ job_id: 's1' }), payment({ job_id: 's1', amount: -180, memo: 'Restock', sequence_order: 1 })],
    )
    expect(sheets).toHaveLength(1)
    const s = sheets[0]!
    expect(s.agreed).toBe(3120)
    expect(s.paid).toBe(1500)
    expect(s.backcharges).toBe(180)
    expect(s.open).toBe(1440)
    expect(s.stage).toBe('walkthrough')
    expect(s.stageChangedOn).toBe('2026-09-04')
    expect(s.stageSource).toBe('portal')
    expect(s.payableAfter).toBe('2026-09-05')
    expect(s.payHoldReason).toBe('Friday pay run')
    expect(s.items.map((i) => i.label)).toEqual([
      '14 × Top out fixtures — 3.5 hr each @ $58/hr',
      'Water heater set (fixed price)',
    ])
    expect(s.items[1]!.amount).toBe(278)
  })

  it('cost-less sheets with money moved net to zero (subLaborOutstanding parity)', () => {
    const [s] = buildSubSheets([sheet({ id: 's1' })], [], [payment({ job_id: 's1', amount: 500 })])
    expect(s!.agreed).toBe(500)
    expect(s!.open).toBe(0)
  })

  it('normalizes an unknown stage to working and sorts items by sequence', () => {
    const [s] = buildSubSheets(
      [sheet({ id: 's1', stage: 'weird', stage_source: 'sub' })],
      [item({ job_id: 's1', fixture: 'B', sequence_order: 2 }), item({ job_id: 's1', fixture: 'A', sequence_order: 1 })],
      [],
    )
    expect(s!.stage).toBe('working')
    expect(s!.stageChangedOn).toBeNull()
    expect(s!.stageSource).toBeNull()
    expect(s!.items[0]!.label).toContain('A')
  })
})

describe('buildSubPaymentLines', () => {
  const sheetsById = new Map<string, SubSheetRow>([['s1', sheet({ id: 's1' })]])
  it('keeps amounts but drops hidden memos', () => {
    const lines = buildSubPaymentLines(
      [payment({ job_id: 's1' }), payment({ job_id: 's1', amount: -180, memo: 'internal note', hidden_from_sub: true, payment_date: '2026-08-15' })],
      sheetsById,
      '2026-06-01',
    )
    expect(lines).toHaveLength(2)
    expect(lines[0]!.memo).toBe('Progress payment')
    expect(lines[1]!.memo).toBeNull()
    expect(lines[1]!.amount).toBe(-180)
  })
  it('falls back to created_at date, filters by window, sorts newest first', () => {
    const lines = buildSubPaymentLines(
      [
        payment({ job_id: 's1', payment_date: null, created_at: '2026-08-01T00:00:00Z' }),
        payment({ job_id: 's1', payment_date: '2026-05-01' }),
        payment({ job_id: 's1', payment_date: '2026-08-22' }),
      ],
      sheetsById,
      '2026-06-04',
    )
    expect(lines.map((l) => l.date)).toEqual(['2026-08-22', '2026-08-01'])
  })
})

describe('buildSubTotals', () => {
  it('floors open per sheet — a credit never nets across sheets', () => {
    const sheets = buildSubSheets(
      [sheet({ id: 's1' }), sheet({ id: 's2', job_number: 'J-2' })],
      [item({ job_id: 's1' }), item({ job_id: 's2', count: 1, hrs_per_unit: 1 })],
      [payment({ job_id: 's2', amount: 500 })], // s2 agreed 58, paid 500 → overpaid
    )
    const totals = buildSubTotals(sheets)
    expect(totals.earned).toBe(2900)
    expect(totals.paid).toBe(500)
    expect(totals.open).toBe(2842) // s1 only; s2's credit does not net
  })
})

describe('buildSubOffers', () => {
  function offer(over: Partial<SubOfferRow> & { id: string }): SubOfferRow {
    return {
      amount: 4850,
      notes: null,
      offer_scope_snapshot: { lines: [{ label: 'Rough-in — 22 fixtures', amount: 4350 }, { label: 'Garage stub-outs', amount: 500 }], startsLabel: 'Week of Sep 15' },
      offer_expires_at: '2026-09-12',
      proposed_start: '2026-09-15',
      proposed_end: '2026-09-22',
      step_name: 'Rough-in',
      ...over,
    }
  }
  it('shapes lines, title, starts label from the snapshot', () => {
    const [o] = buildSubOffers([offer({ id: 'c1' })], TODAY)
    expect(o!.title).toBe('Rough-in')
    expect(o!.lines).toHaveLength(2)
    expect(o!.total).toBe(4850)
    expect(o!.startsLabel).toBe('Week of Sep 15')
    expect(o!.expiresOn).toBe('2026-09-12')
  })
  it('drops expired offers; falls back to notes/step-name line and proposed dates', () => {
    expect(buildSubOffers([offer({ id: 'c1', offer_expires_at: '2026-09-01' })], TODAY)).toHaveLength(0)
    const [o] = buildSubOffers(
      [offer({ id: 'c2', offer_scope_snapshot: null, notes: 'Trim set upstairs', offer_expires_at: null })],
      TODAY,
    )
    expect(o!.lines).toEqual([{ label: 'Trim set upstairs', amount: null }])
    expect(o!.startsLabel).toBe('Starts 2026-09-15')
  })
  it('tolerates malformed snapshots', () => {
    const [o] = buildSubOffers([offer({ id: 'c3', offer_scope_snapshot: { lines: [{ nope: 1 }, 'x', { label: ' ok ', amount: 'NaN' }] } })], TODAY)
    expect(o!.lines).toEqual([{ label: 'ok', amount: null }])
    expect(o!.anchor).toBe('step')
    expect(o!.references).toEqual([])
    expect(o!.acknowledgements).toEqual([])
  })
  it('sheet work orders (v2.2789): title from the sheet label, extras carried through', () => {
    const [o] = buildSubOffers(
      [
        offer({
          id: 'c4',
          step_name: null,
          labor_job_id: 'sheet-1',
          offer_scope_snapshot: {
            anchor: 'sheet',
            sheetLabel: 'J977 · 415 Springtown Way',
            lines: [{ label: 'Fixtures per plans', amount: null }],
            startsLabel: 'Starts Sep 15 → Sep 26',
            exclusions: ['Sales tax'],
            references: [{ kind: 'book', documentId: 'd1', name: 'General Conditions', versionDate: '2026-06-19' }, { kind: 'bogus', name: 'Pay', versionDate: '' }, { name: '' }],
            acknowledgements: ['I will bill through the portal.', ''],
            bond: 'furnished',
            specialProvisions: 'Owner supplies fixtures.',
          },
        }),
      ],
      TODAY,
    )
    expect(o!.title).toBe('J977 · 415 Springtown Way')
    expect(o!.anchor).toBe('sheet')
    expect(o!.exclusions).toEqual(['Sales tax'])
    expect(o!.references).toEqual([
      { kind: 'book', name: 'General Conditions', versionDate: '2026-06-19' },
      { kind: 'book', name: 'Pay', versionDate: null },
    ])
    expect(o!.acknowledgements).toEqual(['I will bill through the portal.'])
    expect(o!.bond).toBe('furnished')
    expect(o!.specialProvisions).toBe('Owner supplies fixtures.')
  })
})

describe('attachSheetAgreements (v2.2789)', () => {
  it('joins the newest signed order onto its sheet and reads what was ticked', () => {
    const sheets = buildSubSheets([sheet({ id: 's1' }), sheet({ id: 's2' })], [item({ job_id: 's1' })], [])
    const out = attachSheetAgreements(sheets, [
      { labor_job_id: 's1', amount: 3120, signed_at: '2026-08-01T10:00:00Z', accepted_at: null, signer_printed_name: 'Old', offer_scope_snapshot: { lines: [{ label: 'old' }] }, signer_acknowledgements: null },
      { labor_job_id: 's1', amount: 3400, signed_at: '2026-08-20T10:00:00Z', accepted_at: null, signer_printed_name: 'Danny Vasquez', offer_scope_snapshot: { lines: [{ label: 'Top out' }], acknowledgements: ['A', 'B'], references: [{ kind: 'book', name: 'GC', versionDate: '2026-06-19' }] }, signer_acknowledgements: [{ text: 'A', acknowledgedAt: 'x' }] },
      { labor_job_id: null, amount: 1, signed_at: null, accepted_at: null, signer_printed_name: null, offer_scope_snapshot: null, signer_acknowledgements: null },
    ])
    expect(out[1]!.agreement).toBeNull()
    const a = out[0]!.agreement!
    expect(a.signedOn).toBe('2026-08-20')
    expect(a.signerName).toBe('Danny Vasquez')
    expect(a.amount).toBe(3400)
    expect(a.lines).toEqual([{ label: 'Top out', amount: null }])
    expect(a.references).toEqual([{ kind: 'book', name: 'GC', versionDate: '2026-06-19' }])
    expect(a.acknowledgements).toEqual(['A'])
  })
  it('parseScopeExtras never throws', () => {
    expect(parseScopeExtras(null).anchor).toBe('step')
    expect(parseScopeExtras('x').exclusions).toEqual([])
  })
})

describe('buildSubDocuments', () => {
  function doc(over: Partial<SubDocRow> & { id: string }): SubDocRow {
    return { document_name: 'Master Subcontract Agreement', doc_type: 'contract', status: 'signed', signed_at: '2026-09-02', expires_at: null, ...over }
  }
  it('signed → on_file with signed date; sent/unsent → signable action', () => {
    const docs = buildSubDocuments(
      [doc({ id: 'd1' }), doc({ id: 'd2', status: 'sent', signed_at: null }), doc({ id: 'd3', status: 'unsent', signed_at: null })],
      TODAY,
    )
    expect(docs[0]).toMatchObject({ state: 'on_file', detail: { kind: 'signed', signedOn: '2026-09-02' }, signable: false })
    expect(docs[1]).toMatchObject({ state: 'action_needed', detail: { kind: 'needs_signature' }, signable: true })
    expect(docs[2]).toMatchObject({ state: 'action_needed', signable: true })
  })
  it('expiry ladder: fine > warn (≤60d) > expired', () => {
    const docs = buildSubDocuments(
      [
        doc({ id: 'far', expires_at: '2027-06-01' }),
        doc({ id: 'soon', expires_at: '2026-10-15' }),
        doc({ id: 'gone', expires_at: '2026-08-01' }),
      ],
      TODAY,
    )
    expect(docs[0]!.state).toBe('on_file')
    expect(docs[1]).toMatchObject({ state: 'expiring', detail: { kind: 'expires', on: '2026-10-15' } })
    expect(docs[2]).toMatchObject({ state: 'action_needed', detail: { kind: 'expired', on: '2026-08-01' }, signable: false })
  })
})

describe('pay-run date math', () => {
  it('addDaysYmd crosses month boundaries', () => {
    expect(addDaysYmd('2026-08-30', 5)).toBe('2026-09-04')
    expect(addDaysYmd('2026-09-02', -90)).toBe('2026-06-04')
  })
  it('nextPayRunYmd lands on the next matching weekday (today counts)', () => {
    // 2026-09-02 is a Wednesday.
    expect(nextPayRunYmd('2026-09-02', 'friday')).toBe('2026-09-04')
    expect(nextPayRunYmd('2026-09-02', 'wednesday')).toBe('2026-09-02')
    expect(nextPayRunYmd('2026-09-02', 'Friday ')).toBe('2026-09-04')
    expect(nextPayRunYmd('2026-09-02', null)).toBeNull()
    expect(nextPayRunYmd('2026-09-02', 'someday')).toBeNull()
  })
})
