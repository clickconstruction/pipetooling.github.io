import { describe, expect, it } from 'vitest'
import { accountsReceivableButtonName } from './stagesAccountsReceivableButton'

describe('accountsReceivableButtonName', () => {
  it('names the roles when the viewer cannot record payments, whatever is waiting', () => {
    expect(accountsReceivableButtonName({ canRecordPayments: false, unallocatedCount: 4, billedRowCount: 9 })).toBe(
      'Only dev, leader, assistant, and primary can record payments',
    )
  })

  it('counts unallocated bank transactions first, singular and plural', () => {
    expect(accountsReceivableButtonName({ canRecordPayments: true, unallocatedCount: 1, billedRowCount: 0 })).toBe(
      'Accounts Receivable, 1 unallocated bank transaction',
    )
    expect(accountsReceivableButtonName({ canRecordPayments: true, unallocatedCount: 3, billedRowCount: 9 })).toBe(
      'Accounts Receivable, 3 unallocated bank transactions',
    )
  })

  it('reads "No billed rows" only when nothing is unallocated and nothing is billed', () => {
    expect(accountsReceivableButtonName({ canRecordPayments: true, unallocatedCount: 0, billedRowCount: 0 })).toBe('No billed rows')
    expect(accountsReceivableButtonName({ canRecordPayments: true, unallocatedCount: null, billedRowCount: 0 })).toBe('No billed rows')
    expect(accountsReceivableButtonName({ canRecordPayments: true, unallocatedCount: undefined, billedRowCount: 0 })).toBe('No billed rows')
  })

  it('otherwise describes the door', () => {
    expect(accountsReceivableButtonName({ canRecordPayments: true, unallocatedCount: 0, billedRowCount: 2 })).toBe(
      'Accounts Receivable: apply bank deposits to billed lines (non-Stripe)',
    )
  })
})
