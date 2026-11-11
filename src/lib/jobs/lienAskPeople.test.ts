import { describe, expect, it } from 'vitest'
import { lienAskDev, lienAskFor, type LienAskUser } from './lienAskPeople'

// Every name and number here is made up.
const users: LienAskUser[] = [
  { id: 'm1', name: 'Pat Sample', phone: '555-0100', role: 'master_technician' },
  { id: 'm2', name: 'Lee Sample', phone: null, role: 'master_technician' },
  { id: 'd2', name: 'Zed Sample', phone: '555-0199', role: 'dev' },
  { id: 'd1', name: 'Ada Sample', phone: '', role: 'dev' },
  { id: 'a1', name: 'Office Sample', phone: '555-0111', role: 'assistant' },
]

describe('who a lien help sheet says to ask (punch list #314, change 9)', () => {
  it('names the job’s lien leader, then the dev', () => {
    expect(lienAskFor(users, 'm1')).toBe('Not sure? Ask Pat Sample, 555-0100, or Zed Sample, 555-0199.')
    expect(lienAskFor(users, 'm2')).toBe('Not sure? Ask Lee Sample, or Zed Sample, 555-0199.')
  })
  it('the dev is one person: the first by name with a phone, else the first by name', () => {
    expect(lienAskDev(users)).toEqual({ name: 'Zed Sample', phone: '555-0199' })
    expect(lienAskDev(users.filter((u) => u.id !== 'd2'))).toEqual({ name: 'Ada Sample', phone: null })
    expect(lienAskDev(users.filter((u) => u.role !== 'dev'))).toBeNull()
  })
  it('a job with no leader on record names the dev alone, a dev who leads the job is named once, and nobody known prints nothing', () => {
    expect(lienAskFor(users, null)).toBe('Not sure? Ask Zed Sample, 555-0199.')
    expect(lienAskFor(users, 'gone')).toBe('Not sure? Ask Zed Sample, 555-0199.')
    expect(lienAskFor(users, 'd2')).toBe('Not sure? Ask Zed Sample, 555-0199.')
    expect(lienAskFor([], 'm1')).toBe('')
  })
})
