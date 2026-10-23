// @vitest-environment jsdom
/**
 * Render smokes for the Quickfill "Percent complete" station (v2.5764): the header's count
 * line, a card with the sentence, the stage bar and the pre-filled box, Save writing the
 * typed percent and leaving a green line with Undo, Dismiss leaving a muted line, a save
 * that fails naming the job and the reason on its own card, and the all-agree line.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { QuickfillPercentCompleteSection } from './QuickfillPercentCompleteSection'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { progressPaymentForJob } from '../../lib/jobs/progressPaymentForJob'
import { percentCompleteList, type PercentCompleteJobInput } from '../../lib/quickfill/percentComplete'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const TODAY = '2026-10-23'
const NOW = '2026-10-23T15:00:00.000Z'

function stageInput(id: string, jobNumber: string, jobName: string, pct: number | null, prices: [number, number, number], paidStages: number): PercentCompleteJobInput {
  const names = ['Rough In', 'Top Out', 'Trim Set']
  const fixtures = names.map((name, i) => ({ id: `${id}-f${i}`, name, count: 1, line_unit_price: prices[i]!, sequence_order: i, invoice_id: i < paidStages ? `${id}-inv${i}` : null, stage_kind: 'order', progress_pct: null, shared_with_gc: false }))
  const invoices = fixtures.filter((f) => f.invoice_id).map((f, i) => ({ id: f.invoice_id!, status: 'paid', amount: prices[i]!, billed_at: `2026-09-1${i}` }))
  const payments = invoices.map((inv, i) => ({ invoice_id: inv.id, paid_on: `2026-09-2${i}`, amount: inv.amount }))
  const paid = payments.reduce((s, p) => s + p.amount, 0)
  const { model, view } = progressPaymentForJob({ id, revenue: prices.reduce((s, n) => s + n, 0), payments_made: paid, pct_complete: pct, status: 'working', fixtures, invoices, payments }, null, TODAY)
  return { id, jobNumber, jobName, status: 'working', pct, money: model, view, newestPaidOn: payments.length ? payments[payments.length - 1]!.paid_on : null }
}

const j879 = stageInput('879', '879', 'Hunter Homes, lot 12', 0, [16620, 16620, 8310], 1)
const j892 = stageInput('892', '892', 'Cedar Bend, building C', 30, [14154, 14155, 9436], 2)
const list = percentCompleteList([j879, j892], new Map(), NOW)
const empty = percentCompleteList([], new Map(), NOW)

const noop = async () => undefined

describe('QuickfillPercentCompleteSection', () => {
  const onSave = vi.fn(async () => undefined)
  const onDismiss = vi.fn(async () => '2026-10-30T15:00:00.000Z')
  beforeEach(() => {
    onSave.mockClear()
    onDismiss.mockClear()
  })

  it('counts the cases, says what disagrees, draws the stage bar and pre-fills the suggested percent', async () => {
    renderWithProviders(<QuickfillPercentCompleteSection list={list} loading={false} snoozeAvailable onSave={onSave} onUndoSave={noop} onDismiss={onDismiss} onUndoDismiss={noop} />)
    await settle()
    expect(screen.getByTestId('percent-complete-line').textContent).toContain('2 open jobs where the stages or the money disagree with the % done.')
    const cards = screen.getAllByTestId('percent-complete-card')
    expect(cards.length).toBe(2)
    // 892's money is newer, so it comes first.
    expect(cards[0]!.textContent).toContain('Rough and Top Out are ticked and 75% is paid, but the job says 30% done.')
    expect(cards[1]!.textContent).toContain('Rough is ticked and 40% is paid, but the job says 0% done.')
    expect(cards[0]!.querySelector('[data-progress-mode="stages"]')).not.toBeNull()
    const box = screen.getByLabelText('% done for 892 · Cedar Bend, building C') as HTMLInputElement
    expect(box.value).toBe('75')
    expect(screen.getByRole('button', { name: 'Save 75%' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '879 · Hunter Homes, lot 12' }).getAttribute('href')).toBe('/jobs?tab=stages&stagesJob=879')
  })

  it('Save writes the typed percent and leaves a green line with Undo', async () => {
    const onUndoSave = vi.fn(async () => undefined)
    renderWithProviders(<QuickfillPercentCompleteSection list={list} loading={false} snoozeAvailable onSave={onSave} onUndoSave={onUndoSave} onDismiss={onDismiss} onUndoDismiss={noop} />)
    await settle()
    const box = screen.getByLabelText('% done for 879 · Hunter Homes, lot 12') as HTMLInputElement
    fireEvent.change(box, { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save 45%' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect((onSave.mock.calls[0] as unknown[])[1]).toBe(45)
    const line = await screen.findByTestId('percent-complete-saved')
    expect(line.textContent).toContain('879 set to 45%. Was 0%.')
    fireEvent.click(line.querySelector('button')!)
    await waitFor(() => expect(onUndoSave).toHaveBeenCalledTimes(1))
  })

  it('a bad number disables Save, and Dismiss leaves a muted line', async () => {
    renderWithProviders(<QuickfillPercentCompleteSection list={list} loading={false} snoozeAvailable onSave={onSave} onUndoSave={noop} onDismiss={onDismiss} onUndoDismiss={noop} />)
    await settle()
    const box = screen.getByLabelText('% done for 879 · Hunter Homes, lot 12') as HTMLInputElement
    fireEvent.change(box, { target: { value: '140' } })
    const saves = screen.getAllByRole('button', { name: 'Save' })
    expect((saves[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss for one week' })[1]!)
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1))
    const line = await screen.findByTestId('percent-complete-dismissed')
    expect(line.textContent).toContain('879 dismissed until Oct 30.')
  })

  it('a save that fails names the job and the reason on its card and the rest stay workable', async () => {
    const failing = vi.fn(async (card: { jobNumber: string }) => {
      if (card.jobNumber === '892') throw new Error('Not authorized')
    })
    renderWithProviders(<QuickfillPercentCompleteSection list={list} loading={false} snoozeAvailable onSave={failing} onUndoSave={noop} onDismiss={onDismiss} onUndoDismiss={noop} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Save 75%' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Could not save 892: Not authorized')
    expect(screen.getAllByTestId('percent-complete-card').length).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: 'Save 40%' }))
    await waitFor(() => expect(failing).toHaveBeenCalledTimes(2))
    expect(await screen.findByTestId('percent-complete-saved')).toBeTruthy()
  })

  it('says all agree when there is nothing to fix', async () => {
    renderWithProviders(<QuickfillPercentCompleteSection list={empty} loading={false} snoozeAvailable onSave={onSave} onUndoSave={noop} onDismiss={onDismiss} onUndoDismiss={noop} />)
    await settle()
    expect(screen.getByTestId('percent-complete-line').textContent).toContain('All agree.')
  })
})
