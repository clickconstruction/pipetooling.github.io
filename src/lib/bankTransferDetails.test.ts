import { describe, expect, it } from 'vitest'
import {
  bankTransferDetailsComplete,
  bankTransferDetailsForPortal,
  bankTransferDetailsToRow,
  bankTransferGuardLine,
  buildBankTransferMemo,
  checkMailingSentence,
  groupDigits,
  parseBankTransferDetails,
  routingNumberProblem,
} from './bankTransferDetails'

const row = {
  payee_name: ' Sample Plumbing LLC ',
  bank_name: 'Sample Bank',
  bank_note: 'Your bank may show this name instead of ours.',
  routing_number: '0210 0002 1',
  account_number: '0000 1234 5678',
  account_kind: '',
  beneficiary_address: '1 Main St, Kyle, TX 78640',
  check_mailing_address: '12925 FM 20, Kingsbury, TX 78638',
  show_on_portal: true,
}

describe('parseBankTransferDetails', () => {
  it('trims strings, strips spaces from the numbers, defaults the kind', () => {
    const d = parseBankTransferDetails(row)!
    expect(d.payeeName).toBe('Sample Plumbing LLC')
    expect(d.routingNumber).toBe('021000021')
    expect(d.accountNumber).toBe('000012345678')
    expect(d.accountKind).toBe('Checking')
    expect(d.showOnPortal).toBe(true)
  })
  it('returns null for nothing, and reads show_on_portal false', () => {
    expect(parseBankTransferDetails(null)).toBeNull()
    expect(parseBankTransferDetails('x')).toBeNull()
    expect(parseBankTransferDetails({ ...row, show_on_portal: false })!.showOnPortal).toBe(false)
  })
  it('round-trips through the saved row', () => {
    const d = parseBankTransferDetails(row)!
    expect(bankTransferDetailsToRow(d)).toEqual({
      payee_name: 'Sample Plumbing LLC',
      bank_name: 'Sample Bank',
      bank_note: 'Your bank may show this name instead of ours.',
      routing_number: '021000021',
      account_number: '000012345678',
      account_kind: 'Checking',
      beneficiary_address: '1 Main St, Kyle, TX 78640',
      check_mailing_address: '12925 FM 20, Kingsbury, TX 78638',
      show_on_portal: true,
    })
  })
})

describe('routingNumberProblem', () => {
  it('accepts a valid ABA checksum and an empty field', () => {
    expect(routingNumberProblem('021000021')).toBeNull()
    expect(routingNumberProblem('')).toBeNull()
  })
  it('names the wrong length and a failed checksum', () => {
    expect(routingNumberProblem('12345')).toMatch(/nine digits/)
    expect(routingNumberProblem('021000022')).toMatch(/one digit is off/)
  })
})

describe('completeness and the portal gate', () => {
  it('transfer needs payee + routing + account; checks needs the address', () => {
    const d = parseBankTransferDetails(row)!
    expect(bankTransferDetailsComplete(d)).toEqual({ transfer: true, checks: true })
    expect(bankTransferDetailsComplete({ ...d, accountNumber: '' })).toEqual({ transfer: false, checks: true })
    expect(bankTransferDetailsComplete({ ...d, checkMailingAddress: '' })).toEqual({ transfer: true, checks: false })
    expect(bankTransferDetailsComplete(null)).toEqual({ transfer: false, checks: false })
  })
  it('the portal shows the record only when on and at least one half is complete', () => {
    const d = parseBankTransferDetails(row)!
    expect(bankTransferDetailsForPortal(d)).toBe(d)
    expect(bankTransferDetailsForPortal({ ...d, showOnPortal: false })).toBeNull()
    expect(bankTransferDetailsForPortal({ ...d, accountNumber: '', checkMailingAddress: '' })).toBeNull()
    expect(bankTransferDetailsForPortal({ ...d, accountNumber: '' })).not.toBeNull()
  })
})

describe('buildBankTransferMemo', () => {
  it('names the customer and the open jobs once each, tag from the first', () => {
    const bills = [
      { jobNumber: '1001', serviceTag: 'plum' },
      { jobNumber: '0994', serviceTag: 'plum' },
      { jobNumber: '1001', serviceTag: 'plum' },
      { jobNumber: '', serviceTag: 'elec' },
    ]
    expect(buildBankTransferMemo('Sam Sample', bills)).toBe('Sam Sample · PLUM 1001, 0994')
  })
  it('falls back to the name alone, or the jobs alone', () => {
    expect(buildBankTransferMemo('Sam Sample', [])).toBe('Sam Sample')
    expect(buildBankTransferMemo('', [{ jobNumber: '77', serviceTag: null }])).toBe('77')
  })
})

describe('sentences', () => {
  it('builds the checks line from the address, or nothing', () => {
    expect(checkMailingSentence(' 12925 FM 20, Kingsbury, TX 78638 ')).toBe(
      'All checks must be mailed to 12925 FM 20, Kingsbury, TX 78638. Checks sent anywhere else may need to be re-issued.',
    )
    expect(checkMailingSentence('')).toBeNull()
  })
  it('the guard line carries the phone when there is one', () => {
    expect(bankTransferGuardLine('(512) 360-0599')).toContain('call (512) 360-0599 before')
    expect(bankTransferGuardLine('')).toContain('call our office before')
  })
  it('groups ten-plus digit strings for the eye; nine-digit routing numbers and everything else stay whole', () => {
    expect(groupDigits('202511226605')).toBe('2025 1122 6605')
    expect(groupDigits('091311229')).toBe('091311229')
    expect(groupDigits('0000123456')).toBe('0000 1234 56')
    expect(groupDigits('12345')).toBe('12345')
    expect(groupDigits('AB-12')).toBe('AB-12')
  })
})
