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
import { renderWithProviders } from '../../test/renderSmokeMocks'

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
})
