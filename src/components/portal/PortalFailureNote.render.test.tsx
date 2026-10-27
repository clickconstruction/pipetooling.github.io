// @vitest-environment jsdom
/**
 * The public pages' failure line (v2.5965): the class's sentence or the function's own known one, Try again only
 * where it can help, Call the office only where the failure carries the page's number and a call can help.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PortalFailureNote } from './PortalFailureNote'
import { portalFailure, portalFailureFromAnswer } from '../../lib/portal/portalFailure'

const PHONE = '(512) 555-0101'

describe('PortalFailureNote', () => {
  it('draws nothing with no failure', () => {
    const { container } = render(<PortalFailureNote failure={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('a lost signal: the sentence and Try again, which re-runs what failed; never the office’s number', () => {
    const onTryAgain = vi.fn()
    render(<PortalFailureNote failure={portalFailure('network', 'send', 'en', { phone: PHONE })} onTryAgain={onTryAgain} />)
    expect(screen.getByText('No connection. Nothing was sent. Check your signal and try again.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onTryAgain).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('link', { name: 'Call the office' })).toBeNull()
  })

  it('a refused send with the number: asks them to call and shows Call the office, with no Try again', () => {
    render(<PortalFailureNote failure={portalFailure('refused', 'send', 'en', { phone: PHONE })} onTryAgain={() => {}} />)
    expect(screen.getByText("We couldn't record that. Please call the office.")).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Call the office' }).getAttribute('href')).toBe('tel:+15125550101')
  })

  it('in Spanish, with no number: asks them to try later, and offers no call', () => {
    render(<PortalFailureNote failure={portalFailure('refused', 'send', 'es')} lang="es" />)
    expect(screen.getByText('No pudimos registrar eso. Intente de nuevo más tarde.')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('the function’s own sentence, in the page’s language, with the office line and the call after it', () => {
    render(<PortalFailureNote failure={portalFailureFromAnswer(409, { error: 'That change order is already answered.' }, 'send', 'es', { phone: PHONE })} lang="es" />)
    expect(screen.getByText('Esa orden de cambio ya tiene respuesta. Llame a la oficina.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Llamar a la oficina' })).toBeTruthy()
  })

  it('busy hides the press; doors only draws the presses without the sentence', () => {
    const { rerender } = render(<PortalFailureNote failure={portalFailure('network', 'open')} onTryAgain={() => {}} busy />)
    expect(screen.queryByRole('button')).toBeNull()
    rerender(<PortalFailureNote failure={portalFailure('network', 'open', 'es')} lang="es" onTryAgain={() => {}} doorsOnly />)
    expect(screen.queryByText(/Sin conexión/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Intentar de nuevo' })).toBeTruthy()
  })
})
