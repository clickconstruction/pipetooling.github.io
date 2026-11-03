// @vitest-environment jsdom
/**
 * Render smoke for the Contracts Agreements panel's fold (v2.6427): the documents someone holds
 * draw open, the Book entries nobody holds sit behind one press that names their count, the press
 * opens and closes them, and with nothing live the empty state's press is the fold. The split is
 * the kernel's (`lib/contractsAgreementsPanel.test.ts`); this holds the wiring, over invented people.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { AgreementSummary } from '../../lib/contractsAgreementsPanel'
import { ContractsAgreementsPanel } from './ContractsAgreementsPanel'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const summary = (documentName: string, assignedCount: number, signedCount: number): AgreementSummary => ({
  documentName,
  templateNames: assignedCount > 0 ? ['Subcontractors'] : [],
  assignedCount,
  signedCount,
  rows: assignedCount > 0 ? [{ personName: 'Hal Sample', state: signedCount > 0 ? 'signed' : 'unsent', sentAt: null, lastViewedAt: null, signedAt: signedCount > 0 ? '2026-07-01' : null }] : [],
})

const LIVE = [summary('Handbook', 3, 1), summary('Form I-9', 2, 2)]
const IDLE = [summary('Conditional Waiver', 0, 0), summary('Unconditional Waiver', 0, 0), summary('Service agreement', 0, 0)]

afterEach(cleanup)

/** The document cards, by name: each has one expander button whose first span is the document's name and whose words carry its counts. */
const cards = () => [...document.querySelectorAll('button[aria-expanded]:not([data-agreements-fold])')].map((b) => b.querySelector('span')?.textContent ?? '')
const emptyText = () => document.querySelector('[data-empty-state]')?.textContent ?? null

describe('ContractsAgreementsPanel', () => {
  it('draws what is held, folds the rest behind a counted press, and the press opens and closes them', () => {
    renderWithProviders(<ContractsAgreementsPanel summaries={[...IDLE, ...LIVE]} onJumpToPerson={() => {}} onHide={() => {}} />)
    // first paint
    expect(cards()).toEqual(['Handbook', 'Form I-9'])
    expect(emptyText()).toBeNull()
    const fold = screen.getByRole('button', { name: 'Show 3 unassigned documents' })
    expect(fold.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(fold)
    expect(cards()).toEqual(['Handbook', 'Form I-9', 'Conditional Waiver', 'Unconditional Waiver', 'Service agreement'])
    const hide = screen.getByRole('button', { name: 'Hide 3 unassigned documents' })
    expect(hide.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(hide)
    expect(cards()).toEqual(['Handbook', 'Form I-9'])
    expect(screen.getByRole('button', { name: 'Show 3 unassigned documents' })).toBeTruthy()
  })

  it('with nothing live, the empty state names the fold as its press, and the open fold still offers Send to…', () => {
    const onQuickSend = vi.fn()
    renderWithProviders(
      <ContractsAgreementsPanel summaries={IDLE} onJumpToPerson={() => {}} onHide={() => {}} onQuickSend={onQuickSend} quickSendDocumentNames={new Set(['Service agreement'])} />,
    )
    // first paint
    expect(cards()).toEqual([])
    expect(emptyText()).toBe('Nothing is assigned or signed yet. Show 3 unassigned documents lists them.')
    expect(screen.getAllByRole('button', { name: 'Show 3 unassigned documents' })).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Show 3 unassigned documents' }))
    expect(emptyText()).toBeNull()
    expect(cards()).toEqual(['Conditional Waiver', 'Unconditional Waiver', 'Service agreement'])
    expect(screen.getByRole('button', { name: 'Hide 3 unassigned documents' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Send to…' }))
    expect(onQuickSend).toHaveBeenCalledWith('Service agreement')
  })

  it('with every document held, no fold draws', () => {
    renderWithProviders(<ContractsAgreementsPanel summaries={LIVE} onJumpToPerson={() => {}} onHide={() => {}} />)
    // first paint
    expect(cards()).toEqual(['Handbook', 'Form I-9'])
    expect(screen.queryByRole('button', { name: /unassigned document/ })).toBeNull()
  })

  it('with no documents at all, the Contract library is the press', () => {
    const open = vi.fn()
    renderWithProviders(<ContractsAgreementsPanel summaries={[]} onJumpToPerson={() => {}} onHide={() => {}} onOpenContractLibrary={open} />)
    // first paint
    expect(emptyText()).toBe('No agreements yet. Contract library adds the documents.')
    fireEvent.click(screen.getByRole('button', { name: 'Contract library' }))
    expect(open).toHaveBeenCalledTimes(1)
  })
})
