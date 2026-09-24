import { describe, expect, it } from 'vitest'
import { hasProspectsStaffAccess, shareableAccounts, sharedByLine, sharedColumnsLine, sharedWithChip, sharesForColumn, type ColumnShare } from './columnShares'

const names: Record<string, string> = { todd: 'Todd Kline', maria: 'Maria Lopez' }
const nameOf = (id: string) => names[id] ?? null

const shares: ColumnShare[] = [
  { role_id: 'plumber', user_id: 'maria', shared_by: 'todd', created_at: '2026-09-18T20:00:00Z' },
  { role_id: 'hvac', user_id: 'maria', shared_by: 'todd', created_at: '2026-09-20T15:00:00Z' },
  { role_id: 'hvac', user_id: 'jordan', shared_by: null, created_at: null },
]

describe('hasProspectsStaffAccess', () => {
  it('mirrors user_has_prospects_staff_access(): the four office roles, or an estimator with the flag', () => {
    expect(hasProspectsStaffAccess({ role: 'assistant' })).toBe(true)
    expect(hasProspectsStaffAccess({ role: 'controller' })).toBe(true)
    expect(hasProspectsStaffAccess({ role: 'estimator', estimator_prospects_access: true })).toBe(true)
    expect(hasProspectsStaffAccess({ role: 'estimator', estimator_prospects_access: false })).toBe(false)
    expect(hasProspectsStaffAccess({ role: 'helpers' })).toBe(false)
  })
})

describe('shareableAccounts', () => {
  it('lists prospects staff without the switch, sorted by name; never full holders, archived or sample accounts', () => {
    const list = shareableAccounts([
      { id: 'w', name: 'Wendi Park', role: 'estimator', estimator_prospects_access: true },
      { id: 'm', name: 'Maria Lopez', role: 'assistant' },
      { id: 'full', name: 'William Full', role: 'assistant', team_prospects_access: true },
      { id: 'gone', name: 'Gone Assistant', role: 'assistant', archived_at: '2026-01-01' },
      { id: 'sample', name: 'Sample Assistant', role: 'assistant', is_sample: true },
      { id: 'h', name: 'Bryan Helper', role: 'helpers' },
      { id: 'j', name: 'Jordan Reyes', role: 'controller' },
    ])
    expect(list.map((u) => u.id)).toEqual(['j', 'm', 'w'])
  })
})

describe('the chip and the lines', () => {
  it('counts the shares on one column', () => {
    expect(sharesForColumn(shares, 'hvac')).toHaveLength(2)
    expect(sharedWithChip(shares, 'hvac')).toBe('shared with 2')
    expect(sharedWithChip(shares, 'plumber')).toBe('shared with 1')
    expect(sharedWithChip(shares, 'office')).toBeNull()
  })

  it('says who shared and when, and degrades when either is unknown', () => {
    expect(sharedByLine(shares[0]!, nameOf)).toBe('shared by Todd Kline, Sep 18')
    expect(sharedByLine(shares[2]!, nameOf)).toBe('shared')
    expect(sharedByLine({ ...shares[0]!, shared_by: 'ghost' }, nameOf)).toBe('shared Sep 18')
  })

  it('writes the Active accounts line in board order with the latest share’s sharer and day', () => {
    const roles = [{ id: 'hvac', name: 'HVAC Tech' }, { id: 'plumber', name: 'Plumber' }, { id: 'office', name: 'Office Manager' }]
    expect(sharedColumnsLine('maria', shares, roles, nameOf)).toBe('HVAC Tech · Plumber — by Todd Kline, Sep 20')
    expect(sharedColumnsLine('jordan', shares, roles, nameOf)).toBe('HVAC Tech')
    expect(sharedColumnsLine('nobody', shares, roles, nameOf)).toBeNull()
  })

  it('counts a share on a column it cannot name', () => {
    expect(sharedColumnsLine('maria', shares, [{ id: 'plumber', name: 'Plumber' }], nameOf)).toBe('Plumber · 1 more — by Todd Kline, Sep 20')
  })
})
