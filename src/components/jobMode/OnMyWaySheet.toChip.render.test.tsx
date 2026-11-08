// @vitest-environment jsdom
/**
 * Punch list #118, PR 2 (the card's call 5): the To chip on Job Mode's On my way, at a phone's 375 px. With the
 * customer's numbers read, the sheet draws the chip over the preview and the press sends to the number it names; with
 * two numbers the tech switches this once, and the tick *Make this their usual number* stars it through the io before
 * the text goes; with no numbers read (the door not pushed yet) there is no chip and quo-send picks. Made-up people:
 * Luis on the job, Dana Whitfield.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { phoneLinesFromRows, type PhoneLineRow } from '../../lib/jobModeMessageCustomer'
import type { JobModeCustomer } from '../../lib/jobModeMessageCustomerIo'
import type { OnMyWayIo } from '../../lib/jobModeOnMyWayIo'
import { OnMyWaySheet, type OnMyWayDestination } from './OnMyWaySheet'

vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

const row = (id: string, text: string, extra: Partial<PhoneLineRow>): PhoneLineRow => ({
  id, text, for_kind: 'customer', step_key: null, scope: 'team', added_by: 'rosa', added_at: '2026-10-12T14:00:00Z', removed_at: null,
  phone_order: null, phone_name: null, text_es: null, ...extra,
})
const LINES = phoneLinesFromRows([
  row('q1', '{first}, this is {me} with Click Plumbing. I am on my way, about {minutes} minutes out.', { phone_order: 1, phone_name: 'On my way', phone_press: 'on_my_way' }),
  row('q2', '{first}, this is {me} with Click Plumbing. I am here at {address}.', { phone_order: 2, phone_name: 'I’m here', phone_press: 'im_here' }),
]).map((l, i) => ({ ...l, phonePress: (['on_my_way', 'im_here'] as const)[i] ?? null }))

const DANA_ONE: JobModeCustomer = {
  customerId: 'cust-dana', customerName: 'Dana Whitfield', contactId: 'contact-dana', tail: [],
  numbers: [{ channelId: 'ch-1', value: '(830) 555-0121', optedOutAt: null, usualAt: null }],
  lines: [],
}
/** Dana's landline, which the thread carried a line on, and the cell she texted from once, newer. */
const DANA_TWO: JobModeCustomer = {
  ...DANA_ONE,
  numbers: [
    { channelId: 'ch-1', value: '(830) 555-0121', optedOutAt: null, usualAt: null },
    { channelId: 'ch-2', value: '(830) 555-0190', optedOutAt: null, usualAt: null },
  ],
  lines: [{ channelId: 'ch-1', at: '2026-10-10T15:00:00Z', direction: 'out' }],
}
const DANA_NONE: JobModeCustomer = { customerId: 'cust-dana', customerName: 'Dana Whitfield', contactId: 'contact-dana', tail: [] }

const WHITFIELD: OnMyWayDestination = { jobId: 'job-512', label: 'PLUM 512 · Whitfield water heater', sublabel: '10:30 AM · 1208 Mesquite Ln', suggested: true, jobName: 'Whitfield water heater', jobAddress: '1208 Mesquite Ln', timeEnd: '13:00:00' }

const ME = { lat: 29.653, lng: -97.797 }
const FAR = { lat: 29.653, lng: -97.68 }
const NOON_15 = Date.parse('2026-10-16T17:15:00Z')

type Fake = OnMyWayIo & { send: ReturnType<typeof vi.fn>; makeUsual: ReturnType<typeof vi.fn> }
function fakeIo(customer: JobModeCustomer): Fake {
  return {
    loadCustomer: vi.fn(() => Promise.resolve(customer)),
    loadLines: vi.fn(() => Promise.resolve(LINES)),
    loadBlocks: vi.fn(() => Promise.resolve([])),
    send: vi.fn(() => Promise.resolve()),
    noteToOffice: vi.fn(() => Promise.resolve()),
    loadTextsOn: vi.fn(() => Promise.resolve(true)),
    loadPressLines: vi.fn(() => Promise.resolve(LINES)),
    loadJobPoint: vi.fn(() => Promise.resolve(FAR)),
    loadMyPoint: vi.fn(() => Promise.resolve(ME)),
    loadTravelFacts: vi.fn(() => Promise.resolve(null)),
    arrive: vi.fn(() => Promise.resolve(true)),
    loadMyBio: vi.fn(() => Promise.resolve(null)),
    loadIntroduced: vi.fn(() => Promise.resolve(null)),
    makeUsual: vi.fn(() => Promise.resolve()),
  } as Fake
}

