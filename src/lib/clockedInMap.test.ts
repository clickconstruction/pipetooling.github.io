import { describe, expect, it } from 'vitest'
import {
  buildClockedInMap,
  CLOCKED_IN_MAP_COLOR,
  clockedInMapAddresses,
  clockedInMapBidHref,
  clockedInMapDistanceLabel,
  clockedInMapHeaderStamp,
  clockedInMapMilesBetween,
  clockedInMapSummaryLine,
  clockedInMapUnmappedLine,
  formatClockedInElapsed,
  placeClockedInStops,
} from './clockedInMap'
import type { ClockSessionRow, SyntheticSalaryStripSession } from '../types/clockSessions'
import { normalizeAddressForGeocodeKey } from './map/normalizeAddressForGeocode'

const NOW = new Date('2026-09-22T16:45:00Z').getTime()
const PREFIX = {}

function session(p: Partial<ClockSessionRow> & { id: string; user_id: string }): ClockSessionRow {
  return {
    clocked_in_at: '2026-09-22T13:00:00Z',
    clocked_out_at: null,
    work_date: '2026-09-22',
    notes: '',
    job_ledger_id: null,
    bid_id: null,
    clock_in_lat: null,
    clock_in_lng: null,
    clock_out_lat: null,
    clock_out_lng: null,
    clock_in_location_source: null,
    clock_out_location_source: null,
    approved_at: null,
    approved_by: null,
    rejected_at: null,
    rejected_by: null,
    revoked_at: null,
    revoked_by: null,
    users: { name: p.user_id },
    approved_by_user: null,
    rejected_by_user: null,
    revoked_by_user: null,
    jobs_ledger: null,
    bids: null,
    ...p,
  }
}

function onJob(p: { id: string; user_id: string; job: string; hcp?: string; name?: string; address?: string | null; clocked_in_at?: string; notes?: string }): ClockSessionRow {
  return session({
    id: p.id,
    user_id: p.user_id,
    job_ledger_id: p.job,
    clocked_in_at: p.clocked_in_at ?? '2026-09-22T13:00:00Z',
    notes: p.notes ?? '',
    jobs_ledger: { hcp_number: p.hcp ?? '1021', click_number: null, job_name: p.name ?? 'Vecchio Pinpoint', job_address: p.address === undefined ? '1160 Lago Vista Dr, San Marcos, TX 78666' : p.address },
  })
}

const VECCHIO = '1160 Lago Vista Dr, San Marcos, TX 78666'
const OFFICE_ADDR = '12921 FM 20, Kingsbury, TX 78638'

