// @vitest-environment jsdom
/**
 * Messages, residential R2 PR 2: the job window's kinds row over the note composer. With a customer box (the office
 * team), Note · Text · Email sit over it: Note is the crew's note as it was, and Text or Email draw the box in its
 * place. Without one (Job Mode, the crew, Quickfill) the composer is as it was, with no row.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { JobThreadNotesPanel } from './JobThreadNotesPanel'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

function draw(withBox: boolean) {
  const render = vi.fn((kind: 'text' | 'email') => <div data-customer-box={kind}>{`the ${kind} box`}</div>)
  renderWithProviders(
    <JobThreadNotesPanel
      activity={[]}
      loading={false}
      canPost
      draft=""
      onDraftChange={() => undefined}
      onSubmit={() => undefined}
      submitting={false}
      showSectionTitle={false}
      showEmptyPlaceholder={false}
      {...(withBox ? { customerBox: { render } } : {})}
    />,
  )
  return { render }
}

describe('JobThreadNotesPanel: Note · Text · Email (residential R2)', () => {
  it('starts on the crew’s note, and Text or Email draw the customer box in its place', () => {
    const { render } = draw(true)
    const row = screen.getByRole('radiogroup', { name: 'Write as' })
    expect(within(row).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Note', 'Text', 'Email'])
    expect(within(row).getByRole('radio', { name: 'Note' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('button', { name: 'Post note' })).toBeTruthy()
    expect(render).not.toHaveBeenCalled()

    fireEvent.click(within(row).getByRole('radio', { name: 'Text' }))
    expect(document.querySelector('[data-customer-box="text"]')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Post note' })).toBeNull()
    fireEvent.click(within(row).getByRole('radio', { name: 'Email' }))
    expect(document.querySelector('[data-customer-box="email"]')).toBeTruthy()

    fireEvent.click(within(row).getByRole('radio', { name: 'Note' }))
    expect(screen.getByRole('button', { name: 'Post note' })).toBeTruthy()
    expect(document.querySelector('[data-customer-box]')).toBeNull()
  })

  it('draws no row and keeps the composer as it was without a customer box', () => {
    draw(false)
    expect(screen.queryByRole('radiogroup', { name: 'Write as' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Post note' })).toBeTruthy()
  })
})
