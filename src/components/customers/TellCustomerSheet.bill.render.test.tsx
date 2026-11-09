// @vitest-environment jsdom
/**
 * Text the bill (v2.6771, punch list #291) over a fake io: the sheet opens on a bill with the Billed line filled for
 * Dana, the bill's amount and its own pay page in it, the number it goes from beside the To chip; on her first text
 * from us the chip shows, Preview draws the opt-out line under the words with its tag and the real link, and trimming
 * the opening holds Send with the hold's words until Put the opening back restores it; a later text wears no chip, is
 * never held and its preview says why no opt-out line shows; the send goes with the words as typed.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TellContact, TellCustomerIo } from '../../lib/tellCustomer/tellCustomerIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { TellCustomerSheet, type TellBill } from './TellCustomerSheet'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const AT = Date.parse('2026-11-09T21:32:00Z')
const LINK = 'https://clicktooling.com/pay/8f3a2c0a-1111-4111-8111-111111111111'
const BILL: TellBill = { invoiceId: '8f3a2c0a-1111-4111-8111-111111111111', amount: '$1,850.00', link: LINK }
const LINE = `Hi Dana, this is Rosa with Click Plumbing. Your bill for Whitfield water heater is ready, $1,850.00. Text me here with any question. Pay it here: ${LINK}`
const TRIMMED = `Your bill for Whitfield water heater is ready, $1,850.00. Pay it here: ${LINK}`

/** Dana's one number and no text from us yet: her first text. */
const FIRST: TellContact = { contactId: 'contact-dana', numbers: [{ channelId: 'ch-1', value: '(830) 555-0121', stopped: false }], lines: [{ channelId: 'ch-1', at: '2026-11-01T15:00:00Z', direction: 'in' }], prefers: null }
/** The same number, texted by us last week: a later text. */
const LATER: TellContact = { ...FIRST, lines: [{ channelId: 'ch-1', at: '2026-11-02T15:00:00Z', direction: 'out' }] }

type Fake = TellCustomerIo & { send: ReturnType<typeof vi.fn> }
function fakeIo(contact: TellContact, set: Partial<TellCustomerIo> = {}): Fake {
  return {
    loadJob: vi.fn(async () => ({ customerId: 'cust-dana', customerName: 'Dana Whitfield', jobName: 'Whitfield water heater', jobAddress: '1208 Mesquite Ln', lang: 'en' as const, billLink: null, billAmount: null })),
    loadCustomer: vi.fn(async () => ({ name: 'Dana Whitfield', lang: 'en' as const })),
    loadContact: vi.fn(async () => contact),
    loadLines: vi.fn(async () => []),
    loadTextsOn: vi.fn(async () => true),
    loadMyName: vi.fn(async () => 'Rosa Perez'),
    isFirstVisit: vi.fn(async () => false),
    send: vi.fn(async () => 'msg-1'),
    shareEstimateLink: vi.fn(async () => 'https://clicktooling.com/e/x'),
    makeOffer: vi.fn(async () => 'offer-1'),
    loadCallScript: vi.fn(async () => null),
    addCall: vi.fn(async () => 'call-1'),
    loadMyWay: vi.fn(async () => ({ booked: 'ask' as const, estimate: 'ask' as const })),
    saveOfficeLine: vi.fn(async () => undefined),
    loadFromNumber: vi.fn(async () => '(512) 555-0100'),
    ...set,
  } as Fake
}

function mount(io: TellCustomerIo) {
  const onClose = vi.fn()
  const onSent = vi.fn()
  renderWithProviders(<TellCustomerSheet moment="billed" jobId="job-512" jobLabel="Bill $1,850.00 · Whitfield water heater" bill={BILL} userId="rosa" role="assistant" onClose={onClose} onSent={onSent} io={io} now={() => AT} />)
  return { onClose, onSent }
}

afterEach(cleanup)

