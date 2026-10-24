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
import { TellCustomerSheet, type TellEstimate } from './TellCustomerSheet'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const BLOCK: TellBlock = { workDate: '2026-10-23', timeStart: '10:00:00', timeEnd: '12:00:00', techName: 'Luis Ortega' }
const BOOKED: QuickReply = { id: 'q1', text: '{first}, this is {me} with Click Plumbing. We have you booked for {day}, {window}. {tech} will text you when on the way.', for: 'customer', stepId: 'booked', scope: 'team', addedBy: 'rosa', addedAt: 1, removed: false, uses: {}, lastUsed: null, textEs: null } as QuickReply
const AT = Date.parse('2026-10-16T19:41:00Z')

type Fake = TellCustomerIo & { send: ReturnType<typeof vi.fn>; makeOffer: ReturnType<typeof vi.fn>; addCall: ReturnType<typeof vi.fn>; saveOfficeLine: ReturnType<typeof vi.fn> }
function fakeIo(set: Partial<TellCustomerIo> = {}): Fake {
  return {
    loadJob: vi.fn(async () => ({ customerId: 'cust-dana', customerName: 'Dana Whitfield', jobName: 'Whitfield water heater', jobAddress: '1208 Mesquite Ln', lang: 'en' as const })),
    loadCustomer: vi.fn(async () => ({ name: 'Dana Whitfield', lang: 'en' as const })),
    loadContact: vi.fn(async () => ({ contactId: 'contact-dana', numbers: [{ channelId: 'ch-1', value: '(830) 555-0121', stopped: false }], prefers: null })),
    loadLines: vi.fn(async () => [BOOKED]),
    loadTextsOn: vi.fn(async () => true),
    loadMyName: vi.fn(async () => 'Rosa Perez'),
    isFirstVisit: vi.fn(async () => true),
    send: vi.fn(async () => 'msg-1'),
    makeOffer: vi.fn(async () => 'offer-1'),
    loadCallScript: vi.fn(async () => null),
    addCall: vi.fn(async () => 'call-1'),
    loadMyWay: vi.fn(async () => ({ booked: 'ask' as const, estimate: 'ask' as const })),
    saveOfficeLine: vi.fn(async () => undefined),
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
    expect(screen.getByTestId('tell-call').querySelector('svg')).toBeTruthy()
    // Whose script it is, and the door to change it (v2.5796): the assistant edits flows.
    expect(screen.getByTestId('tell-script-source').textContent).toBe('The app’s own words, since the office has no Booked script yet. Change the script in Settings ›')
    expect((screen.getByTestId('tell-script-door') as HTMLAnchorElement).getAttribute('href')).toBe('/settings?tab=settings-flows&kind=residential&step=booked')
    expect(onSent).toHaveBeenCalledWith('msg-1')
    fireEvent.click(screen.getByTestId('tell-done'))
    expect(onClose).toHaveBeenCalled()
  })

  it('on a booking Preview shows the text alone, as it lands, with no pills (v2.5794)', async () => {
    const io = fakeIo()
    mount(io)
    const box = (await screen.findByTestId('tell-body')) as HTMLTextAreaElement
    expect(screen.queryByTestId('tell-preview-email-press')).toBeNull()
    fireEvent.click(screen.getByTestId('tell-preview-text-press'))
    expect(screen.getByTestId('tell-preview').getAttribute('data-kind')).toBe('text')
    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.getByTestId('tell-preview-words').textContent).toBe(box.value)
    expect(screen.queryByTestId('tell-preview-sample')).toBeNull()
    expect(screen.getByTestId('tell-preview-caption').textContent).toBe('To (830) 555-0121From the company number.')
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

  it('a text that fails draws the band with the reason and keeps the words, and the X mid-send says still sending (v2.5681)', async () => {
    let finish: (v: string) => void = () => {}
    const io = fakeIo({ send: vi.fn(() => new Promise<string>((resolve) => (finish = resolve))) })
    const { onClose } = mount(io)
    await screen.findByTestId('tell-body')
    fireEvent.click(screen.getByTestId('tell-primary'))
    expect(screen.getByTestId('tell-primary').textContent).toBe('Sending…')
    fireEvent.click(screen.getByLabelText('Close'))
    expect(await screen.findByTestId('tell-still-sending')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    finish('msg-1')
    expect(await screen.findByTestId('tell-receipt')).toBeTruthy()
    cleanup()
    const failing = fakeIo({ send: vi.fn(async () => Promise.reject(new Error('Quo turned it away'))) })
    mount(failing)
    await screen.findByTestId('tell-body')
    fireEvent.click(screen.getByTestId('tell-primary'))
    const bandEl = await screen.findByTestId('tell-send-problem')
    expect(bandEl.textContent).toBe('The text did not go.Quo turned it away')
    expect(screen.getByTestId('tell-primary').textContent).toBe('Try again')
    expect(screen.queryByTestId('tell-receipt')).toBeNull()
  })

  it('Send in the morning hands the text to the 9 AM run and says when it goes (v2.5595)', async () => {
    const io = fakeIo()
    const { onSent } = mount(io)
    await screen.findByTestId('tell-body')
    fireEvent.click(screen.getByTestId('tell-morning'))
    // AT is 2:41 PM Central on Fri Oct 16, after the run: it goes Sat Oct 17.
    await waitFor(() =>
      expect(io.makeOffer).toHaveBeenCalledWith({
        contactId: 'contact-dana',
        channelId: 'ch-1',
        jobId: 'job-512',
        stepKey: 'booked',
        body: 'Dana, this is Rosa with Click Plumbing. We have you booked for Friday, October 23, 2026, 10:00 AM to 12:00 PM. Luis will text you when on the way.',
        sendOn: '2026-10-17',
      }),
    )
    expect(await screen.findByTestId('tell-morning-receipt')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Ready for the morning' })).toBeTruthy()
    expect(screen.getByTestId('tell-morning-line').textContent).toMatch(/^Goes at 9 AM on Sat.*17 from the company number\.$/)
    expect(io.send).not.toHaveBeenCalled()
    expect(onSent).not.toHaveBeenCalled()
  })

  it('Add to my calls on the receipt makes the call a task for tomorrow with the script as filled (v2.5596)', async () => {
    const io = fakeIo()
    mount(io)
    await screen.findByTestId('tell-body')
    fireEvent.click(screen.getByTestId('tell-primary'))
    await screen.findByTestId('tell-receipt')
    fireEvent.click(screen.getByTestId('tell-add-call'))
    // AT is Fri Oct 16 in the app's zone: the call is for Sat Oct 17.
    await waitFor(() => expect(io.addCall).toHaveBeenCalledWith(expect.objectContaining({ contactId: 'contact-dana', stepKey: 'booked', jobKey: 'pipeline:job-512', dueYmd: '2026-10-17', what: 'about the visit' })))
    expect((io.addCall.mock.calls[0]![0] as { script: string }).script).toContain('Hi Dana, this is Rosa with Click Plumbing.')
  })

  it('reads the step’s own script on the receipt, and hides the call ask when the step says not to suggest one', async () => {
    const io = fakeIo({ loadCallScript: vi.fn(async () => ({ script: { text: 'Hey {first}, {me} here. Good for {day}?', textEs: '' }, suggest: true })) })
    mount(io)
    await screen.findByTestId('tell-body')
    fireEvent.click(screen.getByTestId('tell-primary'))
    await screen.findByTestId('tell-receipt')
    expect(screen.getByTestId('tell-script').textContent).toBe('Hey Dana, Rosa here. Good for Friday, October 23, 2026?')
    expect(screen.getByTestId('tell-script-source').textContent).toContain('The office’s Booked script, filled for this job.')
    cleanup()
    const quiet = fakeIo({ loadCallScript: vi.fn(async () => ({ script: null, suggest: false })) })
    mount(quiet)
    await screen.findByTestId('tell-body')
    fireEvent.click(screen.getByTestId('tell-primary'))
    await screen.findByTestId('tell-receipt')
    expect(screen.queryByTestId('tell-script')).toBeNull()
    expect(screen.queryByTestId('tell-add-call')).toBeNull()
  })

  it('My way: send and show me the receipt sends the moment the sheet can, and says so (v2.5597)', async () => {
    const io = fakeIo({ loadMyWay: vi.fn(async () => ({ booked: 'send' as const, estimate: 'ask' as const })) })
    mount(io)
    // The toast fires before the send and lives five seconds; on a loaded runner the receipt can draw after it has
    // gone (the merge queue, 2026-10-17). Read the toast while it is up, then the receipt.
    expect(await screen.findByText('Sent your way. Change it under Settings → Your account.')).toBeTruthy()
    expect(await screen.findByTestId('tell-receipt')).toBeTruthy()
    expect(io.send).toHaveBeenCalledTimes(1)
  })

  it('an edit offers Make this the office’s line: the blanks come back, a last look, and the save goes through the io (v2.5597)', async () => {
    const io = fakeIo()
    mount(io)
    const box = (await screen.findByTestId('tell-body')) as HTMLTextAreaElement
    expect(screen.queryByTestId('tell-office-line')).toBeNull()
    fireEvent.change(box, { target: { value: 'Dana, Rosa here. We have you booked Friday, October 23, 2026, 10:00 AM to 12:00 PM. Luis will text you when on the way.' } })
    fireEvent.click(screen.getByTestId('tell-office-line'))
    const words = screen.getByTestId('tell-office-line-words') as HTMLTextAreaElement
    expect(words.value).toBe('{first}, {me} here. We have you booked {day}, {window}. {tech} will text you when on the way.')
    fireEvent.click(screen.getByTestId('tell-office-line-save'))
    await waitFor(() => expect(io.saveOfficeLine).toHaveBeenCalledWith({ lineId: 'q1', stepKey: 'booked', text: '{first}, {me} here. We have you booked {day}, {window}. {tech} will text you when on the way.', lang: 'en' }))
    expect(await screen.findByText('Saved as the office’s line. It fills for the next customer.')).toBeTruthy()
    expect(io.send).not.toHaveBeenCalled()
  })

  it('says when the customer asked for email, and still lets the text go (v2.5597)', async () => {
    mount(fakeIo({ loadContact: vi.fn(async () => ({ contactId: 'contact-dana', numbers: [{ channelId: 'ch-1', value: '(830) 555-0121', stopped: false }], prefers: 'email' as const })) }))
    await screen.findByTestId('tell-body')
    expect(screen.getAllByTestId('tell-act').map((p) => p.textContent)).toContain('ℹ️Dana asked to hear from us by email. A call may be kinder than this text.')
    expect((screen.getByTestId('tell-primary') as HTMLButtonElement).disabled).toBe(false)
  })

  it('takes the app’s own words when the office has no Booked line', async () => {
    mount(fakeIo({ loadLines: vi.fn(async () => []) }))
    const box = (await screen.findByTestId('tell-body')) as HTMLTextAreaElement
    expect(box.value).toContain('We have you booked for Friday, October 23, 2026')
    expect(screen.getByText('The app’s own words, since the office has no Booked line yet. Change any word.')).toBeTruthy()
  })

  it('each hold reads why, with no box and a Close', async () => {
    mount(fakeIo({ loadContact: vi.fn(async () => ({ contactId: 'contact-dana', numbers: [], prefers: null })) }))
    expect((await screen.findByTestId('tell-hold')).textContent).toBe('⚠No text: Dana has no phone number on file. Add one on the customer.')
    expect(screen.queryByTestId('tell-body')).toBeNull()
    expect(screen.getByTestId('tell-primary').textContent).toBe('Close')
    cleanup()
    mount(fakeIo({ loadTextsOn: vi.fn(async () => false) }))
    expect((await screen.findByTestId('tell-hold')).textContent).toContain('No text: texts are off.')
    cleanup()
    mount(fakeIo({ loadContact: vi.fn(async () => ({ contactId: 'contact-dana', numbers: [{ channelId: 'ch-1', value: '(830) 555-0121', stopped: true }], prefers: null })) }))
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

describe('TellCustomerSheet on an estimate (v2.5594)', { timeout: 15_000 }, () => {
  const ESTIMATE_LINE: QuickReply = { ...BOOKED, id: 'q9', stepId: 'estimate', text: '{first}, {me} here with Click Plumbing. Your estimate for {job} is ready, {amount}: {link}' }
  const estimate = (
    sendEmail: TellEstimate['sendEmail'] = vi.fn(async () => ({ ok: true as const, acceptUrl: 'https://clicktooling.com/estimate/accept?t=abc', emailed: true })),
    sendEmailAgain?: TellEstimate['sendEmailAgain'],
  ) => ({
    customerId: 'cust-dana',
    email: 'dana@example.com',
    amount: '$1,850.00',
    title: 'Whitfield water heater',
    jobId: null,
    sendEmail,
    sendEmailAgain,
  })
  const mountEstimate = (io: TellCustomerIo, est: TellEstimate = estimate()) => {
    const onClose = vi.fn()
    renderWithProviders(<TellCustomerSheet moment="estimate" jobId={null} jobLabel="Estimate #512 · Whitfield water heater" estimate={est} userId="rosa" role="assistant" onClose={onClose} io={io} now={() => AT} />)
    return { onClose, est }
  }

  it('Preview opens What Dana sees over the sheet on the text or the email, and Escape or Back closes it alone (v2.5794)', async () => {
    const io = fakeIo({ loadLines: vi.fn(async () => [ESTIMATE_LINE]) })
    const est: TellEstimate = { ...estimate(), previewEmail: { from: 'Click Plumbing <estimates@clickplumbing.com>', replyTo: null, subject: 'Estimate #512 · Whitfield water heater', html: '<p>Hi Dana</p>' } }
    const { onClose } = mountEstimate(io, est)
    const box = (await screen.findByTestId('tell-body')) as HTMLTextAreaElement
    fireEvent.click(screen.getByTestId('tell-preview-text-press'))
    expect(screen.getByRole('dialog', { name: 'What Dana sees' })).toBeTruthy()
    expect(screen.getByTestId('tell-preview').getAttribute('data-kind')).toBe('text')
    expect(screen.getByTestId('tell-preview-words').textContent).toBe(box.value.replace('{link}', 'https://clicktooling.com/estimate/accept?t=sample'))
    expect(screen.getByTestId('tell-preview-sample')).toBeTruthy()
    fireEvent.click(screen.getByTestId('tell-preview-pill-email'))
    expect(screen.getByTestId('tell-preview').getAttribute('data-kind')).toBe('email')
    expect(screen.getByTestId('tell-preview-subject').textContent).toBe('Subject: Estimate #512 · Whitfield water heater')
    expect((screen.getByTestId('tell-preview-frame') as HTMLIFrameElement).getAttribute('srcdoc')).toBe('<p>Hi Dana</p>')
    // Escape closes the window alone: the sheet is still there and its onClose never fired.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('tell-preview')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Tell Dana' })).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('tell-preview-email-press'))
    expect(screen.getByTestId('tell-preview').getAttribute('data-kind')).toBe('email')
    fireEvent.click(screen.getByTestId('tell-preview-back'))
    expect(screen.queryByTestId('tell-preview')).toBeNull()
    expect(screen.getByTestId('tell-sheet')).toBeTruthy()
  })

  it('both channels in one press: the email first, then the text with the link it came back with, and the receipt names both', async () => {
    const io = fakeIo({ loadLines: vi.fn(async () => [ESTIMATE_LINE]) })
    const { est } = mountEstimate(io)
    const box = (await screen.findByTestId('tell-body')) as HTMLTextAreaElement
    expect(io.loadCustomer).toHaveBeenCalledWith('cust-dana')
    expect(io.loadJob).not.toHaveBeenCalled()
    expect(box.value).toBe('Dana, Rosa here with Click Plumbing. Your estimate for Whitfield water heater is ready, $1,850.00: {link}')
    expect(screen.getByTestId('tell-email').textContent).toBe('The estimate with its link to approve, as the page previews it.')
    expect(screen.getAllByTestId('tell-act').map((p) => p.textContent)).toEqual([
      '✉️Emails Dana the estimate with the link to approve it.',
      '💬Texts Dana the same link from the company number. Dana’s answer comes to the office.',
      '🧾Then shows you what went, and offers the call.',
    ])
    const primary = screen.getByTestId('tell-primary') as HTMLButtonElement
    expect(primary.textContent).toBe('Send both to Dana')
    expect(primary.disabled).toBe(false)
    fireEvent.click(primary)
    await waitFor(() => expect(io.send).toHaveBeenCalledTimes(1))
    expect(est.sendEmail).toHaveBeenCalledTimes(1)
    expect(io.send).toHaveBeenCalledWith({ contactId: 'contact-dana', channelId: 'ch-1', jobId: null, body: 'Dana, Rosa here with Click Plumbing. Your estimate for Whitfield water heater is ready, $1,850.00: https://clicktooling.com/estimate/accept?t=abc' })
    expect(await screen.findByTestId('tell-receipt')).toBeTruthy()
    expect(screen.getByTestId('tell-receipt-email').textContent).toBe('Email · dana@example.com · 2:41 PM')
    expect(screen.getByTestId('tell-receipt-words').textContent).toContain('https://clicktooling.com/estimate/accept?t=abc')
    expect(screen.getByTestId('tell-script').textContent).toBe('Hi Dana, this is Rosa with Click Plumbing. I just sent your estimate for Whitfield water heater, $1,850.00. Do you have two minutes for me to walk you through it? You can approve from the link whenever you are ready.')
  })

  it('Email only sends the email alone; a failed email draws the band, keeps the words, and the press reads Try again (v2.5681)', async () => {
    const io = fakeIo()
    const { est } = mountEstimate(io)
    await screen.findByTestId('tell-body')
    fireEvent.click(screen.getByTestId('tell-email-only'))
    await waitFor(() => expect(est.sendEmail).toHaveBeenCalledTimes(1))
    expect(await screen.findByTestId('tell-receipt')).toBeTruthy()
    expect(io.send).not.toHaveBeenCalled()
    expect(screen.queryByTestId('tell-receipt-words')).toBeNull()
    cleanup()
    const failing = estimate(vi.fn(async () => ({ ok: false as const, kind: 'refused' as const, why: 'This customer has no email on record.' })))
    const io2 = fakeIo()
    mountEstimate(io2, failing)
    const box = (await screen.findByTestId('tell-body')) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'Dana, your estimate is here: {link}' } })
    fireEvent.click(screen.getByTestId('tell-primary'))
    await waitFor(() => expect(failing.sendEmail).toHaveBeenCalled())
    expect(io2.send).not.toHaveBeenCalled()
    expect(screen.queryByTestId('tell-receipt')).toBeNull()
    const bandEl = await screen.findByTestId('tell-send-problem')
    expect(bandEl.textContent).toBe('The email did not go.This customer has no email on record.')
    expect((screen.getByTestId('tell-body') as HTMLTextAreaElement).value).toBe('Dana, your estimate is here: {link}')
    expect(screen.getByTestId('tell-primary').textContent).toBe('Try again')
  })

  it('an estimate that already went flips the press to Send the link again, which resends and texts the fresh link (v2.5681)', async () => {
    const sendEmail = vi.fn(async () => ({ ok: false as const, kind: 'already-went' as const, why: 'This estimate already went to the customer.', sentAtMs: Date.parse('2026-10-20T18:31:00Z') }))
    const sendEmailAgain = vi.fn(async () => ({ ok: true as const, acceptUrl: 'https://clicktooling.com/estimate/accept?t=fresh', emailed: true }))
    const io = fakeIo()
    mountEstimate(io, estimate(sendEmail, sendEmailAgain))
    await screen.findByTestId('tell-body')
    fireEvent.click(screen.getByTestId('tell-primary'))
    const bandEl = await screen.findByTestId('tell-send-problem')
    expect(bandEl.textContent).toContain('This estimate already went to Dana. It went Tue, Oct 20 at 1:31 PM.')
    expect(bandEl.textContent).toContain('Send the link again makes a fresh link and emails it.')
    const primary = screen.getByTestId('tell-primary') as HTMLButtonElement
    expect(primary.textContent).toBe('Send the link again')
    fireEvent.click(primary)
    await waitFor(() => expect(sendEmailAgain).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(io.send).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('t=fresh') })))
    expect(await screen.findByTestId('tell-receipt')).toBeTruthy()
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('the receipt says when the email did not go, and when the text failed after it (v2.5681)', async () => {
    const io = fakeIo()
    mountEstimate(io, estimate(vi.fn(async () => ({ ok: true as const, acceptUrl: 'https://clicktooling.com/estimate/accept?t=abc', emailed: false }))))
    await screen.findByTestId('tell-body')
    fireEvent.click(screen.getByTestId('tell-primary'))
    expect(await screen.findByTestId('tell-receipt')).toBeTruthy()
    expect(screen.getByTestId('tell-receipt-email').textContent).toBe('The email to dana@example.com did not go. The link was made and copied. Paste it into an email yourself.')
    cleanup()
    const io2 = fakeIo({ send: vi.fn(async () => Promise.reject(new Error('Quo turned it away'))) })
    mountEstimate(io2)
    await screen.findByTestId('tell-body')
    fireEvent.click(screen.getByTestId('tell-primary'))
    expect(await screen.findByTestId('tell-receipt')).toBeTruthy()
    expect(screen.getByTestId('tell-receipt-email').textContent).toBe('Email · dana@example.com · 2:41 PM')
    expect(screen.queryByTestId('tell-receipt-words')).toBeNull()
    expect((await screen.findByTestId('tell-receipt-note')).textContent).toBe('Quo turned it away')
  })

  it('with no number the email still goes, the hold says why no text, and the press reads Send email', async () => {
    const io = fakeIo({ loadContact: vi.fn(async () => ({ contactId: 'contact-dana', numbers: [], prefers: null })) })
    const { est } = mountEstimate(io)
    expect((await screen.findByTestId('tell-hold')).textContent).toBe('⚠No text: Dana has no phone number on file. Add one on the customer.')
    expect(screen.queryByTestId('tell-body')).toBeNull()
    expect(screen.queryByTestId('tell-email-only')).toBeNull()
    const primary = screen.getByTestId('tell-primary') as HTMLButtonElement
    expect(primary.textContent).toBe('Send email to Dana')
    expect(primary.disabled).toBe(false)
    fireEvent.click(primary)
    await waitFor(() => expect(est.sendEmail).toHaveBeenCalled())
    expect(await screen.findByTestId('tell-receipt-email')).toBeTruthy()
    expect(io.send).not.toHaveBeenCalled()
  })

  it('the link word may stay in braces; any other blank left holds the press', async () => {
    mountEstimate(fakeIo())
    const box = (await screen.findByTestId('tell-body')) as HTMLTextAreaElement
    expect(box.value).toContain('{link}')
    expect((screen.getByTestId('tell-primary') as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText('The link fills in when it sends. Keep the word link in braces where you want it.')).toBeTruthy()
    fireEvent.change(box, { target: { value: 'Dana, your estimate for {job} is here: {link}' } })
    expect((screen.getByTestId('tell-primary') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('tell-primary') as HTMLButtonElement).title).toBe('Fill {job} before it sends.')
  })
  it('asks on a board’s move with the app’s Done words filled for the job, and the Done script on the receipt (v2.5627)', async () => {
    const io = fakeIo()
    const { onSent } = mount(io, { moment: 'done', block: null })
    const box = (await screen.findByTestId('tell-body')) as HTMLTextAreaElement
    expect(screen.getByRole('dialog', { name: 'Tell Dana' })).toBeTruthy()
    expect(box.value).toBe('Dana, this is Rosa with Click Plumbing. The work on Whitfield water heater is done. Your bill follows by email. Text me here with any question.')
    expect(screen.getByText('The app’s own words, since the office has no Done line yet. Change any word.')).toBeTruthy()
    expect(screen.getAllByTestId('tell-act').map((p) => p.textContent)).toEqual([
      '💬Texts Dana that the work is done from the company number. Dana’s answer comes to the office.',
      '🧾Then shows you what went, and offers the call.',
    ])
    const primary = screen.getByTestId('tell-primary') as HTMLButtonElement
    expect(primary.textContent).toBe('Send text to Dana')
    fireEvent.click(primary)
    await waitFor(() => expect(io.send).toHaveBeenCalledWith(expect.objectContaining({ contactId: 'contact-dana', jobId: 'job-512', body: expect.stringContaining('is done') })))
    expect(await screen.findByTestId('tell-receipt')).toBeTruthy()
    expect(screen.getByTestId('tell-script').textContent).toContain('The work on Whitfield water heater is done. I wanted to make sure everything looks right to you.')
    expect(onSent).toHaveBeenCalledWith('msg-1')
  })
})
