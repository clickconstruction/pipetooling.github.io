import { describe, expect, it } from 'vitest'
import { rosterForPick, rosterRoleLine } from './statementRoster'

describe('the roster for a statement (punch list #220, v2.6210)', () => {
  it('lists the RMPs first, then everyone by name, and leaves out a row with no name', () => {
    const picks = rosterForPick([
      { id: 'g', name: 'Grace Lee', role: 'assistant', title: 'Office manager' },
      { id: 'n', name: null, role: 'helpers' },
      { id: 'd', name: 'Daniel Alvarez', role: 'master_technician' },
      { id: 'r', name: 'R. Ortiz', role: 'helpers', title: '' },
      { id: 'a', name: 'Abe Click', role: 'master_technician' },
    ])
    expect(picks.map((p) => p.id)).toEqual(['a', 'd', 'g', 'r'])
  })
  it('gives a leader the RMP line and everyone else their title or role', () => {
    expect(rosterRoleLine({ role: 'master_technician' })).toBe('Responsible Master Plumber of record for Click Plumbing and Electrical')
    expect(rosterRoleLine({ role: 'assistant', title: 'Office manager' })).toBe('Office manager at Click Plumbing and Electrical')
    expect(rosterRoleLine({ role: 'helpers', title: '  ' })).toBe('Helper at Click Plumbing and Electrical')
    expect(rosterRoleLine({ role: null })).toBe('— at Click Plumbing and Electrical')
  })
})
