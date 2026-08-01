import { describe, expect, it } from 'vitest'
import {
  arRecordedPaymentAmountStr,
  arRecordedPaymentJobNumber,
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
