// @vitest-environment jsdom
/**
 * Today's sends (v2.5595, punch list #115) over a fake io: the window lists the prepared texts with the person, the
 * step and the words; Send presses one through the io and the Dashboard counts again; Edit changes the words before
 * the press; Send all that are ready presses the ready ones and not the held or the morning's; a held one says why with
 * no Send; Not this one, Hold until a day and Stop reminding each write through the io; an empty table says so.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OfferRow, TodaysSendsInput } from '../../lib/offers/offers'
import type { OffersIo } from '../../lib/offers/offersIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { TodaysSendsWindow } from './TodaysSendsWindow'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const offer = (over: Partial<OfferRow> = {}): OfferRow => ({
  id: 'o-dana',
  contactId: 'c-dana',
  contactKind: 'residential',
  stepKey: 'approved',
  jobKey: 'pipeline:job-1312',
  body: 'Dana, any word on the estimate? Happy to walk through it.',
  channelId: 'ch-1',
  preparedAt: '2026-10-17T14:00:00Z',
  preparedBy: 'app',
  sendOn: null,
  heldWhy: null,
  ...over,
})

const INPUT: TodaysSendsInput = {
  offers: [offer(), offer({ id: 'o-sam', contactId: 'c-sam', channelId: 'ch-9', stepKey: 'booked', body: 'Sam, we have you booked Friday.' }), offer({ id: 'o-held', contactId: 'c-lee', channelId: null, stepKey: 'booked', body: 'Lee, we have you booked Monday.' }), offer({ id: 'o-morning', contactId: 'c-dana', preparedBy: 'office', sendOn: '2026-10-18', body: 'Dana, Luis is on the way at 10.' })],
  names: { 'c-dana': 'Dana Whitfield', 'c-sam': 'Sam Ortiz', 'c-lee': 'Lee Park' },
  numbers: { 'ch-1': '(830) 555-0121', 'ch-9': '(210) 555-0199' },
  stepNames: { 'residential:approved': 'Approved', 'residential:booked': 'Booked' },
}

type Fake = { [K in keyof OffersIo]: ReturnType<typeof vi.fn> } & OffersIo
function fakeIo(input: TodaysSendsInput = INPUT): Fake {
  return {
    loadOpen: vi.fn(async () => input),
    countOpen: vi.fn(async () => input.offers.length),
    send: vi.fn(async () => 'msg-1'),
    dismiss: vi.fn(async () => undefined),
    holdUntil: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    make: vi.fn(async () => 'o-new'),
  } as unknown as Fake
}

function mount(io: OffersIo) {
  const onClose = vi.fn()
  const onChanged = vi.fn()
  renderWithProviders(<TodaysSendsWindow onClose={onClose} onChanged={onChanged} io={io} />)
  return { onClose, onChanged }
}

const rowOf = async (who: string) => {
  const rows = await screen.findAllByTestId('todays-send')
  const row = rows.find((r) => r.textContent?.includes(who))
  if (!row) throw new Error(`no row for ${who}`)
  return row
}

afterEach(cleanup)

describe('TodaysSendsWindow', { timeout: 15_000 }, () => {
  it('lists the prepared texts, ready first, and Send presses one through the io', async () => {
    const io = fakeIo()
    const { onChanged } = mount(io)
    const rows = await screen.findAllByTestId('todays-send')
    expect(screen.getByRole('dialog', { name: 'Today’s sends' })).toBeTruthy()
    expect(rows.map((r) => within(r).getByTestId('todays-send-words').textContent)).toEqual([
      'Dana, any word on the estimate? Happy to walk through it.',
      'Sam, we have you booked Friday.',
      'Dana, Luis is on the way at 10.',
      'Lee, we have you booked Monday.',
    ])
    const dana = await rowOf('Dana Whitfield · Approved')
    fireEvent.click(within(dana).getByTestId('todays-send-send'))
    await waitFor(() => expect(io.send).toHaveBeenCalledWith({ id: 'o-dana', contactId: 'c-dana', channelId: 'ch-1', jobKey: 'pipeline:job-1312', who: 'Dana Whitfield' }, 'Dana, any word on the estimate? Happy to walk through it.'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(io.loadOpen).toHaveBeenCalledTimes(2)
  })

  it('Edit changes the words before the press, and Send all presses only the ready ones', async () => {
    const io = fakeIo()
    mount(io)
    const sam = await rowOf('Sam Ortiz')
    fireEvent.click(within(sam).getByRole('button', { name: 'Edit' }))
    const box = within(sam).getByTestId('todays-send-body') as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'Sam, you are booked Friday at 10. Luis will text you when on the way.' } })
    fireEvent.click(within(sam).getByRole('button', { name: 'Done editing' }))
    expect(within(sam).getByTestId('todays-send-words').textContent).toBe('Sam, you are booked Friday at 10. Luis will text you when on the way.')
    const all = screen.getByTestId('todays-sends-all') as HTMLButtonElement
    expect(all.textContent).toBe('Send all 2 that are ready')
    fireEvent.click(all)
    await waitFor(() => expect(io.send).toHaveBeenCalledTimes(2))
    expect(io.send.mock.calls.map((c) => [(c[0] as { id: string }).id, c[1]])).toEqual([
      ['o-dana', 'Dana, any word on the estimate? Happy to walk through it.'],
      ['o-sam', 'Sam, you are booked Friday at 10. Luis will text you when on the way.'],
    ])
  })

  it('a held one says why with no Send, the morning’s says its day, and Not this one, Hold until and Stop write through the io', async () => {
    const io = fakeIo()
    mount(io)
    const lee = await rowOf('Lee Park')
    expect(within(lee).getByTestId('todays-send-held').textContent).toBe('Held: No phone number on file. Add one on the customer, or call instead.')
    expect(within(lee).queryByTestId('todays-send-send')).toBeNull()
    const morning = await rowOf('Luis is on the way')
    expect(within(morning).getByText('Goes in the morning of 2026-10-18.')).toBeTruthy()
    expect(within(morning).queryByTestId('todays-send-send')).toBeNull()
    fireEvent.click(within(lee).getByTestId('todays-send-skip'))
    await waitFor(() => expect(io.dismiss).toHaveBeenCalledWith('o-held', 'not this one'))
    const sam = await rowOf('Sam Ortiz')
    fireEvent.click(within(sam).getByTestId('todays-send-hold'))
    fireEvent.change(within(sam).getByTestId('todays-send-hold-date'), { target: { value: '2026-10-20' } })
    fireEvent.click(within(sam).getByTestId('todays-send-hold-go'))
    await waitFor(() => expect(io.holdUntil).toHaveBeenCalledWith({ id: 'o-sam', contactId: 'c-sam', jobKey: 'pipeline:job-1312', stepKey: 'booked' }, '2026-10-20'))
    const dana = await rowOf('Dana Whitfield · Approved')
    fireEvent.click(within(dana).getByTestId('todays-send-stop'))
    await waitFor(() => expect(io.stop).toHaveBeenCalledWith({ id: 'o-dana', contactId: 'c-dana', jobKey: 'pipeline:job-1312', stepKey: 'approved' }, 'Stopped from Today’s sends'))
  })

  it('says so when nothing waits', async () => {
    mount(fakeIo({ offers: [], names: {}, numbers: {}, stepNames: {} }))
    expect(await screen.findByText('Nothing waits. The morning run prepares a text when a step is set to Offers in Flows.')).toBeTruthy()
    expect(screen.queryByTestId('todays-sends-all')).toBeNull()
  })
})
