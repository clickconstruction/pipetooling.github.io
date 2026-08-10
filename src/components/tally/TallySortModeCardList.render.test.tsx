// @vitest-environment jsdom
/**
 * Render-smoke tests for TallySortModeCardList — the phone card flow that
 * replaces the Transactions table for subcontractor-like roles (v2.1542).
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { TallySortModeCardList } from './TallySortModeCardList'
import type { TallyLinkedMercuryRow } from '../../lib/mercuryTxRowFromTally'
import { renderWithProviders } from '../../test/renderSmokeMocks'

function row(over: Partial<TallyLinkedMercuryRow> = {}): TallyLinkedMercuryRow {
  return {
    amount: -45.56,
    counterparty_name: 'Reece Plumbing',
    currency: 'USD',
    invoices_summary: '',
    job_splits: [],
    jobs_summary: '',
    mercury_account_id: 'acc-1',
    mercury_account_nickname: '',
    mercury_debit_card_id: 'card-1',
    mercury_id: 'm-1',
    mercury_transaction_id: 'tx-1',
    note: '',
    person_label: 'Paige',
    posted_at: '2026-08-08T17:00:00Z',
    raw: null,
    tally_user_note: '',
    ...over,
  } as TallyLinkedMercuryRow
}

function makeProps(over: Record<string, unknown> = {}) {
  return {
    rows: [row()],
    unlinkedCount: 1,
    jobLabelById: {},
    onStartSort: vi.fn(),
    onOpenAllocations: vi.fn(),
    onSaveMyNote: vi.fn(async () => null),
    ...over,
  }
}

describe('TallySortModeCardList', () => {
  it('unsorted purchase: CTA counts it and the card offers Sort to job', () => {
    const onStartSort = vi.fn()
    renderWithProviders(<TallySortModeCardList {...makeProps({ onStartSort })} />)
    expect(screen.getByText('Sort 1 purchase →')).toBeTruthy()
    expect(screen.getByText('Reece Plumbing')).toBeTruthy()
    expect(screen.getByText('$45.56')).toBeTruthy()
    screen.getByText('Sort to job').click()
    expect(onStartSort).toHaveBeenCalledWith('tx-1')
  })

  it('sorted purchase: green job label opens the full Assign modal, no Sort button', () => {
    const sorted = row({
      job_splits: [{ job_id: 'j1', hcp_number: '942', job_name: 'Spigots replaced', amount: -45.56 }],
    })
    const onOpenAllocations = vi.fn()
    renderWithProviders(
      <TallySortModeCardList
        {...makeProps({ rows: [sorted], unlinkedCount: 0, onOpenAllocations, jobLabelById: { j1: '942 · Spigots replaced' } })}
      />,
    )
    expect(screen.queryByText('Sort to job')).toBeNull()
    expect(screen.queryByText(/Sort .* purchase/)).toBeNull()
    const label = screen.getByText(/942 · Spigots replaced/)
    label.click()
    expect(onOpenAllocations).toHaveBeenCalled()
  })

  it('memo editor opens, saves through the callback', async () => {
    const onSaveMyNote = vi.fn(async () => null)
    renderWithProviders(<TallySortModeCardList {...makeProps({ onSaveMyNote })} />)
    screen.getByText('+ memo').click()
    const box = (await screen.findByLabelText('My memo for this purchase')) as HTMLTextAreaElement
    expect(box).toBeTruthy()
    screen.getByText('Save memo').click()
    expect(onSaveMyNote).toHaveBeenCalledWith('tx-1', '')
  })
})
