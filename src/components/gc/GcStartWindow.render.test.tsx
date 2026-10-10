// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { GcStartWindow, type StartPresses } from './GcStartWindow'
import { GcCompanyOpenerContext } from './gcCompanyOpener'
import { withSchedules } from '../../lib/gc/billCustomer'
import { boardStateFromRows, type BoardRows } from '../../lib/gc/boardRows'
import { awardedClinicBoardRows, readyClinicBoardRows as readyRows } from '../../lib/gc/boardTestRows'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { GcState } from '../../lib/gc/types'
import { renderWithProviders } from '../../test/renderSmokeMocks'

function presses(over: Partial<StartPresses> = {}): StartPresses {
  return {
    start: vi.fn(() => Promise.resolve({ told: ['Lonestar Earthworks'], missed: [] })),
    tellAgain: vi.fn(() => Promise.resolve({ told: ['Lonestar Earthworks'], missed: [] })),
    setPermit: vi.fn(() => Promise.resolve()),
    setStartDate: vi.fn(() => Promise.resolve()),
    signContract: vi.fn(() => Promise.resolve()),
    award: vi.fn(),
    openSow: vi.fn(),
    ...over,
  }
}

/** A drawn schedule to lay over the clinic: the prototype's Fair Oaks one, since the step only counts it. */
const drawn = () => initialGcState().projects.find((p) => p.id === 'fairoaksd')!.schedule!

/** The clinic won, its sitework awarded to Lonestar with nothing else in (concrete not awarded, our plumbing bid not priced). */
function notReadyRows(): BoardRows {
  return awardedClinicBoardRows()
}

function stateOf(rows: BoardRows, schedule = true): GcState {
  const state = boardStateFromRows(rows)
  return schedule ? withSchedules(state, new Map([['p1', drawn()]])) : state
}

/** Null presses: the window reads only. */
function open(state: GcState, p: StartPresses | null = presses(), told: string[] = []) {
  const openPartner = vi.fn()
  renderWithProviders(
    <GcCompanyOpenerContext.Provider value={{ openPartner }}>
      <GcStartWindow state={state} project={state.projects[0]!} {...(p ? { presses: p } : {})} told={told} ownBidHref={(id) => (id === 'k3' ? '/bids?tab=pricing&bidId=b7' : null)} onOpenSchedule={() => undefined} onClose={() => undefined} />
    </GcCompanyOpenerContext.Provider>,
  )
  return { p, openPartner, dialog: screen.getByRole('dialog', { name: 'Get started, Hill Country Clinic' }) }
}

