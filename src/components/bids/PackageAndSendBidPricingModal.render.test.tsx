// @vitest-environment jsdom
/**
 * Render smoke for Share with a teammate carrying both prices (v2.3685 "Send both"): the
 * caption names the pair, the preview shows one labeled table per price (★ first), and
 * Copy for text puts both headings and both totals on the clipboard.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: vi.fn() }))

import { PackageAndSendBidPricingModal } from './PackageAndSendBidPricingModal'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'

const bid = {
  id: 'bid-1',
  project_name: 'Galloway Park Concession Stand',
  bid_number: '385',
  plans_link: 'https://example.com/plans',
  count_tooling_plans_link: null,
  address: '1 Park Rd, San Antonio TX',
  service_type_id: null,
} as unknown as BidWithBuilder

const starRows = [{ fixture: 'Toilet', count: 2, unitPrice: 100, revenue: 200, omitFromSubmissionDocuments: false }]
const otherRows = [{ fixture: 'Sink', count: 1, unitPrice: 50, revenue: 50, omitFromSubmissionDocuments: false }]

function renderBoth() {
  return render(
    <PackageAndSendBidPricingModal
      open
      onClose={vi.fn()}
      bid={bid}
      priceBookVersionId="v-star"
      priceBookVersionName="Value Engineered"
      pricingRows={starRows}
      totalRevenue={200}
      alsoPrice={{ priceBookVersionId: 'v-viewed', name: 'Written to Plan', rows: otherRows, totalRevenue: 50 }}
      estimatorUsers={[]}
      prefixMap={new Map() as unknown as LedgerPrefixMap}
      currentUserName="Grace"
      onRequestEditBid={vi.fn()}
    />,
  )
}

describe('PackageAndSendBidPricingModal — Send both', () => {
  it('names the pair in the caption and previews one labeled table per price, ★ first', () => {
    const { baseElement } = renderBoth()
    expect(screen.getByText(/★ Value Engineered \+ Written to Plan/)).toBeTruthy()
    expect(screen.getByText(/both prices, ★ first/)).toBeTruthy()
    const tables = baseElement.querySelectorAll('.package-send-preview table')
    expect(tables.length).toBe(2)
    const preview = (baseElement.querySelector('.package-send-preview') as HTMLElement).textContent ?? ''
    expect(preview.indexOf("★ Value Engineered — customer's price")).toBeGreaterThan(-1)
    expect(preview.indexOf('Written to Plan — second price')).toBeGreaterThan(preview.indexOf('★ Value Engineered'))
  })

  it('Copy for text copies both headings and both totals', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    renderBoth()
    fireEvent.click(screen.getByText('Copy for text'))
    await waitFor(() => expect(screen.getByText(/Text copied to clipboard/)).toBeTruthy())
    const text = writeText.mock.calls[0]?.[0] as string
    expect(text).toContain("★ Value Engineered — customer's price")
    expect(text).toContain('Written to Plan — second price')
    expect(text.split('\n').filter((l) => l.startsWith('Total:'))).toEqual(['Total: $200.00', 'Total: $50.00'])
  })
})
