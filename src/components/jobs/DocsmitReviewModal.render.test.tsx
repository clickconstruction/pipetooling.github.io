// @vitest-environment jsdom
/**
 * Render smokes for the review before it mails (the Docsmit train, PR 5b): each envelope's face and PDF,
 * the held ones with their reasons, the price line, the one button that mails and that reads Close once
 * the send ran; the arrow keys walk the envelopes and Esc closes.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import DocsmitReviewModal from './DocsmitReviewModal'

const prepared = [
  { key: 'e1', n: 1, label: 'Owner of record', who: 'ATI Schertz Holdings LLC', windowLines: ['ATI Schertz Holdings LLC', '17300 IH 35 N', 'Schertz, TX 78154'], sendType: 'Certified, Electronic Return Receipt', shortCode: 'KX7M2QRT', recipient: 'owner' as const, jobNumber: '650', itemIds: ['it1'], pieceId: 'p1', price: 9.85, correction: 'ZIP+4: 78154-2011', sheets: 4, envelope: '#10' as const, pdfUrl: 'blob:one', pdfPath: 'mail/KX7M2QRT.pdf' },
  { key: 'e2', n: 2, label: 'Original contractor', who: 'Loberg Contracting', windowLines: ['Loberg Contracting', '4303 Thousand Oaks Dr', 'San Antonio, TX 78217'], sendType: 'Certified, Electronic Return Receipt', shortCode: 'ABCD2345', recipient: 'original_contractor' as const, jobNumber: '650', itemIds: ['it1', 'it2'], pieceId: 'p2', price: 12.4, correction: null, sheets: 9, envelope: 'Flat' as const, pdfUrl: 'blob:two', pdfPath: 'mail/ABCD2345.pdf' },
]
const held = [{ key: 'e4', n: 4, label: 'Owner of record', why: 'The address needs a ZIP or ZIP+4.' }]

describe('DocsmitReviewModal', () => {
  it('shows the first envelope’s face and PDF, the held one with its reason, the price line, and mails on the button', () => {
    const onMail = vi.fn()
    renderWithProviders(<DocsmitReviewModal prepared={prepared} held={held} priceWords="2 envelopes · $22.25 · balance $120.00" short={false} low={false} sendBy={{ words: 'Send to Docsmit by 2026-10-14 at 3:00 pm', late: false }} busy={false} outcome={null} onMail={onMail} onClose={() => {}} />)
    expect(screen.getByTestId('dsm-face').textContent).toContain('17300 IH 35 N')
    expect(screen.getByTestId('dsm-correction').textContent).toContain('ZIP+4: 78154-2011')
    expect((screen.getByTestId('dsm-pdf') as HTMLIFrameElement).getAttribute('src')).toBe('blob:one')
    expect(screen.getByTestId('dsm-held-4').textContent).toContain('stays on paper · The address needs a ZIP or ZIP+4.')
    expect(screen.getByTestId('dsm-price').textContent).toBe('2 envelopes · $22.25 · balance $120.00')
    expect(screen.getByTestId('dsm-send-by').textContent).toBe('Send to Docsmit by 2026-10-14 at 3:00 pm')
    fireEvent.click(screen.getByTestId('dsm-mail'))
    expect(onMail).toHaveBeenCalledTimes(1)
  })

  it('the arrow keys walk the envelopes, Esc closes, a short balance disables the button, and an outcome turns it into Close', () => {
    const onClose = vi.fn()
    const { rerender } = renderWithProviders(<DocsmitReviewModal prepared={prepared} held={[]} priceWords="short" short={true} low={true} sendBy={null} busy={false} outcome={null} onMail={() => {}} onClose={onClose} />)
    expect((screen.getByTestId('dsm-mail') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect((screen.getByTestId('dsm-pdf') as HTMLIFrameElement).getAttribute('src')).toBe('blob:two')
    expect(screen.getByTestId('dsm-face').textContent).toContain('Loberg Contracting')
    fireEvent.click(screen.getByTestId('dsm-env-1'))
    expect((screen.getByTestId('dsm-pdf') as HTMLIFrameElement).getAttribute('src')).toBe('blob:one')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    rerender(<DocsmitReviewModal prepared={prepared} held={[]} priceWords="2 envelopes" short={false} low={false} sendBy={null} busy={false} outcome="2 envelopes mailed through Docsmit." onMail={() => {}} onClose={onClose} />)
    expect(screen.getByTestId('dsm-outcome').textContent).toBe('2 envelopes mailed through Docsmit.')
    expect(screen.queryByTestId('dsm-mail')).toBeNull()
    fireEvent.click(screen.getByTestId('dsm-close'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
