// @vitest-environment jsdom
/**
 * Job Mode's I'm here (v2.5573): the sheet stamps the arrival the moment it opens, then offers the office's I'm here
 * line for Dana with the text as a choice; with no text possible it closes itself after the stamp. Made-up people.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { phoneLinesFromRows, type PhoneLineRow } from '../../lib/jobModeMessageCustomer'
import type { JobModeCustomer } from '../../lib/jobModeMessageCustomerIo'
import type { OnMyWayIo } from '../../lib/jobModeOnMyWayIo'
import { ImHereSheet } from './ImHereSheet'

vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

const row = (id: string, text: string, extra: Partial<PhoneLineRow>): PhoneLineRow => ({
  id, text, for_kind: 'customer', step_key: null, scope: 'team', added_by: 'rosa', added_at: '2026-10-12T14:00:00Z', removed_at: null,
  phone_order: null, phone_name: null, text_es: null, ...extra,
})
const LINES = phoneLinesFromRows([
  row('q1', '{first}, this is {me} with Click Plumbing. I am on my way, about {minutes} minutes out.', { phone_order: 1 }),
  row('q2', '{first}, this is {me} with Click Plumbing. I am here at {address}.', { phone_order: 2, phone_name: 'I’m here' }),
]).map((l) => ({ ...l, phonePress: l.id === 'q2' ? ('im_here' as const) : l.id === 'q1' ? ('on_my_way' as const) : null }))
const DANA: JobModeCustomer = { customerId: 'cust-dana', customerName: 'Dana Whitfield', contactId: 'contact-dana', tail: [] }
const NOON_45 = Date.parse('2026-10-16T17:45:00Z')

type Fake = OnMyWayIo & { send: ReturnType<typeof vi.fn>; arrive: ReturnType<typeof vi.fn> }
function fakeIo(set: Partial<OnMyWayIo> = {}): Fake {
  return {
    loadCustomer: vi.fn(() => Promise.resolve(DANA)),
    loadLines: vi.fn(() => Promise.resolve(LINES)),
    loadBlocks: vi.fn(() => Promise.resolve([])),
    send: vi.fn(() => Promise.resolve()),
    noteToOffice: vi.fn(() => Promise.resolve()),
    loadTextsOn: vi.fn(() => Promise.resolve(true)),
    loadPressLines: vi.fn(() => Promise.resolve(LINES)),
    loadJobPoint: vi.fn(() => Promise.resolve(null)),
    loadMyPoint: vi.fn(() => Promise.resolve(null)),
    loadTravelFacts: vi.fn(() => Promise.resolve(null)),
    arrive: vi.fn(() => Promise.resolve(true)),
    ...set,
  } as Fake
}

function mount(io: OnMyWayIo) {
  const onDone = vi.fn()
  const onClose = vi.fn()
  renderWithProviders(
    <ImHereSheet
      sessionId="sess-1"
      jobId="job-512"
      jobLabel="PLUM 512 · Whitfield water heater"
      jobName="Whitfield water heater"
      jobAddress="1208 Mesquite Ln"
      userId="luis"
      me="Luis Ortega"
      role="primary"
      travelFacts={{ travelStartedAt: '2026-10-16T17:26:00Z', arrivedAt: null }}
      io={io}
      onDone={onDone}
      onClose={onClose}
      today="2026-10-16"
      now={() => NOON_45}
    />,
  )
  return { onDone, onClose }
}

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
  window.matchMedia = ((q: string) => ({ matches: /max-width:\s*640px/.test(q), media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia
})
afterEach(cleanup)

describe('ImHereSheet at 375 px', { timeout: 15_000 }, () => {
  it('stamps the arrival at once, shows the I’m here line with the road, and the press sends it', async () => {
    const io = fakeIo()
    const { onDone, onClose } = mount(io)
    expect(screen.getByRole('dialog', { name: 'You are on site' })).toBeTruthy()
    await waitFor(() => expect(io.arrive).toHaveBeenCalledWith('sess-1'))
    expect((await screen.findByTestId('im-here-preview')).textContent).toBe('Dana, this is Luis with Click Plumbing. I am here at 1208 Mesquite Ln.')
    expect(screen.getAllByTestId('im-here-act').map((p) => p.textContent)).toEqual([
      '📍Marks you on site at PLUM 512 · Whitfield water heater. 19 minutes on the road.',
      '💬Texts Dana that you are at the door. Skip it when Dana is already there.',
    ])
    expect(screen.getByTestId('im-here-no-text').textContent).toBe('I’m here, no text')
    fireEvent.click(screen.getByTestId('im-here-text'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(io.send).toHaveBeenCalledWith({ from: 'job_mode', customerId: 'cust-dana', contactId: 'contact-dana', jobId: 'job-512', quickReplyId: 'q2', fills: {} })
    expect(onDone).toHaveBeenCalled()
  })

  it('I’m here, no text: the stamp stands and nothing is sent', async () => {
    const io = fakeIo()
    const { onClose } = mount(io)
    fireEvent.click(await screen.findByTestId('im-here-no-text'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(io.arrive).toHaveBeenCalledTimes(1)
    expect(io.send).not.toHaveBeenCalled()
  })

  it('with texts off it stamps and closes itself, drawing no line', async () => {
    const io = fakeIo({ loadTextsOn: vi.fn(() => Promise.resolve(false)) })
    const { onDone, onClose } = mount(io)
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(io.arrive).toHaveBeenCalledWith('sess-1')
    expect(onDone).toHaveBeenCalled()
    expect(screen.queryByTestId('im-here-preview')).toBeNull()
    expect(io.send).not.toHaveBeenCalled()
  })
})
