import { describe, expect, it } from 'vitest'
import {
  resolveCustomerIdForJobPayload,
  resolveGcCustomerIdForJobPayload,
  type JobPayloadCustomerRow,
} from './jobLedgerCustomer'

const MASTER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const MASTER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

function cust(id: string, master: string, name: string): JobPayloadCustomerRow {
  return { id, master_user_id: master, name }
}

describe('resolveCustomerIdForJobPayload (one company, v2.2972)', () => {
  it('keeps an explicit id', () => {
    const customers = [cust('c1', MASTER_A, 'Acme')]
    expect(resolveCustomerIdForJobPayload('c1', MASTER_A, 'Acme', customers)).toBe('c1')
  })

  it('trusts an explicit id that is not present in the supplied list', () => {
    expect(resolveCustomerIdForJobPayload('c-unknown', MASTER_A, 'Acme', [])).toBe('c-unknown')
  })

  it('keeps an explicit id filed under another account — ownership is no longer a wall', () => {
    const customers = [cust('c-b', MASTER_B, 'Acme'), cust('c-a', MASTER_A, 'Acme')]
    expect(resolveCustomerIdForJobPayload('c-b', MASTER_A, 'Acme', customers)).toBe('c-b')
  })

  it('resolves by name across every account when no explicit id is given', () => {
    const customers = [cust('c-b', MASTER_B, 'Acme'), cust('c-x', MASTER_A, 'Other')]
    expect(resolveCustomerIdForJobPayload(null, MASTER_A, 'acme', customers)).toBe('c-b')
  })

  it('an ambiguous name match resolves to null', () => {
    const customers = [cust('c-b', MASTER_B, 'Acme'), cust('c-a', MASTER_A, 'Acme')]
    expect(resolveCustomerIdForJobPayload(null, MASTER_A, 'Acme', customers)).toBeNull()
  })

  it('blank name with no explicit id is null', () => {
    expect(resolveCustomerIdForJobPayload(null, MASTER_A, '   ', [cust('c1', MASTER_A, 'Acme')])).toBeNull()
  })
})

describe('resolveGcCustomerIdForJobPayload (one company, v2.2972)', () => {
  it('keeps a pick, whichever account filed the customer', () => {
    const customers = [cust('gc-b', MASTER_B, 'Knight Contracting'), cust('gc-a', MASTER_A, 'Knight Contracting')]
    expect(resolveGcCustomerIdForJobPayload('gc-b', MASTER_A, customers)).toBe('gc-b')
  })

  it('trusts a pick not present in the supplied list', () => {
    expect(resolveGcCustomerIdForJobPayload('gc-unknown', MASTER_A, [])).toBe('gc-unknown')
  })

  it('null in, null out', () => {
    expect(resolveGcCustomerIdForJobPayload(null, MASTER_A, [])).toBeNull()
  })
})
