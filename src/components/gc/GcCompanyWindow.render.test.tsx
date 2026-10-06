// @vitest-environment jsdom
/**
 * Render smoke for the company window opened on a paper's send (G-77): a not-ready bar's button
 * lands on the ask itself, the way Get started's Send to sign opens the customer's. Opened at the
 * paper without it, the window waits for the row's own button.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { GcCompanyWindow } from './GcCompanyWindow'
import { initialGcState } from '../../lib/gcMode/gcFixture'

afterEach(cleanup)

const state = initialGcState()
const pecanValley = state.partners.find((p) => p.id === 'pecanvalley')!

function open(send: boolean) {
  render(<GcCompanyWindow state={state} partner={pecanValley} dispatch={vi.fn()} at={{ tab: 'documents', doc: 'insurance', ...(send ? { send: true } : {}) }} onClose={() => undefined} onOpenProject={() => undefined} />)
}

describe('the company window, opened at a paper', () => {
  it('opens on the send when asked: the ask for the renewed certificate, ready to go', () => {
    open(true)
    expect(screen.getByText('Ask for the renewed insurance certificate')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send the ask' })).toBeTruthy()
  })

  it('without it, shows the paper with its own button', () => {
    open(false)
    expect(screen.queryByText('Ask for the renewed insurance certificate')).toBeNull()
    expect(screen.getByRole('button', { name: 'Ask for it' })).toBeTruthy()
  })
})
