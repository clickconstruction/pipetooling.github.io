// @vitest-environment jsdom
/**
 * Vehicle check-ins know whom you already asked (v2.5887, punch list #180): each late truck's row says
 * whether its holder was asked and answered, read from the holder's Messages thread; the count is
 * what is still to do; the asked trucks sit in a fold; the Mark's note comes from the rows.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { QuickfillSectionMetricsProvider, useQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { QuickfillVehicleOdometersSection } from './QuickfillVehicleOdometersSection'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()
// A reading's date is a Chicago calendar day, as the section counts it: a UTC slice ran a day ahead after
// 7 PM Central, and the "19 days since the last reading" row read 18 every evening.
const ymdAgo = (days: number) => calendarYmdInAppTzFromIso(ago(days))

const state = vi.hoisted(() => ({ lines: [] as Array<{ contact_id: string; at: string; direction: string }> }))

vi.mock('../../lib/supabase', () => {
  const tables: Record<string, () => unknown> = {
    users: () => [{ id: 'u-me', role: 'assistant' }],
    pay_approved_masters: () => [],
    vehicles: () => [
      { id: 'v1', year: 2022, make: 'Ford', model: 'Transit', vin: null },
      { id: 'v2', year: 2021, make: 'Ford', model: 'F-250', vin: null },
      { id: 'v3', year: 2020, make: 'Ram', model: 'ProMaster', vin: null },
    ],
    vehicle_possessions: () => [
      { id: 'p1', vehicle_id: 'v1', user_id: 'u1', start_date: ymdAgo(300), end_date: null },
      { id: 'p2', vehicle_id: 'v2', user_id: 'u2', start_date: ymdAgo(300), end_date: null },
      { id: 'p3', vehicle_id: 'v3', user_id: 'u3', start_date: ymdAgo(300), end_date: null },
    ],
    vehicle_odometer_entries: () => [
      { id: 'o1', vehicle_id: 'v1', odometer_value: 48000, read_date: ymdAgo(19), created_by: null, created_at: ago(19) },
      { id: 'o2', vehicle_id: 'v2', odometer_value: 61000, read_date: ymdAgo(12), created_by: null, created_at: ago(12) },
      { id: 'o3', vehicle_id: 'v3', odometer_value: 30000, read_date: ymdAgo(2), created_by: null, created_at: ago(2) },
    ],
    people: () => [
      { id: 'pe1', account_user_id: 'u1' },
      { id: 'pe2', account_user_id: 'u2' },
    ],
    contacts: () => [
      { id: 'c1', person_id: 'pe1' },
      { id: 'c2', person_id: 'pe2' },
    ],
    messages: () => state.lines,
  }
  function builder(table: string) {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'is', 'gte', 'order', 'limit', 'range', 'insert']) b[m] = () => b
    b.single = () => Promise.resolve({ data: table === 'users' ? { role: 'assistant' } : null, error: null })
    b.maybeSingle = () => Promise.resolve({ data: null, error: null })
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
      // The roster read is `users.select('id, name, phone')`; the access read is `.single()` above.
      const data = table === 'users' ? [{ id: 'u1', name: 'Sam Pruitt', phone: '2105550113' }, { id: 'u2', name: 'Jorge Ruiz', phone: null }, { id: 'u3', name: 'Tony Vega', phone: null }] : (tables[table]?.() ?? [])
      return Promise.resolve({ data, error: null }).then(ok, bad)
    }
    return b
  }
  return { supabase: { from: (table: string) => builder(table), rpc: () => Promise.resolve({ data: null, error: null }) } }
})
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return { useAuth: () => makeUseAuthValue({ role: 'assistant', user: { id: 'u-me' } as never }), AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</> }
})
vi.mock('../../lib/vehicleCheckinSettings', async (orig) => {
  const mod = await orig<typeof import('../../lib/vehicleCheckinSettings')>()
  return { ...mod, fetchVehicleCheckinSettings: async () => ({ ...mod.DEFAULT_VEHICLE_CHECKIN_SETTINGS, assignedDays: 7, motorPoolDays: 30, questions: [] }) }
})

function Probe() {
  const m = useQuickfillSectionMetric('vehicle-odometers')
  return <div data-testid="probe">{m.loading ? 'loading' : `${m.count ?? '-'}|${m.nextLine ?? ''}|${m.markNote ?? ''}`}</div>
}

beforeAll(installDomShims)
beforeEach(() => {
  // Jorge was asked three days ago and has not answered; Sam was never asked.
  state.lines = [{ contact_id: 'c2', at: ago(3), direction: 'out' }]
})
afterEach(cleanup)

describe('Vehicle check-ins know whom you already asked (v2.5887)', () => {
  it('says who was asked, counts what is still to do, folds the waiting, and writes the note', async () => {
    renderWithProviders(
      <QuickfillSectionMetricsProvider>
        <QuickfillVehicleOdometersSection lastMarkedAt={ago(4)} />
        <Probe />
      </QuickfillSectionMetricsProvider>,
    )
    await screen.findByText('2022 Ford Transit')
    await settle()
    // The fresh truck (2 days) is not late; the Transit is not asked; the F-250 is asked and folded.
    expect(screen.queryByText('2020 Ram ProMaster')).toBeNull()
    const todo = document.querySelector('[data-vehicle-group="todo"]')!
    expect(todo.textContent).toContain('2022 Ford Transit')
    expect(todo.textContent).toContain('Sam Pruitt · never asked')
    expect(todo.textContent).not.toContain('2021 Ford F-250')
    expect(screen.getByRole('button', { name: 'Copy the ask' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open the thread →' })).toHaveProperty('href', expect.stringContaining('/messages?thread=c1'))
    fireEvent.click(screen.getByRole('button', { name: /Asked, waiting on the driver/ }))
    expect(document.querySelector('[data-vehicle-group="waiting"]')!.textContent).toContain('asked Jorge Ruiz 3d ago · waiting on the driver')
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toMatch(/^1\|Ask Sam Pruitt for the 2022 Ford Transit's miles by text · 19 days since the last reading\|2 late · 1 not asked · 1 asked and waiting · 0 answered, miles to type/))
    expect(document.querySelector('[data-vehicle-since]')!.textContent).toContain('1 asked')
  })

  it('an answer after the ask moves the truck to answered and the miles are still typed here', async () => {
    state.lines = [
      { contact_id: 'c2', at: ago(3), direction: 'out' },
      { contact_id: 'c2', at: ago(1), direction: 'in' },
    ]
    renderWithProviders(
      <QuickfillSectionMetricsProvider>
        <QuickfillVehicleOdometersSection />
        <Probe />
      </QuickfillSectionMetricsProvider>,
    )
    await screen.findByText('2021 Ford F-250')
    await settle()
    const todo = document.querySelector('[data-vehicle-group="todo"]')!
    expect(todo.textContent).toContain('Jorge Ruiz answered 1d ago · type the miles from the thread')
    expect(screen.getByRole('link', { name: 'Read the answer →' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Odometer for 2021 Ford F-250' })).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toMatch(/^2\|/))
  })
})
