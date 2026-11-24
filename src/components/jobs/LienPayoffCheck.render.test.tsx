// @vitest-environment jsdom
/**
 * One check over many bills (punch list #435, piece 3): the pane opens from a place in Payoffs with the amount that
 * pays the liens off, shows the three totals, holds a part payment on a Stripe bill with its door, takes a value set
 * by hand, records the ready lines with the check's number, day and note, and lists a line that failed with its
 * reason. The write is handed in; the rule is held by `lienPayoffCheck.test.ts`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { BankCheck } from '../../lib/jobs/checkCleared'
import type { LienPayoffFacts } from '../../lib/jobs/lienPayoff'
import type { PayoffCheckOutcome, PayoffCheckWrite } from '../../lib/jobs/lienPayoffCheckIo'
import LienPayoffs from './LienPayoffs'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

// Every name, address, job, instrument, check and amount here is made up.
const job = (id: string, n: string, name: string) => ({ id, hcp_number: null, click_number: n, job_name: name, job_address: '212 Larkspur Court, Austin, TX', customer_id: 'c1', customer_name: 'Marisol Okafor' })
const lien = (id: string, job_id: string, amount: number, recording_number: string) => ({ id, job_id, amount, county: 'Travis', recording_number, filed_at: '2026-11-09' })
const facts = (over: Partial<LienPayoffFacts> = {}): LienPayoffFacts => ({
  affidavits: [lien('a1', 'j1', 7420, '2026-0412207'), lien('a2', 'j2', 5160.5, '2026-0412208')],
  releases: [],
  jobs: [job('j1', '2041', 'Okafor main house'), job('j2', '2058', 'Okafor service visit')],
  otherJobs: [job('j4', '2071', 'Okafor trip charge')],
  openByJob: { j1: 7420, j2: 5160.5, j4: 640 },
  billsByJob: {
    j1: [
      { invoiceId: 'b1', jobId: 'j1', open: 4420, billedYmd: '2026-11-02', stripe: false },
      { invoiceId: 'b2', jobId: 'j1', open: 3000, billedYmd: '2026-11-10', stripe: false },
    ],
    j2: [{ invoiceId: 'b3', jobId: 'j2', open: 5160.5, billedYmd: '2026-11-09', stripe: true }],
    j4: [{ invoiceId: 'b5', jobId: 'j4', open: 640, billedYmd: '2026-09-03', stripe: false }],
  },
  paymentsByJob: {},
  todayYmd: '2026-11-24',
  ...over,
})
/** The bank's deposit of check 2290 for exactly what pays the two liens off. */
const AT_BANK: BankCheck = { id: 'k1', amount: 12580.5, status: 'pending', depositedYmd: '2026-11-23', postedYmd: null, bankDayYmd: '2026-12-02', checkNumber: '2290', failureReason: null }

type Record = (lines: ReadonlyArray<PayoffCheckWrite>, check: { paidOn: string; number: string; note: string }) => Promise<PayoffCheckOutcome[]>
const draw = async (record?: Record, over: Partial<LienPayoffFacts> = {}) => {
  const onOpenBill = vi.fn()
  const onChanged = vi.fn()
  const read = vi.fn(() => Promise.resolve(facts(over)))
  const write = vi.fn<Record>(record ?? (async (lines) => lines.map((l) => ({ invoiceId: l.invoiceId, ok: true, why: null }))))
  renderWithProviders(<LienPayoffs todayYmd={over.todayYmd ?? '2026-11-24'} refreshKey={1} onOpenBill={onOpenBill} onOpenRelease={() => {}} onChanged={onChanged} read={read} record={write} initiallyOpen />)
  fireEvent.click(await screen.findByRole('button', { name: 'One check for this place ›' }))
  return { onOpenBill, onChanged, read, write }
}
const q = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const line = (id: string) => q(`[data-lien-payoff-check-line="${id}"]`)
const totals = () => [...document.querySelectorAll('[data-lien-payoff-check-totals] [data-value="worked-out"]')].map((n) => n.textContent)
const type = (selector: string, value: string) => fireEvent.change(q<HTMLInputElement>(selector), { target: { value } })

afterEach(cleanup)

