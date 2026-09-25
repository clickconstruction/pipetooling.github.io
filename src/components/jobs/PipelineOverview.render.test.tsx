// @vitest-environment jsdom
/**
 * Render-smoke tests for PipelineOverview — the Pipeline's money story strip
 * + Today's Money Opportunities card, focused on the Fix-ups strip (v2.1961).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PipelineOverview } from './PipelineOverview'
import type { StagesHeaderStats } from '../../lib/jobs/stagesHeaderStats'
import { emptyBillTruth } from '../../lib/billing/billTruth'

const stats: StagesHeaderStats = {
  waiting: { count: 17, total: 262300 },
  working: { count: 34, total: 247000 },
  readyToBill: { count: 1, total: 1850 },
  billed: { count: 121, total: 224400 },
  collections: { count: 5, total: 22800 },
  paid: { count: 630 },
  capableToBill: 71969,
  billedAging: { count30_90: 10, sum30_90: 40000, count90: 4, sum90: 44000 },
  collectedByDay: [12000, 30000, 40000, 36000].map((total, i) => ({ dayYmd: `2026-08-0${i + 1}`, total })),
  billedNoDate: 0,
  billTruth: emptyBillTruth(),
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

describe('PipelineOverview payment chase card (v2.2025)', () => {
  it('renders the compact claim, tier why-line, and badge; Start call mode fires onStartChase', () => {
    const onStartChase = vi.fn()
    render(
      <PipelineOverview
        {...props({
          chase: { dueCustomers: 4, dueDollars: 36029, askCount: 3, brokenCount: 1, waitingCount: 1, disputeCount: 2 },
          onStartChase,
        })}
      />,
    )
    // Compact anatomy (v2.2059): one-line claim (badge carries the count),
    // tiers as one plain why line — same shape as every neighbor card.
    expect(screen.getByText("Ask when they'll pay — $36,029")).toBeTruthy()
    expect(screen.getByText('3 customers past expected, never asked · 1 broken promise · 1 waiting · 2 disputes')).toBeTruthy()
    fireEvent.click(screen.getByText('Start call mode →'))
    expect(onStartChase).toHaveBeenCalledOnce()
  })

  it('shows the quiet everyone-asked state at zero due customers', () => {
    render(
      <PipelineOverview
        {...props({
          chase: { dueCustomers: 0, dueDollars: 0, askCount: 0, brokenCount: 0, waitingCount: 2, disputeCount: 0 },
          onStartChase: vi.fn(),
        })}
      />,
    )
    expect(screen.getByText('Payment follow-up · everyone asked')).toBeTruthy()
  })

  it('hides entirely when the chase prop is absent (non-office roles)', () => {
    render(<PipelineOverview {...props()} />)
    expect(screen.queryByText(/Start call mode/)).toBeNull()
  })
})

describe('PipelineOverview lien notices card (v2.3799, punch list #34)', () => {
  const lienNotices = {
    claim: '5 lien notices due · $28,987 — the earliest by Oct 3',
    why: 'In 9 days: the first window closes · 2 to draft · 3 awaiting approval',
    count: 5,
    tone: 'amber' as const,
    title: '5 lien notices due · $28,987',
    piles: [
      { key: 'to_draft' as const, label: '2 to draft', count: 2 },
      { key: 'awaiting' as const, label: '3 awaiting approval', count: 3 },
    ],
    deadline: { label: 'by Oct 3 · in 9 days', tone: 'amber' as const, hover: 'In 9 days: the first window closes — mail by Oct 3 or the lien right on that work is gone', pile: 'awaiting' as const },
  }

  it('two lines (v2.3822): the title with the Lien desk door, then the piles and the deadline as chips that open the desk on their pile', () => {
    const onOpenLienDesk = vi.fn()
    render(<PipelineOverview {...props({ lienNotices, onOpenLienDesk })} />)
    const card = screen.getByTestId('pipeline-lien-notices-card')
    expect(card.textContent).toContain('5 lien notices due · $28,987')
    expect(card.textContent).not.toContain('the earliest by Oct 3')
    // the old sentence survives as the card's hover
    expect(card.getAttribute('title')).toBe('In 9 days: the first window closes · 2 to draft · 3 awaiting approval')
    expect(screen.getAllByTestId('pipeline-lien-pile-chip').map((c) => c.textContent)).toEqual(['2 to draft', '3 awaiting approval'])
    fireEvent.click(screen.getByText('3 awaiting approval'))
    expect(onOpenLienDesk).toHaveBeenLastCalledWith('awaiting')
    const deadline = screen.getByTestId('pipeline-lien-deadline-chip')
    expect(deadline.textContent).toBe('by Oct 3 · in 9 days')
    expect(deadline.getAttribute('title')).toContain('mail by Oct 3')
    fireEvent.click(deadline)
    expect(onOpenLienDesk).toHaveBeenLastCalledWith('awaiting')
    fireEvent.click(screen.getByText('Lien desk →'))
    expect(onOpenLienDesk).toHaveBeenLastCalledWith()
    expect(screen.queryByText('Open the Lien desk →')).toBeNull()
  })

  it('the burn card (v2.3822): the count and the margin on one line, the worst jobs as chips that open their Costs tab', () => {
    const onOpenBurnJob = vi.fn()
    const onShowBurnList = vi.fn()
    const burnAlert = {
      count: 4,
      marginAtRiskUsd: 23_410,
      assumedCount: 1,
      worst: [
        { jobId: 'j878', label: 'J878 Take 5 – Seguin', footing: 'bid' as const, glyph: '◆', spentPct: 88, pct: 60, projectedMarginUsd: 1000, atRiskUsd: 12_000 },
        { jobId: 'j523', label: 'J523 Mission Hills', footing: 'assumed' as const, glyph: '≈', spentPct: 96, pct: 90, projectedMarginUsd: 500, atRiskUsd: 5_019 },
        { jobId: 'j1031', label: 'J1031 Lot 14', footing: 'typed' as const, glyph: '✎', spentPct: 71, pct: 55, projectedMarginUsd: 200, atRiskUsd: 6_391 },
      ],
    }
    render(<PipelineOverview {...props({ burnAlert, onOpenBurnJob, onShowBurnList })} />)
    const card = screen.getByTestId('pipeline-burn-card')
    expect(card.textContent).toContain('4 jobs burning · $23,410 margin at risk')
    expect(card.textContent).not.toContain('Each opens on its Costs tab')
    expect(screen.getAllByTestId('pipeline-burn-job-chip').map((c) => c.textContent)).toEqual([
      '◆ J878 Take 5 – Seguin · 88% spent at 60% done',
      '≈ J523 Mission Hills · 96% spent at 90% done',
      '✎ J1031 Lot 14 · 71% spent at 55% done',
    ])
    fireEvent.click(screen.getByText(/J523 Mission Hills/))
    expect(onOpenBurnJob).toHaveBeenLastCalledWith('j523')
    fireEvent.click(screen.getByTestId('pipeline-burn-more-chip'))
    expect(onShowBurnList).toHaveBeenCalledOnce()
    expect(screen.getByTestId('pipeline-burn-assumed-chip').textContent).toBe('≈ 1 against an assumed budget')
    fireEvent.click(screen.getByText('Worst first →'))
    expect(onOpenBurnJob).toHaveBeenLastCalledWith('j878')
  })

  it('is the only card when nothing else needs a move — the queue is not "clean" with a window closing', () => {
    render(
      <PipelineOverview
        {...props({
          stats: { ...stats, capableToBill: 0, billedAging: { count30_90: 0, sum30_90: 0, count90: 0, sum90: 0 } },
          canOpenAr: false,
          lienNotices,
          onOpenLienDesk: vi.fn(),
        })}
      />,
    )
    expect(screen.queryByText(/nothing needs a move right now/)).toBeNull()
    expect(screen.getByTestId('pipeline-lien-notices-card')).toBeTruthy()
  })

  it('hides when the card is null (nothing due, or a role with no desk) and when no door is given', () => {
    render(<PipelineOverview {...props({ lienNotices: null, onOpenLienDesk: vi.fn() })} />)
    expect(screen.queryByTestId('pipeline-lien-notices-card')).toBeNull()
    render(<PipelineOverview {...props({ lienNotices })} />)
    expect(screen.queryByTestId('pipeline-lien-notices-card')).toBeNull()
  })
})
