import { describe, expect, it } from 'vitest'

import { pickMasterTechRecipients } from './packageSendMasterTechRecipients'
import type { EstimatorUser } from '../types/bidWithBuilder'

function u(over: Partial<EstimatorUser> & { id: string }): EstimatorUser {
  return {
    id: over.id,
    name: over.name ?? null,
    email: over.email ?? '',
    role: over.role ?? null,
  }
}

describe('pickMasterTechRecipients', () => {
  it('returns empty when the roster has no master technicians', () => {
    const roster: EstimatorUser[] = [
      u({ id: 'a', name: 'Alice', email: 'a@x.com', role: 'estimator' }),
      u({ id: 'b', name: 'Bob', email: 'b@x.com', role: 'dev' }),
    ]
    expect(pickMasterTechRecipients(roster)).toEqual([])
  })

  it('returns the lone master technician', () => {
    const roster: EstimatorUser[] = [
      u({ id: 'a', name: 'Alice', email: 'a@x.com', role: 'estimator' }),
      u({ id: 'm', name: 'Mona', email: 'm@x.com', role: 'master_technician' }),
    ]
    const out = pickMasterTechRecipients(roster)
    expect(out).toHaveLength(1)
    expect(out[0]?.id).toBe('m')
  })

  it('sorts multiple master technicians by name asc case-insensitive', () => {
    const roster: EstimatorUser[] = [
      u({ id: 'z', name: 'Zane', email: 'z@x.com', role: 'master_technician' }),
      u({ id: 'a', name: 'alice', email: 'a@x.com', role: 'master_technician' }),
      u({ id: 'm', name: 'Mona', email: 'm@x.com', role: 'master_technician' }),
    ]
    expect(pickMasterTechRecipients(roster).map((r) => r.id)).toEqual(['a', 'm', 'z'])
  })

  it('excludes master technicians without an email', () => {
    const roster: EstimatorUser[] = [
      u({ id: 'm1', name: 'Mona', email: '', role: 'master_technician' }),
      u({ id: 'm2', name: 'Max', email: '   ', role: 'master_technician' }),
      u({ id: 'm3', name: 'Mel', email: 'mel@x.com', role: 'master_technician' }),
    ]
    expect(pickMasterTechRecipients(roster).map((r) => r.id)).toEqual(['m3'])
  })

  it('treats null/undefined role as not a master technician', () => {
    const roster: EstimatorUser[] = [
      u({ id: 'n', name: 'Nick', email: 'n@x.com', role: null }),
      { id: 'u', name: 'Una', email: 'u@x.com' }, // no role field at all
    ]
    expect(pickMasterTechRecipients(roster)).toEqual([])
  })

  it('tiebreaks identical names deterministically by id asc', () => {
    const roster: EstimatorUser[] = [
      u({ id: 'b', name: 'Pat', email: 'b@x.com', role: 'master_technician' }),
      u({ id: 'a', name: 'Pat', email: 'a@x.com', role: 'master_technician' }),
    ]
    expect(pickMasterTechRecipients(roster).map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('drops entries with empty id', () => {
    const roster: EstimatorUser[] = [
      u({ id: '', name: 'Ghost', email: 'g@x.com', role: 'master_technician' }),
      u({ id: 'real', name: 'Real', email: 'r@x.com', role: 'master_technician' }),
    ]
    expect(pickMasterTechRecipients(roster).map((r) => r.id)).toEqual(['real'])
  })
})
