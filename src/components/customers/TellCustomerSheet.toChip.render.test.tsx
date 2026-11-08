// @vitest-environment jsdom
/**
 * Punch list #118, PR 2: the To chip on the Tell the customer sheet. With one number the Text row carries a label.
 * With two the chip opens a menu in the rule's order; a pick sends there this once, and the tick *Make this their
 * usual number* stars it through the io before the text goes, on a send and on Send in the morning alike.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { QuickReply } from '../../lib/quickReplies/kernel'
import type { TellBlock } from '../../lib/tellCustomer/tellCustomer'
import type { TellContact, TellCustomerIo } from '../../lib/tellCustomer/tellCustomerIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { TellCustomerSheet } from './TellCustomerSheet'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const BLOCK: TellBlock = { workDate: '2026-10-23', timeStart: '10:00:00', timeEnd: '12:00:00', techName: 'Luis Ortega' }
const BOOKED: QuickReply = { id: 'q1', text: '{first}, we have you booked for {day}, {window}.', for: 'customer', stepId: 'booked', scope: 'team', addedBy: 'rosa', addedAt: 1, removed: false, uses: {}, lastUsed: null, textEs: null } as QuickReply
const AT = Date.parse('2026-10-16T19:41:00Z')

const ONE: TellContact = { contactId: 'contact-dana', numbers: [{ channelId: 'ch-1', value: '(830) 555-0121', stopped: false }], prefers: null }
/** Dana's landline, the thread's only lines on it, and the cell she texted from once, newer. */
const TWO: TellContact = {
  contactId: 'contact-dana',
  numbers: [
    { channelId: 'ch-1', value: '(830) 555-0121', stopped: false, usualAt: null },
    { channelId: 'ch-2', value: '(830) 555-0190', stopped: false, usualAt: null },
  ],
  lines: [{ channelId: 'ch-1', at: '2026-10-10T15:00:00Z', direction: 'out' }],
  prefers: null,
}

type Fake = TellCustomerIo & { send: ReturnType<typeof vi.fn>; makeOffer: ReturnType<typeof vi.fn>; makeUsual: ReturnType<typeof vi.fn> }
function fakeIo(contact: TellContact): Fake {
  return {
    loadJob: vi.fn(async () => ({ customerId: 'cust-dana', customerName: 'Dana Whitfield', jobName: 'Whitfield water heater', jobAddress: '1208 Mesquite Ln', lang: 'en' as const })),
    loadCustomer: vi.fn(async () => ({ name: 'Dana Whitfield', lang: 'en' as const })),
    loadContact: vi.fn(async () => contact),
    loadLines: vi.fn(async () => [BOOKED]),
    loadTextsOn: vi.fn(async () => true),
    loadMyName: vi.fn(async () => 'Rosa Perez'),
    isFirstVisit: vi.fn(async () => true),
    send: vi.fn(async () => 'msg-1'),
    shareEstimateLink: vi.fn(async () => 'https://clicktooling.com/e/x'),
    makeOffer: vi.fn(async () => 'offer-1'),
    loadCallScript: vi.fn(async () => null),
    addCall: vi.fn(async () => 'call-1'),
    loadMyWay: vi.fn(async () => ({ booked: 'ask' as const, estimate: 'ask' as const })),
    saveOfficeLine: vi.fn(async () => undefined),
    makeUsual: vi.fn(async () => undefined),
  } as Fake
}

function mount(io: TellCustomerIo) {
  renderWithProviders(<TellCustomerSheet moment="booked" jobId="job-512" jobLabel="PLUM 512 · Whitfield water heater" block={BLOCK} userId="rosa" role="assistant" onClose={vi.fn()} onSent={vi.fn()} io={io} now={() => AT} />)
}

afterEach(cleanup)

