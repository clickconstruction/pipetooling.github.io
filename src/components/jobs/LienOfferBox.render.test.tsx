// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LienOfferBox from './LienOfferBox'

afterEach(cleanup)

describe('LienOfferBox — the leader’s pay offer (v2.4713)', () => {
  it('the switch and the details draw apart for the footer row; the pay-page line waits until it is on (v2.4745)', () => {
    const onChange = vi.fn()
    const props = { onChange, todayYmd: '2026-11-01', affidavitDueOn: '2026-12-15', amounts: [6240] }
    const sw = render(<LienOfferBox {...props} offer={null} part="switch" />)
    expect(sw.container.textContent).toBe('Offer a discount if a bill is paid in full by a day')
    expect(screen.queryByTestId('lien-offer-box')).toBeNull()
    sw.unmount()
    const off = render(<LienOfferBox {...props} offer={null} part="details" onSave={() => undefined} />)
    expect(off.container.innerHTML).toBe('')
    off.unmount()
    // An approved notice that carried an offer: switched off, the details are only the Save that takes it away.
    const removing = render(<LienOfferBox {...props} offer={null} part="details" onSave={() => undefined} saved />)
    expect(screen.getByTestId('lien-offer-save').textContent).toBe('Save')
    removing.unmount()
    render(<LienOfferBox {...props} offer={{ pct: 10, by: '2026-11-15' }} part="details" />)
    expect(screen.queryByTestId('lien-offer-switch')).toBeNull()
    expect(screen.getByTestId('lien-offer-box').textContent).toContain("Printed on the owner's pay page, never on the notice form. The claim stays the full amount.")
  })

  it('off, the box is the switch alone, without the pay-page line', () => {
    render(<LienOfferBox offer={null} onChange={vi.fn()} todayYmd="2026-11-01" affidavitDueOn="2026-12-15" amounts={[6240]} />)
    expect(screen.getByTestId('lien-offer-box').textContent).toBe('Offer a discount if a bill is paid in full by a day')
  })

  it('is off until switched on; on, it offers 10% by 14 days from today and prints the sentence', () => {
    const onChange = vi.fn()
    const { rerender } = render(<LienOfferBox offer={null} onChange={onChange} todayYmd="2026-11-01" affidavitDueOn="2026-12-15" amounts={[6240, 6165, 5180]} />)
    expect(screen.getByTestId('lien-offer-box').getAttribute('data-on')).toBe('no')
    expect(screen.queryByTestId('lien-offer-prints')).toBeNull()
    fireEvent.click(screen.getByTestId('lien-offer-switch'))
    expect(onChange).toHaveBeenCalledWith({ pct: 10, by: '2026-11-15' })
    rerender(<LienOfferBox offer={{ pct: 10, by: '2026-11-15' }} onChange={onChange} todayYmd="2026-11-01" affidavitDueOn="2026-12-15" amounts={[6240, 6165, 5180]} />)
    expect(screen.getByTestId('lien-offer-box').getAttribute('data-on')).toBe('yes')
    expect(screen.getByTestId('lien-offer-cost').textContent).toBe('Up to $1,758.50 if all 3 are paid in time')
    expect(screen.getByTestId('lien-offer-prints').textContent).toContain('Pay any of these bills in full by November 15, 2026 and it is 10% less.')
    // The counsel line is gone (v2.4739): the owner cleared the words.
    expect(screen.queryByTestId('lien-offer-counsel')).toBeNull()
    expect((screen.getByTestId('lien-offer-day-default') as HTMLInputElement).checked).toBe(true)
    expect(screen.getByTestId('lien-offer-day-latest').parentElement?.textContent).toContain('Dec 8')
  })

  it('a percent button and a day change the offer; a day past the week before the affidavit names the problem', () => {
    const onChange = vi.fn()
    const { rerender } = render(<LienOfferBox offer={{ pct: 10, by: '2026-11-15' }} onChange={onChange} todayYmd="2026-11-01" affidavitDueOn="2026-12-15" amounts={[6240]} />)
    fireEvent.click(screen.getByTestId('lien-offer-pct-15'))
    expect(onChange).toHaveBeenLastCalledWith({ pct: 15, by: '2026-11-15' })
    fireEvent.click(screen.getByTestId('lien-offer-day-latest'))
    expect(onChange).toHaveBeenLastCalledWith({ pct: 10, by: '2026-12-08' })
    fireEvent.change(screen.getByTestId('lien-offer-day-input'), { target: { value: '2026-12-12' } })
    expect(onChange).toHaveBeenLastCalledWith({ pct: 10, by: '2026-12-12' })
    rerender(<LienOfferBox offer={{ pct: 10, by: '2026-12-12' }} onChange={onChange} todayYmd="2026-11-01" affidavitDueOn="2026-12-15" amounts={[6240]} onSave={() => undefined} />)
    expect(screen.getByTestId('lien-offer-problem').textContent).toBe('No later than Dec 8, a week before the affidavit must be filed.')
    expect((screen.getByTestId('lien-offer-save') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByTestId('lien-offer-switch'))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})
