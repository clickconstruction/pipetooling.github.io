// @vitest-environment jsdom
/**
 * Render smoke for the Mark sent form (v2.2761): Email is preselected, a
 * channel chip switches the stamp line, and Save hands the parent the chosen
 * channel plus the trimmed note. Labels live in gcStatementRounds.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import GcStatementMarkSentForm from './GcStatementMarkSentForm'

describe('GcStatementMarkSentForm', () => {
  it('defaults to email and saves the picked channel with a trimmed note', () => {
    const onSave = vi.fn()
    render(<GcStatementMarkSentForm gcName="Southern Post" actorName="Malachi" busy={false} onSave={onSave} onCancel={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Email' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText(/Stamps Malachi · .* · email/)).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: 'Text' }))
    expect(screen.getByText(/· text$/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: '  texted Dave the PDF  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save mark' }))
    expect(onSave).toHaveBeenCalledWith('text', 'texted Dave the PDF')
  })

  it('Cancel hands back without saving', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(<GcStatementMarkSentForm gcName="Southern Post" actorName="Malachi" busy={false} onSave={onSave} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
