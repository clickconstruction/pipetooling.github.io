// @vitest-environment jsdom
/**
 * Render smoke for Scan a label (punch list #304): the words, the typed code with its dash, a slip for a short code,
 * and the code handed on whole.
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
})
