import { describe, expect, it } from 'vitest'
import { buildDuplicateJobAddressGroups } from './duplicateJobAddressGroups'

function job(id: string, address: string | null, status: string, created: string) {
  return { id, hcp_number: id, job_name: `Job ${id}`, job_address: address, status, created_at: created }
}

describe('buildDuplicateJobAddressGroups', () => {
  it('groups case/whitespace-normalized addresses with 2+ jobs and skips uniques and blanks', () => {
    const groups = buildDuplicateJobAddressGroups([
      job('a', '109 Tuscarora Trail', 'working', '2026-02-24'),
      job('b', '109  tuscarora   trail', 'paid', '2026-02-25'),
      job('c', '717 Trinity St', 'working', '2026-03-01'),
      job('d', '', 'working', '2026-03-02'),
      job('e', null as unknown as string, 'working', '2026-03-03'),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.address).toBe('109 Tuscarora Trail')
    expect(groups[0]?.jobs.map((j) => j.id)).toEqual(['a', 'b'])
  })

  it('sorts jobs within a group active-first then newest-first', () => {
    const groups = buildDuplicateJobAddressGroups([
      job('old-active', 'A St', 'waiting', '2026-01-01'),
      job('paid', 'A St', 'paid', '2026-03-01'),
      job('new-active', 'A St', 'working', '2026-02-01'),
    ])
    expect(groups[0]?.jobs.map((j) => j.id)).toEqual(['new-active', 'old-active', 'paid'])
  })

  it('sorts groups: has-active first, then SMALLER first (pairs before staging addresses), then A-Z', () => {
    const groups = buildDuplicateJobAddressGroups([
      job('p1', 'Z Done St', 'paid', '2026-01-01'),
      job('p2', 'Z Done St', 'billed', '2026-01-02'),
      job('s1', 'Staging Yard', 'working', '2026-01-01'),
      job('s2', 'Staging Yard', 'working', '2026-01-02'),
      job('s3', 'Staging Yard', 'working', '2026-01-03'),
      job('b1', 'A Live St', 'working', '2026-01-01'),
      job('b2', 'A Live St', 'paid', '2026-01-02'),
    ])
    expect(groups.map((g) => g.address)).toEqual(['A Live St', 'Staging Yard', 'Z Done St'])
    expect(groups[2]?.hasActive).toBe(false)
  })
})
