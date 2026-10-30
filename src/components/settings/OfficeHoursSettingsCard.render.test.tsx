// @vitest-environment jsdom
/**
 * Punch list #140 PR 1: Settings → Phone and texts → Office hours over a fake io. The owner edits the days and the two
 * times and saves them with the tech's hour and the after-hours number kept; a bad draft says why and cannot save;
 * everyone else reads the line; a refused save keeps the draft and says why. Punch list #141 PR 1: the switch on hides
 * the days and times and saves `always: true` with the hours kept; off puts them back; a reader sees the lines.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OFFICE_HOURS, type OfficeHours } from '../../lib/messages/hasRule'
import { OFFICE_HOURS_WORDS as W } from '../../lib/messages/officeHoursCard'
import type { OfficeHoursIo } from '../../lib/messages/officeHoursCardIo'
import type { PushCoverageIo } from '../../lib/messages/pushCoverageIo'
import type { CoverageMember } from '../../lib/messages/whoIsOff'
import { renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import { OfficeHoursSettingsCard } from './OfficeHoursSettingsCard'
import { useLocation } from 'react-router-dom'

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location-probe">{loc.pathname + loc.search + loc.hash}</div>
}

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const KEPT: OfficeHours = { ...OFFICE_HOURS, techUntil: '16:00', emergency: '512-555-0144' }

function fakeIo(hours: OfficeHours = KEPT, over: Partial<OfficeHoursIo> = {}): OfficeHoursIo {
  return { load: vi.fn(async () => ({ hours, raw: JSON.stringify(hours) })), save: vi.fn(async () => undefined), ...over }
}

const card = () => within(document.querySelector<HTMLElement>('[data-settings-hours]')!)
const line = () => document.querySelector<HTMLElement>('[data-office-hours-line]')!.textContent
const techLine = () => document.querySelector<HTMLElement>('[data-office-hours-tech]')!.textContent
const saveButton = () => card().getByRole('button', { name: W.save }) as HTMLButtonElement
const alwaysSwitch = () => card().getByRole('switch', { name: W.always })
const NOW = '2026-10-21T15:00:00.000Z'
const TECH_LINE = 'A tech who texts a customer keeps the replies until 4:00 PM.'

afterEach(cleanup)

describe('OfficeHoursSettingsCard', () => {
  it('reads the hours for the owner: the days pressed, the two times and the line', async () => {
    renderWithProviders(<OfficeHoursSettingsCard role="master_technician" io={fakeIo()} now={() => NOW} />)
    const monday = await screen.findByRole('button', { name: 'Monday' })
    expect(monday.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Saturday' }).getAttribute('aria-pressed')).toBe('false')
    expect((screen.getByLabelText(W.opens) as HTMLInputElement).value).toBe('07:30')
    expect((screen.getByLabelText(W.closes) as HTMLInputElement).value).toBe('17:00')
    expect(line()).toBe('Mon to Fri, 7:30 AM to 5:00 PM')
    expect(saveButton().disabled).toBe(true)
    expect(card().getByText(W.note)).toBeTruthy()
    expect(alwaysSwitch().getAttribute('aria-checked')).toBe('false')
    expect(alwaysSwitch().textContent).toBe('Off')
    expect(techLine()).toBe(TECH_LINE)
    expect(card().queryByText(W.alwaysWhoever)).toBeNull()
  })

  it('saves changed days and times, keeps the tech’s hour and the after-hours number, and stamps the save', async () => {
    const io = fakeIo()
    renderWithProviders(<OfficeHoursSettingsCard role="master_technician" io={io} now={() => NOW} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Saturday' }))
    fireEvent.change(screen.getByLabelText(W.closes), { target: { value: '17:30' } })
    expect(line()).toBe('Mon to Sat, 7:30 AM to 5:30 PM')
    expect(saveButton().disabled).toBe(false)

    fireEvent.click(saveButton())
    await waitFor(() => expect(io.save).toHaveBeenCalledTimes(1))
    const written = JSON.parse((io.save as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string) as Record<string, unknown>
    expect(written).toEqual({ days: [1, 2, 3, 4, 5, 6], opens: '07:30', closes: '17:30', techUntil: '16:00', emergency: '512-555-0144', always: false, savedAt: NOW })
    expect(await screen.findByText(W.saved)).toBeTruthy()
    await waitFor(() => expect(saveButton().disabled).toBe(true))
    expect(line()).toBe('Mon to Sat, 7:30 AM to 5:30 PM')
  })

  it('refuses a draft with no days or a close at or before the open, and says why', async () => {
    const io = fakeIo()
    renderWithProviders(<OfficeHoursSettingsCard role="master_technician" io={io} now={() => NOW} />)
    await screen.findByRole('button', { name: 'Monday' })
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) fireEvent.click(screen.getByRole('button', { name: day }))
    expect(line()).toBe(W.noDays)
    expect(saveButton().disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Monday' }))
    fireEvent.change(screen.getByLabelText(W.opens), { target: { value: '18:00' } })
    expect(line()).toBe(W.closeBeforeOpen)
    expect(saveButton().disabled).toBe(true)
    fireEvent.click(saveButton())
    expect(io.save).not.toHaveBeenCalled()
  })

  it('puts the draft back to the saved hours', async () => {
    renderWithProviders(<OfficeHoursSettingsCard role="dev" io={fakeIo()} now={() => NOW} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Sunday' }))
    fireEvent.change(screen.getByLabelText(W.opens), { target: { value: '08:00' } })
    expect(line()).toBe('Sun to Fri, 8:00 AM to 5:00 PM')
    fireEvent.click(card().getByRole('button', { name: W.putBack }))
    expect(line()).toBe('Mon to Fri, 7:30 AM to 5:00 PM')
    expect((screen.getByLabelText(W.opens) as HTMLInputElement).value).toBe('07:30')
    expect(saveButton().disabled).toBe(true)
  })

  it('shows an assistant the line, the tech’s hour and no way to change them', async () => {
    renderWithProviders(<OfficeHoursSettingsCard role="assistant" io={fakeIo()} now={() => NOW} />)
    expect(await screen.findByText('Mon to Fri, 7:30 AM to 5:00 PM')).toBeTruthy()
    expect(techLine()).toBe(TECH_LINE)
    expect(card().getByText(W.notAllowed)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Monday' })).toBeNull()
    expect(screen.queryByRole('button', { name: W.save })).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('the switch on hides the days and times, reads the one line, and saves always with the hours kept (punch list #141 PR 1)', async () => {
    const io = fakeIo()
    renderWithProviders(<OfficeHoursSettingsCard role="master_technician" io={io} now={() => NOW} />)
    await screen.findByRole('button', { name: 'Monday' })
    fireEvent.click(alwaysSwitch())
    expect(alwaysSwitch().getAttribute('aria-checked')).toBe('true')
    expect(alwaysSwitch().textContent).toBe('On')
    expect(screen.queryByRole('button', { name: 'Monday' })).toBeNull()
    expect(screen.queryByLabelText(W.opens)).toBeNull()
    expect(line()).toBe(W.alwaysLine)
    expect(card().getByText(W.alwaysWhoever)).toBeTruthy()
    expect(card().getByText(W.alwaysOffice)).toBeTruthy()
    expect(techLine()).toBe(TECH_LINE)
    expect(saveButton().disabled).toBe(false)

    fireEvent.click(saveButton())
    await waitFor(() => expect(io.save).toHaveBeenCalledTimes(1))
    const written = JSON.parse((io.save as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string) as Record<string, unknown>
    expect(written).toEqual({ days: [1, 2, 3, 4, 5], opens: '07:30', closes: '17:00', techUntil: '16:00', emergency: '512-555-0144', always: true, savedAt: NOW })
    expect(await screen.findByText(W.saved)).toBeTruthy()
    await waitFor(() => expect(saveButton().disabled).toBe(true))
    expect(line()).toBe(W.alwaysLine)
  })

  it('the switch off puts the kept days and times back, and Put them back undoes a press', async () => {
    const io = fakeIo({ ...KEPT, days: [1, 2, 3], opens: '08:00', closes: '16:00', always: true })
    renderWithProviders(<OfficeHoursSettingsCard role="dev" io={io} now={() => NOW} />)
    await waitFor(() => expect(alwaysSwitch().getAttribute('aria-checked')).toBe('true'))
    expect(line()).toBe(W.alwaysLine)
    expect(screen.queryByRole('button', { name: 'Monday' })).toBeNull()
    expect(saveButton().disabled).toBe(true)

    fireEvent.click(alwaysSwitch())
    expect(screen.getByRole('button', { name: 'Monday' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Thursday' }).getAttribute('aria-pressed')).toBe('false')
    expect((screen.getByLabelText(W.opens) as HTMLInputElement).value).toBe('08:00')
    expect(line()).toBe('Mon to Wed, 8:00 AM to 4:00 PM')
    expect(card().queryByText(W.alwaysWhoever)).toBeNull()
    expect(saveButton().disabled).toBe(false)

    fireEvent.click(card().getByRole('button', { name: W.putBack }))
    expect(alwaysSwitch().getAttribute('aria-checked')).toBe('true')
    expect(line()).toBe(W.alwaysLine)
    expect(saveButton().disabled).toBe(true)

    fireEvent.click(alwaysSwitch())
    fireEvent.click(saveButton())
    await waitFor(() => expect(io.save).toHaveBeenCalledTimes(1))
    const written = JSON.parse((io.save as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string) as Record<string, unknown>
    expect(written).toEqual({ days: [1, 2, 3], opens: '08:00', closes: '16:00', techUntil: '16:00', emergency: '512-555-0144', always: false, savedAt: NOW })
  })

  it('shows a reader the switch’s line and the tech’s hour while it is on', async () => {
    renderWithProviders(<OfficeHoursSettingsCard role="assistant" io={fakeIo({ ...KEPT, always: true })} now={() => NOW} />)
    expect(await screen.findByText(W.alwaysLine)).toBeTruthy()
    expect(card().getByText(W.alwaysWhoever)).toBeTruthy()
    expect(card().getByText(W.alwaysOffice)).toBeTruthy()
    expect(techLine()).toBe(TECH_LINE)
    expect(card().getByText(W.notAllowed)).toBeTruthy()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('keeps the draft and says why when the save is refused', async () => {
    const io = fakeIo(KEPT, { save: vi.fn(async () => Promise.reject(new Error(W.notSaved))) })
    renderWithProviders(<OfficeHoursSettingsCard role="master_technician" io={io} now={() => NOW} />)
    fireEvent.change(await screen.findByLabelText(W.closes), { target: { value: '18:00' } })
    fireEvent.click(saveButton())
    expect((await screen.findByRole('alert')).textContent).toContain(W.notSaved)
    expect((screen.getByLabelText(W.closes) as HTMLInputElement).value).toBe('18:00')
    expect(saveButton().disabled).toBe(false)
  })

  it('says why when the hours cannot be read', async () => {
    renderWithProviders(<OfficeHoursSettingsCard role="master_technician" io={fakeIo(KEPT, { load: vi.fn(async () => Promise.reject(new Error('Could not read the office hours.'))) })} />)
    expect((await screen.findByRole('alert')).textContent).toContain('Could not read the office hours.')
    expect(screen.queryByRole('button', { name: 'Monday' })).toBeNull()
  })
})

/** Every day, 6 AM to 8 PM: the Push me default, as three office members kept it. */
const EVERY_DAY: OfficeHours = { ...OFFICE_HOURS, days: [0, 1, 2, 3, 4, 5, 6], opens: '06:00', closes: '20:00', always: false }
const OFFICE: CoverageMember[] = [
  { name: 'Rosa Delgado', hours: EVERY_DAY },
  { name: 'Evan Hart', hours: EVERY_DAY },
  { name: 'Taunya Reed', hours: EVERY_DAY },
]
const fakeCoverage = (members: CoverageMember[] = OFFICE): PushCoverageIo => ({ load: vi.fn(async () => members) })
const coverageLine = () => document.querySelector<HTMLElement>('[data-office-hours-coverage]')

