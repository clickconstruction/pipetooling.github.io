// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeCashConfidence } from './BridgeCashConfidence'
import { receiptsConfidence } from '../../lib/bridge/cashConfidence'

describe('BridgeCashConfidence', () => {
  it('draws the band with its three amounts and the carrying-day sentence', () => {
    const c = receiptsConfidence([
      { usd: 3087, basis: 'promised' },
      { usd: 57_900, basis: 'customer' },
      { usd: 227_536, basis: 'late' },
    ])
    renderWithProviders(<BridgeCashConfidence confidence={c} carry="87% of the window's receipts ($228k) land on Oct 24. If they slip, that is the day to watch." />)
    expect(screen.getByRole('img', { name: 'Promised $3.1k, by pace $57.9k, late and assumed $228k' })).toBeTruthy()
    expect(screen.getByText(/late, assumed within their pace/).textContent).toContain('(1)')
    expect(screen.getByTestId('bridge-cash-carry').textContent).toContain('land on Oct 24')
  })
  it('draws no carry box when no day carries the window', () => {
    renderWithProviders(<BridgeCashConfidence confidence={receiptsConfidence([])} carry={null} />)
    expect(screen.queryByTestId('bridge-cash-carry')).toBeNull()
  })
})