describe('buildClockedInMap', () => {
  it('regroups sessions by place: two people on one job share a stop, stops sort most people first, then label', () => {
    const m = buildClockedInMap(
      [
        onJob({ id: 's1', user_id: 'Abraham', job: 'j1', clocked_in_at: '2026-09-22T13:00:00Z' }),
        onJob({ id: 's2', user_id: 'Malachi', job: 'j2', hcp: '1039', name: 'Echols', address: '1 Echols Rd, Kingsbury, TX' }),
        onJob({ id: 's3', user_id: 'Paige', job: 'j1', clocked_in_at: '2026-09-22T12:18:00Z', notes: 'Work' }),
        onJob({ id: 's4', user_id: 'Tristen', job: 'j3', hcp: '251', name: 'Michael Palmer', address: '9 Blanco St, Blanco, TX' }),
      ],
      NOW,
      PREFIX,
    )
    expect(m.stops.map((s) => [s.id, s.label, s.people.map((p) => p.name)])).toEqual([
      ['job:j1', 'J1021 · Vecchio Pinpoint', ['Paige', 'Abraham']],
      ['job:j2', 'J1039 · Echols', ['Malachi']],
      ['job:j3', 'J251 · Michael Palmer', ['Tristen']],
    ])
    expect(m.stops[0]?.people[0]).toMatchObject({ elapsedLabel: '4h 27m', memo: 'Work', synthetic: false })
    expect(m.stops[0]?.people[1]?.elapsedLabel).toBe('3h 45m')
    expect(m.peopleCount).toBe(4)
    expect(m.office).toBeNull()
    expect(m.unassigned).toEqual([])
    expect(m.legend).toEqual({ jobs: 3, bids: 0, office: 0 })
  })

  it('a bid session is a violet stop with the bid label; a session with no job or bid is listed, never placed', () => {
    const bid = session({
      id: 'b1',
      user_id: 'Michael A',
      bid_id: 'bid-9',
      bids: { bid_number: '482', project_name: 'Kimberly Coe', address: '4 Converse Ln, Converse, TX', customers: { name: 'Coe' } },
    })
    const loose = session({ id: 'l1', user_id: 'Isiah', notes: 'Working with micheal', clocked_in_at: '2026-09-22T15:26:00Z' })
    const m = buildClockedInMap([bid, loose], NOW, PREFIX)
    expect(m.stops).toHaveLength(1)
    expect(m.stops[0]).toMatchObject({ id: 'bid:bid-9', kind: 'bid', label: 'B482 · Kimberly Coe', bidId: 'bid-9', jobLedgerId: null })
    expect(m.unassigned.map((p) => [p.name, p.elapsedLabel, p.memo])).toEqual([['Isiah', '1h 19m', 'Working with micheal']])
    expect(m.legend).toEqual({ jobs: 0, bids: 1, office: 0 })
  })

  it('sessions on the office job sit on the office, not a pin — by job id, or by the office address', () => {
    const byId = buildClockedInMap([onJob({ id: 'o1', user_id: 'Grace', job: 'office-job', hcp: '000', name: 'Office', address: null })], NOW, PREFIX, {
      officeJobLedgerId: 'office-job',
    })
    expect(byId.stops).toEqual([])
    expect(byId.office).toMatchObject({ id: 'office', kind: 'office', label: 'Office', people: [expect.objectContaining({ name: 'Grace' })] })
    expect(byId.legend.office).toBe(1)

    const byAddress = buildClockedInMap([onJob({ id: 'o2', user_id: 'Grace', job: 'jx', hcp: '000', name: 'Office', address: OFFICE_ADDR })], NOW, PREFIX, {
      officeAddressKey: normalizeAddressForGeocodeKey(OFFICE_ADDR),
    })
    expect(byAddress.stops).toEqual([])
    expect(byAddress.office?.people.map((p) => p.name)).toEqual(['Grace'])

    const noOffice = buildClockedInMap([onJob({ id: 'o3', user_id: 'Grace', job: 'jx', hcp: '000', name: 'Office', address: OFFICE_ADDR })], NOW, PREFIX)
    expect(noOffice.office).toBeNull()
    expect(noOffice.stops).toHaveLength(1)
  })

  it('a schedule-implied (synthetic) row is listed under Not on a job as synthetic; one person on two sessions counts once per stop and once overall', () => {
    const synthetic: SyntheticSalaryStripSession = {
      kind: 'synthetic_salary',
      id: 'syn-1',
      user_id: 'Taunya',
      clocked_in_at: '2026-09-22T13:00:00Z',
      clocked_out_at: null,
      work_date: '2026-09-22',
      notes: '',
      job_ledger_id: null,
      bid_id: null,
      approved_at: null,
      rejected_at: null,
      revoked_at: null,
      users: { name: 'Taunya' },
      jobs_ledger: null,
      bids: null,
    }
    const m = buildClockedInMap(
      [synthetic, onJob({ id: 'a', user_id: 'Abraham', job: 'j1' }), onJob({ id: 'a2', user_id: 'Abraham', job: 'j1', clocked_in_at: '2026-09-22T14:00:00Z' })],
      NOW,
      PREFIX,
    )
    expect(m.unassigned).toEqual([expect.objectContaining({ name: 'Taunya', synthetic: true })])
    expect(m.stops[0]?.people).toHaveLength(1)
    expect(m.peopleCount).toBe(2)
  })
})

