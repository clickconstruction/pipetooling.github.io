// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcFollowUp, GcTradeAsks, type AskWrites } from './GcAskThread'
import { boardStateFromRows } from '../../lib/gc/boardRows'
import { clinicBoardRows } from '../../lib/gc/boardTestRows'
import { installDomShims } from '../../test/renderSmokeMocks'

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

  it('says so when nobody is waited on', () => {
    render(<GcFollowUp state={boardStateFromRows(clinicBoardRows({ invites: [] }))} writes={writes()} onWhoElse={() => undefined} />)
    expect(screen.getByText('We are not waiting on anyone for a quote.')).toBeTruthy()
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

  it('says no company is asked yet, and draws nothing for our own trade', () => {
    const { container, rerender } = render(<GcTradeAsks state={boardStateFromRows(clinicBoardRows())} projectId="p1" packageId="k2" writes={writes()} />)
    expect(screen.getByText('No company asked yet.')).toBeTruthy()
    rerender(<GcTradeAsks state={boardStateFromRows(clinicBoardRows())} projectId="p1" packageId="k3" writes={writes()} />)
    expect(container.textContent).toBe('')
  })
})
