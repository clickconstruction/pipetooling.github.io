import { describe, expect, it } from 'vitest'
import { LIEN_IN_KIND_COLUMN, LIEN_IN_KIND_WINDOW_NOTE, jobOffLienDeskInKind, lienInKindJobIds, lienInKindWindowNote, jobOffLienDesk, lienJobIdsOffDesk, lienOffDeskJobIds, withLienOffDeskColumns } from './lienInKind'
import { plainWordsFailures } from '../plainWords'

const job = (id: string, deal: string | null = null) => ({ id, in_kind_arrangement_id: deal })

describe('lienInKind (v2.7253: paid in kind is paid, as far as the Lien desk goes)', () => {
  it('a job an open deal pays is off the desk; a job with no link, or no job at all, is not', () => {
    expect(jobOffLienDeskInKind(job('a', 'deal-1'))).toBe(true)
    expect(jobOffLienDeskInKind(job('a'))).toBe(false)
    expect(jobOffLienDeskInKind({})).toBe(false)
    expect(jobOffLienDeskInKind(null)).toBe(false)
    expect(jobOffLienDeskInKind(undefined)).toBe(false)
  })

  it('ending the deal clears the link on its jobs, and the job is back with no extra step', () => {
    const before = [job('a', 'deal-1'), job('b', 'deal-1'), job('c')]
    expect([...lienInKindJobIds(before)].sort()).toEqual(['a', 'b'])
    // What the trigger in_kind_arrangements_end_releases_jobs leaves: the same rows with the link null.
    const after = before.map((j) => ({ ...j, in_kind_arrangement_id: null }))
    expect(lienInKindJobIds(after).size).toBe(0)
    expect(lienJobIdsOffDesk(after, null)).toBeNull()
  })

  it('a desk read drops the deal’s jobs with the hidden ZZ test jobs, and nothing when there are neither', () => {
    const jobs = [job('a', 'deal-1'), job('b'), job('z')]
    expect(lienJobIdsOffDesk([job('b')], null)).toBeNull()
    expect([...lienJobIdsOffDesk(jobs, null)!]).toEqual(['a'])
    expect([...lienJobIdsOffDesk(jobs, new Set(['z']))!].sort()).toEqual(['a', 'z'])
    expect([...lienJobIdsOffDesk([job('b'), job('z')], new Set(['z']))!]).toEqual(['z'])
  })

  it('never changes the caller’s own set of ZZ jobs', () => {
    const zz = new Set(['z'])
    lienJobIdsOffDesk([job('a', 'deal-1')], zz)
    expect([...zz]).toEqual(['z'])
  })

  it('a read of the desk’s jobs names the link through the kernel', () => {
    expect(LIEN_IN_KIND_COLUMN).toBe('in_kind_arrangement_id')
    expect(withLienOffDeskColumns('id, status')).toBe('id, status, in_kind_arrangement_id, lien_path_answer')
  })

  it('the job’s own Lien window says so in plain words, and only on such a job', () => {
    expect(lienInKindWindowNote(job('a'))).toBeNull()
    expect(lienInKindWindowNote(job('a', 'deal-1'))).toBe(LIEN_IN_KIND_WINDOW_NOTE)
    expect(LIEN_IN_KIND_WINDOW_NOTE.line).toContain('off the Lien desk')
    expect(LIEN_IN_KIND_WINDOW_NOTE.line).toContain('They still run')
    expect(plainWordsFailures(LIEN_IN_KIND_WINDOW_NOTE.line)).toEqual([])
  })

  it('leaves off a job a person took off the lien path, by the same door (v2.7521)', () => {
    expect(jobOffLienDesk({ lien_path_answer: 'off_path' })).toBe(true)
    expect(jobOffLienDesk({ in_kind_arrangement_id: 'deal-1' })).toBe(true)
    expect(jobOffLienDesk({ lien_path_answer: null, in_kind_arrangement_id: null })).toBe(false)
    expect(jobOffLienDesk({})).toBe(false)
    expect(jobOffLienDesk(null)).toBe(false)
    const jobs = [{ id: 'a', lien_path_answer: 'off_path' }, { id: 'b', in_kind_arrangement_id: 'deal-1' }, { id: 'c' }, { id: 'zz' }]
    expect([...lienOffDeskJobIds(jobs)].sort()).toEqual(['a', 'b'])
    expect([...(lienJobIdsOffDesk(jobs, new Set(['zz'])) ?? [])].sort()).toEqual(['a', 'b', 'zz'])
    expect(lienJobIdsOffDesk([{ id: 'c' }], null)).toBeNull()
    // A job put back carries no answer and is on the desk on the next read.
    expect(lienJobIdsOffDesk([{ id: 'a', lien_path_answer: null }], null)).toBeNull()
  })
})
