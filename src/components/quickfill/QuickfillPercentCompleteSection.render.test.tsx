// @vitest-environment jsdom
/**
 * Render smokes for the Quickfill "Percent complete" station (v2.5764): the header's count
 * line, a card with the sentence, the stage bar and the pre-filled box, Save writing the
 * typed percent and leaving a green line with Undo, Dismiss leaving a muted line, a save
 * that fails naming the job and the reason on its own card, and the all-agree line. Since
 * v2.5805 the bar is the slider: the knob's keyboard, a stop chip, the move line, a press on
 * the measured bar, and Save going dead on no change.
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

  it('the bar is the slider: the knob starts on the suggestion, the arrow keys walk it, and the box and Save follow', async () => {
    renderWithProviders(<QuickfillPercentCompleteSection list={list} loading={false} snoozeAvailable onSave={onSave} onUndoSave={noop} onDismiss={onDismiss} onUndoDismiss={noop} />)
    await settle()
    const knob = screen.getByRole('slider', { name: '% done knob for 892 · Cedar Bend, building C' })
    expect(knob.getAttribute('aria-valuenow')).toBe('75')
    expect(knob.getAttribute('aria-valuetext')).toBe('75% done')
    fireEvent.keyDown(knob, { key: 'ArrowRight' })
    expect(knob.getAttribute('aria-valuenow')).toBe('76')
    expect((screen.getByLabelText('% done for 892 · Cedar Bend, building C') as HTMLInputElement).value).toBe('76')
    expect(screen.getByRole('button', { name: 'Save 76%' })).toBeTruthy()
    fireEvent.keyDown(knob, { key: 'ArrowLeft', shiftKey: true })
    expect(knob.getAttribute('aria-valuenow')).toBe('66')
    fireEvent.keyDown(knob, { key: 'End' })
    expect(knob.getAttribute('aria-valuenow')).toBe('100')
    fireEvent.keyDown(knob, { key: 'Home' })
    expect(knob.getAttribute('aria-valuenow')).toBe('0')
    expect(screen.getByRole('button', { name: 'Save 0%' })).toBeTruthy()
  })

  it('a stop chip sets the number, the move line reads it, and a number already on the job makes Save dead', async () => {
    renderWithProviders(<QuickfillPercentCompleteSection list={list} loading={false} snoozeAvailable onSave={onSave} onUndoSave={noop} onDismiss={onDismiss} onUndoDismiss={noop} />)
    await settle()
    const [moveFor892, moveFor879] = screen.getAllByTestId('percent-complete-move')
    expect(moveFor892!.textContent).toBe('30% → 75%▲ 45')
    expect(moveFor879!.textContent).toBe('0% → 40%▲ 40')
    const stops = screen.getByRole('group', { name: 'Stops for 892 · Cedar Bend, building C' })
    const chips = Array.from(stops.querySelectorAll('button')).map((b) => [b.textContent, b.getAttribute('aria-pressed')])
    expect(chips).toEqual([
      ['Rough ✓ 37%', 'false'],
      ['Top Out ✓ 75%', 'true'],
      ['Trim 100%', 'false'],
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Rough ✓ 37%' }))
    expect(screen.getByRole('button', { name: 'Rough ✓ 37%' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('slider', { name: '% done knob for 892 · Cedar Bend, building C' }).getAttribute('aria-valuenow')).toBe('37')
    expect(screen.getByRole('button', { name: 'Save 37%' })).toBeTruthy()
    expect(moveFor892!.textContent).toBe('30% → 37%▲ 7')
    // Typing today's number: the knob follows, the move reads no change, Save goes dead.
    const box = screen.getByLabelText('% done for 892 · Cedar Bend, building C') as HTMLInputElement
    fireEvent.change(box, { target: { value: '30' } })
    expect(screen.getByRole('slider', { name: '% done knob for 892 · Cedar Bend, building C' }).getAttribute('aria-valuenow')).toBe('30')
    expect(moveFor892!.textContent).toBe('30% · no change')
    const saves = screen.getAllByRole('button', { name: 'Save' })
    expect((saves[0] as HTMLButtonElement).disabled).toBe(true)
    // A half-typed box leaves the knob where it was.
    fireEvent.change(box, { target: { value: '' } })
    expect(screen.getByRole('slider', { name: '% done knob for 892 · Cedar Bend, building C' }).getAttribute('aria-valuenow')).toBe('30')
  })

  it('a press on the measured bar lands the knob where the Pipeline would draw that percent', async () => {
    renderWithProviders(<QuickfillPercentCompleteSection list={list} loading={false} snoozeAvailable onSave={onSave} onUndoSave={noop} onDismiss={onDismiss} onUndoDismiss={noop} />)
    await settle()
    const knob = screen.getByRole('slider', { name: '% done knob for 879 · Hunter Homes, lot 12' })
    Object.defineProperty(knob, 'getBoundingClientRect', { value: () => ({ left: 100, width: 400, top: 0, height: 44, right: 500, bottom: 44, x: 100, y: 0, toJSON: () => ({}) }) })
    // 879's blocks are Rough 40 · Top Out 40 · Trim 20 of the bid: 60% along the bar is the middle of Top Out.
    fireEvent(knob, new window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 340 }))
    expect(knob.getAttribute('aria-valuenow')).toBe('60')
    fireEvent(knob, new window.MouseEvent('pointermove', { bubbles: true, cancelable: true, clientX: 460 }))
    expect(knob.getAttribute('aria-valuenow')).toBe('90')
    fireEvent(knob, new window.MouseEvent('pointerup', { bubbles: true, cancelable: true, clientX: 460 }))
    fireEvent(knob, new window.MouseEvent('pointermove', { bubbles: true, cancelable: true, clientX: 100 }))
    expect(knob.getAttribute('aria-valuenow')).toBe('90')
    // Save with the slid value.
    fireEvent.click(screen.getByRole('button', { name: 'Save 90%' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect((onSave.mock.calls[0] as unknown[])[1]).toBe(90)
    expect((await screen.findByTestId('percent-complete-saved')).textContent).toContain('879 set to 90%. Was 0%.')
  })

  it('a knob let go near a stage mark snaps to it; the arrow keys step past it by one', async () => {
    renderWithProviders(<QuickfillPercentCompleteSection list={list} loading={false} snoozeAvailable onSave={onSave} onUndoSave={noop} onDismiss={onDismiss} onUndoDismiss={noop} />)
    await settle()
    const knob = screen.getByRole('slider', { name: '% done knob for 879 · Hunter Homes, lot 12' })
    Object.defineProperty(knob, 'getBoundingClientRect', { value: () => ({ left: 100, width: 400, top: 0, height: 44, right: 500, bottom: 44, x: 100, y: 0, toJSON: () => ({}) }) })
    // The marks sit at the stops: Rough 40 · Top Out 80 · Trim 100.
    expect(Array.from(knob.querySelectorAll('[data-percent-mark]')).map((m) => m.getAttribute('data-percent-mark'))).toEqual(['40', '80', '100'])
    // 38% along the bar, let go: lands on Rough's end at 40, and its chip reads pressed.
    fireEvent(knob, new window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 252 }))
    expect(knob.getAttribute('aria-valuenow')).toBe('38')
    fireEvent(knob, new window.MouseEvent('pointerup', { bubbles: true, cancelable: true, clientX: 252 }))
    expect(knob.getAttribute('aria-valuenow')).toBe('40')
    expect(screen.getByRole('button', { name: 'Rough ✓ 40%' }).getAttribute('aria-pressed')).toBe('true')
    // Three points off is left alone.
    fireEvent(knob, new window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 272 }))
    fireEvent(knob, new window.MouseEvent('pointerup', { bubbles: true, cancelable: true, clientX: 272 }))
    expect(knob.getAttribute('aria-valuenow')).toBe('43')
    // The keyboard never snaps.
    fireEvent.keyDown(knob, { key: 'ArrowLeft' })
    fireEvent.keyDown(knob, { key: 'ArrowLeft' })
    expect(knob.getAttribute('aria-valuenow')).toBe('41')
  })

  it('says all agree when there is nothing to fix', async () => {
    renderWithProviders(<QuickfillPercentCompleteSection list={empty} loading={false} snoozeAvailable onSave={onSave} onUndoSave={noop} onDismiss={onDismiss} onUndoDismiss={noop} />)
    await settle()
    expect(screen.getByTestId('percent-complete-line').textContent).toContain('All agree.')
  })
})
