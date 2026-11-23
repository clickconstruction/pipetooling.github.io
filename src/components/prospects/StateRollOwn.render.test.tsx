// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { OwnRecord, OwnStateRow } from '../../lib/licenseRoll/ownLicenses'
import type { OwnLicensesRead } from '../../lib/licenseRoll/ownLicensesIo'

/**
 * Prospects → State roll → Our own (punch list #411). A card a plumbing license of ours beside the state's row,
 * the two chips, the press that takes the state's date, and the strip that picks the view. Every person, number
 * and day here is made up.
 */
const io = vi.hoisted(() => ({ readOwnLicenses: vi.fn(), saveOwnLicenseDate: vi.fn() }))
vi.mock('../../lib/licenseRoll/ownLicensesIo', () => io)
const pulls = vi.hoisted(() => ({ readRollPulls: vi.fn(), pullRollFile: vi.fn() }))
vi.mock('../../lib/licenseRoll/rollPullsIo', () => pulls)
const everyone = vi.hoisted(() => ({ EVERYONE_PAGE: 50, readEveryoneFrame: vi.fn(), readEveryonePage: vi.fn(), readPersonSheet: vi.fn(), readNotesFor: vi.fn(), addRollNote: vi.fn(), deleteRollNote: vi.fn(), leaveOffRoll: vi.fn(), putBackOnRoll: vi.fn() }))
vi.mock('../../lib/licenseRoll/everyoneIo', () => everyone)
vi.mock('../../utils/dateUtils', async (original) => ({ ...(await original<typeof import('../../utils/dateUtils')>()), todayYmdInAppTz: () => '2026-11-21' }))

import { StateRollOwn } from './StateRollOwn'
import { StateRollTab } from './StateRollTab'

function rec(over: Partial<OwnRecord> = {}): OwnRecord {
  return { key: 'pl:1', licenseId: '1', personName: 'Silas Okafor', text: 'Journeyman Plumber #J-000277', expiryYmd: '2026-01-31', sub: false, ...over }
}
function row(over: Partial<OwnStateRow> = {}): OwnStateRow {
  return { id: 'r1', license_class: 'journeyman', license_number: '000277', status: 'current', expires_on: '2027-01-31', last_name: 'OKAFOR', first_name: 'SILAS', county: 'BEXAR', insurance_ends_on: null, gone_on: null, ...over }
}
function read(over: Partial<OwnLicensesRead> = {}): OwnLicensesRead {
  return {
    records: [
      rec(),
      rec({ key: 'pl:2', licenseId: '2', personName: 'Joss Albrecht', text: 'Journeyman Plumber #301', expiryYmd: '2027-05-31' }),
      rec({ key: 'pl:3', licenseId: '3', personName: 'Wren Castellan', text: 'Journeyman Electrician #88001' }),
    ],
    roll: [row(), row({ id: 'r2', license_number: '000301', last_name: 'ALBRECHT', first_name: 'JOSS', expires_on: '2027-05-31' })],
    ...over,
  }
}
const cardOf = (key: string) => document.querySelector(`[data-own-license="${key}"]`) as HTMLElement | null

