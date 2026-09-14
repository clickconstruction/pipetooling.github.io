import { describe, expect, it } from 'vitest'
import { crewOnPin, crewPopupLine, jobsMapCrewLine, readJobsMapCrewsOn, summarizeCrewSessions, writeJobsMapCrewsOn } from './jobsMapCrewDay'

const day = summarizeCrewSessions('2026-06-15', [
  { user_id: 'u1', job_ledger_id: 'jA' },
  { user_id: 'u2', job_ledger_id: 'jA' },
  { user_id: 'u1', job_ledger_id: 'jB' },
  { user_id: 'u3', job_ledger_id: 'jC' },
  { user_id: 'u4', job_ledger_id: null },
  { user_id: null, job_ledger_id: 'jA' },
])

describe('summarizeCrewSessions', () => {
  it('counts distinct people per job and once overall; sessions with no job or no person are ignored', () => {
    expect(day.peopleByJob.get('jA')?.size).toBe(2)
    expect(day.peopleByJob.get('jB')?.size).toBe(1)
    expect(day.peopleByJob.has('jD')).toBe(false)
    expect(day.peopleCount).toBe(3)
    expect(crewOnPin(day, { id: 'jA' })).toBe(2)
    expect(crewOnPin(day, { id: 'jZ' })).toBe(0)
    expect(crewOnPin(null, { id: 'jA' })).toBe(0)
  })
})

describe('the lines', () => {
  it('the rail line counts people and jobs over the pins shown, and says when nobody was out', () => {
    expect(jobsMapCrewLine(day, [{ id: 'jA' }, { id: 'jB' }, { id: 'jZ' }], 'on Mon Jun 15')).toBe('Crews on Mon Jun 15: 2 people on 2 jobs')
    expect(jobsMapCrewLine(day, [{ id: 'jC' }], 'today')).toBe('Crews today: 1 person on 1 job')
    expect(jobsMapCrewLine(day, [{ id: 'jZ' }], 'today')).toBe('Crews today: nobody clocked in on these jobs')
    expect(jobsMapCrewLine(null, [{ id: 'jA' }], 'today')).toBeNull()
  })

  it('the popup line', () => {
    expect(crewPopupLine(0, true)).toBeNull()
    expect(crewPopupLine(1, true)).toBe('1 person clocked in here today')
    expect(crewPopupLine(3, false)).toBe('3 people clocked in here that day')
  })

  it('the preference round-trips and survives a blocked store', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) }
    expect(readJobsMapCrewsOn(storage)).toBe(false)
    writeJobsMapCrewsOn(true, storage)
    expect(readJobsMapCrewsOn(storage)).toBe(true)
    writeJobsMapCrewsOn(false, storage)
    expect(readJobsMapCrewsOn(storage)).toBe(false)
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => {} }
    expect(readJobsMapCrewsOn(broken)).toBe(false)
    expect(() => writeJobsMapCrewsOn(true, broken)).not.toThrow()
  })
})
