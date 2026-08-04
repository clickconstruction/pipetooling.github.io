import { describe, expect, it } from 'vitest'
import { workingBoardBidsSignature } from './bidWorkingBoardColumnMap'

const bid = (id: string, project_name: string | null, estimator_id: string | null = 'u1') => ({
  id,
  project_name,
  estimator_id,
  account_manager_id: null as string | null,
})

describe('workingBoardBidsSignature', () => {
  it('is stable across array identity and order changes', () => {
    const a = [bid('b1', 'Alpha'), bid('b2', 'Beta')]
    const b = [bid('b2', 'Beta'), bid('b1', 'Alpha')]
    expect(workingBoardBidsSignature(a)).toBe(workingBoardBidsSignature(b))
    expect(workingBoardBidsSignature(a)).toBe(workingBoardBidsSignature([...a].map((x) => ({ ...x }))))
  })

  it('changes when membership changes', () => {
    const base = [bid('b1', 'Alpha'), bid('b2', 'Beta')]
    expect(workingBoardBidsSignature(base)).not.toBe(workingBoardBidsSignature([bid('b1', 'Alpha')]))
    expect(workingBoardBidsSignature(base)).not.toBe(
      workingBoardBidsSignature([...base, bid('b3', 'Gamma')])
    )
  })

  it('changes when a project name changes (implicit inbox sort input)', () => {
    expect(workingBoardBidsSignature([bid('b1', 'Alpha')])).not.toBe(
      workingBoardBidsSignature([bid('b1', 'Alpha II')])
    )
  })

  it('changes when an assignment field changes', () => {
    expect(workingBoardBidsSignature([bid('b1', 'Alpha', 'u1')])).not.toBe(
      workingBoardBidsSignature([bid('b1', 'Alpha', 'u2')])
    )
  })

  it('does not collide across entry boundaries', () => {
    const sep = String.fromCharCode(1)
    expect(workingBoardBidsSignature([bid('b1', 'A'), bid('b2', 'B')])).not.toBe(
      workingBoardBidsSignature([bid('b1', `A${sep}b2`), bid('b2', 'B')])
    )
  })

  it('treats null and empty project names the same', () => {
    expect(workingBoardBidsSignature([bid('b1', null)])).toBe(workingBoardBidsSignature([bid('b1', '')]))
  })
})
