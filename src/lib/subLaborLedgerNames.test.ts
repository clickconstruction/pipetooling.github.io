import { describe, expect, it } from 'vitest'
import { buildLaborJobNamesById } from './subLaborLedgerNames'

describe('buildLaborJobNamesById', () => {
  it('keys job names by jobs_ledger id, trims names, skips empty names and ids', () => {
    const map = buildLaborJobNamesById([
      { id: 'j1', job_name: '  Reliant Health- HVAC ' },
      { id: 'j2', job_name: '   ' },
      { id: 'j3', job_name: null },
      { id: '', job_name: 'No id' },
    ])
    expect(map).toEqual({ j1: 'Reliant Health- HVAC' })
  })
  it('first row for a duplicate id wins', () => {
    const map = buildLaborJobNamesById([
      { id: 'j1', job_name: 'First' },
      { id: 'j1', job_name: 'Second' },
    ])
    expect(map.j1).toBe('First')
  })
})