describe('OfficeHoursSettingsCard: the coverage line (v2.6060, punch list #141 PR 4)', () => {
  it('while the switch is on, says the hours nobody in the office is pushed, and who is off then', async () => {
    const coverage = fakeCoverage()
    renderWithProviders(<OfficeHoursSettingsCard role="master_technician" io={fakeIo({ ...KEPT, always: true })} coverage={coverage} now={() => NOW} />)
    await screen.findByRole('switch', { name: W.always })
    await waitFor(() => expect(coverageLine()).not.toBeNull())
    expect(coverageLine()!.textContent).toBe('Nobody hears a reply from 8 PM to 6 AM. Rosa, Evan and Taunya are all off then.')
    expect(coverage.load).toHaveBeenCalledTimes(1)
  })

  it('appears as the switch is pressed on, before the save, and goes as it is pressed off', async () => {
    renderWithProviders(<OfficeHoursSettingsCard role="master_technician" io={fakeIo()} coverage={fakeCoverage()} now={() => NOW} />)
    await screen.findByRole('switch', { name: W.always })
    await waitFor(() => expect(coverageLine()).toBeNull())
    fireEvent.click(alwaysSwitch())
    await waitFor(() => expect(coverageLine()).not.toBeNull())
    fireEvent.click(alwaysSwitch())
    expect(coverageLine()).toBeNull()
  })

  it('draws no line when someone in the office is pushed any time, or when the read brought nobody', async () => {
    renderWithProviders(<OfficeHoursSettingsCard role="master_technician" io={fakeIo({ ...KEPT, always: true })} coverage={fakeCoverage([...OFFICE, { name: 'Marcus Lee', hours: null }])} now={() => NOW} />)
    await screen.findByRole('switch', { name: W.always })
    await waitFor(() => expect(card().getByText(W.alwaysWhoever)).toBeTruthy())
    expect(coverageLine()).toBeNull()
    cleanup()
    renderWithProviders(<OfficeHoursSettingsCard role="master_technician" io={fakeIo({ ...KEPT, always: true })} coverage={fakeCoverage([])} now={() => NOW} />)
    await screen.findByRole('switch', { name: W.always })
    expect(coverageLine()).toBeNull()
  })

  it('a reader never reads the team: the line is the owner’s to act on', async () => {
    const coverage = fakeCoverage()
    renderWithProviders(<OfficeHoursSettingsCard role="assistant" io={fakeIo({ ...KEPT, always: true })} coverage={coverage} now={() => NOW} />)
    await screen.findByText(W.notAllowed)
    expect(coverage.load).not.toHaveBeenCalled()
    expect(coverageLine()).toBeNull()
  })
})