function mount(io: OnMyWayIo) {
  const apply = vi.fn(() => Promise.resolve({ ok: true, error: null }))
  renderWithProviders(
    <OnMyWaySheet userId="luis" me="Luis Ortega" role="primary" destinations={[WHITFIELD]} initialJobId={null} leaving={null} canFinishDay={false} apply={apply} onFinishDay={vi.fn()} onDone={vi.fn()} onClose={vi.fn()} io={io} today="2026-10-16" now={() => NOON_15} />,
  )
  return { apply }
}

async function guessed(): Promise<void> {
  await waitFor(() => expect((screen.getByTestId('on-my-way-minutes') as HTMLInputElement).value).toBe('20'))
}

async function pressPrimary() {
  const primary = screen.getByTestId('on-my-way-primary') as HTMLButtonElement
  await waitFor(() => expect(primary.disabled).toBe(false), { timeout: 4000 })
  fireEvent.click(primary)
}

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
  window.matchMedia = ((q: string) => ({ matches: /max-width:\s*640px/.test(q), media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia
})
afterEach(cleanup)

describe('the To chip on On my way (punch list #118, PR 2)', { timeout: 15_000 }, () => {
  it('with one number the chip is a label over the preview, and the press sends to it', async () => {
    const io = fakeIo(DANA_ONE)
    mount(io)
    await screen.findByTestId('on-my-way-preview')
    await guessed()
    const to = screen.getByTestId('on-my-way-to')
    expect(to.querySelector('[data-to-chip]')?.textContent).toBe('To (830) 555-0121')
    expect(within(to).queryByRole('button')).toBeNull()
    await pressPrimary()
    await waitFor(() => expect(io.send).toHaveBeenCalledWith(expect.objectContaining({ from: 'job_mode', quickReplyId: 'q1', channelId: 'ch-1' })))
    expect(io.makeUsual).not.toHaveBeenCalled()
  })

  it('with two the tech switches, the tick stars the pick before the text goes, and the bio follows the same number', async () => {
    const io = fakeIo(DANA_TWO)
    io.loadIntroduced = vi.fn(() => Promise.resolve(false))
    io.loadMyBio = vi.fn(() => Promise.resolve([{ id: 'b1', text: '{me} has been a plumber for twelve years.', textEs: null, position: 1, addedAt: 1, removed: false, offByUser: false }]))
    mount(io)
    await screen.findByTestId('on-my-way-preview')
    await guessed()
    const to = screen.getByTestId('on-my-way-to')
    fireEvent.click(within(to).getByRole('button', { name: /^To \(830\) 555-0121/ }))
    const menu = within(to).getByRole('menu', { name: 'Which number' })
    const rows = within(menu).getAllByRole('menuitemradio')
    expect(rows.map((r) => r.getAttribute('data-to-choice'))).toEqual(['ch-1', 'ch-2'])
    expect((within(menu).getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(rows[1]!)
    expect(within(to).getByRole('button', { name: /^To \(830\) 555-0190/ })).toBeTruthy()
    await pressPrimary()
    await waitFor(() => expect(io.send).toHaveBeenCalledTimes(2), { timeout: 4000 })
    expect(io.makeUsual).toHaveBeenCalledWith('ch-2')
    expect(io.makeUsual.mock.invocationCallOrder[0]!).toBeLessThan(io.send.mock.invocationCallOrder[0]!)
    expect(io.send.mock.calls[0]![0]).toMatchObject({ quickReplyId: 'q1', channelId: 'ch-2' })
    expect(io.send.mock.calls[1]![0]).toMatchObject({ kind: 'bio', channelId: 'ch-2' })
  })

  it('with the tick off the switch is this once, and with no numbers read there is no chip and quo-send picks', async () => {
    const io = fakeIo(DANA_TWO)
    mount(io)
    await screen.findByTestId('on-my-way-preview')
    await guessed()
    const to = screen.getByTestId('on-my-way-to')
    fireEvent.click(within(to).getByRole('button', { name: /^To \(830\) 555-0121/ }))
    const menu = within(to).getByRole('menu', { name: 'Which number' })
    fireEvent.click(within(menu).getByRole('checkbox'))
    fireEvent.click(within(menu).getAllByRole('menuitemradio')[1]!)
    await pressPrimary()
    await waitFor(() => expect(io.send).toHaveBeenCalledWith(expect.objectContaining({ channelId: 'ch-2' })))
    expect(io.makeUsual).not.toHaveBeenCalled()
    cleanup()
    const none = fakeIo(DANA_NONE)
    mount(none)
    await screen.findByTestId('on-my-way-preview')
    await guessed()
    expect(screen.queryByTestId('on-my-way-to')).toBeNull()
    await pressPrimary()
    await waitFor(() => expect(none.send).toHaveBeenCalled())
    expect(none.send.mock.calls[0]![0]).not.toHaveProperty('channelId')
  })
})
