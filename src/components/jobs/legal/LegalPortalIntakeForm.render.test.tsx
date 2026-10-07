// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import LegalPortalIntakeForm from './LegalPortalIntakeForm'
import { EMPTY_LEGAL_FIRM_INTAKE } from '../../../lib/legal/legalFirmIntake'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

const base = { short: 'Acme', recordedById: '', busy: false, notice: null, onOpenRules: () => {}, onOpenNotifications: () => {} }

describe('LegalPortalIntakeForm (v2.4821)', () => {
  it('fills from the answers on file, says when and by whom, and sends the shaped answers with the name typed', async () => {
    const onSend = vi.fn(async () => true)
    render(<LegalPortalIntakeForm {...base} recipients={[]} intake={{ answers: { ...EMPTY_LEGAL_FIRM_INTAKE, fileWhere: 'Hays County', efile: 'yes' }, sentAt: '2026-10-07T15:00:00Z', sentBy: 'Ann Sample' }} onSend={onSend} />)
    expect((screen.getByPlaceholderText('For example, a county and a precinct.') as HTMLInputElement).value).toBe('Hays County')
    const efile = within(document.querySelector('[data-intake-question="efile"]') as HTMLElement)
    expect(efile.getByRole('button', { name: 'Yes' }).getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('[data-legal-intake-sent]')!.textContent).toBe('Sent Oct 7 by Ann Sample. Change an answer and send again.')
    expect((screen.getByRole('textbox', { name: 'Answered by' }) as HTMLInputElement).value).toBe('Ann Sample')
    fireEvent.change(screen.getByPlaceholderText('For example, the W-9 or the original bid.'), { target: { value: '  The W-9.  ' } })
    fireEvent.click(efile.getByRole('button', { name: 'Yes' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Answered by' }), { target: { value: 'Lee Paralegal' } })
    expect(JSON.parse(window.localStorage.getItem('legalPortal.intakeDraft') ?? '{}').needs).toBe('  The W-9.  ')
    fireEvent.click(screen.getByRole('button', { name: 'Send to Acme' }))
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ ...EMPTY_LEGAL_FIRM_INTAKE, needs: 'The W-9.', fileWhere: 'Hays County', efile: '' }, 'Lee Paralegal'))
    await waitFor(() => expect(window.localStorage.getItem('legalPortal.intakeDraft')).toBeNull())
  })

  it('a draft on this browser wins over the answers on file; a picked person on the firm list answers', () => {
    window.localStorage.setItem('legalPortal.intakeDraft', JSON.stringify({ needs: 'From the draft' }))
    render(<LegalPortalIntakeForm {...base} recordedById="r2" recipients={[{ id: 'r1', name: 'Ann Sample', role: 'attorney' }, { id: 'r2', name: 'Lee Paralegal', role: 'paralegal' }] as never} intake={{ answers: { ...EMPTY_LEGAL_FIRM_INTAKE, needs: 'On file' }, sentAt: null, sentBy: '' }} onSend={async () => true} />)
    expect((screen.getByPlaceholderText('For example, the W-9 or the original bid.') as HTMLTextAreaElement).value).toBe('From the draft')
    expect((screen.getByRole('combobox', { name: 'Answered by' }) as HTMLSelectElement).value).toBe('Lee Paralegal')
    expect(screen.getByText('Nothing sent yet.')).toBeTruthy()
  })
})
