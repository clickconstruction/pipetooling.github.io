// @vitest-environment jsdom
/**
 * Render smoke for the 🤖 Console's "Run the robots" card (v2.4229): Claude Code is the
 * first way — its kickoff is the robot's instructions with the connector filled in and no
 * setup steps for a person — and the chat kickoff stays as the fallback beside it. The
 * cards under it (questions, memo, pricer, runs) are stubbed; they have their own smokes.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { BidsRobotConsoleTab } from './BidsRobotConsoleTab'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/usePriceMatrixRequests', () => ({
  usePriceMatrixRequests: () => ({ requests: [], supported: true, loaded: true, reload: () => {} }),
}))
vi.mock('./TwinPricerCard', () => ({ TwinPricerCard: () => null }))
vi.mock('./TwinOperatorQuestionsCard', () => ({ TwinOperatorQuestionsCard: () => null }))
vi.mock('./TwinOwnerMemoCard', () => ({ TwinOwnerMemoCard: () => null }))
vi.mock('./TwinRunsLedger', () => ({ TwinRunsLedger: () => null }))

function mountClipboard() {
  const writeText = vi.fn((_text: string) => Promise.resolve())
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  return writeText
}

describe('BidsRobotConsoleTab — Run the robots', () => {
  it('puts Claude Code first and copies a kickoff that is the robot’s instructions, connector filled in', async () => {
    const writeText = mountClipboard()
    renderWithProviders(<BidsRobotConsoleTab bids={[]} twinBidBySourceId={new Map()} onOpenQueue={() => {}} />)
    await settle()

    const heads = screen.getAllByText(/^From |^Pricing robot/).map((el) => el.textContent)
    expect(heads).toEqual(['From Claude Code · reads the plans itself', 'From a Claude chat · when Code is not at hand', 'Pricing robot · never bids'])
    expect(screen.getByText(/pulls each plan set through the connector — nothing to attach/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Copy Code kickoff' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const code = writeText.mock.calls[0]![0]
    expect(code.startsWith('# Robot estimator from Claude Code — kickoff prompt')).toBe(true)
    expect(code).toContain('**Run this now.**')
    expect(code).toContain('`https://mcp.clicktooling.com/twin`')
    expect(code).not.toContain('{{CONNECTOR_URL}}')
    expect(code).not.toContain('One-time setup')
  })

  it('keeps the chat kickoff beside it, and says what a chat costs', async () => {
    const writeText = mountClipboard()
    renderWithProviders(<BidsRobotConsoleTab bids={[]} twinBidBySourceId={new Map()} onOpenQueue={() => {}} />)
    await settle()

    expect(screen.getByText(/asks you to drag in each plan PDF/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Copy chat kickoff' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const chat = writeText.mock.calls[0]![0]
    expect(chat.startsWith('# Robot estimator from Claude Desktop — kickoff prompt')).toBe(true)
    expect(chat).toContain('drag the PDF into the chat')

    // The previews show what each button copies.
    fireEvent.click(screen.getByRole('button', { name: 'Preview the Code kickoff' }))
    expect(screen.getByRole('button', { name: 'Hide the Code kickoff' })).toBeTruthy()
    expect(document.querySelector('pre')?.textContent).toContain('You fetch the plan set yourself; nobody attaches it.')
  })
})
