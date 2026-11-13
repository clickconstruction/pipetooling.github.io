import { describe, expect, it } from 'vitest'
import { lienDeskMoreButton, lienDeskMoreRows } from './lienDeskPhoneMore'

const office = { run: { label: 'Record the mailing', count: 4, hint: 'Type each envelope’s tracking number' }, gcNotice: false, legendLabel: 'What this desk holds', caller: true, share: true, ownerRecords: true }

describe('lienDeskMoreRows', () => {
  it('an office seat with a run waiting: the run first, then every door the header held', () => {
    const rows = lienDeskMoreRows(office)
    expect(rows.map((r) => r.key)).toEqual(['run', 'rules', 'caller', 'legend', 'share', 'owner_records'])
    expect(rows[0]).toMatchObject({ label: 'Record the mailing', count: 4, primary: true })
    expect(rows.filter((r) => r.primary)).toHaveLength(1)
  })

  it('the doors keep the names they have on a computer', () => {
    const byKey = Object.fromEntries(lienDeskMoreRows(office).map((r) => [r.key, r.label]))
    expect(byKey.rules).toBe('§ Rules')
    expect(byKey.caller).toBe('An owner is calling')
    expect(byKey.legend).toBe('What this desk holds')
    expect(byKey.share).toBe('Share where the liens stand')
    expect(byKey.owner_records).toBe('An owner asked for records')
  })

  it('on Notices, Put a GC on notice sits under the run and above the reading doors', () => {
    const rows = lienDeskMoreRows({ ...office, gcNotice: true })
    expect(rows.map((r) => r.key)).toEqual(['run', 'gc_notice', 'rules', 'caller', 'legend', 'share', 'owner_records'])
    expect(rows[1]!.label).toBe('Put a GC on notice…')
    expect(rows[1]!.primary).toBe(false)
  })

  it('no run waiting, or a count of zero: no run row and no filled press', () => {
    for (const run of [null, { label: 'Send the run', count: 0, hint: 'One packet' }]) {
      const rows = lienDeskMoreRows({ ...office, run })
      expect(rows.map((r) => r.key)).toEqual(['rules', 'caller', 'legend', 'share', 'owner_records'])
      expect(rows.some((r) => r.primary)).toBe(false)
    }
  })

  it('a leader who is not in the office reads the rules and the marks and can share', () => {
    const rows = lienDeskMoreRows({ ...office, run: null, caller: false, share: true, ownerRecords: false })
    expect(rows.map((r) => r.key)).toEqual(['rules', 'legend', 'share'])
  })

  it('before the desk has its data there is nothing to share', () => {
    expect(lienDeskMoreRows({ ...office, run: null, caller: false, share: false, ownerRecords: false }).map((r) => r.key)).toEqual(['rules', 'legend'])
  })

  it('every row has a name and a hint, and only the run has a count', () => {
    for (const r of lienDeskMoreRows(office)) {
      expect(r.label.length).toBeGreaterThan(0)
      expect(r.hint.length).toBeGreaterThan(0)
      expect(r.count != null).toBe(r.key === 'run')
    }
  })
})

describe('lienDeskMoreButton', () => {
  it('wears the run’s count and says it, so a waiting run is never out of sight', () => {
    expect(lienDeskMoreButton({ label: 'Record the mailing', count: 4 })).toEqual({ label: 'More · Record the mailing · 4', badge: 4 })
  })

  it('is plain when nothing waits', () => {
    expect(lienDeskMoreButton(null)).toEqual({ label: 'More', badge: null })
    expect(lienDeskMoreButton({ label: 'Send the run', count: 0 })).toEqual({ label: 'More', badge: null })
  })
})
