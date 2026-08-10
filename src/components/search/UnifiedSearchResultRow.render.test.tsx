// @vitest-environment jsdom
/**
 * Render tests for the shared UnifiedSearchResultRow — the header-search
 * standard every picker adopts: trade pill + plain J/B number, and the
 * evidence rail (status chip · $revenue · paid recency · N this wk · line
 * summary), with the lines-only variant for field roles.
 */
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'

import { UnifiedSearchResultRow, bidSearchDateLabel } from './UnifiedSearchResultRow'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { UnifiedSearchResult } from '../../utils/unifiedJobBidSearch'
import type { JobSearchEvidence } from '../../lib/jobSearchEvidence'

import type { LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'

// st1 configures JP/BP prefixes — the rows must still render plain J/B beside the pill.
const prefixMap: LedgerPrefixMap = { st1: { job: 'JP', bid: 'BP' } }

const jobResult: Extract<UnifiedSearchResult, { source: 'job' }> = {
  source: 'job',
  id: 'j1',
  hcp_number: '927',
  click_number: null,
  job_name: 'Mike Holub',
  job_address: '109 Tuscarora Dr San Antonio, TX 78209',
  service_type_id: 'st1',
  service_type_name: 'Plumbing',
}

const jobEvidence: JobSearchEvidence = {
  lineCount: 2,
  lineRevenue: 4850,
  lineSummary: 'Water heater 50 gal, Expansion tank',
  paidTotal: 4850,
  lastPaidDaysAgo: 12,
  status: 'ready_to_bill',
  blocksThisWeek: 2,
}

describe('UnifiedSearchResultRow', () => {
  it('renders a job with plain J prefix, trade pill, status chip, money, and this-wk count', () => {
    renderWithProviders(
      <UnifiedSearchResultRow result={jobResult} prefixMap={prefixMap} jobEvidence={jobEvidence} />,
    )
    // Plain J (not the configured JP) because the plum pill carries the trade.
    expect(screen.getByText(/J927 · Mike Holub - 109 Tuscarora Dr San Antonio, TX/)).toBeTruthy()
    expect(screen.queryByText(/JP927/)).toBeNull()
    expect(screen.getByText('plum')).toBeTruthy()
    expect(screen.getByText('Ready to Bill')).toBeTruthy()
    expect(screen.getByText('$4,850')).toBeTruthy()
    expect(screen.getByText(/paid 12d/)).toBeTruthy()
    expect(screen.getByText('2 this wk')).toBeTruthy()
    expect(screen.getByText('Water heater 50 gal, Expansion tank')).toBeTruthy()
  })

  it('lines-only mode hides dollars but keeps status, line count, and this-wk', () => {
    renderWithProviders(
      <UnifiedSearchResultRow
        result={jobResult}
        prefixMap={prefixMap}
        jobEvidence={{ ...jobEvidence, status: 'working', blocksThisWeek: 4 }}
        evidenceMode="lines-only"
      />,
    )
    expect(screen.queryByText('$4,850')).toBeNull()
    expect(screen.queryByText(/paid 12d/)).toBeNull()
    expect(screen.getByText('Working')).toBeTruthy()
    expect(screen.getByText('2 lines')).toBeTruthy()
    expect(screen.getByText('4 this wk')).toBeTruthy()
  })

  it('renders without evidence as a plain pill + label row', () => {
    renderWithProviders(<UnifiedSearchResultRow result={jobResult} prefixMap={prefixMap} />)
    expect(screen.getByText(/J927 · Mike Holub/)).toBeTruthy()
    expect(screen.queryByText(/this wk/)).toBeNull()
  })

  it('stacks the rail below the identity line on narrow viewports', () => {
    // Install a MATCHING matchMedia before renderWithProviders' shim (which only
    // fills the gap when window.matchMedia is undefined, and returns matches:false).
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query.includes('640'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
    try {
      renderWithProviders(
        <UnifiedSearchResultRow result={jobResult} prefixMap={prefixMap} jobEvidence={jobEvidence} />,
      )
      const label = screen.getByText(/J927 · Mike Holub/)
      const chip = screen.getByText('Ready to Bill')
      // Stacked: the chip lives on its own line — it must NOT share the desktop
      // layout's common flex-row ancestor with the identity span.
      const identityLine = label.closest('span[style*="flex"]')
      expect(identityLine).toBeTruthy()
      expect(identityLine?.contains(chip)).toBe(false)
      // All evidence still renders.
      expect(screen.getByText('$4,850')).toBeTruthy()
      expect(screen.getByText('2 this wk')).toBeTruthy()
    } finally {
      window.matchMedia = original
    }
  })

  it('renders a bid with plain B prefix, outcome chip, value, and date', () => {
    renderWithProviders(
      <UnifiedSearchResultRow
        result={{
          source: 'bid',
          id: 'b1',
          bid_number: '356',
          project_name: 'Heron Creek Amenity Center',
          address: '4412 Heron Creek Blvd',
          customer_name: 'Heron Custom Homes',
          service_type_id: 'st1',
          service_type_name: 'Plumbing',
        }}
        prefixMap={prefixMap}
        bidEvidence={{ bidValue: 38600, winLoss: 'won', dateSent: '2026-02-07', dueDate: null }}
      />,
    )
    expect(screen.getByText(/B356 · Heron Creek Amenity Center - 4412 Heron Creek Blvd/)).toBeTruthy()
    expect(screen.queryByText(/BP356/)).toBeNull()
    expect(screen.getByText('Won')).toBeTruthy()
    expect(screen.getByText('$38,600')).toBeTruthy()
    expect(screen.getByText('sent 2/7')).toBeTruthy()
  })
})

describe('bidSearchDateLabel', () => {
  it('prefers due date for non-terminal outcomes, sent date otherwise', () => {
    expect(bidSearchDateLabel({ bidValue: null, winLoss: null, dateSent: null, dueDate: '2026-05-05' })).toBe('due 5/5')
    expect(bidSearchDateLabel({ bidValue: null, winLoss: 'won', dateSent: '2026-03-02', dueDate: '2026-05-05' })).toBe('sent 3/2')
    expect(bidSearchDateLabel({ bidValue: null, winLoss: null, dateSent: null, dueDate: null })).toBeNull()
  })
})
