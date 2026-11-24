// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { EveryoneRow, NoteRow } from '../../lib/licenseRoll/everyone'
import type { EveryoneFrame, SheetRead } from '../../lib/licenseRoll/everyoneIo'

/**
 * Prospects → State roll → Everyone and the person's sheet (punch list #411, step three). The search and the chips,
 * a page of rows, a row opening the sheet, a note kept, Leave off with its ask and the way back. Every person,
 * number, ZIP and note here is made up.
 */
const io = vi.hoisted(() => ({
  EVERYONE_PAGE: 50,
  readEveryoneFrame: vi.fn(),
  readEveryonePage: vi.fn(),
  readPersonSheet: vi.fn(),
  readNotesFor: vi.fn(),
  addRollNote: vi.fn(),
  deleteRollNote: vi.fn(),
  leaveOffRoll: vi.fn(),
  putBackOnRoll: vi.fn(),
}))
vi.mock('../../lib/licenseRoll/everyoneIo', () => io)
vi.mock('../../utils/dateUtils', async (original) => ({ ...(await original<typeof import('../../utils/dateUtils')>()), todayYmdInAppTz: () => '2026-11-23' }))

import { StateRollEveryone } from './StateRollEveryone'

function row(over: Partial<EveryoneRow> = {}): EveryoneRow {
  return {
    id: 'r1',
    source: 'tsbpe',
    license_class: 'journeyman',
    license_number: 'J-90001',
    status: 'current',
    licensed_on: '2014-04-09',
    expires_on: '2027-03-31',
    last_name: 'SAMPLE',
    first_name: 'PAT',
    middle_name: '',
    suffix: '',
    name_key: 'sample|pat||78000',
    zip: '78000',
    county: 'BEXAR',
    endorsements: ['medical_gas'],
    company: '',
    insurance_ends_on: null,
    ours: false,
    first_seen_on: '2026-11-21',
    gone_on: null,
    ...over,
  }
}
const LONG = row({ id: 'r2', license_class: 'master', license_number: 'M-90002', first_name: 'MAXIMILIANA', middle_name: 'ESPERANZA', last_name: 'VANDERHOOGSTRAATEN-MACALLISTER', suffix: 'III', status: 'expired', expires_on: '2026-06-30', county: 'GUADALUPE', endorsements: [], ours: true, name_key: 'x|y||78001' })
function note(over: Partial<NoteRow> = {}): NoteRow {
  return { id: 'n1', source: 'tsbpe', license_class: 'journeyman', license_number: 'J-90001', name_key: 'sample|pat||78000', body: 'Met at the supply house.', noted_by: 'me', noted_by_name: 'Bed Holder', noted_at: '2026-11-22T15:00:00Z', ...over }
}
function frame(over: Partial<EveryoneFrame> = {}): EveryoneFrame {
  return { counties: ['BEXAR', 'GUADALUPE'], notes: [{ source: 'tsbpe', license_number: 'J-90001' }, { source: 'tsbpe', license_number: 'J-90001' }], current: 5687, lapsed: 819, withNotes: 1, leftOff: [], ...over }
}
function sheet(over: Partial<SheetRead> = {}): SheetRead {
  return {
    row: row(),
    changes: [
      { id: 'c2', seen_on: '2026-11-23', kind: 'renewed', was: { expires_on: '2026-03-31' }, now_is: { expires_on: '2027-03-31' } },
      { id: 'c1', seen_on: '2026-11-21', kind: 'first_seen', was: {}, now_is: {} },
    ],
    notes: [note()],
    firstPullDay: '2026-11-21',
    ...over,
  }
}

