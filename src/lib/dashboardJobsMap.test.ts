import { describe, expect, it } from 'vitest'
import {
  dashboardJobsMapBounds,
  dashboardJobsMapDetailLine,
  dashboardJobsMapDirectionsUrl,
  dashboardJobsMapJobs,
  dashboardJobsMapLegend,
  dashboardJobsMapUnmappedLine,
  readDashboardJobsMapHidden,
  resolveDashboardJobsMapPins,
  writeDashboardJobsMapHidden,
} from './dashboardJobsMap'
import type { DashboardTeamAssignedJobRow } from './dashboardTeamAssignedJobRow'

function row(p: Partial<DashboardTeamAssignedJobRow> & { id: string }): DashboardTeamAssignedJobRow {
  return {
    hcp_number: 'J1021',
    job_name: 'Bexley Park Bldg C',
    job_address: '1400 Oak Hollow Rd',
    google_drive_link: null,
    job_plans_link: null,
    revenue: null,
    created_at: null,
    status: 'working',
    ...p,
  }
}

describe('dashboardJobsMapJobs', () => {
  it('merges assigned + superintendent rows, dedupes by id, labels number · name, keys the address', () => {
    const assigned = [row({ id: 'a', status: 'working' }), row({ id: 'b', hcp_number: '', click_number: 'C77', job_name: 'Lot 42', job_address: ' 218  Meadowbrook Ln ', status: 'waiting' })]
    const sup = [row({ id: 'a', status: undefined }), row({ id: 'c', hcp_number: 'J1031', job_name: 'Pine Ridge', status: undefined })]
    const { jobs, noAddress } = dashboardJobsMapJobs(assigned, sup)
    expect(jobs.map((j) => j.id)).toEqual(['a', 'b', 'c'])
    expect(jobs[0]!.label).toBe('J1021 · Bexley Park Bldg C')
    expect(jobs[0]!.status).toBe('working')
    expect(jobs[1]!.label).toBe('C77 · Lot 42')
    expect(jobs[1]!.address).toBe('218  Meadowbrook Ln')
    expect(jobs[1]!.addressKey).toBe('218 meadowbrook ln')
    expect(jobs[1]!.status).toBe('waiting')
    // a superintendent row has no status column → treated as waiting (still in the field)
    expect(jobs[2]!.status).toBe('waiting')
    expect(noAddress).toEqual([])
  })

  it('drops jobs that left the field and sets aside jobs with no address', () => {
    const { jobs, noAddress } = dashboardJobsMapJobs(
      [row({ id: 'billed', status: 'billed' }), row({ id: 'paid', status: 'paid' }), row({ id: 'shop', job_name: 'Shop stock', job_address: '' })],
      [],
    )
    expect(jobs).toEqual([])
    expect(noAddress.map((j) => j.id)).toEqual(['shop'])
  })

  it('carries the stage and last-report fields for the popup', () => {
    const { jobs } = dashboardJobsMapJobs([row({ id: 'a', in_progress_stage_name: ' Rough-in ', last_report_at: '2026-09-05T12:00:00Z' })], [])
    expect(jobs[0]!.stageName).toBe('Rough-in')
    expect(jobs[0]!.lastReportAt).toBe('2026-09-05T12:00:00Z')
  })
})

