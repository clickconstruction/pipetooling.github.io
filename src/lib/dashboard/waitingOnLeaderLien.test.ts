import { describe, expect, it } from 'vitest'
import type { LienDeskEntry } from '../jobs/lienDesk'
import { waitingOnLeaderLien, type WaitingOnLeaderDesk } from './waitingOnLeaderLien'

const entry = (over: Record<string, unknown>): LienDeskEntry => ({ jobId: 'j1', gcCustomerId: 'g1', earliestDeadline: '2026-11-20', item: { id: 'i1', submitted_at: '2026-11-13T15:00:00Z', fields: {} }, ...over }) as unknown as LienDeskEntry

const desk = (awaiting: LienDeskEntry[], ready: LienDeskEntry[]): WaitingOnLeaderDesk => ({
  queue: { piles: { awaiting, ready } },
  jobsById: { j1: { hcp_number: '650', click_number: null, job_name: 'Alder Creek Lofts' }, j2: { hcp_number: '702', click_number: null, job_name: '' } },
  gcsById: { g1: { name: 'Calloway Construction' } },
})

describe('waitingOnLeaderLien', () => {
  it('is null until the desk is read', () => {
    expect(waitingOnLeaderLien(null)).toBeNull()
    expect(waitingOnLeaderLien(undefined)).toBeNull()
  })

  it('takes every awaiting notice with its job, its day and the day it was sent for approval', () => {
    const lien = waitingOnLeaderLien(desk([entry({}), entry({ jobId: 'j2', item: { id: 'i2', submitted_at: null, fields: {} }, earliestDeadline: null })], []))!
    expect(lien.approve).toHaveLength(2)
    expect(lien.approve[0]).toMatchObject({ itemId: 'i1', dueYmd: '2026-11-20', askedYmd: '2026-11-13', runGc: null })
    expect(lien.approve[0]!.label).toContain('Alder Creek Lofts')
    expect(lien.approve[1]).toMatchObject({ itemId: 'i2', dueYmd: null, askedYmd: null })
    expect(lien.sign).toEqual([])
  })

  it('names the GC of a notice the office prepared in a run', () => {
    const lien = waitingOnLeaderLien(desk([entry({ item: { id: 'i1', submitted_at: null, fields: { notice: {}, batchReason: 'first notice we have sent this GC' } } })], []))!
    expect(lien.approve[0]!.runGc).toBe('Calloway Construction')
  })

  it('a job the desk does not hold keeps a short id for a label', () => {
    const lien = waitingOnLeaderLien(desk([entry({ jobId: 'abcdef1234567890' })], []))!
    expect(lien.approve[0]!.label).toBe('abcdef12')
  })

  it('counts an approved notice to sign only while no signature is on it', () => {
    const unsigned = entry({ item: { id: 'i5', submitted_at: null, fields: {} } })
    const noItem = entry({ jobId: 'j2', item: null })
    const lien = waitingOnLeaderLien(desk([], [unsigned, noItem]))!
    expect(lien.sign.map((p) => p.itemId)).toEqual(['i5'])
  })
})
