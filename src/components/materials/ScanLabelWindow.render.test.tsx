// @vitest-environment jsdom
/**
 * Render smoke for Scan a label (punch list #304): the words, the typed code with its dash, a slip for a short code,
 * and the code handed on whole. Since v2.7438 (Taunya's call of 2026-11-16) a sticker's running number is on no tape,
 * so the field takes the eight characters alone: digits typed are not looked up as a sticker any more.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import ScanLabelWindow, { SCAN_LABEL_SLIP } from './ScanLabelWindow'

afterEach(cleanup)

describe('ScanLabelWindow', () => {
  it('says how a label opens and refuses a short code with a reason', () => {
    const onOpen = vi.fn()
    renderWithProviders(<ScanLabelWindow onClose={() => {}} onOpen={onOpen} />)
    expect(screen.getByRole('dialog', { name: 'Scan a label' }).textContent).toContain('point it at the label')
    const input = screen.getByTestId('scan-label-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '4f2a9' } })
    expect(input.value).toBe('4F2A-9')
    fireEvent.click(screen.getByTestId('scan-label-open'))
    expect(screen.getByTestId('scan-label-slip').textContent).toBe(SCAN_LABEL_SLIP)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('hands on a whole code and closes on the backdrop', () => {
    const onOpen = vi.fn()
    const onClose = vi.fn()
    renderWithProviders(<ScanLabelWindow onClose={onClose} onOpen={onOpen} />)
    fireEvent.change(screen.getByTestId('scan-label-input'), { target: { value: '4f2a-9c18' } })
    fireEvent.click(screen.getByTestId('scan-label-open'))
    expect(onOpen).toHaveBeenCalledWith('4F2A9C18')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('asks for the eight characters alone, and four digits are a short code, not a sticker’s number', () => {
    const onOpen = vi.fn()
    renderWithProviders(<ScanLabelWindow onClose={() => {}} onOpen={onOpen} />)
    expect(screen.getByRole('dialog', { name: 'Scan a label' }).textContent).toContain('Or type the eight characters under the QR code')
    expect(screen.getByRole('dialog', { name: 'Scan a label' }).textContent).not.toMatch(/number/i)
    const input = screen.getByTestId('scan-label-input') as HTMLInputElement
    expect(input.placeholder).toBe('4F2A-9C18')
    fireEvent.change(input, { target: { value: '0147' } })
    fireEvent.click(screen.getByTestId('scan-label-open'))
    expect(screen.getByTestId('scan-label-slip').textContent).toBe('Type all eight characters under the QR code.')
    expect(onOpen).not.toHaveBeenCalled()
  })
})
