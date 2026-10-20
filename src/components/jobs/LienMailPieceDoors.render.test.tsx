// @vitest-environment jsdom
/**
 * The doors on an envelope that came back (the Docsmit train, 6b-3): a plain copy with one press, another address
 * split and checked before it can go, handled by hand with a note; each reaches the function once and reloads the desk.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LienMailPieceDoors from './LienMailPieceDoors'
import type { LienMailPieceRow } from '../../lib/mail/lienMailPieces'

const resend = vi.fn()
const resolve = vi.fn()
vi.mock('../../lib/mail/runDocsmitIo', () => ({ resendDocsmitPiece: (...a: unknown[]) => resend(...a), resolveDocsmitPiece: (...a: unknown[]) => resolve(...a) }))

const piece: LienMailPieceRow = { id: 'p1', kind: 'lien_notice_53_056', recipient: 'owner', status: 'returned', usps_tracking: '9407 1118', mailed_at: '2026-10-14T00:30:00Z', delivered_at: null, signed_by: null, delivery_status: 'Return to Sender', source_ids: ['f1'], organization: 'ATI Schertz Holdings LLC', name: '' }

describe('LienMailPieceDoors', () => {
  it('a plain copy is one press; another address is split and checked before it can go; by hand takes a note', async () => {
    resend.mockResolvedValue({ ok: true, pieceId: 'p2', status: 'sent', tracking: null, price: 1.12, resolvedNote: 'a plain First Class copy sent', shortfall: null, error: null })
    resolve.mockResolvedValue({ ok: true, error: null })
    const onChanged = vi.fn()
    renderWithProviders(<LienMailPieceDoors piece={piece} jobNumber="650" onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('button', { name: 'send a plain copy ›' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(resend).toHaveBeenCalledWith({ pieceId: 'p1', mode: 'plain', jobNumber: '650' })

    fireEvent.click(screen.getByRole('button', { name: 'mail to another address ›' }))
    const again = screen.getByRole('button', { name: 'mail it again ›' }) as HTMLButtonElement
    expect(again.disabled).toBe(true)
    expect((screen.getByLabelText('Name on the envelope') as HTMLInputElement).value).toBe('ATI Schertz Holdings LLC')
    fireEvent.change(screen.getByLabelText('The other address, on one line'), { target: { value: '1 Main St, Austin, Texas 787' } })
    expect(screen.getByText('needs a two-letter state, a ZIP or ZIP+4')).toBeTruthy()
    expect(again.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('The other address, on one line'), { target: { value: '9993 IH 10 West Suite 102, San Antonio, TX 78230' } })
    expect(again.disabled).toBe(false)
    fireEvent.click(again)
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(2))
    expect(resend).toHaveBeenLastCalledWith({ pieceId: 'p1', mode: 'address', jobNumber: '650', address: { name: '', organization: 'ATI Schertz Holdings LLC', address1: '9993 IH 10 West', address2: 'Suite 102', city: 'San Antonio', state: 'TX', postal_code: '78230' } })

    fireEvent.click(screen.getByRole('button', { name: 'handled by hand ›' }))
    const record = screen.getByRole('button', { name: 'record it ›' }) as HTMLButtonElement
    expect(record.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('How it was handled'), { target: { value: 'courier, Oct 14' } })
    fireEvent.click(record)
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(3))
    expect(resolve).toHaveBeenCalledWith('p1', 'courier, Oct 14')
  })

  it('a refusal is shown and the desk is not reloaded', async () => {
    resend.mockResolvedValue({ ok: false, pieceId: null, status: null, tracking: null, price: null, resolvedNote: null, shortfall: 0.62, error: 'Docsmit credit is short by $0.62; the copy is prepared, not sent.' })
    const onChanged = vi.fn()
    renderWithProviders(<LienMailPieceDoors piece={piece} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('button', { name: 'send a plain copy ›' }))
    await waitFor(() => expect(resend).toHaveBeenCalled())
    await waitFor(() => expect(document.body.textContent).toContain('credit is short'))
    expect(onChanged).not.toHaveBeenCalled()
  })
})
