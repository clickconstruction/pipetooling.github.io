// @vitest-environment jsdom
/**
 * Render smoke for Share with a teammate carrying both prices (v2.3685 "Send both"): the
 * caption names the pair, the preview shows one labeled table per price (★ first), and
 * Copy for text puts both headings and both totals on the clipboard. The text reads in
 * whole dollars (v2.7045); the preview table and the email keep their cents. A fixed-price
 * row in either price reaches the text as one price for its line (v2.7136).
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
import { settle } from '../../test/renderSmokeMocks'

const bid = {
  id: 'bid-1',
  project_name: 'Gallenby Park Concession Stand',
  bid_number: '385',
  plans_link: 'https://example.com/plans',
  count_tooling_plans_link: null,
  address: '1 Park Rd, San Antonio TX',
  service_type_id: null,
} as unknown as BidWithBuilder

const starRows = [
  { fixture: 'Toilet', count: 2, unitPrice: 100, revenue: 200, omitFromSubmissionDocuments: false },
  { fixture: 'Mobilize', count: 3, unitPrice: 1500, revenue: 1500, isFixedPrice: true, omitFromSubmissionDocuments: false },
]
const otherRows = [
  { fixture: 'Sink', count: 1, unitPrice: 50, revenue: 50, omitFromSubmissionDocuments: false },
  { fixture: 'Permit', count: 2, unitPrice: 300, revenue: 300, isFixedPrice: true, omitFromSubmissionDocuments: false },
]

function renderBoth() {
  return render(
    <PackageAndSendBidPricingModal
      open
      onClose={vi.fn()}
      bid={bid}
      priceBookVersionId="v-star"
      priceBookVersionName="Value Engineered"
      pricingRows={starRows}
      totalRevenue={1700}
      alsoPrice={{ priceBookVersionId: 'v-viewed', name: 'Written to Plan', rows: otherRows, totalRevenue: 350 }}
      estimatorUsers={[]}
      prefixMap={new Map() as unknown as LedgerPrefixMap}
      currentUserName="Grace"
      onRequestEditBid={vi.fn()}
    />,
  )
}

describe('PackageAndSendBidPricingModal — Send both', () => {
  it('names the pair in the caption and previews one labeled table per price, ★ first', async () => {
    const { baseElement } = renderBoth()
    await settle()
    expect(screen.getByText(/★ Value Engineered \+ Written to Plan/)).toBeTruthy()
    expect(screen.getByText(/both prices, ★ first/)).toBeTruthy()
    const tables = baseElement.querySelectorAll('.package-send-preview table')
    expect(tables.length).toBe(2)
    const preview = (baseElement.querySelector('.package-send-preview') as HTMLElement).textContent ?? ''
    expect(preview.indexOf("★ Value Engineered — customer's price")).toBeGreaterThan(-1)
    expect(preview.indexOf('Written to Plan — second price')).toBeGreaterThan(preview.indexOf('★ Value Engineered'))
  })

  it('Copy for text copies both headings, both totals and each fixed price as one price', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    renderBoth()
    await settle()
    fireEvent.click(screen.getByText('Copy for text'))
    await waitFor(() => expect(screen.getByText(/Text copied to clipboard/)).toBeTruthy())
    const text = writeText.mock.calls[0]?.[0] as string
    expect(text).toContain("★ Value Engineered — customer's price")
    expect(text).toContain('Written to Plan — second price')
    expect(text).toContain('Toilet \u2014 2 \u00d7 $100 = $200')
    expect(text).toContain('Mobilize \u2014 3, fixed price $1,500')
    expect(text).toContain('Permit \u2014 2, fixed price $300')
    expect(text.split('\n').filter((l) => l.startsWith('Total:'))).toEqual(['Total: $1,700', 'Total: $350'])
  })
})