describe('Text the bill on the Tell the customer sheet (v2.6771)', { timeout: 15_000 }, () => {
  it('fills the Billed line with the bill’s amount and its pay page, names the number it goes from, and wears the first-text chip', async () => {
    mount(fakeIo(FIRST))
    const box = (await screen.findByTestId('tell-body')) as HTMLTextAreaElement
    expect(screen.getByRole('dialog', { name: 'Tell Dana' })).toBeTruthy()
    expect(screen.getByTestId('tell-sheet').textContent).toContain('The bill for Whitfield water heater · $1,850.00')
    expect(box.value).toBe(LINE)
    expect(screen.getByTestId('tell-from-number').textContent).toBe('from the company number (512) 555-0100')
    expect(screen.getByTestId('tell-first-text').textContent).toBe('First text to this numberDana’s first text from us names you and Click Plumbing. The app adds the carriers’ opt-out line under it. Preview shows both.')
    expect(screen.getByText('The app’s own Billed line, filled for this bill. Change any word.')).toBeTruthy()
    expect(screen.getByText('The link is the bill’s own pay page on a Click Plumbing address. It keeps working after Stripe’s link changes.')).toBeTruthy()
    expect(screen.getAllByTestId('tell-act').map((p) => p.textContent)).toEqual(['💬Texts Dana the bill with its pay link from the company number. Dana’s answer comes to the office.', '🧾Then shows you what went, and offers the call.'])
    expect((screen.getByTestId('tell-primary') as HTMLButtonElement).disabled).toBe(false)
  })

  it('Preview on a first text draws the real link and the opt-out line under the words, tagged as the app’s', async () => {
    mount(fakeIo(FIRST))
    await screen.findByTestId('tell-body')
    fireEvent.click(screen.getByTestId('tell-preview-text-press'))
    expect(screen.getByTestId('tell-preview').getAttribute('data-kind')).toBe('text')
    expect(screen.getByTestId('tell-preview-first').textContent).toBe('Dana’s first text from usA number they have not seen before. The words have to say who we are.')
    expect(screen.getByTestId('tell-preview-caption').textContent).toBe('To (830) 555-0121From the company number (512) 555-0100.')
    expect(screen.getByTestId('tell-preview-words').textContent).toBe(LINE)
    expect(screen.getByTestId('tell-preview-optout').textContent).toContain('Click Plumbing and Electrical. Reply STOP to opt out.')
    expect(screen.getByTestId('tell-preview-optout-tag').textContent).toBe('added by the app · required on a first text')
    expect(screen.queryByTestId('tell-preview-sample')).toBeNull()
    expect(screen.getByTestId('tell-preview-real-link').textContent).toBe('The link is the bill’s own pay page. It opens the bill with its Pay button.')
    expect(screen.queryByTestId('tell-preview-later')).toBeNull()
  })

  it('trimming the opening on a first text holds Send with the reason, and Put the opening back restores it', async () => {
    const io = fakeIo(FIRST)
    mount(io)
    const box = (await screen.findByTestId('tell-body')) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: TRIMMED } })
    const primary = screen.getByTestId('tell-primary') as HTMLButtonElement
    expect(primary.disabled).toBe(true)
    expect(primary.title).toBe('This is Dana’s first text from us, so it has to say who is writing. Put ‘this is Rosa with Click Plumbing’ back, or press Put the opening back.')
    const hold = screen.getByTestId('tell-intro-hold')
    expect(hold.textContent).toContain('This is Dana’s first text from us, so it has to say who is writing.')
    expect(hold.textContent).toContain('A later text is not held. Only the first one has to introduce you.')
    fireEvent.click(primary)
    expect(io.send).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('tell-put-opening-back'))
    expect(box.value).toBe(`Hi Dana, this is Rosa with Click Plumbing. ${TRIMMED}`)
    expect(screen.queryByTestId('tell-intro-hold')).toBeNull()
    expect(primary.disabled).toBe(false)
    // The name alone is enough: the office may write its own opening.
    fireEvent.change(box, { target: { value: `Dana, Rosa here. ${TRIMMED}` } })
    expect(screen.queryByTestId('tell-intro-hold')).toBeNull()
    fireEvent.click(screen.getByTestId('tell-primary'))
    await waitFor(() => expect(io.send).toHaveBeenCalledWith({ contactId: 'contact-dana', channelId: 'ch-1', jobId: 'job-512', body: `Dana, Rosa here. ${TRIMMED}` }))
    expect(await screen.findByTestId('tell-receipt')).toBeTruthy()
  })

  it('a later text wears no chip, is never held with the opening trimmed, and its preview says why no opt-out line shows', async () => {
    const io = fakeIo(LATER)
    const { onSent } = mount(io)
    const box = (await screen.findByTestId('tell-body')) as HTMLTextAreaElement
    expect(screen.queryByTestId('tell-first-text')).toBeNull()
    fireEvent.change(box, { target: { value: TRIMMED } })
    expect(screen.queryByTestId('tell-intro-hold')).toBeNull()
    expect((screen.getByTestId('tell-primary') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByTestId('tell-preview-text-press'))
    expect(screen.queryByTestId('tell-preview-first')).toBeNull()
    expect(screen.queryByTestId('tell-preview-optout')).toBeNull()
    expect(screen.getByTestId('tell-preview-later').textContent).toBe('No opt-out line: not their first text from us.')
    fireEvent.click(screen.getByTestId('tell-preview-back'))
    fireEvent.click(screen.getByTestId('tell-primary'))
    await waitFor(() => expect(io.send).toHaveBeenCalledWith(expect.objectContaining({ body: TRIMMED })))
    await waitFor(() => expect(onSent).toHaveBeenCalledWith('msg-1'))
  })

  it('with no number from Settings the words alone name the company number', async () => {
    mount(fakeIo(LATER, { loadFromNumber: vi.fn(async () => null) }))
    await screen.findByTestId('tell-body')
    expect(screen.getByTestId('tell-from-number').textContent).toBe('from the company number')
  })
})