describe('resolveDashboardJobsMapPins + legend + bounds', () => {
  const { jobs } = dashboardJobsMapJobs(
    [row({ id: 'a' }), row({ id: 'b', job_address: '218 Meadowbrook Ln', status: 'waiting' }), row({ id: 'c', job_address: '90 River Bend Dr' })],
    [],
  )

  it('splits pins from unmapped by cache hit and ignores non-finite coordinates', () => {
    const coords = new Map([
      ['1400 oak hollow rd', { lat: 30.5, lng: -97.7 }],
      ['90 river bend dr', { lat: Number.NaN, lng: -97.7 }],
    ])
    const { pins, unmapped } = resolveDashboardJobsMapPins(jobs, coords)
    expect(pins.map((p) => p.id)).toEqual(['a'])
    expect(unmapped.map((u) => u.id)).toEqual(['b', 'c'])
  })

  it('legend counts by status and drops zero entries', () => {
    const coords = new Map([
      ['1400 oak hollow rd', { lat: 30.5, lng: -97.7 }],
      ['218 meadowbrook ln', { lat: 30.6, lng: -97.8 }],
    ])
    const { pins } = resolveDashboardJobsMapPins(jobs, coords)
    expect(dashboardJobsMapLegend(pins)).toEqual([
      { status: 'working', count: 1 },
      { status: 'waiting', count: 1 },
    ])
    expect(dashboardJobsMapLegend([])).toEqual([])
  })

  it('bounds cover every pin; a lone pin gets a padded box; none → null', () => {
    const coords = new Map([
      ['1400 oak hollow rd', { lat: 30.5, lng: -97.7 }],
      ['218 meadowbrook ln', { lat: 30.6, lng: -97.9 }],
    ])
    const { pins } = resolveDashboardJobsMapPins(jobs, coords)
    expect(dashboardJobsMapBounds(pins)).toEqual({ south: 30.5, west: -97.9, north: 30.6, east: -97.7 })
    const lone = dashboardJobsMapBounds([pins[0]!])!
    expect(lone.south).toBeCloseTo(30.49, 6)
    expect(lone.west).toBeCloseTo(-97.71, 6)
    expect(lone.north).toBeCloseTo(30.51, 6)
    expect(lone.east).toBeCloseTo(-97.69, 6)
    expect(dashboardJobsMapBounds([])).toBeNull()
  })
})

describe('copy helpers', () => {
  it('unmapped line pluralizes and hides at zero', () => {
    expect(dashboardJobsMapUnmappedLine(0)).toBeNull()
    expect(dashboardJobsMapUnmappedLine(1)).toBe('1 job has no map location yet')
    expect(dashboardJobsMapUnmappedLine(3)).toBe('3 jobs have no map location yet')
  })

  it('directions url is the job rows’ Google Maps search link', () => {
    expect(dashboardJobsMapDirectionsUrl(' 1400 Oak Hollow Rd ')).toBe('https://www.google.com/maps/search/?api=1&query=1400%20Oak%20Hollow%20Rd')
  })

  it('detail line joins stage and last-report age', () => {
    const now = new Date('2026-09-07T18:00:00Z')
    expect(dashboardJobsMapDetailLine({ stageName: 'Rough-in', lastReportAt: '2026-09-05T12:00:00Z' }, now)).toBe('Rough-in · last report 2 days ago')
    expect(dashboardJobsMapDetailLine({ stageName: null, lastReportAt: '2026-09-07T06:00:00Z' }, now)).toBe('last report today')
    expect(dashboardJobsMapDetailLine({ stageName: null, lastReportAt: '2026-09-06T06:00:00Z' }, now)).toBe('last report yesterday')
    expect(dashboardJobsMapDetailLine({ stageName: 'Trim', lastReportAt: '2026-07-01T06:00:00Z' }, now)).toBe('Trim · last report over a month ago')
    expect(dashboardJobsMapDetailLine({ stageName: null, lastReportAt: null }, now)).toBeNull()
  })
})

describe('hide-map preference', () => {
  it('reads "1" as hidden, writes and clears, and survives a throwing store', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    }
    expect(readDashboardJobsMapHidden(storage)).toBe(false)
    writeDashboardJobsMapHidden(true, storage)
    expect(readDashboardJobsMapHidden(storage)).toBe(true)
    writeDashboardJobsMapHidden(false, storage)
    expect(readDashboardJobsMapHidden(storage)).toBe(false)
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readDashboardJobsMapHidden(throwing)).toBe(false)
    expect(() => writeDashboardJobsMapHidden(true, throwing)).not.toThrow()
  })
})