describe('OfficeHoursSettingsCard: the coverage grid (v2.6154, punch list #217, office-11)', () => {
  /** Mon to Fri, 6 AM to 8 PM: the weekend off. */
  const WEEKDAYS: OfficeHours = { ...EVERY_DAY, days: [1, 2, 3, 4, 5] }
  const TEAM: CoverageMember[] = [
    { id: 'u-rosa', name: 'Rosa Delgado', hours: WEEKDAYS },
    { id: SMOKE_AUTH_USER_ID, name: 'Taunya Reed', hours: WEEKDAYS },
  ]
  const grid = () => document.querySelector<HTMLElement>('[data-coverage-grid]')

  it('draws the hours the line is read from above it: a row a person, the gaps as columns with their times, the weekend as a chip', async () => {
    renderWithProviders(<OfficeHoursSettingsCard role="master_technician" io={fakeIo({ ...KEPT, always: true })} coverage={fakeCoverage(TEAM)} now={() => NOW} />)
    await screen.findByRole('switch', { name: W.always })
    await waitFor(() => expect(grid()).not.toBeNull())
    const g = within(grid()!)
    expect(g.getByText('Who hears a reply')).toBeTruthy()
    expect(grid()!.querySelectorAll('[data-coverage-panel]')).toHaveLength(1)
    expect(grid()!.querySelector('[data-coverage-panel]')!.getAttribute('data-coverage-panel')).toBe('Mon to Fri')
    expect(grid()!.querySelectorAll('[data-coverage-row]')).toHaveLength(2)
    expect(g.getAllByLabelText('Rosa: 6 AM to 8 PM')).toHaveLength(1)
    expect(g.getByText('nobody to 6 AM')).toBeTruthy()
    expect(g.getByText('nobody from 8 PM')).toBeTruthy()
    expect(grid()!.querySelector('[data-coverage-row]')!.querySelectorAll('[data-coverage-gap]')).toHaveLength(2)
    expect(g.getByText('Nobody Fri 8 PM to Mon 6 AM')).toBeTruthy()
    // The line stays under the grid as its caption.
    expect(coverageLine()!.textContent).toBe('Nobody hears a reply from 8 PM to 6 AM on Mon to Thu. Nobody hears a reply from Fri 8 PM to Mon 6 AM. Rosa and Taunya are both off then.')
    expect(grid()!.compareDocumentPosition(coverageLine()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('a press on a row opens that person’s hours: your own on Your account, another’s desk', async () => {
    renderWithProviders(
      <>
        <OfficeHoursSettingsCard role="master_technician" io={fakeIo({ ...KEPT, always: true })} coverage={fakeCoverage(TEAM)} now={() => NOW} />
        <LocationProbe />
      </>,
    )
    await screen.findByRole('switch', { name: W.always })
    await waitFor(() => expect(grid()).not.toBeNull())
    const g = within(grid()!)
    const mine = g.getByRole('button', { name: 'You: open your Push me hours.' })
    expect(mine.textContent).toBe('You')
    fireEvent.click(mine)
    expect(screen.getByTestId('location-probe').textContent).toBe('/settings?tab=settings-account#settings-push-hours')
    const rosa = g.getByRole('button', { name: 'Rosa: open their desk. Only Rosa can set their hours.' })
    expect(rosa.textContent).toBe('Rosa')
    fireEvent.click(rosa)
    expect(screen.getByTestId('location-probe').textContent).toBe('/settings?tab=settings-phone-texts&person=u:u-rosa')
  })

  it('draws no grid while the switch is off, when there is no gap, or for a reader', async () => {
    renderWithProviders(<OfficeHoursSettingsCard role="master_technician" io={fakeIo()} coverage={fakeCoverage(TEAM)} now={() => NOW} />)
    await screen.findByRole('switch', { name: W.always })
    expect(grid()).toBeNull()
    fireEvent.click(alwaysSwitch())
    await waitFor(() => expect(grid()).not.toBeNull())
    fireEvent.click(alwaysSwitch())
    expect(grid()).toBeNull()
    cleanup()
    renderWithProviders(<OfficeHoursSettingsCard role="master_technician" io={fakeIo({ ...KEPT, always: true })} coverage={fakeCoverage([...TEAM, { id: 'u-max', name: 'Max Hart', hours: null }])} now={() => NOW} />)
    await screen.findByRole('switch', { name: W.always })
    await waitFor(() => expect(card().getByText(W.alwaysWhoever)).toBeTruthy())
    expect(grid()).toBeNull()
    cleanup()
    renderWithProviders(<OfficeHoursSettingsCard role="assistant" io={fakeIo({ ...KEPT, always: true })} coverage={fakeCoverage(TEAM)} now={() => NOW} />)
    await screen.findByText(W.notAllowed)
    expect(grid()).toBeNull()
  })
})
