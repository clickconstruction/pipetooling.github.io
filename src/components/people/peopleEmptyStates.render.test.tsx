// @vitest-environment jsdom
/**
 * Empty states in People, pay and hiring (punch list #184, sweep C) for the surfaces with no smoke of
 * their own: each empty list names its press, and the press does what it says. The words are held by
 * `lib/people/peopleEmptyWords.test.ts`; this file holds the wiring.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { ContractsAgreementsPanel } from './ContractsAgreementsPanel'
import { OverheadPeopleTable } from './OverheadPeopleTable'
import { PeopleReviewRankedList } from './review/PeopleReviewRankedList'
import FeedbackPeopleTable from '../team-feedback/FeedbackPeopleTable'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const emptyText = () => document.querySelector('[data-empty-state]')?.textContent ?? null
const press = () => document.querySelector('[data-empty-state] button') as HTMLButtonElement

describe('empty states with their own press', () => {
  it('Contracts → Agreements: Contract library adds the documents', () => {
    const open = vi.fn()
    renderWithProviders(<ContractsAgreementsPanel summaries={[]} onJumpToPerson={() => {}} onHide={() => {}} onOpenContractLibrary={open} />)
    expect(emptyText()).toBe('No agreements yet. Contract library adds the documents.')
    fireEvent.click(screen.getByRole('button', { name: 'Contract library' }))
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('Overhead → the pool table widens to the next window', () => {
    renderWithProviders(<OverheadPeopleTable labor={[]} parts={[]} endYmd="2026-10-26" loading={false} />)
    expect(emptyText()).toBe('Nothing in the pool for the last 7 days. Last 30 days looks further back.')
    fireEvent.click(press())
    expect(emptyText()).toBe('Nothing in the pool for the last 30 days. Last 90 days looks further back.')
    expect(screen.getAllByRole('button', { name: 'Last 30 days' })[0]!.getAttribute('aria-pressed')).toBe('true')
  })

  it('Review → the ranked bars: a search with no match offers Clear the search', () => {
    const onSearchChange = vi.fn()
    renderWithProviders(
      <PeopleReviewRankedList ranked={{ bars: [], zeroPct: 50 }} rankBy="profit" onRankByChange={() => {}} search="ana" onSearchChange={onSearchChange} selectedName={null} onTogglePerson={() => {}} refreshing={false} />,
    )
    expect(emptyText()).toBe('Nobody matches ‘ana’. Clear the search')
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    expect(onSearchChange).toHaveBeenCalledWith('')
  })

  it('Feedback → the people table: a chip hiding everyone offers Everyone', () => {
    renderWithProviders(<FeedbackPeopleTable rows={[]} nowMs={Date.now()} enabled selectedUserId={null} onSelect={() => {}} narrow={false} />)
    expect(emptyText()).toBe('Nobody matches this filter. Everyone shows the whole roster.')
    fireEvent.click(screen.getByRole('button', { name: 'Everyone' }))
    expect(emptyText()).toBe('Nobody on the team yet.')
  })
})
