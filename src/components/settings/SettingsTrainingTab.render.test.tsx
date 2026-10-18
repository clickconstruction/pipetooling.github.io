// @vitest-environment jsdom
/**
 * Settings → Training (punch list #111, v2.5569): the course with its switch, its role chips, its numbers, its
 * counts and See who, over fake reads; the switch and a role chip save and reload; Everyone takes it again
 * confirms with the count it turns red, then stamps today; the words before the tables exist.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => ({ supabase: (await import('../../test/renderSmokeMocks')).makeSupabaseStub() }))
vi.mock('../../hooks/useAuth', async () => {
  const m = await import('../../test/renderSmokeMocks')
  return { ...m.useAuthModuleMock(), useAuth: () => m.makeUseAuthValue({ role: 'dev' }) }
})
vi.mock('../../lib/training/courseRegistry', () => ({
  TRAINING_COURSES: [{ slug: 'osha-30-refresher', lessons: new Array(30).fill(0), minutes: 160, contentVersion: 'abcdef01' }],
  findCourse: () => null,
}))

const io = vi.hoisted(() => ({
  missing: false,
  enabled: true,
  requiredRoles: ['helpers', 'subcontractor'] as string[],
  retakeFrom: null as string | null,
  offered: false,
  rows: [
    { user_id: 'u1', name: 'Dana R', role: 'helpers', colour: 'red', passed_on: null, due_on: null, days_to_due: null },
    { user_id: 'u2', name: 'Luis M', role: 'helpers', colour: 'amber', passed_on: '2025-10-03', due_on: '2026-10-03', days_to_due: -12 },
    { user_id: 'u3', name: 'Priya K', role: 'subcontractor', colour: 'green', passed_on: '2026-03-03', due_on: '2027-03-03', days_to_due: 139 },
  ],
  save: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../lib/training/trainingIo', () => ({
  loadTrainingCatalog: () =>
    Promise.resolve({
      policies: [{ slug: 'osha-30-refresher', title: 'OSHA 30 refresher', on: io.enabled, requiredRoles: io.requiredRoles, goodForMonths: 12, dueSoonDays: 30, retakeFrom: io.retakeFrom, offered: io.offered }],
      missing: io.missing,
    }),
  loadTrainingStandings: () => Promise.resolve({ rows: io.rows, missing: false }),
  loadTrainingTakenCount: () => Promise.resolve(3),
  saveTrainingPolicy: io.save,
}))

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SettingsTrainingTab } from './SettingsTrainingTab'

async function open() {
  renderWithProviders(<SettingsTrainingTab />)
  await waitFor(() => expect(screen.getByText('OSHA 30 refresher')).toBeTruthy())
}
const section = () => document.querySelector('[data-training-policy="osha-30-refresher"]') as HTMLElement

beforeEach(() => {
  cleanup()
  io.missing = false
  io.enabled = true
  io.offered = false
  io.requiredRoles = ['helpers', 'subcontractor']
  io.retakeFrom = null
  io.save.mockClear()
})

describe('SettingsTrainingTab', () => {
  it('shows the course with its switch, role chips, numbers, the bundle facts and the counts', async () => {
    await open()
    const s = section()
    expect(within(s).getByText('On')).toBeTruthy()
    expect(within(s).getByText(/30 lessons and a final check/)).toBeTruthy()
    expect((within(s).getByText('✓ Helpers') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true')
    expect((within(s).getByText('Masters') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('false')
    expect((within(s).getByLabelText('Months a pass is good for') as HTMLInputElement).value).toBe('12')
    expect(within(s).getByText('1 current')).toBeTruthy()
    expect(within(s).getByText('1 lapsed')).toBeTruthy()
    expect(within(s).getByText('1 not done')).toBeTruthy()
    fireEvent.click(within(s).getByText('See who'))
    const who = s.querySelector('[data-training-who]') as HTMLElement
    expect(who.textContent).toContain('Dana R')
    expect(who.textContent).toContain('Priya K')
  })

  it('the switch and a role chip save the policy', async () => {
    await open()
    fireEvent.click(section().querySelector('[data-training-switch]') as HTMLButtonElement)
    await waitFor(() => expect(io.save).toHaveBeenCalledWith('osha-30-refresher', { enabled: false }, expect.any(String)))
    fireEvent.click(within(section()).getByText('Masters'))
    await waitFor(() => expect(io.save).toHaveBeenCalledWith('osha-30-refresher', { required_roles: ['helpers', 'subcontractor', 'master_technician'] }, expect.any(String)))
  })

  it('changing the numbers shows Save, which writes both', async () => {
    await open()
    const months = within(section()).getByLabelText('Months a pass is good for') as HTMLInputElement
    fireEvent.change(months, { target: { value: '6' } })
    fireEvent.click(within(section()).getByText('Save'))
    await waitFor(() => expect(io.save).toHaveBeenCalledWith('osha-30-refresher', { good_for_months: 6, due_soon_days: 30 }, expect.any(String)))
  })

  it('Everyone takes it again confirms with the count it turns red, then stamps today', async () => {
    await open()
    fireEvent.click(section().querySelector('[data-training-retake]') as HTMLButtonElement)
    await screen.findByText('Everyone takes it again?')
    expect(screen.getByText(/1 current person turns red/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Everyone takes it again' }))
    await waitFor(() => expect(io.save).toHaveBeenCalledTimes(1))
    const patch = (io.save.mock.calls[0] as unknown[])[1] as { retake_from: string }
    expect(patch.retake_from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('Preview the course opens the course page, the facts line carries no hash, and the retake day is a chip whose Clear puts the old passes back (v2.5577)', async () => {
    io.retakeFrom = '2026-10-16'
    await open()
    expect((section().querySelector('[data-training-preview]') as HTMLAnchorElement).getAttribute('href')).toBe('/training/osha-30-refresher')
    expect(within(section()).getByText(/30 lessons and a final check · about 3 h · ships with the app/)).toBeTruthy()
    expect(section().textContent).not.toContain('abcdef01')
    expect(within(section()).getByText(/Everyone takes it again from/)).toBeTruthy()
    fireEvent.click(section().querySelector('[data-training-retake-clear]') as HTMLButtonElement)
    await waitFor(() => expect(io.save).toHaveBeenCalledTimes(1))
    expect((io.save.mock.calls[0] as unknown[])[1]).toEqual({ retake_from: null })
    cleanup()
    io.retakeFrom = null
    await open()
    expect(section().querySelector('[data-training-retake-chip]')).toBeNull()
  })

  it('says so before the tables exist, and that an off course counts nobody', async () => {
    io.missing = true
    renderWithProviders(<SettingsTrainingTab />)
    await screen.findByText(/not switched on yet/)
    cleanup()
    io.missing = false
    io.enabled = false
    await open()
    expect(within(section()).getByText('Off')).toBeTruthy()
    expect(within(section()).getByText(/nobody is counted/)).toBeTruthy()
    expect((section().querySelector('[data-training-retake]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('Also open to · Everyone is the offered state (v2.5610): the chip saves it, and an offered course says how many took it', async () => {
    await open()
    const chip = section().querySelector('[data-training-offered]') as HTMLButtonElement
    expect(chip.getAttribute('aria-pressed')).toBe('false')
    expect(within(section()).getByText(/only the required roles see it/)).toBeTruthy()
    fireEvent.click(chip)
    await waitFor(() => expect(io.save).toHaveBeenCalledWith('osha-30-refresher', { offered: true }, expect.any(String)))
    cleanup()
    io.offered = true
    await open()
    expect((section().querySelector('[data-training-offered]') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true')
    await waitFor(() => expect(within(section()).getByText(/3 took it/)).toBeTruthy())
  })
})