describe('StateRollEveryone', () => {
  beforeEach(() => {
    for (const fn of Object.values(io)) if (typeof fn === 'function') fn.mockReset()
    io.readEveryoneFrame.mockResolvedValue(frame())
    io.readEveryonePage.mockResolvedValue({ rows: [row(), LONG], total: 2 })
    io.readPersonSheet.mockResolvedValue(sheet())
    io.readNotesFor.mockResolvedValue([note(), note({ id: 'n2', body: 'Runs new construction.', noted_at: '2026-11-23T16:00:00Z' })])
    io.addRollNote.mockResolvedValue(undefined)
    io.leaveOffRoll.mockResolvedValue({ leftOffId: 'lo1', takenOff: 1, shownAs: 'Pat Sample, journeyman J-90001' })
    io.putBackOnRoll.mockResolvedValue(undefined)
  })
  afterEach(cleanup)

  it('reads our counties, opens on the current licenses, and draws a row a person with its columns', async () => {
    renderWithProviders(<StateRollEveryone canSeeOwn authUserId="me" />)
    await screen.findByText('Pat Sample')
    expect(io.readEveryonePage).toHaveBeenCalledWith(expect.objectContaining({ counties: ['BEXAR', 'GUADALUPE'], page: 0, search: '', filter: expect.objectContaining({ status: 'current' }) }))
    expect(screen.getByRole('button', { name: /Current · 5,687/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /Lapsed · 819/ }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: /Has our notes · 1/ })).toBeTruthy()
    const table = document.querySelector('[data-roll-everyone="table"]') as HTMLElement
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Name', 'License', 'Since', 'Expires', 'County', 'Ours'])
    const pat = document.querySelector('[data-roll-row="r1"]') as HTMLElement
    expect(pat.textContent).toContain('2014')
    expect(pat.textContent).toContain('Mar 31, 2027')
    expect(pat.textContent).toContain('Bexar')
    expect(pat.textContent).toContain('2 notes')
    expect(pat.textContent).toContain('Medical gas')
    const long = document.querySelector('[data-roll-row="r2"]') as HTMLElement
    expect(long.textContent).toContain('Maximiliana Esperanza Vanderhoogstraaten-Macallister III')
    expect(long.textContent).toContain('One of ours')
    expect(long.textContent).toContain('Lapsed')
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('Showing 2 of 2.')
  })

  it('never says one of ours to a person who may not open People → Licenses', async () => {
    renderWithProviders(<StateRollEveryone canSeeOwn={false} authUserId="me" />)
    await screen.findByText('Pat Sample')
    expect(screen.queryByText('One of ours')).toBeNull()
  })

  it('asks again on a chip and on a search, from the first page', async () => {
    renderWithProviders(<StateRollEveryone canSeeOwn authUserId="me" />)
    await screen.findByText('Pat Sample')
    fireEvent.click(screen.getByRole('button', { name: 'Master' }))
    await waitFor(() => expect(io.readEveryonePage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, filter: expect.objectContaining({ classes: ['master'] }) })))
    fireEvent.change(screen.getByPlaceholderText('Search a name or a license number'), { target: { value: 'sample' } })
    await waitFor(() => expect(io.readEveryonePage).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'sample', page: 0 })))
  })

  it('says what hides the rows when a search finds nobody, and clears it on the press', async () => {
    renderWithProviders(<StateRollEveryone canSeeOwn authUserId="me" />)
    await screen.findByText('Pat Sample')
    io.readEveryonePage.mockResolvedValue({ rows: [], total: 0 })
    fireEvent.change(screen.getByPlaceholderText('Search a name or a license number'), { target: { value: 'nobody' } })
    await screen.findByText(/No people match ‘nobody’/)
    io.readEveryonePage.mockResolvedValue({ rows: [row()], total: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    await screen.findByText('Pat Sample')
    expect((screen.getByPlaceholderText('Search a name or a license number') as HTMLInputElement).value).toBe('')
  })

  it('offers fifty more when the roll holds more than a page', async () => {
    io.readEveryonePage.mockResolvedValueOnce({ rows: [row()], total: 120 }).mockResolvedValueOnce({ rows: [LONG], total: 120 })
    renderWithProviders(<StateRollEveryone canSeeOwn authUserId="me" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Show 50 more' }))
    await screen.findByText('Maximiliana Esperanza Vanderhoogstraaten-Macallister III')
    expect(io.readEveryonePage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
    expect(screen.getByText('Pat Sample')).toBeTruthy()
  })

  it('opens the sheet: the state’s facts, what changed from our first pull, and our notes', async () => {
    renderWithProviders(<StateRollEveryone canSeeOwn authUserId="me" />, { route: '/prospects?tab=roll&roll=everyone&person=r1' })
    const sheetEl = await waitFor(() => {
      const el = document.querySelector('[data-roll-sheet="r1"]') as HTMLElement | null
      expect(el).toBeTruthy()
      return el!
    })
    await within(sheetEl).findByText('J-90001')
    expect(io.readPersonSheet).toHaveBeenCalledWith('r1')
    expect(sheetEl.textContent).toContain('Bexar County, 78000')
    expect(sheetEl.textContent).toContain('Renewed. Expires Mar 31, 2027.')
    expect(sheetEl.textContent).toContain('First seen on the roll, on our first pull.')
    expect(sheetEl.textContent).toContain('Met at the supply house.')
    expect(within(sheetEl).getByRole('button', { name: 'Delete my note' })).toBeTruthy()
    expect(screen.queryByText(/Cell/)).toBeNull()
    expect(screen.queryByText(/OK to text/)).toBeNull()
  })

  it('keeps a note written on the sheet, and refuses a blank one in words', async () => {
    renderWithProviders(<StateRollEveryone canSeeOwn authUserId="me" />, { route: '/prospects?tab=roll&person=r1' })
    fireEvent.click(await screen.findByRole('button', { name: 'Add a note' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep the note' }))
    await screen.findByText('Write the note first.')
    expect(io.addRollNote).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText(/A note for the office/), { target: { value: '  Runs new construction.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep the note' }))
    await waitFor(() => expect(io.addRollNote).toHaveBeenCalledWith(expect.objectContaining({ license_number: 'J-90001' }), 'Runs new construction.'))
    await screen.findByText('Runs new construction.')
  })

  it('asks before Leave off with a press that names the act, then offers the way back', async () => {
    renderWithProviders(<StateRollEveryone canSeeOwn authUserId="me" />, { route: '/prospects?tab=roll&person=r1' })
    fireEvent.click(await screen.findByRole('button', { name: 'Leave off' }))
    await screen.findByText('Leave Pat Sample off the roll?')
    expect(io.leaveOffRoll).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Leave Pat off' }))
    await waitFor(() => expect(io.leaveOffRoll).toHaveBeenCalledWith('r1', ''))
    await screen.findByText('Pat Sample, journeyman J-90001 is left off the roll.')
    fireEvent.click(screen.getByRole('button', { name: 'Put back' }))
    await waitFor(() => expect(io.putBackOnRoll).toHaveBeenCalledWith('lo1'))
    await waitFor(() => expect(document.querySelector('[data-roll-sheet]')).toBeNull())
  })

  it('draws no Leave off on one of our own licenses', async () => {
    io.readPersonSheet.mockResolvedValue(sheet({ row: row({ ours: true }) }))
    renderWithProviders(<StateRollEveryone canSeeOwn authUserId="me" />, { route: '/prospects?tab=roll&person=r1' })
    await screen.findByText('This license is one of ours, so it stays on the roll.')
    expect(screen.queryByRole('button', { name: 'Leave off' })).toBeNull()
  })

  it('lists who is left off at the foot, each with Put back on the list', async () => {
    io.readEveryoneFrame.mockResolvedValue(frame({ leftOff: [{ id: 'lo9', license_number: 'T-90009', shown_as: 'Lee Madeup, tradesman T-90009', note: 'Asked by phone.', noted_by_name: 'Bed Holder', noted_at: '2026-11-20T15:00:00Z' }] }))
    renderWithProviders(<StateRollEveryone canSeeOwn authUserId="me" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Show them' }))
    expect(screen.getByText('Lee Madeup, tradesman T-90009')).toBeTruthy()
    expect(screen.getByText('Asked by phone.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Put back on the list' }))
    await waitFor(() => expect(io.putBackOnRoll).toHaveBeenCalledWith('lo9'))
  })
})
