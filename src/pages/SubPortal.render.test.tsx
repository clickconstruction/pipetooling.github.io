// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SubPortal from './SubPortal'
import { installDomShims } from '../test/renderSmokeMocks'
import { SUB_PORTAL_DEMO_PAYLOAD } from '../lib/subPortal/subPortalDemoFixture'

/**
 * Wiring smoke for the sub portal page (sub-portal train): the edge-fn fetch
 * is stubbed with the demo fixture; asserts every statement section renders
 * from a parsed payload — head figures, job cards, offer, ledger, paperwork.
 * The page needs a router location carrying ?t=, so it renders in its own
 * MemoryRouter (it uses none of the app contexts renderWithProviders adds).
 */

const TOKEN = 'a'.repeat(32)

function renderPortal(query = '') {
  installDomShims()
  return render(
    <MemoryRouter initialEntries={[`/sub?t=${TOKEN}${query}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/sub" element={<SubPortal />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => SUB_PORTAL_DEMO_PAYLOAD,
    })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SubPortal render smoke', () => {
  it('renders the full statement from a fetched payload', async () => {
    renderPortal()
    await waitFor(() => expect(screen.getByText('Work & pay statement')).toBeTruthy())

    // Head: sub name + owed figure + split pay note
    expect(screen.getByText('Danny Vasquez')).toBeTruthy()
    // The owed figure appears in the head AND the recap's double-rule total.
    expect(screen.getAllByText('$4,180.00').length).toBeGreaterThanOrEqual(2)

    // Job cards with line items and pay-when
    expect(screen.getAllByText(/J-1482/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/14 × Top out fixtures/)).toBeTruthy()
    expect(screen.getByText(/Payable after Sep 9, 2026/)).toBeTruthy()
    // Stage rail (v2.2767): the working sheet offers the sub's one button; the
    // walk-through sheet (moved from the portal Sep 1) reads its dated sentence.
    // v2.2931: the done button became the percent control; 100 ✓ + Send to office is the done path.
    expect(screen.getByText('How far along is your part?')).toBeTruthy()
    expect(screen.getByText('100% ✓')).toBeTruthy()
    expect(screen.getByText(/You told us the work's done Sep 1, 2026/)).toBeTruthy()

    // Offer with sign-to-accept
    expect(screen.getByText('Rough-in · 407 E 6th St')).toBeTruthy()
    expect(screen.getByText(/Sign to accept this work/)).toBeTruthy()

    // Ledger + recap + minus-amount legend
    expect(screen.getByText('Restock: cracked lav (supply house)')).toBeTruthy()
    expect(screen.getByText('Balance owed to you')).toBeTruthy()
    expect(screen.getByText(/minus amount is a deduction/)).toBeTruthy()

    // Paperwork states
    expect(screen.getByText('Master Subcontract Agreement')).toBeTruthy()
    expect(screen.getByText(/Expires Nov 30, 2026/)).toBeTruthy()
    expect(screen.getByText('Sign now')).toBeTruthy()

    // Short address card
    expect(screen.getAllByText(/dv-mechanical/).length).toBeGreaterThanOrEqual(1)
  })

  it('scrolls to and halos the card the office asked to be shown (?focus=)', async () => {
    installDomShims()
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    renderPortal('&focus=sheet%3Ademo-s1')
    await waitFor(() => expect(screen.getByText('Work & pay statement')).toBeTruthy())
    const target = document.getElementById('sp-focus-sheet-demo-s1')
    expect(target).toBeTruthy()
    // The working sheet's sentence + button live inside the haloed block.
    expect(target!.textContent).toContain('How far along is your part?')
    await waitFor(() => expect(target!.className).toBe('sp-focus'))
    expect(scroll).toHaveBeenCalledTimes(1)
    // The other cards stay plain.
    expect(document.getElementById('sp-focus-sheet-demo-s2')!.className).toBe('')
    expect(document.getElementById('sp-focus-offer-demo-o1')!.className).toBe('')
    scroll.mockRestore()
  })

  it('shows the friendly error when the link is dead', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: 'This link is no longer active. Please contact our office for a new one.' }),
      })),
    )
    renderPortal()
    await waitFor(() => expect(screen.getByText(/couldn.t open this page/i)).toBeTruthy())
    expect(screen.getByText(/no longer active/)).toBeTruthy()
  })
})