describe('GcStartWindow', () => {
  it('not ready: names what is missing, keeps Start shut, and each trade’s Next opens where that work is done', () => {
    const { p, openPartner, dialog } = open(stateOf(notReadyRows(), false))
    const strip = dialog.querySelector('[data-gc-start-strip]') as HTMLElement
    expect(strip.textContent).toMatch(/^Not ready yet\. \d+ things are missing\.$/)
    const start = within(dialog).getByRole('button', { name: 'Start the project and tell the 1 on the job' }) as HTMLButtonElement
    expect(start.disabled).toBe(true)
    expect(start.title).toContain('The permit is in hand: not yet.')
    expect(within(dialog).getByText('Concrete: Pick a company and award the trade.')).toBeTruthy()
    expect(within(dialog).getByText('Plumbing: Price our own bid.')).toBeTruthy()
    // Sitework's first open step is the master agreement: the company's Documents, its send open.
    const sitework = dialog.querySelector('[data-gc-start-trade="k1"]') as HTMLElement
    expect(within(sitework).getByText('Send the master agreement.')).toBeTruthy()
    fireEvent.click(within(sitework).getByRole('button', { name: 'Send the master agreement' }))
    expect(openPartner).toHaveBeenCalledWith('lonestar', { tab: 'documents', doc: 'msa', send: true })
    // Our own crew links to its bid.
    const plumbing = dialog.querySelector('[data-gc-start-trade="k3"]') as HTMLElement
    expect(within(plumbing).getByRole('link', { name: 'Price our own bid' }).getAttribute('href')).toBe('/bids?tab=pricing&bidId=b7')
    expect(p?.start).not.toHaveBeenCalled()
  })

  it('Start anyway needs why, and sends what was missing as the window listed it', async () => {
    const state = stateOf(notReadyRows(), false)
    const { p, dialog } = open(state)
    const anyway = within(dialog).getByRole('button', { name: 'Start anyway' }) as HTMLButtonElement
    expect(anyway.disabled).toBe(true)
    fireEvent.change(within(dialog).getByLabelText('Why start anyway'), { target: { value: 'The customer wants the pad poured before the rain.' } })
    expect(anyway.disabled).toBe(false)
    fireEvent.click(anyway)
    await waitFor(() => expect(p?.start).toHaveBeenCalledTimes(1))
    const [arg] = (p!.start as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(arg.reason).toBe('The customer wants the pad poured before the rain.')
    expect(arg.missing).toContain('Concrete: Pick a company and award the trade.')
    expect(arg.missing).toContain('The schedule is drawn: not drawn yet.')
  })

  it('ready: nothing is missing, and Start starts it plainly', async () => {
    const { p, dialog } = open(stateOf(readyRows()))
    expect((dialog.querySelector('[data-gc-start-strip]') as HTMLElement).textContent).toBe('Ready to start. Nothing is missing.')
    expect(within(dialog).queryByRole('button', { name: 'Start anyway' })).toBeNull()
    expect(within(dialog).getAllByText('ready')).toHaveLength(2)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start the project and tell the 1 on the job' }))
    await waitFor(() => expect(p?.start).toHaveBeenCalledWith(undefined))
  })

  it('the customer’s steps: the permit, the start date, and our contract for the money team', async () => {
    const { p, dialog } = open(stateOf(readyRows({ owner_contract_signed_on: null, permit_on: null, owner_contract_sent_on: '2026-10-05' })))
    const contract = dialog.querySelector('[data-gc-start-owner="ownerContract"]') as HTMLElement
    expect(within(contract).getByText('sent Oct 5, waiting on their signature')).toBeTruthy()
    fireEvent.click(within(contract).getByRole('button', { name: 'Mark it signed' }))
    await waitFor(() => expect(p?.signContract).toHaveBeenCalledWith(true))
    fireEvent.click(within(dialog.querySelector('[data-gc-start-owner="permit"]') as HTMLElement).getByRole('button', { name: 'Mark it done' }))
    await waitFor(() => expect(p?.setPermit).toHaveBeenCalledWith(true))
    fireEvent.change(within(dialog).getByLabelText('The day work starts'), { target: { value: '2026-10-26' } })
    await waitFor(() => expect(p?.setStartDate).toHaveBeenCalledWith('2026-10-26'))
  })

  it('without the money team’s press, our contract only reads', () => {
    const { dialog } = open(stateOf(readyRows({ owner_contract_signed_on: null })), presses({ signContract: undefined }))
    expect(within(dialog.querySelector('[data-gc-start-owner="ownerContract"]') as HTMLElement).queryByRole('button')).toBeNull()
  })

  it('started: the day, who was told, Send again for anyone missed, and the table locked', async () => {
    const tellAgain = vi.fn(() => Promise.resolve({ told: ['Lonestar Earthworks'], missed: [] }))
    const state = stateOf(readyRows({ started_on: '2026-10-10' }))
    const { dialog } = open(
      { ...state, projects: state.projects.map((x) => ({ ...x, stage: 'building' as const })) },
      presses({ tellAgain }),
      [],
    )
    expect((dialog.querySelector('[data-gc-start-strip]') as HTMLElement).textContent).toBe('Started Oct 10. Work begins Mon Oct 19.')
    expect(within(dialog).queryByRole('button', { name: /Start the project/ })).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send again' }))
    await waitFor(() => expect(tellAgain).toHaveBeenCalledTimes(1))
    expect(await within(dialog).findByText('Told Lonestar Earthworks.')).toBeTruthy()
    expect(within(dialog).queryByRole('button', { name: 'Send again' })).toBeNull()
  })

  it('names a company the start email missed, with why', async () => {
    const start = vi.fn(() => Promise.resolve({ told: [], missed: [{ company: 'Lonestar Earthworks', why: 'No one at the company has an email for this kind of message. Call them.' }] }))
    const { dialog } = open(stateOf(readyRows()), presses({ start }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start the project and tell the 1 on the job' }))
    // Said at once, before the page reads the start back.
    expect(await within(dialog).findByText('Lonestar Earthworks was not told: No one at the company has an email for this kind of message. Call them.')).toBeTruthy()
  })

  it('started anyway: who, why, and what is still owed, with the steps still open', () => {
    const rows = notReadyRows()
    const started = { ...rows, userNames: { ...rows.userNames, u2: 'Grace' }, boardDates: { p1: { ...rows.boardDates.p1!, started_on: '2026-10-10', started_anyway_by: 'u2', started_anyway_reason: 'The pad pours before the rain.', started_anyway_missing: ['The permit is in hand: not yet.'] } } }
    const state = stateOf(started, false)
    const { openPartner, dialog } = open({ ...state, projects: state.projects.map((x) => ({ ...x, stage: 'building' as const })) }, presses(), ['Lonestar Earthworks'])
    expect(within(dialog).getByText(/Grace started it before everything was in: The pad pours before the rain\. Still owed:/)).toBeTruthy()
    expect(within(dialog).getByText('Concrete: Pick a company and award the trade.')).toBeTruthy()
    expect(within(dialog).getByText('Told Lonestar Earthworks.')).toBeTruthy()
    // The steps stay open until what is owed is in.
    fireEvent.click(within(dialog.querySelector('[data-gc-start-trade="k1"]') as HTMLElement).getByRole('button', { name: 'Send the master agreement' }))
    expect(openPartner).toHaveBeenCalled()
    expect(within(dialog.querySelector('[data-gc-start-owner="permit"]') as HTMLElement).getByRole('button', { name: 'Mark it done' })).toBeTruthy()
  })

  it('a drafted statement of work steps aside to the trade’s card, where it is sent', () => {
    const base = readyRows()
    const rows = { ...base, sows: (base.sows ?? []).map((s) => ({ ...s, status: 'draft' as const, sent_on: null, signed_on: null })) }
    const { p, dialog } = open(stateOf(rows))
    fireEvent.click(within(dialog.querySelector('[data-gc-start-trade="k1"]') as HTMLElement).getByRole('button', { name: 'Send the statement of work' }))
    expect(p?.openSow).toHaveBeenCalledWith('k1')
  })

  it('reads only without presses', () => {
    const { dialog } = open(stateOf(notReadyRows(), false), null)
    expect(within(dialog).queryByRole('button', { name: /Start/ })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Send the master agreement' })).toBeNull()
  })
})
