import { describe, expect, it } from 'vitest'
import { LIEN_JOB_PATH_COLUMN, LIEN_JOB_PATH_COLUMNS, jobOffLienPath, lienJobPathStanding, lienOffPathJobIds } from './lienJobPath'

describe('a job off the lien path for its own reason', () => {
  it('is off only when the job says off_path', () => {
    expect(jobOffLienPath({ lien_path_answer: 'off_path' })).toBe(true)
    expect(jobOffLienPath({ lien_path_answer: null })).toBe(false)
    expect(jobOffLienPath({ lien_path_answer: 'on_path' })).toBe(false)
    expect(jobOffLienPath({ lien_path_answer: true })).toBe(false)
  })

  it('keeps a job on the path when the row carries no answer, as before the migration', () => {
    expect(jobOffLienPath({})).toBe(false)
    expect(jobOffLienPath(null)).toBe(false)
    expect(jobOffLienPath(undefined)).toBe(false)
  })

  it('lists the jobs that are off, by id', () => {
    const ids = lienOffPathJobIds([
      { id: 'a', lien_path_answer: 'off_path' },
      { id: 'b', lien_path_answer: null },
      { id: 'c' },
      { id: 'd', lien_path_answer: 'off_path' },
    ])
    expect([...ids].sort()).toEqual(['a', 'd'])
  })

  it('reads who, when and why beside the answer, trimmed', () => {
    expect(lienJobPathStanding({ lien_path_answer: 'off_path', lien_path_reason: '  The bill is for trips, not for work.  ', lien_path_answered_at: '2026-11-16T21:00:00Z', lien_path_answered_by: 'u1' })).toEqual({
      off: true,
      reason: 'The bill is for trips, not for work.',
      at: '2026-11-16T21:00:00Z',
      by: 'u1',
    })
  })

  it('keeps who put a job back, when and why after it is back on the path', () => {
    expect(lienJobPathStanding({ lien_path_answer: null, lien_path_reason: 'Counsel says the claim stands.', lien_path_answered_at: '2026-11-20T15:00:00Z', lien_path_answered_by: 'u2' })).toEqual({
      off: false,
      reason: 'Counsel says the claim stands.',
      at: '2026-11-20T15:00:00Z',
      by: 'u2',
    })
  })

  it('reads a job nobody ever changed as on the path with nothing beside it', () => {
    expect(lienJobPathStanding({})).toEqual({ off: false, reason: '', at: null, by: null })
    expect(lienJobPathStanding(null)).toEqual({ off: false, reason: '', at: null, by: null })
  })

  it('names the column the rule reads inside the columns a screen shows', () => {
    expect(LIEN_JOB_PATH_COLUMNS.split(', ')).toContain(LIEN_JOB_PATH_COLUMN)
    expect(LIEN_JOB_PATH_COLUMNS.split(', ')).toHaveLength(4)
  })
})
