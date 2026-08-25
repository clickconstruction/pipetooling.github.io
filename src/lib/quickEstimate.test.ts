import { describe, expect, it } from 'vitest'
import {
  formatBallparkUsd,
  parseBallparkDollars,
  quickEstimateBallparkLine,
  quickEstimateCanSend,
  quickEstimateDispatchTitle,
  quickEstimateDraftTitle,
  quickEstimateReferenceSummary,
  quickEstimateReviewRows,
  quickEstimateWorkLine,
  type QuickEstimateSummaryInput,
} from './quickEstimate'

const coInput: QuickEstimateSummaryInput = {
  branch: 'change_order',
  jobLabel: 'HCP 5124 — Herber Custom Homes',
  customerLabel: null,
  description: 'Added a hose bib on the back wall and move the water heater to the attic.',
  photoCount: 2,
  ballparkCents: 100000,
  dispatchNote: 'customer wants it this week',
}

describe('parseBallparkDollars', () => {
  it('accepts plain, comma, dollar, and cents forms', () => {
    expect(parseBallparkDollars('1350')).toBe(135000)
    expect(parseBallparkDollars('$1,350')).toBe(135000)
    expect(parseBallparkDollars(' 250.50 ')).toBe(25050)
  })
  it('rejects garbage, empties, zero, and negatives', () => {
    expect(parseBallparkDollars('')).toBeNull()
    expect(parseBallparkDollars('about a grand')).toBeNull()
    expect(parseBallparkDollars('0')).toBeNull()
    expect(parseBallparkDollars('-50')).toBeNull()
    expect(parseBallparkDollars('1.234')).toBeNull()
  })
})

describe('formatBallparkUsd', () => {
  it('whole dollars stay whole; cents show when carried', () => {
    expect(formatBallparkUsd(135000)).toBe('$1,350')
    expect(formatBallparkUsd(25050)).toBe('$250.50')
  })
})

describe('quickEstimateCanSend', () => {
  it('needs a description or a photo', () => {
    expect(quickEstimateCanSend({ description: '  ', photoCount: 0 })).toBe(false)
    expect(quickEstimateCanSend({ description: 'hose bib', photoCount: 0 })).toBe(true)
    expect(quickEstimateCanSend({ description: '', photoCount: 1 })).toBe(true)
  })
})

describe('quickEstimateReviewRows', () => {
  it('CO branch: Job/Change labels, filled rows, office tail', () => {
    const rows = quickEstimateReviewRows(coInput)
    expect(rows.map((r) => r.label)).toEqual(['Job', 'Change', 'Ballpark', 'Rest'])
    expect(rows[0]!).toMatchObject({ value: 'HCP 5124 — Herber Custom Homes', filled: true })
    expect(rows[1]!.filled).toBe(true)
    expect(rows[1]!.value).toContain('2 photos')
    expect(rows[2]!).toMatchObject({ value: '$1,000', filled: true })
    expect(rows[3]!.value).toContain('Office prices it')
  })
  it('estimate branch skips read as the office to-do', () => {
    const rows = quickEstimateReviewRows({
      branch: 'estimate',
      jobLabel: null,
      customerLabel: null,
      description: 'Yard hydrant for the barn',
      photoCount: 0,
      ballparkCents: null,
      dispatchNote: '',
    })
    expect(rows[0]!).toMatchObject({ label: 'For', value: 'Skipped — in the notes', filled: false })
    expect(rows[2]!).toMatchObject({ value: 'Skipped — office prices it', filled: false })
    expect(rows[3]!.value).toBe('Office finds/creates the customer')
  })
  it('long descriptions truncate with an ellipsis', () => {
    const rows = quickEstimateReviewRows({ ...coInput, description: 'x'.repeat(200), photoCount: 0 })
    expect(rows[1]!.value.length).toBeLessThan(70)
    expect(rows[1]!.value.endsWith('…')).toBe(true)
  })
})

describe('dispatch title + reference summary', () => {
  it('titles by kind and target', () => {
    expect(quickEstimateDispatchTitle(coInput)).toBe(
      'Review field change order — HCP 5124 — Herber Custom Homes',
    )
    expect(
      quickEstimateDispatchTitle({ ...coInput, branch: 'estimate', customerLabel: 'Mike down the road' }),
    ).toBe('Review field estimate — Mike down the road')
    expect(quickEstimateDispatchTitle({ ...coInput, jobLabel: null })).toBe(
      'Review field change order — from the field',
    )
  })
  it('summary mirrors the review rows, note included when present', () => {
    expect(quickEstimateReferenceSummary(coInput)).toBe(
      'Job ✓ | Work ✓ (2 photos) | Ballpark $1,000 | Note: customer wants it this week',
    )
    expect(
      quickEstimateReferenceSummary({
        ...coInput,
        jobLabel: null,
        photoCount: 0,
        ballparkCents: null,
        dispatchNote: '',
      }),
    ).toBe('Job — skipped | Work ✓ | Ballpark — skipped')
  })
})

describe('draft lines + title', () => {
  it('ballpark line is a labeled $0 placeholder', () => {
    expect(quickEstimateBallparkLine(100000)).toEqual({
      line_item: 'Field ballpark: ~$1,000 — to be priced',
      description: '',
      quantity: 1,
      unit_price_cents: 0,
      amount_cents: 0,
    })
  })
  it('estimate work line carries the description at $0', () => {
    const l = quickEstimateWorkLine('  Yard hydrant  ')
    expect(l.description).toBe('Yard hydrant')
    expect(l.amount_cents).toBe(0)
  })
  it('titles: CO untitled, estimate carries the free-typed lead', () => {
    expect(quickEstimateDraftTitle('change_order', 'Mike')).toBe('')
    expect(quickEstimateDraftTitle('estimate', ' Mike down the road ')).toBe(
      'Field estimate — Mike down the road',
    )
    expect(quickEstimateDraftTitle('estimate', '')).toBe('')
  })
})

describe('quickEstimateBackTarget', () => {
  it('walks the stages backwards per branch, no Back on kind/done', async () => {
    const { quickEstimateBackTarget } = await import('./quickEstimate')
    expect(quickEstimateBackTarget('job', 'change_order')).toBe('kind')
    expect(quickEstimateBackTarget('customer', 'estimate')).toBe('kind')
    expect(quickEstimateBackTarget('work', 'change_order')).toBe('job')
    expect(quickEstimateBackTarget('work', 'estimate')).toBe('customer')
    expect(quickEstimateBackTarget('cost', 'change_order')).toBe('work')
    expect(quickEstimateBackTarget('review', 'estimate')).toBe('cost')
    expect(quickEstimateBackTarget('kind', 'change_order')).toBeNull()
    expect(quickEstimateBackTarget('done', 'change_order')).toBeNull()
  })
})
