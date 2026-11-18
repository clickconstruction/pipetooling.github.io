// @vitest-environment jsdom
/**
 * A trip's lines in the History (punch list #379): each leads with the trip's number, *Trip 5 out* and
 * *Trip 5 back*, and carries a door that opens that trip in the Trips look on the same page. A trip made
 * before numbers keeps its old verb and still has its door. With no door handed in the line is words alone.
 * Made-up names.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { buildWhatChanged } from '../../lib/developments/whatChanged'
import { tripHistoryLines } from '../../lib/trips/tripHistory'
import { newTripRecord, NO_TRIP_PEOPLE, tripOfRecord, type TripRecord } from '../../lib/trips/tripRecord'
import { DevelopmentFeed } from './DevelopmentFeed'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

const lifts: TripRecord = { ...newTripRecord({ id: 't5', developmentId: 'd1' }), tripNumber: 5, purpose: 'Lift stations before the pour', people: [{ personId: null, userId: null, name: 'Luis', days: { '2026-10-30': 'road', '2026-10-31': 'site', '2026-11-01': 'road' } }] }
const firstTry: TripRecord = { ...newTripRecord({ id: 't1', developmentId: 'd1' }), people: [{ personId: null, userId: null, name: 'Dana', days: { '2026-02-13': 'road', '2026-02-14': 'site' } }] }

/** The lines as the page hands them to the feed: through the one stream, newest first. */
const feedOf = (records: TripRecord[]) =>
  buildWhatChanged({
    members: { bids: [], jobs: [] }, requests: [], submissionEntries: [], bidChanges: [], statusEvents: [], invoices: [], payments: [], threadNotes: [], bidNotes: [], entryLines: [],
    mailLines: tripHistoryLines({ trips: records.map((record) => ({ record, trip: tripOfRecord(record, NO_TRIP_PEOPLE) })), siteName: 'Heron Point', todayYmd: '2026-11-17' }),
    customerContacts: [], customerNames: new Map(), names: new Map(), bidLabel: () => '', jobLabel: () => '', stageLabel: () => '', money: () => '', shortDay: () => '', siteName: 'Heron Point', nowMs: Date.parse('2026-11-17T18:00:00Z'),
  })

describe('DevelopmentFeed: a trip’s lines', () => {
  it('lead with the trip’s number, and the door on a line opens that trip', () => {
    const onOpenTrip = vi.fn()
    renderWithProviders(<DevelopmentFeed lines={feedOf([lifts, firstTry])} sinceIndex={null} lastLooked={null} openAbout={() => {}} olderOpen={false} onToggleOlder={() => {}} onOpenTrip={onOpenTrip} />)
    const rows = screen.getAllByTestId('changed-line')
    expect(rows.map((r) => r.textContent?.replace(/^[A-Za-z]{3} \d+[^A-Z]*/, ''))).toEqual([
      'Trip 5 back · Heron Point · Luis is back · 1 day at the site · Open Trip 5 ›',
      'Trip 5 out · Heron Point · Luis left for Heron Point · Lift stations before the pour · Open Trip 5 ›',
      'Trip back · Heron Point · Dana is back · 1 day at the site · Open this trip ›',
      'Trip out · Heron Point · Dana left for Heron Point · Open this trip ›',
    ])
    fireEvent.click(within(rows[1]!).getByRole('button', { name: 'Open Trip 5 ›' }))
    expect(onOpenTrip).toHaveBeenCalledWith('t5')
    fireEvent.click(within(rows[2]!).getByRole('button', { name: 'Open this trip ›' }))
    expect(onOpenTrip).toHaveBeenLastCalledWith('t1')
  })

  it('are words alone when the page hands no door', () => {
    renderWithProviders(<DevelopmentFeed lines={feedOf([lifts])} sinceIndex={null} lastLooked={null} openAbout={() => {}} olderOpen={false} onToggleOlder={() => {}} />)
    expect(screen.queryByTestId('history-trip-door')).toBeNull()
    expect(screen.getAllByTestId('changed-line')[0]!.textContent).toContain('Trip 5 back · Heron Point · Luis is back · 1 day at the site')
  })
})
