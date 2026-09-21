// @vitest-environment jsdom
/**
 * Render smokes for the stage boxes (v2.3672): a click lights a stage, a second
 * lit box makes an even split with the "½ · ½" text, Shift-click makes one
 * stage the only one, an inherited split reads dashed and a click on it starts
 * from it, ↺ hands a line back to its fixture, and typed shares parse.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { StageSplitChips } from './StageSplitChips'
import { stageWeights } from '../../lib/bids/materialsByStage'

describe('StageSplitChips', () => {
  it('a click lights a stage; a second lit box is an even split', () => {
    const onChange = vi.fn()
    const { rerender } = render(<StageSplitChips scope="fixture" label="SK-1" value={null} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /3 Trim Set/ }))
    expect(onChange).toHaveBeenLastCalledWith(stageWeights(0, 0, 1))
    rerender(<StageSplitChips scope="fixture" label="SK-1" value={stageWeights(0, 0, 1)} onChange={onChange} />)
    expect(screen.getByRole('button', { name: /3 Trim Set, on/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /1 Rough In/ }))
    expect(onChange).toHaveBeenLastCalledWith(stageWeights(1, 0, 1))
    rerender(<StageSplitChips scope="fixture" label="SK-1" value={stageWeights(1, 0, 1)} onChange={onChange} />)
    expect(screen.getByRole('button', { name: /Change the shares/ }).textContent).toBe('½ · ½')
  })

  it('Shift-click makes the stage the only one; the number keys work on a focused box', () => {
    const onChange = vi.fn()
    render(<StageSplitChips scope="fixture" label="SK-1" value={stageWeights(1, 1, 0)} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /3 Trim Set/ }), { shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith(stageWeights(0, 0, 1))
    fireEvent.keyDown(screen.getByRole('button', { name: /1 Rough In/ }), { key: '2' })
    expect(onChange).toHaveBeenLastCalledWith(stageWeights(1, 0, 0))
  })

  it('an inherited split reads dashed, a click starts from it, and ↺ returns a line to its fixture', () => {
    const onChange = vi.fn()
    const { rerender } = render(<StageSplitChips scope="line" label="P-trap in SK-1" value={null} inherited={stageWeights(0, 0, 1)} inheritedFrom="fixture" onChange={onChange} />)
    expect(screen.getByRole('button', { name: /3 Trim Set, inherited/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Follow the fixture again/ })).toBeNull()
    expect(screen.getByTestId('stage-split-chips').getAttribute('data-own')).toBe('0')
    fireEvent.click(screen.getByRole('button', { name: /1 Rough In/ }))
    expect(onChange).toHaveBeenLastCalledWith(stageWeights(1, 0, 1))
    rerender(<StageSplitChips scope="line" label="P-trap in SK-1" value={stageWeights(1, 0, 0)} inherited={stageWeights(0, 0, 1)} inheritedFrom="fixture" onChange={onChange} />)
    expect(screen.getByTestId('stage-split-chips').getAttribute('data-own')).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: /Follow the fixture again/ }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('typed shares over the lit stages commit on Enter; garbage is ignored', () => {
    const onChange = vi.fn()
    render(<StageSplitChips scope="fixture" label="ft of 4IN WASTE" value={stageWeights(1, 1, 0)} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Change the shares/ }))
    const input = screen.getByRole('textbox', { name: /Shares for Rough In and Top Out/ }) as HTMLInputElement
    expect(input.value).toBe('50 / 50')
    fireEvent.change(input, { target: { value: '70 / 30' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith(stageWeights(70, 30, 0))
    fireEvent.click(screen.getByRole('button', { name: /Change the shares/ }))
    const again = screen.getByRole('textbox', { name: /Shares for Rough In and Top Out/ })
    fireEvent.change(again, { target: { value: 'nope' } })
    fireEvent.keyDown(again, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
