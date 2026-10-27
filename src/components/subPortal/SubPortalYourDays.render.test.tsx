// @vitest-environment jsdom
/**
 * Render smoke for Your days (v2.2930): cells word their counts, a tap opens
 * the day's list with addresses and a Map link, marking a booked day off
 * warns, and the toggle posts through the callback.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { SubPortalYourDays } from './SubPortalYourDays'
import { subPortalT } from '../../lib/subPortal/subPortalI18n'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

const DAYS = {
  bookings: [
    { start: '2026-09-09', end: '2026-09-10', label: 'Rough-in · #1004', address: '2210 Goforth Rd, Kyle', jobNumber: '1004', source: 'pick' as const, commitmentId: 'c1', note: null },
    { start: '2026-09-10', end: '2026-09-10', label: '#1017', address: '415 Bunton Creek Rd, Kyle', jobNumber: '1017', source: 'office' as const, commitmentId: null, note: 'morning' },
  ],
  offDays: ['2026-09-15'],
}
const t = (key: Parameters<typeof subPortalT>[1], vars?: Record<string, string>) => subPortalT('en', key, vars)

describe('SubPortalYourDays', () => {
  it('words the counts, opens a day, and marks a day off', async () => {
    const onToggleOff = vi.fn(async () => ({ ok: true }))
    renderWithProviders(<SubPortalYourDays days={DAYS} todayYmd="2026-09-07" lang="en" t={t} onToggleOff={onToggleOff} />)
    await settle()
    expect(screen.getByText('one job')).toBeTruthy()
    expect(screen.getByText('two jobs')).toBeTruthy()
    expect(screen.getByText('off')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('2026-09-10'))
    const sheet = screen.getByTestId('sub-day-sheet')
    expect(sheet.textContent).toContain('2 jobs')
    expect(sheet.textContent).toContain('2210 Goforth Rd, Kyle')
    expect(screen.getAllByText('Map ›')).toHaveLength(2)
    expect(sheet.textContent).toContain("You're booked")
    fireEvent.click(screen.getByLabelText('2026-09-16'))
    fireEvent.click(screen.getByText('Mark this day off'))
    await waitFor(() => expect(onToggleOff).toHaveBeenCalledWith('2026-09-16', true))
    await waitFor(() => expect(screen.getByText('Take this day back')).toBeTruthy())
  })

  it('a lost signal reads the offline sentence in the page’s language with Try again, which sends again (v2.5965)', async () => {
    const onToggleOff = vi
      .fn<(day: string, off: boolean) => Promise<{ ok: boolean; failure?: 'network' | 'gone' | 'refused' }>>()
      .mockResolvedValueOnce({ ok: false, failure: 'network' })
      .mockResolvedValue({ ok: true })
    const es = (key: Parameters<typeof subPortalT>[1], vars?: Record<string, string>) => subPortalT('es', key, vars)
    renderWithProviders(<SubPortalYourDays days={DAYS} todayYmd="2026-09-07" lang="es" t={es} onToggleOff={onToggleOff} phone="(512) 555-0101" />)
    await settle()
    fireEvent.click(screen.getByLabelText('2026-09-16'))
    fireEvent.click(screen.getByText(subPortalT('es', 'markOff')))
    await screen.findByText('Sin conexión. No se envió nada. Revise su señal e intente de nuevo.')
    expect(screen.queryByRole('link', { name: 'Llamar a la oficina' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }))
    await waitFor(() => expect(onToggleOff).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText(subPortalT('es', 'takeBack'))).toBeTruthy())
  })

  it('a refusal asks them to call, with Call the office, never the server’s words (v2.5965)', async () => {
    const onToggleOff = vi.fn(async () => ({ ok: false, failure: 'refused' as const }))
    renderWithProviders(<SubPortalYourDays days={DAYS} todayYmd="2026-09-07" lang="en" t={t} onToggleOff={onToggleOff} phone="(512) 555-0101" />)
    await settle()
    fireEvent.click(screen.getByLabelText('2026-09-16'))
    fireEvent.click(screen.getByText('Mark this day off'))
    await screen.findByText("We couldn't record that. Please call the office.")
    expect(screen.getByRole('link', { name: 'Call the office' }).getAttribute('href')).toBe('tel:+15125550101')
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('the function’s own sentence reads in the sub’s Spanish (v2.5965)', async () => {
    const onToggleOff = vi.fn(async () => ({ ok: false, failure: { kind: 'refused' as const, known: 'saidDayBehind' as const } }))
    const es = (key: Parameters<typeof subPortalT>[1], vars?: Record<string, string>) => subPortalT('es', key, vars)
    renderWithProviders(<SubPortalYourDays days={DAYS} todayYmd="2026-09-07" lang="es" t={es} onToggleOff={onToggleOff} phone="(512) 555-0101" />)
    await settle()
    fireEvent.click(screen.getByLabelText('2026-09-16'))
    fireEvent.click(screen.getByText(subPortalT('es', 'markOff')))
    await screen.findByText('Ese día ya pasó.')
    expect(screen.queryByText('That day is already behind us.')).toBeNull()
  })
})
