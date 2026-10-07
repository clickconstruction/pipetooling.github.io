// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import LegalNarrativeEditor, { type NarrativeDesk } from './LegalNarrativeEditor'

afterEach(cleanup)

const desk = (over: Partial<NarrativeDesk> = {}): NarrativeDesk => ({ markdown: '', updatedOn: '', updatedByName: '', canEdit: true, save: vi.fn(async () => true), ...over })

describe('LegalNarrativeEditor (v2.4812)', () => {
  it('starts from the outline, previews as the firm sees it, and saves the text', () => {
    const save = vi.fn(async () => true)
    render(<LegalNarrativeEditor narrative={desk({ save })} busy={false} />)
    expect(screen.getByText(/Not written yet/)).toBeTruthy()
    const saveBtn = screen.getByRole('button', { name: 'Save narrative' }) as HTMLButtonElement
    expect(saveBtn.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Start from the outline' }))
    const area = screen.getByLabelText('Narrative for the firm') as HTMLTextAreaElement
    expect(area.value).toContain('## The parties')
    fireEvent.change(area, { target: { value: '## The parties\n\nClick was the sub.\n\n| They say | The record |\n|---|---|\n| a | b |' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview as the firm sees it' }))
    const rendered = document.querySelector('[data-legal-narrative-desk] .legalNarrative')!
    expect(rendered.querySelector('h2')!.textContent).toBe('The parties')
    expect(rendered.querySelector('table')).toBeTruthy()
    expect(document.querySelector('[data-legal-narrative-desk]')!.textContent).toContain("The office's account of this matter, written by the office.")
    expect(saveBtn.disabled).toBe(false)
    fireEvent.click(saveBtn)
    expect(save).toHaveBeenCalledWith('## The parties\n\nClick was the sub.\n\n| They say | The record |\n|---|---|\n| a | b |')
  })

  it('a saved text says who and when; Undo changes brings it back; a text over the limit will not save', () => {
    render(<LegalNarrativeEditor narrative={desk({ markdown: '## Saved', updatedOn: '2026-10-07', updatedByName: 'Robin Ortega' })} busy={false} />)
    expect(screen.getByText(/Saved 2026-10-07 by Robin Ortega/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Start from the outline' })).toBeNull()
    const area = screen.getByLabelText('Narrative for the firm') as HTMLTextAreaElement
    fireEvent.change(area, { target: { value: 'x'.repeat(40_001) } })
    expect((screen.getByRole('button', { name: 'Save narrative' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('alert').textContent).toContain('longer than 40,000 characters')
    fireEvent.click(screen.getByRole('button', { name: 'Undo changes' }))
    expect(area.value).toBe('## Saved')
  })

  it('read only: the rendered text, or a line when there is none', () => {
    const { rerender } = render(<LegalNarrativeEditor narrative={desk({ canEdit: false, markdown: '## The parties\n\nX', updatedOn: '2026-10-07', updatedByName: 'R' })} busy={false} />)
    expect(screen.queryByLabelText('Narrative for the firm')).toBeNull()
    expect(document.querySelector('.legalNarrative h2')!.textContent).toBe('The parties')
    rerender(<LegalNarrativeEditor narrative={desk({ canEdit: false })} busy={false} />)
    expect(screen.getByText(/No narrative yet/)).toBeTruthy()
  })
})
