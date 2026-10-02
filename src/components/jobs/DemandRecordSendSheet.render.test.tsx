// @vitest-environment jsdom
/**
 * Save & record send… on a phone (v2.4414): the step as a sheet over the Lien window. Wiring
 * only: the window owns the values and the write.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import DemandRecordSendSheet, { type DemandRecordSendSheetProps } from './DemandRecordSendSheet'

afterEach(() => cleanup())

const METHODS = [
  { value: 'certified_mail', label: 'Certified mail' },
  { value: 'traceable_courier', label: 'Traceable courier' },
  { value: 'email', label: 'Email' },
  { value: 'hand', label: 'Hand-delivered' },
]

function setup(over: Partial<DemandRecordSendSheetProps> = {}) {
  const props: DemandRecordSendSheetProps = {
    headline: 'Demand letter · $15,722.49',
    lines: ['ATI Schertz — As per plans · 650', 'Pay by October 16, 2026'],
    methods: METHODS,
    method: 'certified_mail',
    onMethod: vi.fn(),
    tracking: '',
    onTracking: vi.fn(),
    sentOn: '2026-10-02',
    onSentOn: vi.fn(),
    note: 'Deadline watch: if the covered lines are still unpaid after October 16, 2026, a Needs You card hands you the next step.',
    busy: false,
    onBack: vi.fn(),
    onClose: vi.fn(),
    onRecord: vi.fn(),
    ...over,
  }
  render(<DemandRecordSendSheet {...props} />)
  return props
}

describe('DemandRecordSendSheet', () => {
  it('says what is being recorded, since the letter is under it', () => {
    setup()
    const summary = document.querySelector('[data-lien-record-summary]')!
    expect(summary.textContent).toContain('Demand letter · $15,722.49')
    expect(summary.textContent).toContain('ATI Schertz — As per plans · 650')
    expect(summary.textContent).toContain('Pay by October 16, 2026')
    expect(screen.getByText(/Deadline watch/)).toBeTruthy()
  })

  it('the four ways are pressed buttons, and a press hands the way up', () => {
    const p = setup()
    expect(METHODS.map((m) => screen.getByRole('button', { name: m.label }).getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false'])
    fireEvent.click(screen.getByRole('button', { name: 'Hand-delivered' }))
    expect(p.onMethod).toHaveBeenCalledWith('hand')
  })

  it('the two fields hand their values up, in 16 px type so an iPhone does not zoom', () => {
    const p = setup()
    const tracking = screen.getByLabelText('Tracking / receipt number') as HTMLInputElement
    expect(tracking.style.fontSize).toBe('1rem')
    fireEvent.change(tracking, { target: { value: '9407 1112' } })
    expect(p.onTracking).toHaveBeenCalledWith('9407 1112')
    const sentOn = screen.getByLabelText(/Sent on/) as HTMLInputElement
    expect(sentOn.type).toBe('date')
    expect(sentOn.value).toBe('2026-10-02')
    fireEvent.change(sentOn, { target: { value: '2026-10-01' } })
    expect(p.onSentOn).toHaveBeenCalledWith('2026-10-01')
  })

  it('Back, × and Record each call their own door; a busy Record waits', () => {
    const p = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(p.onBack).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(p.onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Record' }))
    expect(p.onRecord).toHaveBeenCalledTimes(1)
    cleanup()
    setup({ busy: true })
    expect((screen.getByRole('button', { name: 'Recording…' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
