// @vitest-environment jsdom
/**
 * The Pipeline's good-through-passed chip (v2.6037, punch list #206's follow-up): it reads the card's
 * words, carries the passed day on hover, and its press lands on the estimate's sent view at the
 * Extend good-through hash.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import EstimateGoodThroughPassedChip from './EstimateGoodThroughPassedChip'
import { goodThroughPassedChip } from '../../lib/estimates/estimateGoodThroughChip'
import { renderWithProviders } from '../../test/renderSmokeMocks'

afterEach(() => cleanup())

function Landed() {
  const loc = useLocation()
  return <p data-testid="landed">{`${loc.pathname}${loc.hash}`}</p>
}

describe('EstimateGoodThroughPassedChip', () => {
  it('reads the words, names the passed day on hover, and the press lands on the Extend door', () => {
    const chip = goodThroughPassedChip({ status: 'sent', sent_at: '2026-09-24T18:31:00Z', valid_until: '2026-10-26', estimate_number: 176 }, '2026-10-28')
    expect(chip).not.toBeNull()
    renderWithProviders(
      <Routes>
        <Route path="/" element={<EstimateGoodThroughPassedChip chip={chip!} />} />
        <Route path="/estimates/:n" element={<Landed />} />
      </Routes>,
    )
    const link = screen.getByRole('link', { name: 'good through passed · extend?' })
    expect(link.getAttribute('href')).toBe('/estimates/176#extend-good-through')
    expect(link.getAttribute('title')).toBe('Pricing passed its good-through date on Oct 26, 2026. Extend it and the link they have works again.')
    fireEvent.click(link)
    expect(screen.getByTestId('landed').textContent).toBe('/estimates/176#extend-good-through')
  })
})
