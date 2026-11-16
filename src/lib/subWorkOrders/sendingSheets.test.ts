import { describe, expect, it } from 'vitest'
import type { LaborJob } from '../../types/laborJob'
import type { NeedsWorkOrderRosterPerson } from './rosterSub'
import { sendingSheetsFrom } from './sendingSheets'

// Made-up people and sheets.
const ROSTER: NeedsWorkOrderRosterPerson[] = [
  { id: 'marlow', name: 'Marlow Tile', kind: 'sub', accountRole: 'subcontractor' },
  { id: 'dana', name: 'Dana Whitlock', kind: 'sub', accountRole: 'superintendent' },
  { id: 'owen', name: 'Owen Farris', kind: 'helper', accountRole: 'helpers' },
]
const sheet = (id: string, names: string, amount: number): LaborJob =>
  ({ id, assigned_to_name: names, job_number: '2041', job_ledger_id: null, address: '418 Larkspur Ln', labor_rate: null, job_date: '2026-11-13', created_at: '2026-11-13T15:00:00Z', items: [{ fixture: 'Flat amount', count: 1, hrs_per_unit: 0, direct_labor_amount: amount }], payments: [] }) as unknown as LaborJob

const SHEETS = [sheet('sub', 'Marlow Tile', 900), sheet('own', 'Dana Whitlock', 450), sheet('mixed', 'Marlow Tile | Dana Whitlock', 300), sheet('two', 'Dana Whitlock | Owen Farris', 200)]
const keys = (rule?: 'owed' | 'payroll') => Object.fromEntries(sendingSheetsFrom(SHEETS, new Map(), {}, ROSTER, rule).map((s) => [s.id, s.key]))

describe('sendingSheetsFrom — whose sheets share a sending', () => {
  it("a teammate's own sheet is theirs, so their sheets share a sending and can hold a credit", () => {
    expect(keys()).toMatchObject({ sub: 'id:marlow', own: 'id:dana', mixed: 'id:marlow' })
  })
  it('a sheet several teammates share keeps a key of its own, apart from either person', () => {
    const k = keys().two
    expect(k).not.toBe('')
    expect(k).not.toBe('id:dana')
  })
  it('the old rule gave a sheet with no sub no key at all', () => {
    expect(keys('payroll')).toMatchObject({ sub: 'id:marlow', own: '', two: '' })
  })
  it('carries what is still open and the day', () => {
    expect(sendingSheetsFrom(SHEETS, new Map(), {}, ROSTER)[1]).toMatchObject({ id: 'own', remaining: 450, day: '2026-11-13' })
  })
})
