import { describe, expect, it } from 'vitest'
import { DESK_PICK_EVERY_JOB, DESK_PICK_ON_DESK, deskPickOptions, deskPickRows, deskPickSearchWords } from './deskJobPick'

const j = (id: string, n: string, name: string, address: string | null = null) => ({ id, hcp_number: n, click_number: null, job_name: name, customer_name: null, job_address: address })

describe('the Materials desk’s Open a job pick', () => {
  it('a row’s search words are the number, the name and the address', () => {
    expect(deskPickSearchWords(j('a', '224', 'Materials: Phase 2 draws', 'Gun Dog Trail, Neeses, SC'))).toBe('224 · Materials: Phase 2 draws · Gun Dog Trail, Neeses, SC')
    expect(deskPickSearchWords(j('a', '224', 'Materials: Phase 2 draws'))).toBe('224 · Materials: Phase 2 draws')
  })

  it('the jobs with a box come first in the desk’s order, then the rest, nothing twice', () => {
    const jobs = [j('x', '972', 'Tovi'), j('a', '224', 'Draws'), j('b', '1091', 'Lift stations'), j('y', '97', 'Diagnostic')]
    const { onDesk, rest } = deskPickRows(jobs, ['b', 'a', 'gone'])
    expect(onDesk.map((r) => r.id)).toEqual(['b', 'a'])
    expect(rest.map((r) => r.id)).toEqual(['x', 'y'])
  })

  it('draws a heading over each group and none over an empty one', () => {
    const jobs = [j('x', '972', 'Tovi'), j('a', '224', 'Draws')]
    const both = deskPickOptions(jobs, ['a'])
    expect(both.map((o) => ('kind' in o ? `— ${o.label}` : o.value))).toEqual([`— ${DESK_PICK_ON_DESK}`, 'a', `— ${DESK_PICK_EVERY_JOB}`, 'x'])
    const none = deskPickOptions(jobs, [])
    expect(none.map((o) => ('kind' in o ? `— ${o.label}` : o.value))).toEqual(['— Every job', 'x', 'a'])
  })
})
