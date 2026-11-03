// @vitest-environment jsdom
/**
 * Render smoke for People → Licenses (v2.6424): the Expired section first with the days since,
 * the thirty-day strip after it with the days left, a license beyond the window in neither, and a
 * press on a person in the Expired section opening their licenses in the roster below. The buckets
 * are the kernel's (`lib/people/licenseExpiry.test.ts`); this holds the wiring, over invented people.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import PeopleLicensesTab from './PeopleLicensesTab'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'

const TODAY = todayYmdInAppTz()

const LICENSES = [
  { id: 'l-hal', person_name: 'Hal Sample', license_type: 'Master Plumber #1001', note: null, date_of_expiry: ymdAddDays(TODAY, -232), created_at: null, person_license_cost_lines: [{ id: 'c1', amount: 150, note: null, date: '2026-01-05' }] },
  { id: 'l-pat', person_name: 'Pat Sample', license_type: 'Journeyman #2002', note: null, date_of_expiry: ymdAddDays(TODAY, 10), created_at: null, person_license_cost_lines: [] },
  { id: 'l-kim', person_name: 'Kim Sample', license_type: 'Apprentice #3003', note: null, date_of_expiry: ymdAddDays(TODAY, 400), created_at: null, person_license_cost_lines: [] },
]

const TABLE_ROWS: Record<string, unknown[]> = { person_licenses: LICENSES }

vi.mock('../../lib/supabase', () => {
  function makeBuilder(rows: unknown[]): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'order', 'range', 'limit', 'single', 'maybeSingle']) {
      builder[m] = () => builder
    }
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null, count: rows.length }).then(onFulfilled, onRejected)
    return builder
  }
  return {
    supabase: {
      from: (table: string) => makeBuilder(TABLE_ROWS[table] ?? []),
      rpc: () => Promise.resolve({ data: null, error: null }),
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    },
  }
})

const person = (id: string, name: string) => ({ id, master_user_id: 'm1', kind: 'helper', name, email: null, phone: null, notes: null })
const PEOPLE = [person('p-hal', 'Hal Sample'), person('p-pat', 'Pat Sample'), person('p-kim', 'Kim Sample')]

afterEach(cleanup)

const expiredSection = () => document.querySelector('[data-licenses-expired]') as HTMLElement
const expiringSection = () => document.querySelector('[data-licenses-expiring]') as HTMLElement

describe('PeopleLicensesTab', () => {
  it('draws Expired first with the days since, the strip after it with the days left, and the far one in neither', async () => {
    renderWithProviders(<PeopleLicensesTab people={PEOPLE} users={[]} />)
    expect(await screen.findByRole('heading', { name: '1 expired license' })).toBeTruthy()

    const expired = expiredSection()
    expect(within(expired).getByRole('button', { name: 'Hal Sample' })).toBeTruthy()
    expect(within(expired).getByText('Master Plumber #1001')).toBeTruthy()
    expect(within(expired).getByText('232 days ago')).toBeTruthy()
    expect(within(expired).getByText('$150.00')).toBeTruthy()
    expect(within(expired).queryByText('Journeyman #2002')).toBeNull()

    const expiring = expiringSection()
    expect(within(expiring).getByRole('heading', { name: 'Licenses expiring in the next 30 days' })).toBeTruthy()
    expect(within(expiring).getByRole('button', { name: 'Pat Sample' })).toBeTruthy()
    expect(within(expiring).getByText('10')).toBeTruthy()
    expect(within(expiring).queryByText('Master Plumber #1001')).toBeNull()

    // The far one is in neither section; the roster below still lists it.
    expect(within(expired).queryByText('Apprentice #3003')).toBeNull()
    expect(within(expiring).queryByText('Apprentice #3003')).toBeNull()
    expect(screen.getByText('Apprentice #3003')).toBeTruthy()
    // Expired comes before the strip.
    expect(expired.compareDocumentPosition(expiring) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('a press on a person in the Expired section opens their licenses in the roster', async () => {
    renderWithProviders(<PeopleLicensesTab people={PEOPLE} users={[]} />)
    await screen.findByRole('heading', { name: '1 expired license' })
    await settle()
    expect(screen.queryByRole('button', { name: '+ Add license' })).toBeNull()

    fireEvent.click(within(expiredSection()).getByRole('button', { name: 'Hal Sample' }))
    await settle()
    const row = document.querySelector('[data-license-person="Hal Sample"]') as HTMLElement
    expect(row).toBeTruthy()
    expect(screen.getByRole('button', { name: '+ Add license' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hours log' })).toBeTruthy()
    // Hal's expanded table: the license with its Edit and Delete.
    expect(screen.getAllByText('Master Plumber #1001').length).toBe(3)
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })

  it('with nothing lapsed and nothing near, both sections say so', async () => {
    TABLE_ROWS.person_licenses = [LICENSES[2]!]
    try {
      renderWithProviders(<PeopleLicensesTab people={PEOPLE} users={[]} />)
      expect(await screen.findByRole('heading', { name: 'Expired licenses' })).toBeTruthy()
      expect(within(expiredSection()).getByText('Nothing on file has expired.')).toBeTruthy()
      expect(within(expiringSection()).getByText('Nothing expires in the next 30 days.')).toBeTruthy()
    } finally {
      TABLE_ROWS.person_licenses = LICENSES
    }
  })
})