describe('One check for this place', () => {
  it('shows money open with no lien under the place, before the pane opens', async () => {
    renderWithProviders(<LienPayoffs todayYmd="2026-11-24" refreshKey={1} onOpenBill={() => {}} onOpenRelease={() => {}} read={() => Promise.resolve(facts())} initiallyOpen />)
    await screen.findByRole('button', { name: 'One check for this place ›' })
    expect(q('[data-lien-payoff-other]').textContent).toBe('$640.00 more is open here on 2071. It is not liened.')
    expect(q('[data-lien-payoff-headline]').textContent).toBe('2 liens on record here. $12,580.50 pays them off.')
  })

  it('opens on the check the bank holds, and records nothing until the bank clears it', async () => {
    const { write } = await draw(undefined, { bank: [AT_BANK] })
    // Nobody types the check: its amount, its number and the day it was deposited come from the bank.
    expect(q<HTMLInputElement>('[data-lien-payoff-check-amount]').value).toBe('12,580.50')
    expect(q<HTMLInputElement>('[data-lien-payoff-check-number]').value).toBe('2290')
    expect(q<HTMLInputElement>('[data-lien-payoff-check-received]').value).toBe('2026-11-23')
    expect(q('[data-lien-payoff-check-say]').textContent).toBe('Check 2290 is at the bank. The bank says it clears Dec 2. Record it then.')
    expect(q('[data-lien-payoff-check-say]').dataset.lienPayoffCheckSay).toBe('amber')
    const press = q<HTMLButtonElement>('[data-lien-payoff-check-record]')
    expect(press.disabled).toBe(true)
    fireEvent.click(press)
    expect(write).not.toHaveBeenCalled()
    // Another check, typed by hand, is not the one the bank holds.
    type('[data-lien-payoff-check-number]', '2291')
    expect(q('[data-lien-payoff-check-bank]').textContent).toBe('The bank shows no deposit of this check. A release then waits seven days.')
    expect(q<HTMLButtonElement>('[data-lien-payoff-check-record]').disabled).toBe(false)
  })

  it('records the check the day the bank clears it', async () => {
    const { write } = await draw(undefined, { bank: [{ ...AT_BANK, status: 'sent', postedYmd: '2026-11-25' }], todayYmd: '2026-12-02' })
    expect(q('[data-lien-payoff-check-bank]').textContent).toBe('The bank cleared check 2290 on Dec 2.')
    expect(q('[data-lien-payoff-check-bank]').dataset.lienPayoffCheckBank).toBe('green')
    const press = q<HTMLButtonElement>('[data-lien-payoff-check-record]')
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1))
    expect(write.mock.calls[0]![1]).toMatchObject({ paidOn: '2026-11-23', number: '2290' })
  })

  it('opens on what pays the liens off, placed on the liened bills, and waits for the check’s number', async () => {
    await draw()
    expect(q<HTMLInputElement>('[data-lien-payoff-check-amount]').value).toBe('12,580.50')
    expect(q<HTMLInputElement>('[data-lien-payoff-check-received]').value).toBe('2026-11-24')
    expect([...document.querySelectorAll<HTMLElement>('[data-lien-payoff-check-line]')].map((l) => [l.dataset.lienPayoffCheckLine, l.dataset.state])).toEqual([
      ['b1', 'ready'],
      ['b2', 'ready'],
      ['b3', 'ready'],
      ['b5', 'none'],
    ])
    expect(totals()).toEqual(['$12,580.50', '$12,580.50', '$0.00'])
    expect(q('[data-lien-payoff-check-say]').textContent).toBe('Type the check’s number.')
    expect(q<HTMLButtonElement>('[data-lien-payoff-check-record]').disabled).toBe(true)
    type('[data-lien-payoff-check-number]', '1184')
    expect(q('[data-lien-payoff-check-say]').textContent).toBe('Pays all 2 liens’ bills in full.')
    const press = q<HTMLButtonElement>('[data-lien-payoff-check-record]')
    expect(press.textContent).toBe('Record 3 payments')
    expect(press.disabled).toBe(false)
  })

  it('records every ready line with the check’s number, day and note, tells the desk, and goes back to the liens', async () => {
    const { write, onChanged, read } = await draw()
    type('[data-lien-payoff-check-number]', '1184')
    fireEvent.click(q('[data-lien-payoff-check-record]'))
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1))
    expect(write.mock.calls[0]![0]).toEqual([
      { invoiceId: 'b1', amount: 4420 },
      { invoiceId: 'b2', amount: 3000 },
      { invoiceId: 'b3', amount: 5160.5 },
    ])
    expect(write.mock.calls[0]![1]).toEqual({ paidOn: '2026-11-24', number: '1184', note: 'Payoff check 1184, $12,580.50 over 3 bills' })
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(document.querySelector('[data-lien-payoff-check]')).toBeNull())
    expect(document.querySelector('[data-lien-payoffs-window]')).not.toBeNull()
  })

  it('holds a part payment on a Stripe bill with its door, and records the rest', async () => {
    const { write, onOpenBill } = await draw()
    type('[data-lien-payoff-check-number]', '1184')
    type('[data-lien-payoff-check-amount]', '10,000')
    expect(line('b3').dataset.state).toBe('held')
    expect(line('b3').querySelector('[data-lien-payoff-check-why]')!.textContent).toContain('Part of a Stripe bill is recorded on the bill itself.')
    expect(totals()).toEqual(['$10,000.00', '$10,000.00', '$0.00'])
    expect(q('[data-lien-payoff-check-say]').textContent).toBe('Pays 1 of 2 liens’ bills in full.')
    expect(q('[data-lien-payoff-check-record]').textContent).toBe('Record 2 payments · 1 pays part of a Stripe bill ▸')
    fireEvent.click(line('b3').querySelector('button:not([data-value])')!)
    expect(onOpenBill).toHaveBeenCalledWith('j2')
    fireEvent.click(q('[data-lien-payoff-check-record]'))
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1))
    expect(write.mock.calls[0]![0].map((l) => l.invoiceId)).toEqual(['b1', 'b2'])
    // A held line keeps the pane open, with what took and what is held.
    await waitFor(() => expect(q('[data-lien-payoff-check]').dataset.lienPayoffCheck).toBe('ran'))
    expect([...document.querySelectorAll<HTMLElement>('[data-lien-payoff-check-ran]')].map((r) => r.dataset.lienPayoffCheckRan)).toEqual(['ok', 'ok', 'held'])
  })

  it('takes a value kept by hand, spreads the rest around it, and spreads again on request', async () => {
    await draw()
    type('[data-lien-payoff-check-number]', '1184')
    fireEvent.click(screen.getByRole('button', { name: /what this check pays on 2041, bill sent Nov 10/ }))
    fireEvent.change(screen.getByLabelText(/what this check pays on 2041, bill sent Nov 10/), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(line('b2').dataset.state).toBe('none'))
    // The 3,000.00 that bill no longer takes spills onto the job with no lien, and the rest is left to place.
    expect(line('b5').dataset.state).toBe('ready')
    expect(totals()).toEqual(['$12,580.50', '$10,220.50', '$2,360.00'])
    expect(q('[data-lien-payoff-check-say]').textContent).toBe('Pays 1 of 2 liens’ bills in full. $2,360.00 of the check is not placed.')
    fireEvent.click(screen.getByRole('button', { name: 'Spread it again' }))
    expect(totals()).toEqual(['$12,580.50', '$12,580.50', '$0.00'])
  })

  it('keeps going past a line that fails, and lists it with its reason and its door', async () => {
    const { onChanged, onOpenBill } = await draw(async (lines) => lines.map((l) => (l.invoiceId === 'b2' ? { invoiceId: l.invoiceId, ok: false, why: 'Amount exceeds remaining balance on invoice' } : { invoiceId: l.invoiceId, ok: true, why: null })))
    type('[data-lien-payoff-check-number]', '1184')
    fireEvent.click(q('[data-lien-payoff-check-record]'))
    await waitFor(() => expect(q('[data-lien-payoff-check]').dataset.lienPayoffCheck).toBe('ran'))
    expect(q('[data-lien-payoff-check-outcome]').textContent).toBe('1 payment did not record. It stays here with the reason.')
    const rows = [...document.querySelectorAll<HTMLElement>('[data-lien-payoff-check-ran]')]
    expect(rows.map((r) => r.dataset.lienPayoffCheckRan)).toEqual(['ok', 'failed', 'ok'])
    expect(rows[1]!.textContent).toContain('Amount exceeds remaining balance on invoice')
    fireEvent.click(rows[1]!.querySelector('button')!)
    expect(onOpenBill).toHaveBeenCalledWith('j1')
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('is dead while the lines add up to more than the check, and says by how much', async () => {
    await draw()
    type('[data-lien-payoff-check-number]', '1184')
    fireEvent.click(screen.getByRole('button', { name: /what this check pays on 2071/ }))
    fireEvent.change(screen.getByLabelText(/what this check pays on 2071/), { target: { value: '640' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(line('b5').dataset.state).toBe('ready'))
    type('[data-lien-payoff-check-amount]', '500')
    expect(q('[data-lien-payoff-check-say]').textContent).toBe('The lines add up to $140.00 more than the check.')
    expect(q<HTMLButtonElement>('[data-lien-payoff-check-record]').disabled).toBe(true)
  })
})
