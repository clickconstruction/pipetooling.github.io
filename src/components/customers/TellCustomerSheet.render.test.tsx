// @vitest-environment jsdom
/**
 * Tell the customer (v2.5593, punch list #115) over a fake io: the sheet fills the office's Booked line for Dana from
 * the block, the office changes a word, the press sends through the io and the receipt shows what went with the script
 * and the dial; Skip sends nothing; a blank left in the box holds the press; the app's own words when the office has
 * no Booked line; a customer with no number, texts off, STOP and a job with no customer each read their hold; a tech
 * sees the hold and no box.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { QuickReply } from '../../lib/quickReplies/kernel'
import type { TellBlock } from '../../lib/tellCustomer/tellCustomer'
import type { TellCustomerIo } from '../../lib/tellCustomer/tellCustomerIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { TellCustomerSheet } from './TellCustomerSheet'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const BLOCK: TellBlock = { workDate: '2026-10-23', timeStart: '10:00:00', timeEnd: '12:00:00', techName: 'Luis Ortega' }
const BOOKED: QuickReply = { id: 'q1', text: '{first}, this is {me} with Click Plumbing. We have you booked for {day}, {window}. {tech} will text you when on the way.', for: 'customer', stepId: 'booked', scope: 'team', addedBy: 'rosa', addedAt: 1, removed: false, uses: {}, lastUsed: null, textEs: null } as QuickReply
const AT = Date.parse('2026-10-16T19:41:00Z')

type Fake = TellCustomerIo & { send: ReturnType<typeof vi.fn> }
function fakeIo(set: Partial<TellCustomerIo> = {}): Fake {
  return {
    loadJob: vi.fn(async () => ({ customerId: 'cust-dana', customerName: 'Dana Whitfield', jobName: 'Whitfield water heater', jobAddress: '1208 Mesquite Ln', lang: 'en' as const })),
    loadContact: vi.fn(async () => ({ contactId: 'contact-dana', numbers: [{ channelId: 'ch-1', value: '(830) 555-0121', stopped: false }] })),
    loadLines: vi.fn(async () => [BOOKED]),
    loadTextsOn: vi.fn(async () => true),
    loadMyName: vi.fn(async () => 'Rosa Perez'),
    isFirstVisit: vi.fn(async () => true),
    send: vi.fn(async () => 'msg-1'),
    ...set,
  } as Fake
}

function mount(io: TellCustomerIo, over: Partial<Parameters<typeof TellCustomerSheet>[0]> = {}) {
  const onClose = vi.fn()
  const onSent = vi.fn()
  renderWithProviders(<TellCustomerSheet moment="booked" jobId="job-512" jobLabel="PLUM 512 · Whitfield water heater" block={BLOCK} userId="rosa" role="assistant" onClose={onClose} onSent={onSent} io={io} now={() => AT} {...over} />)
  return { onClose, onSent }
}

afterEach(cleanup)

describe('TellCustomerSheet', { timeout: 15_000 }, () => {
  it('fills the office’s line from the block, the office changes a word, the press sends and the receipt follows', async () => {
    const io = fakeIo()
    const { onSent, onClose } = mount(io)
    const box = (await screen.findByTestId('tell-body')) as HTMLTextAreaElement
    expect(screen.getByRole('dialog', { name: 'Tell Dana' })).toBeTruthy()
    expect(box.value).toBe('Dana, this is Rosa with Click Plumbing. We have you booked for Friday, October 23, 2026, 10:00 AM to 12:00 PM. Luis will text you when on the way.')
    expect(screen.getByText('The office’s Booked line, filled from the block. Change any word.')).toBeTruthy()
    expect(screen.getAllByTestId('tell-act').map((p) => p.textContent)).toEqual([
      '💬Texts Dana the day and the window from the company number. Dana’s answer comes to the office.',
      '🧾Then shows you what went, and offers the call.',
    ])
    fireEvent.change(box, { target: { value: 'Dana, Rosa here. We have you booked Friday, 10:00 AM to 12:00 PM. Luis will text you when on the way.' } })
    const primary = screen.getByTestId('tell-primary') as HTMLButtonElement
    expect(primary.textContent).toBe('Send text to Dana')
    fireEvent.click(primary)
    await waitFor(() => expect(io.send).toHaveBeenCalledWith({ contactId: 'contact-dana', channelId: 'ch-1', jobId: 'job-512', body: 'Dana, Rosa here. We have you booked Friday, 10:00 AM to 12:00 PM. Luis will text you when on the way.' }))
    expect(await screen.findByTestId('tell-receipt')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Sent to Dana' })).toBeTruthy()
    expect(screen.getByTestId('tell-receipt-words').textContent).toBe('Dana, Rosa here. We have you booked Friday, 10:00 AM to 12:00 PM. Luis will text you when on the way.')
    expect(screen.getByTestId('tell-receipt-sent').textContent).toBe('Text · from the company number · 2:41 PM · in Dana’s thread')
    expect(screen.getByText('Call Dana to talk it through?')).toBeTruthy()
    expect(screen.getByTestId('tell-script').textContent).toContain('Hi Dana, this is Rosa with Click Plumbing.')
    expect((screen.getByTestId('tell-call') as HTMLAnchorElement).getAttribute('href')).toBe('tel:+18305550121')
    expect(onSent).toHaveBeenCalledWith('msg-1')
    fireEvent.click(screen.getByTestId('tell-done'))
    expect(onClose).toHaveBeenCalled()
  })

  it('Skip sends nothing, and a blank left in the box holds the press', async () => {
    const io = fakeIo()
    const { onClose } = mount(io)
    const box = (await screen.findByTestId('tell-body')) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'Dana, see you {day}.' } })
    const primary = screen.getByTestId('tell-primary') as HTMLButtonElement
    expect(primary.disabled).toBe(true)
    expect(primary.title).toBe('Fill {day} before it sends.')
    fireEvent.click(screen.getByTestId('tell-skip'))
    expect(onClose).toHaveBeenCalled()
    expect(io.send).not.toHaveBeenCalled()
  })

  it('takes the app’s own words when the office has no Booked line', async () => {
    mount(fakeIo({ loadLines: vi.fn(async () => []) }))
    const box = (await screen.findByTestId('tell-body')) as HTMLTextAreaElement
    expect(box.value).toContain('We have you booked for Friday, October 23, 2026')
    expect(screen.getByText('The app’s own words, since the office has no Booked line yet. Change any word.')).toBeTruthy()
  })

  it('each hold reads why, with no box and a Close', async () => {
    mount(fakeIo({ loadContact: vi.fn(async () => ({ contactId: 'contact-dana', numbers: [] })) }))
    expect((await screen.findByTestId('tell-hold')).textContent).toBe('⚠No text: Dana has no phone number on file. Add one on the customer.')
    expect(screen.queryByTestId('tell-body')).toBeNull()
    expect(screen.getByTestId('tell-primary').textContent).toBe('Close')
    cleanup()
    mount(fakeIo({ loadTextsOn: vi.fn(async () => false) }))
    expect((await screen.findByTestId('tell-hold')).textContent).toContain('No text: texts are off.')
    cleanup()
    mount(fakeIo({ loadContact: vi.fn(async () => ({ contactId: 'contact-dana', numbers: [{ channelId: 'ch-1', value: '(830) 555-0121', stopped: true }] })) }))
    expect((await screen.findByTestId('tell-hold')).textContent).toBe('⚠No text: Dana sent STOP to the company number. Call instead.')
    cleanup()
    const noCustomer = fakeIo({ loadJob: vi.fn(async () => ({ customerId: null, customerName: null, jobName: 'A job', jobAddress: null, lang: 'en' as const })) })
    mount(noCustomer)
    expect((await screen.findByTestId('tell-hold')).textContent).toBe('⚠No text: this job has no customer yet. Add one on the job first.')
    expect(noCustomer.loadContact).not.toHaveBeenCalled()
  })

  it('a tech reads the hold and never opens the thread', async () => {
    const io = fakeIo()
    mount(io, { role: 'primary' })
    expect((await screen.findByTestId('tell-hold')).textContent).toBe('⚠No text: only the office team texts a customer from here.')
    expect(io.loadContact).not.toHaveBeenCalled()
  })
})
