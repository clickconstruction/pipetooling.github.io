// @vitest-environment jsdom
/**
 * The window behind Join with the next (v2.7963): both trips drawn as they stand and the one trip they become, the
 * day both give one person, what the joined trip takes, where a line ends up, the press, and what stops it. Every
 * name here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { newTripRecord, type TripRecord } from '../../lib/trips/tripRecord'
import { TRIP_JOIN_BACK_NOTE, TRIP_JOIN_KEEPS_NOTE } from '../../lib/trips/tripJoin'
import { TripJoinWindow } from './TripJoinWindow'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const TODAY = '2026-11-18'
const FIRST: TripRecord = {
  ...newTripRecord({ id: 't7', developmentId: 'd1' }),
  tripNumber: 7,
  purpose: 'Reset the riser the framers moved',
  billing: 'extra',
  people: [
    { personId: null, userId: 'u-dana', name: 'Dana', days: { '2026-11-09': 'road', '2026-11-10': 'site', '2026-11-11': 'site' } },
    { personId: null, userId: 'u-luis', name: 'Luis', days: { '2026-11-10': 'site', '2026-11-11': 'site' } },
  ],
}
const SECOND: TripRecord = {
  ...newTripRecord({ id: 't8', developmentId: 'd1' }),
  tripNumber: 8,
  askedBy: 'them',
  askedWho: 'Walt, the super',
  billing: null,
  people: [
    { personId: null, userId: 'u-dana', name: 'Dana', days: { '2026-11-11': 'road', '2026-11-14': 'site', '2026-11-15': 'road' } },
    { personId: null, userId: null, name: 'Walt', days: { '2026-11-14': 'site' } },
  ],
}

function draw(over: Partial<Parameters<typeof TripJoinWindow>[0]> = {}) {
  const onJoin = vi.fn()
  const onClose = vi.fn()
  renderWithProviders(<TripJoinWindow record={FIRST} next={SECOND} todayYmd={TODAY} lines={{ here: false, next: false }} busy={false} onJoin={onJoin} onClose={onClose} {...over} />)
  return { onJoin, onClose }
}
const confirm = () => within(screen.getByTestId('trip-join-confirm')).getByRole('button') as HTMLButtonElement
const notes = () => screen.queryAllByTestId('trip-join-note').map((n) => n.textContent)

describe('TripJoinWindow', () => {
  it('names both trips, and draws them and the one trip they become before the press', () => {
    draw()
    expect(screen.getByRole('dialog', { name: 'Join Trip 7 with Trip 8' })).toBeTruthy()
    expect(screen.getByTestId('trip-join-title').textContent).toBe('Join Trip 7 with Trip 8')
    expect(screen.getByTestId('trip-join-first').textContent).toBe('Trip 7 · Nov 9 to 11Dana, Luis · 3 days')
    expect(screen.getByTestId('trip-join-second').textContent).toBe('Trip 8 · Nov 11 to 15Dana, Walt · 3 days')
    expect(screen.getByTestId('trip-join-joined').textContent).toBe('Trip 7 · Nov 9 to 15Dana, Luis, Walt · 5 days')
  })

  it('names the day both trips give one person, with the kind that stays', () => {
    draw()
    expect(screen.getByTestId('trip-join-shared').textContent).toContain('On both trips. Trip 7’s kind stays')
    expect(screen.getAllByTestId('trip-join-shared-day').map((d) => d.textContent)).toEqual(['Nov 11Dana · stays At the sitethe next trip said On the road'])
  })

  it('draws no shared days when the trips share none', () => {
    draw({ next: { ...SECOND, people: [SECOND.people[1]!] } })
    expect(screen.queryByTestId('trip-join-shared')).toBeNull()
  })

  it('says what the joined trip takes, where the next trip goes and how a join is taken back', () => {
    draw()
    expect(notes()).toEqual(['Trip 7 keeps its number and its words. It takes who asked from Trip 8.', 'Trip 8 goes, and its number is not used again. It waits under Deleted trips, marked as joined.'])
    expect(screen.getByText(TRIP_JOIN_KEEPS_NOTE)).toBeTruthy()
    expect(screen.getByText(TRIP_JOIN_BACK_NOTE)).toBeTruthy()
  })

  it('the press names the act and joins', () => {
    const { onJoin } = draw()
    expect(confirm().textContent).toBe('Join into one trip')
    expect(confirm().disabled).toBe(false)
    fireEvent.click(confirm())
    expect(onJoin).toHaveBeenCalledTimes(1)
  })

  it('says where a line ends up: it moves from the next trip, or stays with this one', () => {
    draw({ lines: { here: false, next: true } })
    expect(notes()).toContain('Trip 8 is on a bill. Its line moves to the joined trip.')
    cleanup()
    draw({ lines: { here: true, next: false } })
    expect(notes()).toContain('Trip 7 is on a bill. Its line stays with it.')
  })

  it('two different billings stop the press and say why', () => {
    const { onJoin } = draw({ next: { ...SECOND, billing: 'ours' } })
    expect(screen.getByTestId('trip-join-problem').textContent).toBe('These trips say two different billings: Extra and Ours. Make them match with Change, then join.')
    expect(notes()).toEqual([])
    expect(confirm().disabled).toBe(true)
    fireEvent.click(confirm())
    expect(onJoin).not.toHaveBeenCalled()
  })

  it('a line on each trip stops the press and says why', () => {
    draw({ next: { ...SECOND, billing: 'extra' }, lines: { here: true, next: true } })
    expect(screen.getByTestId('trip-join-problem').textContent).toBe('Both trips are on a bill, each with its own line. A trip holds one line. Take one line off its job, then join.')
    expect(confirm().disabled).toBe(true)
  })

  it('holds the press while the join is going', () => {
    const { onJoin } = draw({ busy: true })
    expect(confirm().textContent).toBe('Joining the trips…')
    expect(confirm().disabled).toBe(true)
    fireEvent.click(confirm())
    expect(onJoin).not.toHaveBeenCalled()
  })

  it('closes on Cancel, on the ×, on Escape and on the backdrop', () => {
    const { onClose } = draw()
    fireEvent.click(screen.getByText('Cancel'))
    fireEvent.click(screen.getByLabelText('Close'))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByTestId('trip-join-window'))
    expect(onClose).toHaveBeenCalledTimes(4)
  })
})
