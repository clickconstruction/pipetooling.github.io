// @vitest-environment jsdom
/**
 * Deleted trips on the Trips look: a fold under the rows for the reader who can write, closed until pressed; each
 * deleted trip with who deleted it and until when it is kept; **Put back**, by the trip's id; and the quiet line when
 * the read failed. Heron Point's made-up trips.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { TRIP_DELETED_FAILED_WORDS, TRIP_DELETED_NOTE, type DeletedTripLine } from '../../lib/trips/tripDeleted'
import { newTripRecord, NO_TRIP_PEOPLE, type TripRecord } from '../../lib/trips/tripRecord'
import { buildTripsLook } from '../../lib/trips/tripsLook'
import { DevelopmentTripsLook } from './DevelopmentTripsLook'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

const TODAY = '2026-11-18'
const KEPT: TripRecord = { ...newTripRecord({ id: 't5', developmentId: 'd1' }), tripNumber: 5, purpose: 'Set the lodge fixtures', people: [{ personId: null, userId: null, name: 'Dana', days: { '2026-11-03': 'site' } }] }
const GONE: DeletedTripLine[] = [
  { id: 't3', name: 'Trip 3 · Nov 9 to 11', why: 'Reset the riser the framers moved', who: 'Luis, Priya', deleted: 'Deleted Nov 18 by Dana Office', kept: 'kept until Feb 16', gone: null, pressLabel: 'Put back Trip 3, Nov 9 to 11' },
  { id: 't1', name: 'Trip 1 · Oct 12', why: 'Walk the site', who: 'Luis', deleted: 'Deleted Nov 2 by Marcus Master', kept: 'kept until Jan 31', gone: 'A job it named is gone since.', pressLabel: 'Put back Trip 1, Oct 12' },
]

function draw(over: { records?: TripRecord[]; deleted?: DeletedTripLine[]; deletedFailed?: boolean; canWrite?: boolean; putBackBusy?: boolean; noPress?: boolean; phone?: boolean } = {}) {
  const onPutBack = vi.fn()
  const model = buildTripsLook({ records: over.records ?? [KEPT], index: NO_TRIP_PEOPLE, hours: [], todayYmd: TODAY })
  renderWithProviders(
    <DevelopmentTripsLook
      model={model}
      hoursState="read"
      noSitePoint={false}
      failure={null}
      todayYmd={TODAY}
      phone={over.phone ?? false}
      jobLabel={() => null}
      canWrite={over.canWrite ?? true}
      onAdd={vi.fn()}
      onChange={vi.fn()}
      onDelete={vi.fn()}
      onReload={vi.fn()}
      deleted={over.deleted ?? GONE}
      deletedFailed={over.deletedFailed ?? false}
      putBackBusy={over.putBackBusy ?? false}
      onPutBack={over.noPress ? undefined : onPutBack}
    />,
  )
  return onPutBack
}
const openFold = () => fireEvent.click(screen.getByTestId('trips-deleted-fold'))

describe('Deleted trips on the Trips look', () => {
  it('draws a fold with its count, closed until pressed', () => {
    draw()
    const fold = screen.getByTestId('trips-deleted-fold')
    expect(fold.textContent).toContain('Deleted trips · 2')
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryAllByTestId('trips-deleted-row')).toHaveLength(0)
  })

  it('opens on each deleted trip: its name, what for, who went, who deleted it and until when it is kept', () => {
    draw()
    openFold()
    expect(screen.getByTestId('trips-deleted-fold').getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(TRIP_DELETED_NOTE)).toBeTruthy()
    const rows = screen.getAllByTestId('trips-deleted-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.textContent).toContain('Trip 3 · Nov 9 to 11')
    expect(rows[0]?.textContent).toContain('Reset the riser the framers moved')
    expect(rows[0]?.textContent).toContain('Luis, Priya · Deleted Nov 18 by Dana Office · kept until Feb 16')
    expect(rows[0]?.textContent).not.toContain('gone since')
    expect(rows[1]?.textContent).toContain('A job it named is gone since. Put back saves the trip without it.')
  })

  it('Put back names the trip by its id', () => {
    const onPutBack = draw()
    openFold()
    const rows = screen.getAllByTestId('trips-deleted-row')
    const press = within(rows[1] as HTMLElement).getByRole('button', { name: 'Put back' })
    expect(press.getAttribute('title')).toContain('Put back Trip 1, Oct 12')
    fireEvent.click(press)
    expect(onPutBack).toHaveBeenCalledTimes(1)
    expect(onPutBack).toHaveBeenCalledWith('t1')
  })

  it('holds the press while a save is going, and when nobody takes it', () => {
    const onPutBack = draw({ putBackBusy: true })
    openFold()
    const busy = within(screen.getAllByTestId('trips-deleted-row')[0] as HTMLElement).getByRole('button', { name: 'Put back' }) as HTMLButtonElement
    expect(busy.disabled).toBe(true)
    fireEvent.click(busy)
    expect(onPutBack).not.toHaveBeenCalled()
    cleanup()
    draw({ noPress: true })
    openFold()
    expect((within(screen.getAllByTestId('trips-deleted-row')[0] as HTMLElement).getByRole('button', { name: 'Put back' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('draws no fold with no deleted trip, and none for a reader who cannot write', () => {
    draw({ deleted: [] })
    expect(screen.queryByTestId('trips-deleted')).toBeNull()
    cleanup()
    draw({ canWrite: false })
    expect(screen.queryByTestId('trips-deleted')).toBeNull()
    expect(screen.queryByTestId('trips-deleted-failed')).toBeNull()
  })

  it('still draws the fold on a site whose only trip was deleted, under the empty rows', () => {
    draw({ records: [] })
    expect(screen.queryAllByTestId('trip-row')).toHaveLength(0)
    expect(screen.getByTestId('trips-deleted-fold').textContent).toContain('Deleted trips · 2')
  })

  it('says so when the deleted trips did not read, to a reader who can write alone', () => {
    draw({ deleted: [], deletedFailed: true })
    expect(screen.getByTestId('trips-deleted-failed').textContent).toBe(TRIP_DELETED_FAILED_WORDS)
    cleanup()
    draw({ deleted: [], deletedFailed: true, canWrite: false })
    expect(screen.queryByTestId('trips-deleted-failed')).toBeNull()
  })

  it('draws on a phone too', () => {
    draw({ phone: true })
    openFold()
    expect(screen.getAllByTestId('trips-deleted-row')).toHaveLength(2)
  })
})
