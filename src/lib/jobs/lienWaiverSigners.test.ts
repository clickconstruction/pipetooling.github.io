import { describe, expect, it } from 'vitest'
import { LIEN_WAIVER_SIGNER_ROLES, lienWaiverSignerChoices, lienWaiverSignerName } from './lienWaiverSigners'

const malachi = { id: 'm1', name: 'Malachi W', notes: 'Malachi Whites, Master Plumber', role: 'master_technician', archived_at: null }
const sample = { id: 'm2', name: 'Sample leader', notes: null, role: 'master_technician', archived_at: null }
const robert = { id: 'd1', name: 'Robert', notes: 'PLUM APP: 184614 02/28/27 | A/C TEC: 160601 02/19/27', role: 'dev', archived_at: null }
const test = { id: 'd2', name: 'test', notes: '', role: 'dev', archived_at: null }
const gone = { id: 'm3', name: 'Old leader', notes: null, role: 'master_technician', archived_at: '2026-01-01' }

describe('who a waiver’s Who signs pick offers (v2.5231)', () => {
  it('offers leaders and devs', () => {
    expect([...LIEN_WAIVER_SIGNER_ROLES]).toEqual(['master_technician', 'dev'])
  })

  it('names a leader by his notes before the comma and a dev by his name, never his notes', () => {
    expect(lienWaiverSignerName(malachi)).toBe('Malachi Whites')
    expect(lienWaiverSignerName(sample)).toBe('Sample leader')
    expect(lienWaiverSignerName(robert)).toBe('Robert')
    expect(lienWaiverSignerName({ name: ' ', notes: 'x', role: 'dev' })).toBe('the dev')
    expect(lienWaiverSignerName({ name: null, notes: null, role: 'master_technician' })).toBe('the leader')
  })

  it('the job’s leader first, then the leaders, then the devs, each by name; the archived left out', () => {
    expect(lienWaiverSignerChoices([test, robert, sample, gone, malachi], 'm2').map((s) => s.name)).toEqual(['Sample leader', 'Malachi Whites', 'Robert', 'test'])
    expect(lienWaiverSignerChoices([test, robert, sample, malachi], null).map((s) => s.name)).toEqual(['Malachi Whites', 'Sample leader', 'Robert', 'test'])
    // A dev who is the job's leader comes first too.
    expect(lienWaiverSignerChoices([malachi, robert], 'd1').map((s) => s.id)).toEqual(['d1', 'm1'])
  })
})
