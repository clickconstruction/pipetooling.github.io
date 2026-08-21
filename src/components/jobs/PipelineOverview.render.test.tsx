// @vitest-environment jsdom
/**
 * Render-smoke tests for PipelineOverview — the New view's money story strip
 * + Today's Money Opportunities card, focused on the Fix-ups strip (v2.1961).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PipelineOverview } from './PipelineOverview'
import type { StagesHeaderStats } from '../../lib/jobs/stagesHeaderStats'

const stats: StagesHeaderStats = {
  waiting: { count: 17, total: 262300 },
  working: { count: 34, total: 247000 },
  readyToBill: { count: 1, total: 1850 },
  billed: { count: 121, total: 224400 },
  collections: { count: 5, total: 22800 },
  paid: { count: 630 },
  capableToBill: 71969,
  billedAging: { count30_90: 10, sum30_90: 40000, count90: 4, sum90: 44000 },
  collectedByWeek: [12000, 30000, 40000, 36000].map((total, i) => ({ weekStart: `2026-08-0${i + 1}`, total })),
  billedNoDate: 0,
}

function props(over: Partial<Parameters<typeof PipelineOverview>[0]> = {}) {
  return {
    stats,
    canOpenAr: true,
    canSeeCharts: true,
    canSeeCollected: true,
    arUnallocatedCount: 0,
    onOpenCapable: vi.fn(),
    onOpenBilledBreakdown: vi.fn(),
    onOpenProfitChart: vi.fn(),
    onOpenAr: vi.fn(),
    onFocusSection: vi.fn(),
    onChase90: vi.fn(),
    onFixDates: vi.fn(),
    fixupCounts: { noCustomer: 0, noPictures: 0, noEmail: 0 },
    onFixup: vi.fn(),
    ...over,
  }
}

describe('PipelineOverview fix-ups strip', () => {
  it('renders a chip per non-zero count and routes clicks by key', () => {
    const onFixup = vi.fn()
    render(<PipelineOverview {...props({ fixupCounts: { noCustomer: 1, noPictures: 3, noEmail: 2 }, onFixup })} />)
    expect(screen.getByText('Fix-ups — missing data blocks billing')).toBeTruthy()
    expect(screen.getByText('No customer pictures · 3')).toBeTruthy()
    fireEvent.click(screen.getByText('No customer · 1'))
    fireEvent.click(screen.getByText('No email · 2'))
    expect(onFixup).toHaveBeenNthCalledWith(1, 'no-customer')
    expect(onFixup).toHaveBeenNthCalledWith(2, 'no-email')
  })

  it('hides the whole strip when every count is zero', () => {
    render(<PipelineOverview {...props()} />)
    expect(screen.queryByText(/Fix-ups —/)).toBeNull()
  })

  it('strip still renders under an otherwise-empty opportunities queue', () => {
    render(
      <PipelineOverview
        {...props({
          stats: {
            ...stats,
            capableToBill: 0,
            billedAging: { count30_90: 0, sum30_90: 0, count90: 0, sum90: 0 },
          },
          fixupCounts: { noCustomer: 0, noPictures: 0, noEmail: 4 },
          canOpenAr: false,
        })}
      />,
    )
    expect(screen.queryByText(/nothing needs a move right now/)).toBeNull()
    expect(screen.getByText('No email · 4')).toBeTruthy()
  })
})
