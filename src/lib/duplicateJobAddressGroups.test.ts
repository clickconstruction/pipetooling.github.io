import { describe, expect, it } from 'vitest'
import {
  buildDupJobEnrichments,
  buildDuplicateJobAddressGroups,
  formatDaysAgoShort,
} from './duplicateJobAddressGroups'

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

const NOW_MS = Date.parse('2026-08-09T18:00:00Z')

describe('buildDupJobEnrichments', () => {
  it('sums line count/revenue and builds a capped name summary', () => {
    const m = buildDupJobEnrichments(
      [
        { job_id: 'j1', name: 'A', count: 1, line_unit_price: 100 },
        { job_id: 'j1', name: 'B', count: 2, line_unit_price: 50 },
        { job_id: 'j1', name: 'C', count: 1, line_unit_price: 25 },
        { job_id: 'j1', name: '  ', count: 1, line_unit_price: 25 },
      ],
      [],
      NOW_MS,
    )
    const e = m.get('j1')
    expect(e?.lineCount).toBe(4)
    // 225, not 250: revenueDollarsFromFixtures ignores blank-named lines — same rule as the app's revenue math.
    expect(e?.lineRevenue).toBe(225)
    expect(e?.lineSummary).toBe('A, B, C +1 more')
    expect(e?.lastPaidDaysAgo).toBeNull()
  })

  it('tracks paid total and days since the newest payment (paid_on over created_at)', () => {
    const m = buildDupJobEnrichments(
      [],
      [
        { job_id: 'j1', amount: 100, paid_on: '2026-06-01', created_at: '2026-06-02T10:00:00Z' },
        { job_id: 'j1', amount: 50, paid_on: '2026-08-02', created_at: null },
        { job_id: 'j2', amount: 75, paid_on: null, created_at: '2026-08-08T10:00:00Z' },
      ],
      NOW_MS,
    )
    expect(m.get('j1')?.paidTotal).toBe(150)
    expect(m.get('j1')?.lastPaidDaysAgo).toBe(7)
    expect(m.get('j2')?.lastPaidDaysAgo).toBe(1)
  })
})

describe('formatDaysAgoShort', () => {
  it('formats coarse recency classes', () => {
    expect(formatDaysAgoShort(0)).toBe('today')
    expect(formatDaysAgoShort(5)).toBe('5d ago')
    expect(formatDaysAgoShort(21)).toBe('3 wk ago')
    expect(formatDaysAgoShort(120)).toBe('4 mo ago')
  })
})
