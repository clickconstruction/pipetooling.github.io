import { describe, expect, it } from 'vitest'
import {
  arRecordedPaymentAmountStr,
  arRecordedPaymentJobNumber,
  arRecordedPaymentMatchesForQuery,
  arRecordedPaymentOptions,
  arRecordedPaymentSearchLabel,
  type ArRecordedPaymentCandidate,
} from './arRecordedPaymentTargets'

function cand(overrides: Partial<ArRecordedPaymentCandidate> = {}): ArRecordedPaymentCandidate {
  return {
    payment_id: 'p1',
    job_id: 'j1',
    amount: 2500,
    paid_on: '2026-07-22',
    note: 'chk 1042',
    payment_type: 'check',
    reference_number: null,
    invoice_id: null,
    hcp_number: '941',
    click_number: null,
    job_name: 'Berg AirBnb',
    ...overrides,
  }
}

describe('arRecordedPaymentJobNumber', () => {
  it('prefers HCP over Click (same precedence as effectiveJobLedgerNumber)', () => {
    expect(arRecordedPaymentJobNumber({ hcp_number: '941', click_number: 'C-7' })).toBe('941')
    expect(arRecordedPaymentJobNumber({ hcp_number: '  ', click_number: 'C-7' })).toBe('C-7')
    expect(arRecordedPaymentJobNumber({ hcp_number: null, click_number: null })).toBe('')
  })
})

describe('arRecordedPaymentSearchLabel', () => {
  it('builds the full one-liner', () => {
    expect(arRecordedPaymentSearchLabel(cand())).toBe('#941 Berg AirBnb — check $2,500.00 · 2026-07-22 · chk 1042')
  })

  it('falls back to reference number when note is empty and survives missing fields', () => {
    expect(
      arRecordedPaymentSearchLabel(
        cand({ note: '', reference_number: 'ref-9', payment_type: null, paid_on: null, job_name: '', hcp_number: null, click_number: 'C-12' }),
      ),
    ).toBe('#C-12 — $2,500.00 · ref-9')
  })
})

describe('arRecordedPaymentOptions', () => {
  it('excludes payments taken by other lines', () => {
    const rows = [cand(), cand({ payment_id: 'p2', hcp_number: '798' })]
    const opts = arRecordedPaymentOptions(rows, new Set(['p1']))
    expect(opts.map((o) => o.value)).toEqual(['p2'])
  })
})

describe('arRecordedPaymentAmountStr', () => {
  it('locks to the absolute row amount with two decimals', () => {
    expect(arRecordedPaymentAmountStr({ amount: 2500 })).toBe('2500.00')
    expect(arRecordedPaymentAmountStr({ amount: -1175.5 })).toBe('1175.50')
  })
})

describe('arRecordedPaymentMatchesForQuery (v2.2597 — billed-line dead-end steer)', () => {
  it('matches the same way SearchableSelect filters: case-insensitive substring on the label', () => {
    // Taunya's J989: Mark Paid recorded the check, the billed line has no
    // balance and vanished from the picker — but "989" matches the payment.
    const j989 = cand({
      payment_id: 'p989',
      hcp_number: '',
      click_number: '989',
      job_name: 'Montolongo- Pretest',
      amount: 250,
      payment_type: 'Check',
      note: null,
      reference_number: '3403',
    })
    const rows = [cand(), j989]
    expect(arRecordedPaymentMatchesForQuery(rows, new Set(), '989').map((c) => c.payment_id)).toEqual(['p989'])
    expect(arRecordedPaymentMatchesForQuery(rows, new Set(), 'montolongo').map((c) => c.payment_id)).toEqual(['p989'])
    expect(arRecordedPaymentMatchesForQuery(rows, new Set(), 'zzz')).toEqual([])
  })

  it('excludes payments taken by other lines and blank queries', () => {
    const rows = [cand(), cand({ payment_id: 'p2', hcp_number: '798' })]
    expect(arRecordedPaymentMatchesForQuery(rows, new Set(['p1']), '941')).toEqual([])
    expect(arRecordedPaymentMatchesForQuery(rows, new Set(), '   ')).toEqual([])
  })
})
