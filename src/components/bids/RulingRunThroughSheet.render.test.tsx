// @vitest-environment jsdom
/**
 * Render smokes for RulingRunThroughSheet (v2.4232, punch list #63) — one question at a
 * time: the numbered taps with the robot's pick first, the keys, skip, the free-text box,
 * Not mine / Dismiss, the end screen.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { RulingRunThroughSheet } from './RulingRunThroughSheet'
import type { RunThroughItem } from '../../lib/bids/rulingRunThrough'
import type { TwinQuestionRow } from '../../lib/bids/standingRulings'

const row = (id: string, question: string, over: Partial<TwinQuestionRow> = {}): TwinQuestionRow => ({
  id, twin_user_id: 'tw', about_bid_id: null, mission: null, question, status: 'open', answer: null, answered_by: null, answered_at: null, created_at: '2026-09-30T15:00:00Z', ...over,
})

const items: RunThroughItem[] = [
  {
    key: 'topic:grease-interceptor', questionIds: ['g1', 'g2'], label: 'Grease interceptor', askCount: 2, aboutBidIds: ['s496', 's495'], group: 'shared',
    newest: row('g1', 'Shipley Do-Nuts SE Military, P1.4: the GB-75 sits outside on the site sewer. Do we carry the interceptor package?', { about_bid_id: 's496' }),
    choices: [{ label: 'Site contractor — exclude', recommended: true }, { label: 'Ours — carry it', recommended: false }, { label: 'Carry as an add alternate', recommended: false }],
  },
  { key: 'q:t1', questionIds: ['t1'], label: null, askCount: 1, aboutBidIds: ['s499'], group: 'today', newest: row('t1', 'What do you carry for travel on a job like this?', { about_bid_id: 's499' }), choices: null },
  { key: 'q:o1', questionIds: ['o1'], label: null, askCount: 1, aboutBidIds: [], group: 'older', newest: row('o1', 'A footage allowance, or higher per-fixture prices?'), choices: [{ label: 'Footage allowance', recommended: false }, { label: 'Higher per-fixture', recommended: false }] },
]

const refs = {
  bidIdByNumber: { '496': 's496', '495': 's495', '499': 's499' },
  bidNumberById: { s496: '496', s495: '495', s499: '499' },
  sourceByBidId: { s496: { id: 'h490', number: '490' }, s495: { id: 'h489', number: '489' } },
}

function renderSheet(over: Partial<Parameters<typeof RulingRunThroughSheet>[0]> = {}) {
  const props = {
    items,
    audienceWritable: true,
    busy: false,
    onAnswer: vi.fn(async () => true),
    onNotMine: vi.fn(async () => true),
    onDismiss: vi.fn(async () => true),
    onClose: vi.fn(),
    ...refs,
    ...over,
  }
  renderWithProviders(<RulingRunThroughSheet {...props} />)
  return props
}

describe('RulingRunThroughSheet', () => {
  it('runs the questions in order: taps with the ★ first, the number keys, skip, the box, the end screen', async () => {
    const p = renderSheet()
    expect(screen.getByText('Question 1 of 3')).toBeTruthy()
    expect(screen.getByText('0 answered · ~2 min left')).toBeTruthy()
    expect(screen.getByText('Grease interceptor')).toBeTruthy()
    expect(screen.getByText('asked on 2 bids · b496 → ours b490 · b495 → ours b489')).toBeTruthy()
    expect(screen.getByText(/One tap answers both open copies/)).toBeTruthy()
    const star = screen.getByRole('button', { name: /1 ★ Site contractor — exclude · the robot's pick/ })
    expect(star).toBeTruthy()
    expect(screen.getByRole('button', { name: /4 Something else…/ })).toBeTruthy()

    // The 1 key takes the first tap.
    fireEvent.keyDown(window, { key: '1' })
    await waitFor(() => expect(p.onAnswer).toHaveBeenCalledWith(items[0], 'Site contractor — exclude'))
    await waitFor(() => expect(screen.getByText('Question 2 of 3')).toBeTruthy())
    expect(screen.getByText('1 answered · ~2 min left')).toBeTruthy()

    // A question with no taps has the box; the placeholder speaks of one robot.
    expect(screen.getByPlaceholderText('Your answer — the robot pulls it next run…')).toBeTruthy()
    expect(screen.getByText('asked on 1 bid · b499')).toBeTruthy()
    // → skips it.
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(screen.getByText('Question 3 of 3')).toBeTruthy())
    expect(screen.getByText('a job-wide question')).toBeTruthy()

    // No ★ here: Enter does nothing; 3 opens the box; typing + Enter answers.
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(p.onAnswer).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: '3' })
    const box = await screen.findByPlaceholderText('Your answer — the robot pulls it next run…')
    fireEvent.change(box, { target: { value: 'A footage allowance on jobs under $50k' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() => expect(p.onAnswer).toHaveBeenLastCalledWith(items[2], 'A footage allowance on jobs under $50k'))

    // The end screen: what was saved, what was skipped, the door back.
    await waitFor(() => expect(screen.getByText('Done')).toBeTruthy())
    expect(screen.getByText('2 answered · 1 skipped')).toBeTruthy()
    expect(screen.getByText(/Saved — 2 questions handled/)).toBeTruthy()
    expect(screen.getByText(/Site contractor — exclude/)).toBeTruthy()
    expect(screen.getByText(/1 skipped — still on the list/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to the queue' }))
    expect(p.onClose).toHaveBeenCalledTimes(1)
  })

  it('Enter takes the robot’s pick; Not mine and Dismiss write and advance; a refused write stays put; Esc closes', async () => {
    const p = renderSheet({ onDismiss: vi.fn(async () => false) })
    fireEvent.keyDown(window, { key: 'Enter' })
    await waitFor(() => expect(p.onAnswer).toHaveBeenCalledWith(items[0], 'Site contractor — exclude'))
    await waitFor(() => expect(screen.getByText('Question 2 of 3')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Not mine' }))
    await waitFor(() => expect(p.onNotMine).toHaveBeenCalledWith(items[1]))
    await waitFor(() => expect(screen.getByText('Question 3 of 3')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(p.onDismiss).toHaveBeenCalledWith(items[2]))
    // The dismiss was refused: still on question 3.
    expect(screen.getByText('Question 3 of 3')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(p.onClose).toHaveBeenCalledTimes(1)
  })

  it('starts at the line that was tapped, and hides Not mine when the audience column is missing', () => {
    renderSheet({ startIndex: 1, audienceWritable: false })
    expect(screen.getByText('Question 2 of 3')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Not mine' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy()
  })
})
