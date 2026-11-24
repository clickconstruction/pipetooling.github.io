// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcFollowUp, GcTradeAsks, type AskWrites } from './GcAskThread'
import { boardStateFromRows } from '../../lib/gc/boardRows'
import { clinicBoardRows } from '../../lib/gc/boardTestRows'
import { GC_WAITING_ON_THEM_ID } from '../../lib/gc/links'
import { allPeople } from '../../lib/gc/projectPeople'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'

installDomShims()

function writes(): AskWrites {
  return { logContact: vi.fn(() => Promise.resolve()), decline: vi.fn(() => Promise.resolve()) }
}

describe('GcFollowUp', () => {
  it('puts a company whose promised day passed under Late on their word, with the job and the last thing said', () => {
    const state = boardStateFromRows(clinicBoardRows())
    render(<GcFollowUp state={state} writes={writes()} onWhoElse={() => undefined} />)
    expect(screen.getByRole('heading', { name: 'Late on their word (1)' })).toBeTruthy()
    const card = document.querySelector('[data-gc-follow-up="i2"]')?.parentElement as HTMLElement
    expect(within(card).getByText('Hillside Excavation')).toBeTruthy()
    expect(within(card).getByText(/Hill Country Clinic · Sitework · bid/)).toBeTruthy()
    expect(within(card).getByText(/New to us; met at the pre-bid|Quote by Monday/)).toBeTruthy()
    // No phone on the record: no Call button, never a made-up number.
    expect(within(card).queryByText(/^Call /)).toBeNull()
  })

  it('logs a call with the day they promised, and Who else? goes to the trade', async () => {
    const w = writes()
    const onWhoElse = vi.fn()
    render(<GcFollowUp state={boardStateFromRows(clinicBoardRows())} writes={w} onWhoElse={onWhoElse} />)
    fireEvent.click(screen.getByRole('button', { name: 'Who else?' }))
    expect(onWhoElse).toHaveBeenCalledWith('Sitework')
    fireEvent.click(screen.getByRole('button', { name: 'Log a contact' }))
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('What they said'), { target: { value: 'Pricing it this week.' } })
    fireEvent.change(screen.getByLabelText('The day they promised the quote'), { target: { value: '2026-10-12' } })
    fireEvent.click(save)
    await waitFor(() => expect(w.logContact).toHaveBeenCalledWith({ companyId: 'hillside', inviteId: 'i2' }, 'call', 'Pricing it this week.', '2026-10-12'))
    await waitFor(() => expect(screen.queryByLabelText('What they said')).toBeNull())
  })

  it('Will not do it asks why first, and something else needs their words', async () => {
    const w = writes()
    render(<GcFollowUp state={boardStateFromRows(clinicBoardRows())} writes={w} onWhoElse={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Will not do it' }))
    const dialog = screen.getByRole('dialog', { name: 'Why Hillside Excavation will not do it' })
    const save = within(dialog).getByRole('button', { name: 'Save and take them off' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.click(within(dialog).getByRole('button', { name: 'something else' }))
    expect(save.disabled).toBe(true)
    fireEvent.click(within(dialog).getByRole('button', { name: 'too busy' }))
    fireEvent.change(within(dialog).getByLabelText('Their words'), { target: { value: ' both crews are on a school job ' } })
    fireEvent.click(save)
    await waitFor(() => expect(w.decline).toHaveBeenCalledWith('i2', 'wont', 'busy', 'both crews are on a school job'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('keeps the window open with the problem in words when the decline does not save', async () => {
    const w = writes()
    vi.mocked(w.decline).mockRejectedValueOnce(new Error('No ask with that id.'))
    render(<GcFollowUp state={boardStateFromRows(clinicBoardRows())} writes={w} onWhoElse={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cannot do it' }))
    const dialog = screen.getByRole('dialog', { name: 'Why Hillside Excavation cannot do it' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'too far' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save and take them off' }))
    await within(dialog).findByText('No ask with that id.')
  })

  it('carries the anchor a board’s Needs a hand today lands on', () => {
    render(<GcFollowUp state={boardStateFromRows(clinicBoardRows())} writes={writes()} onWhoElse={() => undefined} />)
    expect(screen.getByRole('region', { name: 'We are waiting on them' }).id).toBe(GC_WAITING_ON_THEM_ID)
  })

  it('says so when nobody is waited on', () => {
    render(<GcFollowUp state={boardStateFromRows(clinicBoardRows({ invites: [] }))} writes={writes()} onWhoElse={() => undefined} />)
    expect(screen.getByText('We are not waiting on anyone for a quote.')).toBeTruthy()
    cleanup()
    render(<GcFollowUp state={boardStateFromRows(clinicBoardRows({ invites: [] }))} writes={writes()} onWhoElse={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'By people · 0' }))
    expect(screen.getByText('We are not waiting on anyone.')).toBeTruthy()
  })
})

describe('GcFollowUp, By people (the Board’s B2b-ii-b)', () => {
  it('counts everyone once, as the badge does, and lists them with the reason and Call only', () => {
    const state = boardStateFromRows(clinicBoardRows())
    render(<GcFollowUp state={state} writes={writes()} onWhoElse={() => undefined} />)
    const people = screen.getByRole('button', { name: `By people · ${allPeople(state).count}` })
    expect(people.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(people)
    expect(people.getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('heading', { name: 'Late on their word (1)' })).toBeNull()
    expect(screen.getByText('Dee Park')).toBeTruthy()
    expect(screen.getByText('Hill Country Clinic: Promised a quote by Mon Oct 5. That was 3 days ago.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Follow up$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Work the list/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'By urgency' }))
    expect(screen.getByRole('heading', { name: 'Late on their word (1)' })).toBeTruthy()
  })

  it('lists who the ask cards never show: Pecan Valley’s insurance on the made-up data', () => {
    const state = initialGcState()
    render(<GcFollowUp state={state} writes={writes()} onWhoElse={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: `By people · ${allPeople(state).count}` }))
    expect(screen.getAllByText(/Their insurance ran out Tue Sep 15\./).length).toBeGreaterThan(0)
  })
})

describe('GcFollowUp, the ways onto the Follow up sheet (the Board’s B2b-viii-a)', () => {
  it('Work the list opens everyone; each person’s Follow up and Call open it at them', () => {
    const state = initialGcState()
    const onFollowUp = vi.fn()
    render(<GcFollowUp state={state} writes={writes()} onWhoElse={() => undefined} onFollowUp={onFollowUp} />)
    // On By urgency the list's button is not drawn: it sits with the people.
    expect(screen.queryByRole('button', { name: /Work the list/ })).toBeNull()
    const count = allPeople(state).count
    fireEvent.click(screen.getByRole('button', { name: `By people · ${count}` }))
    fireEvent.click(screen.getByRole('button', { name: `Work the list · ${count} people` }))
    expect(onFollowUp).toHaveBeenLastCalledWith()
    fireEvent.click(screen.getAllByRole('button', { name: 'Follow up' })[0]!)
    expect(onFollowUp).toHaveBeenLastCalledWith('hillside', false)
  })

  it('ends By urgency with everyone waited on for something other than a quote', () => {
    const state = initialGcState()
    const onFollowUp = vi.fn()
    render(<GcFollowUp state={state} writes={writes()} onWhoElse={() => undefined} onFollowUp={onFollowUp} />)
    const more = screen.getByRole('region', { name: 'More to follow up on' })
    // Everyone but Bexar Steel, who owes only a quote, which its card shows.
    expect(within(more).getByRole('heading', { name: `More to follow up on (${allPeople(state).count - 1})` })).toBeTruthy()
    expect(within(more).queryByText('Tom Riddle')).toBeNull()
    expect(within(more).getByText('Marcus Bell')).toBeTruthy()
    expect(within(more).getByText('Elena Marchetti')).toBeTruthy()
    // Greg's quote is on his card above; here, only the plans he has not opened.
    expect(within(more).queryByText(/Promised a quote/)).toBeNull()
    const customerRow = within(more).getByText('Elena Marchetti').closest('span[style*="grid-template-columns"]') as HTMLElement
    fireEvent.click(within(customerRow).getByRole('button', { name: 'Follow up' }))
    expect(onFollowUp).toHaveBeenLastCalledWith('customer:cibolo', false)
  })
})

describe('GcTradeAsks', () => {
  it('lists each company asked on the trade: a quote in without the buttons, an open ask with its story and the buttons', () => {
    render(<GcTradeAsks state={boardStateFromRows(clinicBoardRows())} projectId="p1" packageId="k1" writes={writes()} />)
    const list = document.querySelector('[data-gc-trade-asks="k1"]') as HTMLElement
    expect(within(list).getByText('Lonestar Earthworks')).toBeTruthy()
    expect(within(list).getByText('quote in')).toBeTruthy()
    expect(within(list).getByText('looking')).toBeTruthy()
    expect(within(list).getAllByRole('button', { name: 'Will not do it' })).toHaveLength(1)
    expect(document.querySelector('[data-gc-ask="i2"]')).toBeTruthy()
    expect(document.querySelector('[data-gc-ask="i1"]')).toBeNull()
  })

  it('offers Ask for quotes while a company in the trade is not asked, and not on a trade with nobody left to ask', () => {
    const onAsk = vi.fn()
    const base = clinicBoardRows()
    const withConcrete = clinicBoardRows({ companies: [...base.companies, { ...base.companies[0]!, id: 'alamo', name: 'Alamo Concrete', trades: ['Concrete'] }] })
    const { rerender } = render(<GcTradeAsks state={boardStateFromRows(withConcrete)} projectId="p1" packageId="k2" writes={writes()} onAsk={onAsk} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ask for quotes' }))
    expect(onAsk).toHaveBeenCalled()
    rerender(<GcTradeAsks state={boardStateFromRows(withConcrete)} projectId="p1" packageId="k1" writes={writes()} onAsk={onAsk} />)
    expect(screen.queryByRole('button', { name: 'Ask for quotes' })).toBeNull()
  })

  it('opens Compare quotes once a quote is in on the trade, counting the quotes', () => {
    const onCompare = vi.fn()
    render(<GcTradeAsks state={boardStateFromRows(clinicBoardRows())} projectId="p1" packageId="k1" writes={writes()} onCompare={onCompare} />)
    fireEvent.click(screen.getByRole('button', { name: 'Compare quotes (1)' }))
    expect(onCompare).toHaveBeenCalled()
  })

  it('says no company is asked yet, and draws nothing for our own trade', () => {
    const { container, rerender } = render(<GcTradeAsks state={boardStateFromRows(clinicBoardRows())} projectId="p1" packageId="k2" writes={writes()} />)
    expect(screen.getByText('No company asked yet.')).toBeTruthy()
    rerender(<GcTradeAsks state={boardStateFromRows(clinicBoardRows())} projectId="p1" packageId="k3" writes={writes()} />)
    expect(container.textContent).toBe('')
  })
})

// v2.8440: Take the ask back… on an ask the company has not heard about, behind a confirm whose button names the act.
describe('GcTradeAsks · Take the ask back… (v2.8440)', () => {
  /** The clinic's sitework with one more company asked a minute ago: no email sent, nothing opened, no contact. */
  function withFreshAsk() {
    const base = clinicBoardRows()
    return clinicBoardRows({
      companies: [...base.companies, { ...base.companies[0]!, id: 'zz', name: 'ZZ Test trade no page, delete me', trades: ['Sitework'] }],
      invites: [...base.invites, { ...base.invites[1]!, id: 'i9', company_id: 'zz', status: 'invited', seen_rev: null }],
    })
  }
  function backWrites() {
    return { ...writes(), takeBack: vi.fn(() => Promise.resolve()) }
  }

  it('shows on an ask still open, asks first in its words, and takes it back on the press', async () => {
    const w = backWrites()
    renderWithProviders(<GcTradeAsks state={boardStateFromRows(withFreshAsk())} projectId="p1" packageId="k1" writes={w} />)
    // Lonestar quoted: its ask offers no press. Hillside opened theirs and has not quoted: it does (v2.8490, below).
    expect(document.querySelector('[data-gc-ask-back="i1"]')).toBeNull()
    expect(document.querySelector('[data-gc-ask-back="i2"]')).not.toBeNull()
    const cell = document.querySelector('[data-gc-ask-back="i9"]') as HTMLElement
    fireEvent.click(within(cell).getByRole('button', { name: 'Take the ask back…' }))
    const ask = await screen.findByRole('alertdialog', { name: 'Take the Sitework ask back from ZZ Test trade no page, delete me?' })
    expect(within(ask).getByText(/has not opened this ask, sent a quote or heard from us about it\. The ask is deleted/)).toBeTruthy()
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(w.takeBack).not.toHaveBeenCalled()

    fireEvent.click(within(cell).getByRole('button', { name: 'Take the ask back…' }))
    const again = await screen.findByRole('alertdialog', { name: 'Take the Sitework ask back from ZZ Test trade no page, delete me?' })
    fireEvent.click(within(again).getByRole('button', { name: 'Take the ask back' }))
    await waitFor(() => expect(w.takeBack).toHaveBeenCalledWith('i9'))
  })

  it('a refusal from the server draws its reason beside the press', async () => {
    const w = backWrites()
    // A Supabase refusal is a plain object, never an Error: the row must still read its reason.
    vi.mocked(w.takeBack).mockRejectedValueOnce({ message: 'ZZ Test trade no page, delete me stays asked on Sitework, since we emailed them about it. Close an ask they heard about with Will not do it or Cannot do it.', code: 'P0001' })
    renderWithProviders(<GcTradeAsks state={boardStateFromRows(withFreshAsk())} projectId="p1" packageId="k1" writes={w} />)
    const cell = document.querySelector('[data-gc-ask-back="i9"]') as HTMLElement
    fireEvent.click(within(cell).getByRole('button', { name: 'Take the ask back…' }))
    const ask = await screen.findByRole('alertdialog', { name: 'Take the Sitework ask back from ZZ Test trade no page, delete me?' })
    fireEvent.click(within(ask).getByRole('button', { name: 'Take the ask back' }))
    await within(cell).findByText('The ask did not come back: ZZ Test trade no page, delete me stays asked on Sitework, since we emailed them about it. Close an ask they heard about with Will not do it or Cannot do it.')
    expect((within(cell).getByRole('button', { name: 'Take the ask back…' }) as HTMLButtonElement).disabled).toBe(false)
  })

  // v2.8490: an ask they heard about is kept and closes as ours, and the window says so before the press.
  it('on an ask they opened, the window says it is kept and closes as we took it back', async () => {
    const w = backWrites()
    renderWithProviders(<GcTradeAsks state={boardStateFromRows(withFreshAsk())} projectId="p1" packageId="k1" writes={w} />)
    const cell = document.querySelector('[data-gc-ask-back="i2"]') as HTMLElement
    const press = within(cell).getByRole('button', { name: 'Take the ask back…' })
    expect(press.getAttribute('title')).toBe('They heard about this ask and have not quoted. Press to close it as we took it back.')
    fireEvent.click(press)
    const ask = await screen.findByRole('alertdialog', { name: 'Take the Sitework ask back from Hillside Excavation?' })
    expect(within(ask).getByText('Hillside Excavation opened this ask in their portal. So the ask is kept, and it closes as we took it back. Their portal says we took it back, and no email goes to them. A closed ask does not open again.')).toBeTruthy()
    fireEvent.click(within(ask).getByRole('button', { name: 'Take the ask back' }))
    await waitFor(() => expect(w.takeBack).toHaveBeenCalledWith('i2'))
  })

  it('an ask we took back reads we took it back on its chip, with no press left on it', () => {
    const base = withFreshAsk()
    const rows = { ...base, invites: base.invites.map((i) => (i.id === 'i2' ? { ...i, status: 'declined', declined_why: 'withdrawn', declined_on: '2026-10-07' } : i)) }
    renderWithProviders(<GcTradeAsks state={boardStateFromRows(rows)} projectId="p1" packageId="k1" writes={backWrites()} />)
    expect(screen.getByText('we took it back').getAttribute('title')).toBe('We took this ask back after they heard about it. It is not their answer.')
    expect(screen.queryByText('passed')).toBeNull()
    expect(document.querySelector('[data-gc-ask-back="i2"]')).toBeNull()
  })

  it('offers no press to a reader without the write', () => {
    render(<GcTradeAsks state={boardStateFromRows(withFreshAsk())} projectId="p1" packageId="k1" writes={writes()} />)
    expect(screen.queryByRole('button', { name: 'Take the ask back…' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Will not do it' }).length).toBeGreaterThan(0)
  })
})
