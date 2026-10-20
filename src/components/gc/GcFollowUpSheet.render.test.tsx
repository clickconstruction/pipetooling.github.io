// @vitest-environment jsdom
/**
 * GC mode, the real build, the Board's B2b-viii-a: the Follow up sheet. From me opens the reader's own Messages or mail and
 * I sent it logs it; Call logs what they said, and a day on a paper writes its promise. Nothing is sent from Click.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcFollowUpSheet, type FollowUpFromCompany } from './GcFollowUpSheet'
import { GC_TRADE_EMAIL_REFUSALS } from '../../lib/gc/tradeEmail'
import type { FollowUpWriters } from '../../lib/gc/followUpWrites'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { GcState } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

/** Press a link without following it: jsdom cannot follow an sms: link. */
function pressLink(link: HTMLElement) {
  const ev = createEvent.click(link)
  ev.preventDefault()
  fireEvent(link, ev)
}

afterEach(() => {
  cleanup()
})

/** The fixture, with a number and an address on Pecan Valley's record. */
function withReach(): GcState {
  const s = initialGcState()
  return { ...s, partners: s.partners.map((p) => (p.id === 'pecanvalley' ? { ...p, phone: '(210) 555-0177', email: 'marcus@pecanvalley.example' } : p)) }
}

function writers(): FollowUpWriters {
  return { logAsk: vi.fn(() => Promise.resolve()), logCustomer: vi.fn(() => Promise.resolve()), recordPromise: vi.fn(() => Promise.resolve()) }
}

