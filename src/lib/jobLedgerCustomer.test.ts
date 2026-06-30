import { describe, expect, it } from 'vitest'
import { resolveCustomerIdForJobPayload, type JobPayloadCustomerRow } from './jobLedgerCustomer'

const MASTER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const MASTER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

function cust(id: string, master: string, name: string): JobPayloadCustomerRow {
  return { id, master_user_id: master, name }
}

describe('resolveCustomerIdForJobPayload', () => {
  it('keeps an explicit id that belongs to the job master', () => {
    const customers = [cust('c1', MASTER_A, 'Acme')]
    expect(resolveCustomerIdForJobPayload('c1', MASTER_A, 'Acme', customers)).toBe('c1')
  })

  it('trusts an explicit id that is not present in the supplied list', () => {
    expect(resolveCustomerIdForJobPayload('c-unknown', MASTER_A, 'Acme', [])).toBe('c-unknown')
  })

  it('drops a cross-master explicit id and re-points to the same-name customer under the job master', () => {
    // Picked customer is owned by master B, but the job master is now A (e.g. project link moved it).
    const customers = [cust('c-b', MASTER_B, 'Acme'), cust('c-a', MASTER_A, 'Acme')]
    expect(resolveCustomerIdForJobPayload('c-b', MASTER_A, 'Acme', customers)).toBe('c-a')
  })

  it('clears a cross-master explicit id when no same-name customer exists under the job master', () => {
    const customers = [cust('c-b', MASTER_B, 'Acme')]
    expect(resolveCustomerIdForJobPayload('c-b', MASTER_A, 'Acme', customers)).toBeNull()
  })

  it('clears a cross-master explicit id when the same-name match under the job master is ambiguous', () => {
    const customers = [
      cust('c-b', MASTER_B, 'Acme'),
      cust('c-a1', MASTER_A, 'Acme'),
      cust('c-a2', MASTER_A, 'acme'),
    ]
    expect(resolveCustomerIdForJobPayload('c-b', MASTER_A, 'Acme', customers)).toBeNull()
  })

  it('resolves by name under the job master when no explicit id is given', () => {
    const customers = [cust('c-a', MASTER_A, 'Acme'), cust('c-b', MASTER_B, 'Acme')]
    expect(resolveCustomerIdForJobPayload(null, MASTER_A, 'acme', customers)).toBe('c-a')
  })

  it('returns null for an ambiguous name match', () => {
    const customers = [cust('c1', MASTER_A, 'Acme'), cust('c2', MASTER_A, 'acme')]
    expect(resolveCustomerIdForJobPayload(null, MASTER_A, 'Acme', customers)).toBeNull()
  })

  it('returns null when no name is supplied and there is no explicit id', () => {
    expect(resolveCustomerIdForJobPayload(null, MASTER_A, '   ', [])).toBeNull()
  })
})
