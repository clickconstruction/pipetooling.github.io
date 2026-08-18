import { describe, expect, it } from 'vitest'
import { buildRecentlyAddedRows, type RecentlyAddedLeanJob } from './recentlyAddedJobs'

function lean(over: Partial<RecentlyAddedLeanJob> & { id: string }): RecentlyAddedLeanJob {
  return {
    hcp_number: '972',
    click_number: null,
    job_name: 'Tovi Pinpoint & Gas Test',
    customer_name: 'Tovi Polk',
    status: 'working',
    created_at: '2026-08-18T17:04:00Z',
    ...over,
  }
}

// Noon UTC on 2026-08-18 = mid-morning in the company TZ, same calendar day.
const NOW = new Date('2026-08-18T17:30:00Z')

describe('buildRecentlyAddedRows', () => {
  it('orders newest first; missing created_at sinks', () => {
    const rows = buildRecentlyAddedRows(
      [
        lean({ id: 'old', created_at: '2026-08-01T10:00:00Z' }),
        lean({ id: 'none', created_at: null }),
        lean({ id: 'new', created_at: '2026-08-18T17:04:00Z' }),
      ],
      NOW,
    )
    expect(rows.map((r) => r.id)).toEqual(['new', 'old', 'none'])
  })

  it('labels today with the time, older days with the short date', () => {
    const rows = buildRecentlyAddedRows(
      [lean({ id: 'today' }), lean({ id: 'older', created_at: '2026-08-17T15:00:00Z' })],
      NOW,
    )
    expect(rows[0]?.addedLabel).toBe('today 12:04 PM')
    expect(rows[1]?.addedLabel).toBe('Aug 17')
  })

  it('uses the effective number and treats null status as working (board parity)', () => {
    const rows = buildRecentlyAddedRows(
      [
        lean({ id: 'click', hcp_number: null, click_number: '560' }),
        lean({ id: 'nullstatus', status: null }),
        lean({ id: 'weird', status: 'collections?' }),
      ],
      NOW,
    )
    expect(rows.find((r) => r.id === 'click')?.label).toBe('560')
    expect(rows.find((r) => r.id === 'nullstatus')?.status).toBe('working')
    expect(rows.find((r) => r.id === 'weird')?.status).toBeNull()
  })
})
