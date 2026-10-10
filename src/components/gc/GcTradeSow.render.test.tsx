// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcTradeSow, type SowWrites } from './GcTradeSow'
import { boardStateFromRows, type SowRow } from '../../lib/gc/boardRows'
import { awardedClinicBoardRows, clinicBoardRows } from '../../lib/gc/boardTestRows'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

function writes(): SowWrites {
  return { send: vi.fn(() => Promise.resolve()) }
}

/** The clinic's sitework awarded to Lonestar, its statement of work in the given state (the bed's numbers). */
function card(sow: Partial<SowRow> = {}, w = writes()) {
  const base = awardedClinicBoardRows()
  const state = boardStateFromRows({ ...base, sows: (base.sows ?? []).map((s) => ({ ...s, ...sow })) })
  render(<GcTradeSow state={state} projectId="p1" packageId="k1" writes={w} canSend canEmail />)
  return { w, el: document.querySelector('[data-gc-trade-sow="k1"]') as HTMLElement }
}

describe('GcTradeSow', () => {
  it('shows the statement of work: who has it, where it stands, the price, ours beside theirs and what they will not do', () => {
    const { el } = card()
    expect(within(el).getByText('Lonestar Earthworks')).toBeTruthy()
    expect(within(el).getByText('Statement of work waiting on their signature')).toBeTruthy()
    expect(within(el).getByText(/awarded Oct 8 by Rosa/)).toBeTruthy()
    expect(within(el).getByText('$66,500')).toBeTruthy()
    expect(within(el).getByText('10%')).toBeTruthy()
    expect(within(el).getByText('Bid set')).toBeTruthy()
    expect(within(el).getByText('Clearing and grading')).toBeTruthy()
    expect(within(el).getByText('$33,300')).toBeTruthy()
    expect(within(el).getByText('Mobilize')).toBeTruthy()
    // Their lines add up to 52,000 against a price of 66,500.
    expect(within(el).getByText('Their lines add up to $52,000, $14,500 under the price.')).toBeTruthy()
    expect(el.textContent).toContain('What they will not do: Dewatering · Rock ($38 per cy if it comes up)')
    // Sent already, so nothing to press.
    expect(within(el).queryByRole('button', { name: 'Send to their portal to sign' })).toBeNull()
  })

  it('a drafted one sends to their portal, and emails it only when a dev ticks the box, which starts off (P2c-ii)', async () => {
    const { w, el } = card({ status: 'draft', sent_on: null })
    expect(within(el).getByText('Statement of work drafted')).toBeTruthy()
    const box = within(el).getByLabelText('Email it now') as HTMLInputElement
    expect(box.checked).toBe(false)
    fireEvent.click(within(el).getByRole('button', { name: 'Send to their portal to sign' }))
    await waitFor(() => expect(w.send).toHaveBeenCalledWith('k1', false))
    fireEvent.click(box)
    fireEvent.click(within(el).getByRole('button', { name: 'Send to their portal to sign' }))
    await waitFor(() => expect(w.send).toHaveBeenLastCalledWith('k1', true))
  })

  it('shows no email box to a sender who may not email a trade', () => {
    const base = awardedClinicBoardRows()
    const state = boardStateFromRows({ ...base, sows: (base.sows ?? []).map((s) => ({ ...s, status: 'draft' as const, sent_on: null })) })
    render(<GcTradeSow state={state} projectId="p1" packageId="k1" writes={writes()} canSend />)
    expect(screen.queryByLabelText('Email it now')).toBeNull()
    expect(screen.getByRole('button', { name: 'Send to their portal to sign' })).toBeTruthy()
  })

  it('says the send’s refusal in its own words', async () => {
    const w = { send: vi.fn(() => Promise.reject(new Error('That statement of work is not a draft any more. Read the board again.'))) }
    const { el } = card({ status: 'draft', sent_on: null }, w)
    fireEvent.click(within(el).getByRole('button', { name: 'Send to their portal to sign' }))
    expect(await within(el).findByText('That statement of work is not a draft any more. Read the board again.')).toBeTruthy()
  })

  it('a drafted one reads only to someone who may not send it, the money team since O9', () => {
    const base = awardedClinicBoardRows()
    const state = boardStateFromRows({ ...base, sows: (base.sows ?? []).map((s) => ({ ...s, status: 'draft', sent_on: null })) })
    render(<GcTradeSow state={state} projectId="p1" packageId="k1" writes={writes()} />)
    const el = document.querySelector('[data-gc-trade-sow="k1"]') as HTMLElement
    expect(within(el).getByText('Statement of work drafted')).toBeTruthy()
    expect(within(el).getByText('$66,500')).toBeTruthy()
    expect(within(el).queryByRole('button', { name: 'Send to their portal to sign' })).toBeNull()
    expect(within(el).getByText('A dev sends it to their portal to sign.')).toBeTruthy()
  })

  it('a signed one reads its day', () => {
    const { el } = card({ status: 'signed', signed_on: '2026-10-12' })
    expect(within(el).getByText('Statement of work signed Oct 12')).toBeTruthy()
  })

  it('shows nothing for a trade with no statement of work', () => {
    render(<GcTradeSow state={boardStateFromRows(clinicBoardRows())} projectId="p1" packageId="k1" writes={writes()} />)
    expect(document.querySelector('[data-gc-trade-sow]')).toBeNull()
    expect(screen.queryByText(/Statement of work/)).toBeNull()
  })
})