describe('clockedInMapAddresses / placeClockedInStops', () => {
  const m = buildClockedInMap(
    [
      onJob({ id: '1', user_id: 'A', job: 'j1' }),
      onJob({ id: '2', user_id: 'B', job: 'j1' }),
      onJob({ id: '3', user_id: 'C', job: 'j2', hcp: '1039', name: 'Echols', address: '1 Echols Rd, Kingsbury, TX' }),
      onJob({ id: '4', user_id: 'D', job: 'j3', hcp: '7', name: 'No address', address: '' }),
    ],
    NOW,
    PREFIX,
  )

  it('asks the geocoder for each address once and never for a blank one', () => {
    expect(clockedInMapAddresses(m)).toEqual([
      { key: normalizeAddressForGeocodeKey(VECCHIO), display: VECCHIO },
      { key: normalizeAddressForGeocodeKey('1 Echols Rd, Kingsbury, TX'), display: '1 Echols Rd, Kingsbury, TX' },
    ])
  })

  it('a placed stop becomes a pin with the head count as its badge; the rest split into unmapped and no-address', () => {
    const coords = new Map([[normalizeAddressForGeocodeKey(VECCHIO), { lat: 29.88, lng: -97.94 }]])
    const placed = placeClockedInStops(m.stops, coords)
    expect(placed.pins).toEqual([{ id: 'job:j1', lat: 29.88, lng: -97.94, color: CLOCKED_IN_MAP_COLOR.job, title: 'J1021 · Vecchio Pinpoint · 2', label: '2' }])
    expect(placed.coordsByStop.get('job:j1')).toEqual({ lat: 29.88, lng: -97.94 })
    expect(placed.unmapped.map((s) => s.id)).toEqual(['job:j2'])
    expect(placed.noAddress.map((s) => s.id)).toEqual(['job:j3'])
  })
})

describe('the lines', () => {
  it('unmapped line names jobs and bids', () => {
    const job = { kind: 'job' } as never
    const bid = { kind: 'bid' } as never
    expect(clockedInMapUnmappedLine([])).toBeNull()
    expect(clockedInMapUnmappedLine([job])).toBe('1 job has no map location yet')
    expect(clockedInMapUnmappedLine([job, job])).toBe('2 jobs have no map location yet')
    expect(clockedInMapUnmappedLine([job, bid])).toBe('1 job and 1 bid have no map location yet')
    expect(clockedInMapUnmappedLine([bid])).toBe('1 bid has no map location yet')
  })

  it('summary line drops zero parts and keeps the head count first', () => {
    const m = buildClockedInMap(
      [
        onJob({ id: '1', user_id: 'A', job: 'j1' }),
        onJob({ id: '2', user_id: 'G', job: 'off', address: null }),
        session({ id: '3', user_id: 'I' }),
      ],
      NOW,
      PREFIX,
      { officeJobLedgerId: 'off' },
    )
    expect(clockedInMapSummaryLine(m)).toBe('3 in · 1 stop · 1 at the office · 1 not on a job')
    expect(clockedInMapSummaryLine(buildClockedInMap([], NOW, PREFIX))).toBe('0 in')
  })

  it('elapsed, distance, header stamp and the bid link', () => {
    expect(formatClockedInElapsed(0)).toBe('0m')
    expect(formatClockedInElapsed(59)).toBe('0m')
    expect(formatClockedInElapsed(3600 * 3 + 45 * 60 + 20)).toBe('3h 45m')
    const office = { lat: 29.653, lng: -97.797 }
    expect(clockedInMapMilesBetween(office, office)).toBe(0)
    expect(clockedInMapDistanceLabel({ lat: 29.88, lng: -97.94 }, office)).toBe('18 mi')
    expect(clockedInMapDistanceLabel({ lat: 29.6531, lng: -97.7971 }, office)).toBe('< 1 mi')
    expect(clockedInMapDistanceLabel(null, office)).toBeNull()
    expect(clockedInMapDistanceLabel({ lat: 1, lng: 1 }, null)).toBeNull()
    expect(clockedInMapHeaderStamp(NOW, 'en-US')).toMatch(/^[A-Z][a-z]{2}, Sep 22 · \d{1,2}:\d{2} [AP]M$/)
    expect(clockedInMapBidHref('b 1')).toBe('/bids?bidId=b%201&tab=submission-followup')
  })
})