describe('the To chip on the Tell the customer sheet (punch list #118, PR 2)', { timeout: 15_000 }, () => {
  it('is a label with one number, and the Text row still says who reads what', async () => {
    mount(fakeIo(ONE))
    const row = await screen.findByTestId('tell-text-to')
    expect(row.querySelector('[data-to-chip]')?.textContent).toBe('To (830) 555-0121')
    expect(within(row).queryByRole('button', { name: /^To \(/ })).toBeNull()
    expect(row.textContent).toContain('Dana reads English')
  })

  it('opens a menu with two, in the rule’s order, sends to the pick and stars it first', async () => {
    const io = fakeIo(TWO)
    mount(io)
    const row = await screen.findByTestId('tell-text-to')
    // The thread carried a line on the landline, so the rule keeps it first.
    fireEvent.click(within(row).getByRole('button', { name: /^To \(830\) 555-0121/ }))
    const menu = within(row).getByRole('menu', { name: 'Which number' })
    const rows = within(menu).getAllByRole('menuitemradio')
    expect(rows.map((r) => r.getAttribute('data-to-choice'))).toEqual(['ch-1', 'ch-2'])
    expect(rows[1]!.textContent).toContain('no line yet')
    expect((within(menu).getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(rows[1]!)
    expect(within(row).getByRole('button', { name: /^To \(830\) 555-0190/ })).toBeTruthy()
    // The receipt's dial follows the pick too.
    fireEvent.click(screen.getByTestId('tell-primary'))
    await waitFor(() => expect(io.send).toHaveBeenCalledWith(expect.objectContaining({ channelId: 'ch-2' })))
    expect(io.makeUsual).toHaveBeenCalledWith('ch-2')
    expect(io.makeUsual.mock.invocationCallOrder[0]!).toBeLessThan(io.send.mock.invocationCallOrder[0]!)
    expect((await screen.findByTestId('tell-call')).getAttribute('href')).toBe('tel:+18305550190')
  })

  it('with the tick off the pick is for this text alone, and Send in the morning stars like a send', async () => {
    const io = fakeIo(TWO)
    mount(io)
    const row = await screen.findByTestId('tell-text-to')
    fireEvent.click(within(row).getByRole('button', { name: /^To \(830\) 555-0121/ }))
    let menu = within(row).getByRole('menu', { name: 'Which number' })
    fireEvent.click(within(menu).getByRole('checkbox'))
    fireEvent.click(within(menu).getAllByRole('menuitemradio')[1]!)
    fireEvent.click(screen.getByTestId('tell-morning'))
    await waitFor(() => expect(io.makeOffer).toHaveBeenCalledWith(expect.objectContaining({ channelId: 'ch-2' })))
    expect(io.makeUsual).not.toHaveBeenCalled()
    cleanup()
    const again = fakeIo(TWO)
    mount(again)
    const row2 = await screen.findByTestId('tell-text-to')
    fireEvent.click(within(row2).getByRole('button', { name: /^To \(830\) 555-0121/ }))
    menu = within(row2).getByRole('menu', { name: 'Which number' })
    fireEvent.click(within(menu).getAllByRole('menuitemradio')[1]!)
    fireEvent.click(screen.getByTestId('tell-morning'))
    await waitFor(() => expect(again.makeOffer).toHaveBeenCalledWith(expect.objectContaining({ channelId: 'ch-2' })))
    expect(again.makeUsual).toHaveBeenCalledWith('ch-2')
  })

  it('a refusal of the star stops the send and is said in the band', async () => {
    const io = fakeIo(TWO)
    io.makeUsual.mockRejectedValueOnce(new Error('Only the office team can pick their usual number.'))
    mount(io)
    const row = await screen.findByTestId('tell-text-to')
    fireEvent.click(within(row).getByRole('button', { name: /^To \(830\) 555-0121/ }))
    fireEvent.click(within(within(row).getByRole('menu', { name: 'Which number' })).getAllByRole('menuitemradio')[1]!)
    fireEvent.click(screen.getByTestId('tell-primary'))
    await waitFor(() => expect(io.makeUsual).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByTestId('tell-send-problem').textContent).toContain('Only the office team can pick their usual number.'))
    expect(io.send).not.toHaveBeenCalled()
  })
})
