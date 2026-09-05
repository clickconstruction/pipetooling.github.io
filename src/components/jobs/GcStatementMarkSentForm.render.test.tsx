// @vitest-environment jsdom
/**
 * Render smoke for the Mark form (v2.2761 → v2.2813): Email is preselected
 * on a send; switching to "Spoke with them" drops Email, demands a
 * temperature pick and a real sentence, and hands the parent the contacted
 * payload with the pay date. Labels live in gcStatementRounds.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import GcStatementMarkSentForm from './GcStatementMarkSentForm'

describe('GcStatementMarkSentForm', () => {
  it('defaults to a send by email and saves the picked channel with a trimmed note', () => {
    const onSave = vi.fn()
    render(<GcStatementMarkSentForm gcName="Southern Post" actorName="Malachi" busy={false} onSave={onSave} onCancel={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Email' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('radio', { name: 'Text' }))
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: '  texted Dave the PDF  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save mark' }))
    expect(onSave).toHaveBeenCalledWith({ action: 'sent', channel: 'text', note: 'texted Dave the PDF', temperature: null, expectedPayBy: null })
  })

  it('a contact needs a temperature and a sentence, then saves the contacted payload', () => {
    const onSave = vi.fn()
    render(<GcStatementMarkSentForm gcName="Knight" actorName="Malachi" busy={false} onSave={onSave} onCancel={() => {}} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Spoke with them · no statement' }))
    expect(screen.queryByRole('radio', { name: 'Email' })).toBeNull()
    expect(screen.getByRole('radio', { name: 'Call' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Save · spoke with them' }))
    expect(screen.getByText('Pick their temperature.')).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('radio', { name: /^Warm/ }))
    fireEvent.change(screen.getByLabelText('Temperature answer'), { target: { value: 'fine' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save · spoke with them' }))
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Temperature answer'), { target: { value: 'Warm — Dave says the check run is the 10th.' } })
    fireEvent.change(screen.getByLabelText('They expect to pay by'), { target: { value: '2026-09-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save · spoke with them' }))
    expect(onSave).toHaveBeenCalledWith({ action: 'contacted', channel: 'call', note: 'Warm — Dave says the check run is the 10th.', temperature: 'warm', expectedPayBy: '2026-09-10' })
  })
})
