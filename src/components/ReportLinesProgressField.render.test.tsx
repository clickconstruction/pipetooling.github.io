// @vitest-environment jsdom
/**
 * Report by line (punch list #130, v2.5663): the lines in plan order, one open at a time, the job's number once under
 * them. Since punch list #189, PR 5a, the open row carries the precise-number control: quick picks at 48 px, −5 and +5
 * at 56 px, and the number typed.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ReportLinesProgressField } from './ReportLinesProgressField'
import type { StageProgressRow } from '../lib/reports/stageProgressReport'

const rows: StageProgressRow[] = [
  { fixtureId: 'u', name: 'Underground', kind: 'order', sequenceOrder: 1, weightPct: 20, progressPct: 100, drawPaid: true },
  { fixtureId: 'r', name: 'Rough In', kind: 'order', sequenceOrder: 2, weightPct: 35, progressPct: 35, drawPaid: false },
  { fixtureId: 't', name: 'Top Out', kind: 'order', sequenceOrder: 3, weightPct: 25, progressPct: null, drawPaid: false },
  { fixtureId: 'w', name: 'Water heater', kind: 'any', sequenceOrder: 4, weightPct: 20, progressPct: null, drawPaid: false },
]

const minHeightPx = (el: HTMLElement) => parseFloat(el.style.minHeight)

describe('ReportLinesProgressField', () => {
  it('lists every stage with its own number, draws the control on the open row only, and reports picks and opens', () => {
    const onOpen = vi.fn()
    const onPct = vi.fn()
    const onSwitch = vi.fn()
    render(<ReportLinesProgressField rows={rows} picks={{}} openId="r" onOpen={onOpen} onPct={onPct} recordedPct={46} onSwitchToWholeJob={onSwitch} />)
    expect(screen.getByText('How far along is each stage?')).toBeTruthy()
    expect(screen.getByText('Move the ones you worked on. The rest stay as they are.')).toBeTruthy()
    expect(screen.getByLabelText('Underground: ✓ Paid')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rough In: 35%', expanded: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Top Out: not started', expanded: false })).toBeTruthy()
    // One row open: its control, nothing on the others.
    expect(screen.getAllByTestId('stage-pct-control')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /Set Top Out to/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Set Rough In to 50 percent' }))
    expect(onPct).toHaveBeenCalledWith('r', 50)
    fireEvent.click(screen.getByRole('button', { name: 'Rough In down 5' }))
    expect(onPct).toHaveBeenCalledWith('r', 30)
    fireEvent.click(screen.getByRole('button', { name: 'Rough In up 5' }))
    expect(onPct).toHaveBeenCalledWith('r', 40)
    fireEvent.click(screen.getByRole('button', { name: 'Top Out: not started' }))
    expect(onOpen).toHaveBeenCalledWith('t')
    fireEvent.click(screen.getByRole('button', { name: 'Rough In: 35%' }))
    expect(onOpen).toHaveBeenCalledWith(null)
    // Nothing moved yet: the job line reads the recorded number, quietly.
    expect(screen.getByTestId('report-lines-job').textContent).toContain('Job 46%')
    expect(screen.getByText('nothing moved yet')).toBeTruthy()
    fireEvent.click(screen.getByText('Set the whole-job % instead'))
    expect(onSwitch).toHaveBeenCalled()
  })

  it('the open row’s presses stand at a thumb’s height: the picks 48 px, the −5 and +5 56 px', () => {
    render(<ReportLinesProgressField rows={rows} picks={{}} openId="r" onOpen={vi.fn()} onPct={vi.fn()} />)
    for (const p of [25, 50, 75, 100]) expect(minHeightPx(screen.getByRole('button', { name: `Set Rough In to ${p} percent` }))).toBeGreaterThanOrEqual(48)
    expect(screen.getByRole('button', { name: 'Set Rough In to 100 percent' }).textContent).toBe('Done ✓')
    expect(minHeightPx(screen.getByRole('button', { name: 'Rough In down 5' }))).toBeGreaterThanOrEqual(56)
    expect(minHeightPx(screen.getByRole('button', { name: 'Rough In up 5' }))).toBeGreaterThanOrEqual(56)
    expect(minHeightPx(screen.getByRole('button', { name: 'Rough In is 35 percent. Tap to type a number' }))).toBeGreaterThanOrEqual(56)
  })

  it('a tap on the number opens a box for the keypad; Enter or leaving the box keeps the typed number, clamped', () => {
    const onPct = vi.fn()
    render(<ReportLinesProgressField rows={rows} picks={{}} openId="r" onOpen={vi.fn()} onPct={onPct} />)
    fireEvent.click(screen.getByRole('button', { name: 'Rough In is 35 percent. Tap to type a number' }))
    const box = screen.getByRole('textbox', { name: 'Rough In percent, type a number' }) as HTMLInputElement
    expect(box.getAttribute('inputmode')).toBe('numeric')
    fireEvent.change(box, { target: { value: '45' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onPct).toHaveBeenCalledWith('r', 45)
    expect(screen.queryByRole('textbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Rough In is 35 percent. Tap to type a number' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '250' } })
    fireEvent.blur(screen.getByRole('textbox'))
    expect(onPct).toHaveBeenCalledWith('r', 100)
    // A cleared box keeps the row where it was.
    fireEvent.click(screen.getByRole('button', { name: 'Rough In is 35 percent. Tap to type a number' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } })
    fireEvent.blur(screen.getByRole('textbox'))
    expect(onPct).toHaveBeenCalledTimes(2)
  })

  it('a moved row reads its move, the job line its before and after, and how? unfolds the shares', () => {
    render(<ReportLinesProgressField rows={rows} picks={{ r: 50, w: 100 }} openId="w" onOpen={vi.fn()} onPct={vi.fn()} recordedPct={null} />)
    expect(screen.getByRole('button', { name: 'Rough In: 35% → 50%' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Water heater: — → ✓ Done', expanded: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Set Water heater to 100 percent', pressed: true })).toBeTruthy()
    expect(screen.getByText('Job 32% → 58%')).toBeTruthy()
    expect(screen.getByText('was 32%')).toBeTruthy()
    expect(screen.queryByTestId('report-lines-how')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'how?' }))
    const how = screen.getByTestId('report-lines-how')
    expect(how.textContent).toContain('35% of the job · 50%')
    expect(how.textContent).toContain('20% of the job · paid')
    expect(how.textContent).toContain('58%')
    // No whole-job link when the host gives none (the stepper on a one-line job never gets here).
    expect(screen.queryByText('Set the whole-job % instead')).toBeNull()
  })
})
