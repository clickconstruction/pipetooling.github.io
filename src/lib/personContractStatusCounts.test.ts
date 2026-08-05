import { describe, expect, it } from 'vitest'
import { countPersonContractStatuses } from './personContractStatusCounts'

const row = (status: string | null) => ({ version: status == null ? null : { status } })

describe('countPersonContractStatuses', () => {
  it('counts by status with placeholders as unsent', () => {
    expect(
      countPersonContractStatuses([row('signed'), row('signed'), row('sent'), row('unsent'), row(null)]),
    ).toEqual({ unsent: 2, sent: 1, signed: 2 })
  })

  it('treats unknown statuses as unsent (matches the aggregate dot)', () => {
    expect(countPersonContractStatuses([row('weird')])).toEqual({ unsent: 1, sent: 0, signed: 0 })
  })

  it('returns zeros for no documents', () => {
    expect(countPersonContractStatuses([])).toEqual({ unsent: 0, sent: 0, signed: 0 })
  })
})