describe('GcFollowUpSheet', () => {
  it('walks everyone Follow up counts, with a draft from me that opens my own Messages', () => {
    render(<GcFollowUpSheet state={withReach()} writes={writers()} me="Robert Douglas" startPartnerId="pecanvalley" onClose={() => undefined} />)
    const nav = screen.getByRole('navigation', { name: 'People to follow up' })
    expect(within(nav).getAllByRole('button').length).toBeGreaterThan(5)
    expect(screen.getByRole('heading', { name: /^Follow up with Marcus/ })).toBeTruthy()
    const draft = screen.getByRole('link', { name: 'Draft text' }) as HTMLAnchorElement
    expect(draft.href).toMatch(/^sms:2105550177\?&body=Hi%20Marcus/)
    // Without the email from Click, no From choice at all.
    expect(screen.queryByRole('group', { name: 'From' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'I sent it' })).toBeNull()
  })

  it('logs the text on I sent it, once, then marks them done', async () => {
    const w = writers()
    const onLogged = vi.fn()
    render(<GcFollowUpSheet state={withReach()} writes={w} me="Robert Douglas" startPartnerId="pecanvalley" onClose={() => undefined} onLogged={onLogged} />)
    pressLink(screen.getByRole('link', { name: 'Draft text' }))
    expect(w.logAsk).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'I sent it' }))
    await waitFor(() => expect(onLogged).toHaveBeenCalledTimes(1))
    expect(w.logAsk).toHaveBeenCalledTimes(1)
    expect(w.logAsk).toHaveBeenCalledWith({ companyId: 'pecanvalley', inviteId: null, how: 'text', note: expect.stringMatching(/^Texted about .*: Hi Marcus/), promisedBy: null })
    expect(w.recordPromise).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toBe('Texted Marcus. It is logged.')
  })

  it('a call with a day writes the promises, then the company’s line', async () => {
    const w = writers()
    render(<GcFollowUpSheet state={withReach()} writes={w} me="Robert Douglas" startPartnerId="pecanvalley" startCalling onClose={() => undefined} />)
    expect(screen.getByText('What did Marcus say?')).toBeTruthy()
    const save = screen.getByRole('button', { name: 'Save the call' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('What Marcus said'), { target: { value: 'Both by Thursday.' } })
    fireEvent.change(screen.getByLabelText('The day they gave'), { target: { value: '2026-10-08' } })
    fireEvent.click(save)
    await waitFor(() => expect(w.logAsk).toHaveBeenCalledTimes(1))
    expect(vi.mocked(w.recordPromise).mock.calls.map(([p]) => p.kind)).toEqual(['insurance', 'closeout'])
    expect(w.recordPromise).toHaveBeenCalledWith(expect.objectContaining({ companyId: 'pecanvalley', kind: 'closeout', projectId: 'fairoaksd', packageId: 'felec', dueOn: '2026-10-08' }))
    expect(w.logAsk).toHaveBeenCalledWith(expect.objectContaining({ inviteId: null, how: 'call', note: expect.stringMatching(/: Both by Thursday\.$/) }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Called Marcus. It is logged.'))
  })

  it('a customer’s call goes in their own log, with the job', async () => {
    const w = writers()
    render(<GcFollowUpSheet state={withReach()} writes={w} me={null} startPartnerId="customer:cibolo" startCalling onClose={() => undefined} />)
    fireEvent.change(screen.getByLabelText(/^What .* said$/), { target: { value: 'Paying Friday.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the call' }))
    await waitFor(() => expect(w.logCustomer).toHaveBeenCalledTimes(1))
    expect(w.logCustomer).toHaveBeenCalledWith({ customerId: 'cibolo', projectId: 'fairoaksd', how: 'call', note: expect.stringMatching(/: Paying Friday\.$/) })
    expect(w.logAsk).not.toHaveBeenCalled()
    expect(w.recordPromise).not.toHaveBeenCalled()
  })

  it('says a refusal in words and logs nothing more', async () => {
    const w = writers()
    w.recordPromise = vi.fn(() => Promise.reject(new Error('Failed to write down the day: Say what they promised.')))
    const onLogged = vi.fn()
    render(<GcFollowUpSheet state={withReach()} writes={w} me="Robert Douglas" startPartnerId="pecanvalley" startCalling onClose={() => undefined} onLogged={onLogged} />)
    fireEvent.change(screen.getByLabelText('The day they gave'), { target: { value: '2026-10-08' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the call' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('It did not log: Failed to write down the day: Say what they promised.'))
    expect(w.logAsk).not.toHaveBeenCalled()
    expect(onLogged).not.toHaveBeenCalled()
  })

  it('never offers a number or an address the record does not have', () => {
    render(<GcFollowUpSheet state={withReach()} writes={writers()} me="Robert Douglas" startPartnerId="hillside" onClose={() => undefined} />)
    expect(screen.getByText('No phone number')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Call' })).toBeNull()
    expect(screen.queryByRole('link', { name: /^Draft / })).toBeNull()
    expect((screen.getByRole('button', { name: 'Text' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Email' }) as HTMLButtonElement).disabled).toBe(true)
    // A call made another way is still logged.
    fireEvent.click(screen.getByRole('button', { name: 'Log a call' }))
    expect(screen.getByText('What did Greg say?')).toBeTruthy()
  })

  it('walks one job’s list under its name, and Escape closes it first', () => {
    const onClose = vi.fn()
    const s = withReach()
    const under = vi.fn((e: KeyboardEvent) => e.defaultPrevented)
    document.addEventListener('keydown', under)
    render(<GcFollowUpSheet state={s} writes={writers()} me={null} onClose={onClose} list={() => []} title="Fair Oaks Shops" />)
    expect(screen.getByRole('dialog', { name: 'Follow up: Fair Oaks Shops' })).toBeTruthy()
    expect(screen.getByText(/No one to follow up right now/)).toBeTruthy()
    act(() => {
      fireEvent.keyDown(document.body, { key: 'Escape' })
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    // A window under the sheet sees the key already taken.
    expect(under).toHaveReturnedWith(true)
    document.removeEventListener('keydown', under)
  })
})

describe('GcFollowUpSheet, the email from Click (B2b-viii-b)', () => {
  function company(over: Partial<FollowUpFromCompany> = {}): FollowUpFromCompany {
    return {
      send: vi.fn(() => Promise.resolve({ ok: true as const, companyId: 'pecanvalley', messageId: 'm1', emailSendLogId: 'l1', to: ['Marcus Bell'], already: false })),
      test: vi.fn(() => Promise.resolve({ ok: true as const, test: true as const, email: 'bids@clickplumbing.com', wouldGo: [{ name: 'Marcus Bell', email: 'marcus@pecanvalley.example' }] })),
      ...over,
    }
  }
  const openFromClick = (fromCompany: FollowUpFromCompany, w = writers(), partnerId = 'pecanvalley', state = withReach()) => {
    render(<GcFollowUpSheet state={state} writes={w} fromCompany={fromCompany} me="Robert Douglas" startPartnerId={partnerId} onClose={() => undefined} />)
    fireEvent.click(within(screen.getByRole('group', { name: 'From' })).getByRole('button', { name: 'Click Construction' }))
    return w
  }

  it('offers From the company only with the press, by email only, its box holding the email’s own words', () => {
    render(<GcFollowUpSheet state={withReach()} writes={writers()} me="Robert Douglas" startPartnerId="pecanvalley" onClose={() => undefined} />)
    expect(screen.queryByRole('group', { name: 'From' })).toBeNull()
    cleanup()
    openFromClick(company())
    expect((screen.getByRole('button', { name: 'Text' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Email' }).getAttribute('aria-pressed')).toBe('true')
    const box = screen.getByLabelText('The message') as HTMLTextAreaElement
    expect(box.value).not.toMatch(/^Hello /)
    expect(box.value).not.toMatch(/Thank you,/)
    expect(screen.queryByRole('link', { name: /^Draft / })).toBeNull()
  })

  it('a test copy goes to me alone and says who the real one reaches; nothing is logged', async () => {
    const c = company()
    const w = openFromClick(c)
    fireEvent.click(screen.getByRole('button', { name: 'Send a test to me' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('A test copy went to bids@clickplumbing.com. The real one goes to Marcus Bell <marcus@pecanvalley.example>.'))
    expect(c.test).toHaveBeenCalledWith(expect.objectContaining({ companyId: 'pecanvalley', kind: 'nudge', test: true, groups: ['job', 'pay'], projectId: 'fairoaksd' }))
    expect(c.send).not.toHaveBeenCalled()
    expect(w.logAsk).not.toHaveBeenCalled()
  })

  it('Send email sends, then logs it as a nudge from Click, and moves on', async () => {
    const c = company()
    const w = openFromClick(c)
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }))
    await waitFor(() => expect(w.logAsk).toHaveBeenCalledTimes(1))
    expect(c.send).toHaveBeenCalledWith(expect.not.objectContaining({ test: true }))
    expect(w.logAsk).toHaveBeenCalledWith(expect.objectContaining({ companyId: 'pecanvalley', inviteId: null, how: 'nudge', note: expect.stringMatching(/^From Click Construction: emailed about /) }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Emailed Marcus. It is logged.'))
  })

  it('a refusal or an email already sent today logs nothing, and says so', async () => {
    const refused = company({ send: vi.fn(() => Promise.resolve({ ok: false as const, key: 'noEmail' as const, detail: null })) })
    const w = openFromClick(refused)
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(GC_TRADE_EMAIL_REFUSALS.noEmail))
    expect(w.logAsk).not.toHaveBeenCalled()
    cleanup()
    const again = company({ send: vi.fn(() => Promise.resolve({ ok: true as const, companyId: 'pecanvalley', messageId: 'm1', emailSendLogId: 'l1', to: [], already: true })) })
    const w2 = openFromClick(again)
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('That email already went today. Nothing new was sent or logged.'))
    expect(w2.logAsk).not.toHaveBeenCalled()
  })

  it('holds a company that writes in Spanish, in words, and never offers Click to a customer', () => {
    const s = withReach()
    const es = { ...s, partners: s.partners.map((p) => (p.id === 'pecanvalley' ? { ...p, lang: 'es' as const } : p)) }
    const c = company()
    openFromClick(c, writers(), 'pecanvalley', es)
    expect(screen.getByText(GC_TRADE_EMAIL_REFUSALS.spanishHeld)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Send email' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Send a test to me' }) as HTMLButtonElement).disabled).toBe(true)
    cleanup()
    render(<GcFollowUpSheet state={withReach()} writes={writers()} fromCompany={company()} me="Robert Douglas" startPartnerId="customer:cibolo" onClose={() => undefined} />)
    expect(screen.queryByRole('group', { name: 'From' })).toBeNull()
  })
})