describe('StateRollOwn', () => {
  beforeEach(() => {
    io.readOwnLicenses.mockReset().mockResolvedValue(read())
    io.saveOwnLicenseDate.mockReset().mockResolvedValue(null)
  })
  afterEach(cleanup)

  it('opens on what needs a look, each license beside what the state says, each value apart from its words', async () => {
    renderWithProviders(<StateRollOwn />)
    await screen.findByText('Silas Okafor')
    const card = cardOf('pl:1')!
    expect(card.querySelector('[data-own-pill="state_later"]')?.textContent).toBe('The state has a later date')
    expect(card.textContent).toContain('Journeyman Plumber number J-000277')
    expect(card.textContent).toContain('Current until Jan 31, 2027')
    expect(card.textContent).toContain('Okafor, Silas · Bexar')
    expect(card.querySelectorAll('[data-value="worked-out"]').length).toBeGreaterThanOrEqual(4)
    // Our own date is the one value a person can change here.
    expect(screen.getByRole('button', { name: /Jan 31, 2026/ })).toBeTruthy()
    // The match is behind its chip, and the license of another trade is counted, not checked.
    expect(cardOf('pl:2')).toBeNull()
    expect(screen.getByRole('button', { name: 'Needs a look · 1' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(/license of another trade is not checked here/)).toBeTruthy()
  })

  it('shows the matches on their chip', async () => {
    renderWithProviders(<StateRollOwn />)
    fireEvent.click(await screen.findByRole('button', { name: 'Matches · 1' }))
    expect(cardOf('pl:2')!.querySelector('[data-own-pill="matches"]')?.textContent).toBe('Matches')
    expect(cardOf('pl:1')).toBeNull()
  })

  it('takes the state’s date on the press, says so, and reads again', async () => {
    renderWithProviders(<StateRollOwn />)
    fireEvent.click(await screen.findByRole('button', { name: 'Use the state’s date' }))
    await waitFor(() => expect(io.saveOwnLicenseDate).toHaveBeenCalledWith('1', '2027-01-31'))
    await screen.findByText('Silas Okafor: the date is now Jan 31, 2027.')
    await waitFor(() => expect(io.readOwnLicenses).toHaveBeenCalledTimes(2))
  })

  it('gives the reason when the date is refused, and leaves the card as it was', async () => {
    io.saveOwnLicenseDate.mockRejectedValue(new Error('Could not save the date: new row violates row-level security policy'))
    renderWithProviders(<StateRollOwn />)
    fireEvent.click(await screen.findByRole('button', { name: 'Use the state’s date' }))
    await screen.findByText(/new row violates row-level security policy/)
    expect(io.readOwnLicenses).toHaveBeenCalledTimes(1)
    expect(cardOf('pl:1')).toBeTruthy()
  })

  it('opens on the matches when nothing needs a look', async () => {
    io.readOwnLicenses.mockResolvedValue(read({ records: [rec({ expiryYmd: '2027-01-31' })] }))
    renderWithProviders(<StateRollOwn />)
    await screen.findByText('Silas Okafor')
    expect(screen.getByRole('button', { name: 'Matches · 1' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('button', { name: 'Use the state’s date' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Needs a look · 0' }))
    expect(screen.getByText('Nothing waiting on you.')).toBeTruthy()
  })

  it('with no plumbing license on file, says where one is added', async () => {
    io.readOwnLicenses.mockResolvedValue(read({ records: [], roll: [] }))
    renderWithProviders(<StateRollOwn />)
    const door = await screen.findByRole('link', { name: 'People → Licenses' })
    expect(door.getAttribute('href')).toBe('/people?tab=licenses')
  })

  it('says why when our licenses cannot be read, and reads again on the press', async () => {
    io.readOwnLicenses.mockRejectedValueOnce(new Error('Could not read our licenses: permission denied for table person_licenses'))
    renderWithProviders(<StateRollOwn />)
    await screen.findByText('Our own licenses could not be read.')
    expect(screen.getByText(/permission denied for table person_licenses/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Read it again' }))
    await screen.findByText('Silas Okafor')
  })
})

describe('StateRollTab · the views', () => {
  beforeEach(() => {
    io.readOwnLicenses.mockReset().mockResolvedValue(read())
    pulls.readRollPulls.mockReset().mockResolvedValue({ pulls: [], kept: {}, lapsed: 0, counties: ['BEXAR'] })
    everyone.readEveryoneFrame.mockReset().mockResolvedValue({ counties: ['BEXAR'], notes: [], current: 0, lapsed: 0, withNotes: 0, leftOff: [] })
    everyone.readEveryonePage.mockReset().mockResolvedValue({ rows: [], total: 0 })
  })
  afterEach(cleanup)

  it('has Everyone and Pulls, and never Our own, for a person who may not open People → Licenses', async () => {
    renderWithProviders(<StateRollTab />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Everyone' }).getAttribute('aria-current')).toBe('true'))
    expect(screen.getByRole('button', { name: 'Pulls' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Our own' })).toBeNull()
    expect(io.readOwnLicenses).not.toHaveBeenCalled()
  })

  it('opens on Our own for a person who may, and Pulls is one press away', async () => {
    renderWithProviders(<StateRollTab canSeeOwn />)
    await screen.findByText('Silas Okafor')
    expect(screen.getByRole('button', { name: 'Our own' }).getAttribute('aria-current')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Pulls' }))
    await screen.findByRole('button', { name: 'Pull 4 files' })
    expect(screen.getByRole('button', { name: 'Pulls' }).getAttribute('aria-current')).toBe('true')
  })

  it('never opens Our own from a link for a person who may not', async () => {
    renderWithProviders(<StateRollTab />, { route: '/prospects?tab=roll&roll=own' })
    await waitFor(() => expect(everyone.readEveryoneFrame).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Everyone' }).getAttribute('aria-current')).toBe('true')
    expect(io.readOwnLicenses).not.toHaveBeenCalled()
  })
})
