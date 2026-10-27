// @vitest-environment jsdom
/**
 * Where it stands with the customer (punch list #186, item 2A, v2.5895): the card draws the three lines with their
 * doors and the stamp, Read again and Keep as a note press their callbacks, a door opens the line's thread, the fold
 * is kept per browser, and a failed read says so. Dana and job 1104 are the mock-up's made-up people.
 */
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SUMMARY_FOLD_KEY, type ThreadSummary } from '../../lib/jobs/threadSummary'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobThreadSummary } from './JobThreadSummary'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)
beforeEach(() => localStorage.clear())

const SUMMARY: ThreadSummary = {
  lines: [
    { key: 'stands', label: 'Where it stands', text: 'The last word was Dana’s, a text yesterday. The job is Working at 34%.', href: '/messages?thread=c-dana&at=m-sat', doorWord: 'the text' },
    { key: 'theirs', label: 'Their word', text: 'Dana promised a decision by Thu Oct 29. Said on Friday.', href: '/messages?thread=c-dana&at=m-fri', doorWord: 'their word' },
    { key: 'ours', label: 'Our word', text: 'We owe Dana a start date by Mon Nov 2. Marked on Friday.', href: null, doorWord: '' },
  ],
  stamp: 'Read 8:10 AM from 41 lines and 12 events.',
  counts: { lines: 41, events: 12 },
  noteBody: 'Where it stands with Dana, read 8:10 AM from 41 lines and 12 events.\n…',
}

function draw(p: Partial<Parameters<typeof JobThreadSummary>[0]> = {}) {
  const onReadAgain = vi.fn()
  const onKeep = vi.fn()
  const onOpenLine = vi.fn()
  renderWithProviders(
    <JobThreadSummary customerName="Dana" summary={SUMMARY} loading={false} failed={false} onReadAgain={onReadAgain} onKeep={onKeep} keeping={false} kept={false} onOpenLine={onOpenLine} {...p} />,
  )
  return { onReadAgain, onKeep, onOpenLine }
}

describe('JobThreadSummary', () => {
  it('draws the three lines, the doors, the stamp and the two presses', () => {
    const { onReadAgain, onKeep, onOpenLine } = draw()
    expect(screen.getByText('Where it stands with Dana')).toBeTruthy()
    expect(screen.getByTestId('job-thread-summary-stands').textContent).toContain('The last word was Dana’s, a text yesterday.')
    expect(screen.getByTestId('job-thread-summary-theirs').textContent).toContain('Dana promised a decision by Thu Oct 29.')
    expect(screen.getByTestId('job-thread-summary-ours').textContent).toContain('We owe Dana a start date by Mon Nov 2.')
    expect(screen.getByTestId('job-thread-summary-stamp').textContent).toBe('Read 8:10 AM from 41 lines and 12 events.')
    expect(screen.getByText('Nothing is written unless you press Keep as a note.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'the text ›' }))
    expect(onOpenLine).toHaveBeenCalledWith('/messages?thread=c-dana&at=m-sat')
    fireEvent.click(screen.getByRole('button', { name: 'Read again' }))
    expect(onReadAgain).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Keep as a note' }))
    expect(onKeep).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /Our word/ })).toBeNull()
  })

  it('folds to one line, keeps the fold on this browser, and opens again on a press', () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'Fold Where it stands with Dana' }))
    expect(localStorage.getItem(SUMMARY_FOLD_KEY)).toBe('1')
    expect(screen.queryByTestId('job-thread-summary-stamp')).toBeNull()
    expect(screen.getByText('The last word was Dana’s, a text yesterday. The job is Working at 34%.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open Where it stands with Dana' }))
    expect(localStorage.getItem(SUMMARY_FOLD_KEY)).toBe('0')
    expect(screen.getByTestId('job-thread-summary-stamp')).toBeTruthy()
  })

  it('says a failed read failed, says kept once kept, and offers no Keep when the viewer cannot write', () => {
    draw({ summary: null, failed: true })
    expect(screen.getByText('The lines could not be read. Press Read again.')).toBeTruthy()
    cleanup()
    draw({ kept: true })
    expect(screen.getByText('Kept as a note on the job.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Keep as a note' }) as HTMLButtonElement).disabled).toBe(true)
    cleanup()
    draw({ onKeep: undefined })
    expect(screen.queryByRole('button', { name: 'Keep as a note' })).toBeNull()
  })
})
