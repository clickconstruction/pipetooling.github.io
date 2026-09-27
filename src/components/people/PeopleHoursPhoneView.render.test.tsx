// @vitest-environment jsdom
/**
 * Render smokes for People · Hours on a phone (v2.3889): the three-way switch,
 * Who's in and Approvals as lists (empty here — the stub returns no rows), and
 * Sessions drawing nothing of its own (the page draws that view).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { PeopleHoursPhoneView } from './PeopleHoursPhoneView'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})

beforeAll(installDomShims)
afterEach(cleanup)

const viewer = { role: 'assistant', isDev: false, canAccessPay: true, canAccessHours: true, canAccessVehicles: false, canAccessLicenses: false, canAccessContracts: false, readOnly: false }

describe('PeopleHoursPhoneView', () => {
  it('draws the switch, and Who’s in says so when nobody is', async () => {
    const onView = vi.fn()
    renderWithProviders(<PeopleHoursPhoneView view="in" onView={onView} viewer={viewer} viewerUserId="u-1" reloadKey={0} onChanged={() => {}} />)
    await settle()
    expect(screen.getByRole('tablist', { name: 'Hours views' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Who’s in 0' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Approvals 0' })).toBeTruthy()
    expect(screen.getByText('Nobody is clocked in.')).toBeTruthy()
    expect(screen.getByText(/The week grid is under Week & sessions/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Week & sessions' }))
    expect(onView).toHaveBeenCalledWith('sessions')
  })

  it('Approvals says when nothing is waiting; Sessions draws only the switch', async () => {
    const { unmount } = renderWithProviders(<PeopleHoursPhoneView view="approvals" onView={() => {}} viewer={viewer} viewerUserId="u-1" reloadKey={0} onChanged={() => {}} />)
    await settle()
    expect(screen.getByText('Nothing is waiting on an approval.')).toBeTruthy()
    unmount()
    renderWithProviders(<PeopleHoursPhoneView view="sessions" onView={() => {}} viewer={viewer} viewerUserId="u-1" reloadKey={0} onChanged={() => {}} />)
    await settle()
    expect(screen.queryByText('Nobody is clocked in.')).toBeNull()
    expect(screen.queryByText('Nothing is waiting on an approval.')).toBeNull()
    expect(document.querySelector('[data-hours-phone] [role="tablist"]')).toBeTruthy()
  })
})
