// @vitest-environment jsdom
/**
 * Extend good-through (v2.5992, punch list #206 PR 1): the lead names the passed day, the presets
 * move the field, the button names the day and reports it, a bad day holds the button.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import EstimateExtendGoodThroughPanel from './EstimateExtendGoodThroughPanel'
import { extendPresetYmd } from '../../lib/estimates/estimateGoodThroughExtend'

const TODAY = '2026-10-27'

afterEach(() => cleanup())

describe('EstimateExtendGoodThroughPanel', () => {
  it('a passed date: the lead says so, +30 days is picked, and the press reports that day', () => {
    const onExtend = vi.fn()
    render(<EstimateExtendGoodThroughPanel validUntil="2026-10-24" todayYmd={TODAY} busy={false} onExtend={onExtend} />)
    expect(screen.getByTestId('estimate-extend-lead').textContent).toBe('Pricing passed its good-through date on Oct 24, 2026. Extend it and the link they have works again.')
    const plus30 = extendPresetYmd(30)
    expect((screen.getByLabelText('Good through') as HTMLInputElement).value).toBe(plus30)
    expect(screen.getByRole('button', { name: '+30 days' }).getAttribute('aria-pressed')).toBe('true')
    const press = screen.getByRole('button', { name: /^Extend good-through to / })
    fireEvent.click(press)
    expect(onExtend).toHaveBeenCalledWith(plus30, false)
  })

  it('with an address the tick is offered, ticked once the date passed, and rides the press (v2.5997)', () => {
    const onExtend = vi.fn()
    render(<EstimateExtendGoodThroughPanel validUntil="2026-10-24" todayYmd={TODAY} busy={false} onExtend={onExtend} emailTo="clerk@zz-test.example" />)
    const tick = screen.getByTestId('estimate-extend-email-again') as HTMLInputElement
    expect(tick.checked).toBe(true)
    expect(screen.getByText(/It goes to clerk@zz-test.example/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Extend good-through to / }))
    expect(onExtend).toHaveBeenCalledWith(extendPresetYmd(30), true)
    fireEvent.click(tick)
    fireEvent.click(screen.getByRole('button', { name: /^Extend good-through to / }))
    expect(onExtend).toHaveBeenLastCalledWith(extendPresetYmd(30), false)
  })

  it('while the date is still good the tick starts unticked', () => {
    render(<EstimateExtendGoodThroughPanel validUntil="2026-11-26" todayYmd={TODAY} busy={false} onExtend={() => {}} emailTo="clerk@zz-test.example" />)
    expect((screen.getByTestId('estimate-extend-email-again') as HTMLInputElement).checked).toBe(false)
  })

  it('a preset moves the field and the button', () => {
    render(<EstimateExtendGoodThroughPanel validUntil="2026-11-26" todayYmd={TODAY} busy={false} onExtend={() => {}} />)
    expect(screen.getByTestId('estimate-extend-lead').textContent).toBe('Good through Nov 26, 2026. Extend it to give them more room.')
    fireEvent.click(screen.getByRole('button', { name: '+60 days' }))
    expect((screen.getByLabelText('Good through') as HTMLInputElement).value).toBe(extendPresetYmd(60))
    expect(screen.getByRole('button', { name: '+60 days' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('a day before today holds the button and says why', () => {
    const onExtend = vi.fn()
    render(<EstimateExtendGoodThroughPanel validUntil="2026-10-24" todayYmd={TODAY} busy={false} onExtend={onExtend} />)
    fireEvent.change(screen.getByLabelText('Good through'), { target: { value: '2026-10-20' } })
    expect(screen.getByTestId('estimate-extend-problem').textContent).toBe('The day must be today or later.')
    const press = screen.getByRole('button', { name: /^Extend good-through/ }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    fireEvent.click(press)
    expect(onExtend).not.toHaveBeenCalled()
  })

  it('busy reads Extending… and holds everything', () => {
    render(<EstimateExtendGoodThroughPanel validUntil="2026-10-24" todayYmd={TODAY} busy onExtend={() => {}} />)
    const press = screen.getByRole('button', { name: 'Extending…' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect((screen.getByLabelText('Good through') as HTMLInputElement).disabled).toBe(true)
  })
})
