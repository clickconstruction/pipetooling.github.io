import { describe, expect, it } from 'vitest'
import { costToWinByEstimator, costToWinByGc, costToWinRows, costToWinTotal, costToWinWords } from './bidCostToWin'
import type { PursuitRow } from './bidPursuit'

const row = (o: Partial<PursuitRow> & { bidId: string }): PursuitRow => ({
  label: o.bidId, projectName: o.bidId, bidNumber: null, estimatorName: null, gcName: null, outcome: 'open', dateYmd: '2026-08-01', robot: false,
  hours: 0, laborUsd: 0, cardUsd: 0, materialsUsd: 0, totalUsd: 0, bidValue: null, usdPerThousandBid: null, people: [], ...o,
})

// William: two open with time, one won with no time, one lost with time. Wendi: one won with time, one lost without. A bid with no estimator.
const rows: PursuitRow[] = [
  row({ bidId: 'w1', estimatorName: 'William', gcName: 'Summit GC', hours: 19.8, totalUsd: 494.99, bidValue: 148000 }),
  row({ bidId: 'w2', estimatorName: 'William', gcName: 'TCT Construction', hours: 18.25, totalUsd: 456.1, bidValue: 380000 }),
  row({ bidId: 'w3', estimatorName: 'William', gcName: 'Summit GC', outcome: 'won', bidValue: 153000 }),
  row({ bidId: 'w4', estimatorName: 'William', gcName: 'Summit GC', outcome: 'lost', hours: 7, totalUsd: 175, bidValue: 90000 }),
  row({ bidId: 'e1', estimatorName: 'Wendi', gcName: 'Summit GC', outcome: 'won', hours: 9.1, totalUsd: 136.48, bidValue: 38000 }),
  row({ bidId: 'e2', estimatorName: 'Wendi', outcome: 'lost', bidValue: 95000 }),
  row({ bidId: 'n1', outcome: 'unsent', hours: 4.83, totalUsd: 121.66 }),
]

describe('costToWinByEstimator', () => {
  it('counts every bid, spends only the clocked ones, and prices the win', () => {
    const [william, wendi, none] = costToWinByEstimator(rows)
    expect(william).toMatchObject({ label: 'William', bids: 4, bidsWithTime: 3, won: 1, lost: 1, open: 2, unsent: 0, wonValue: 153000, lostValue: 90000 })
    expect(william!.hours).toBeCloseTo(45.05, 2)
    expect(william!.usd).toBeCloseTo(1126.09, 2)
    expect(william!.hitRateByValue).toBeCloseTo(153000 / 243000, 6)
    expect(william!.usdPerThousandWon).toBeCloseTo(1126.09 / 153, 4)
    expect(wendi).toMatchObject({ label: 'Wendi', bids: 2, bidsWithTime: 1, won: 1, lost: 1, wonValue: 38000, lostValue: 95000 })
    expect(wendi!.usdPerThousandWon).toBeCloseTo(136.48 / 38, 4)
    expect(none).toMatchObject({ label: 'No estimator', bids: 1, unsent: 1, hitRateByValue: null, usdPerThousandWon: null })
  })
  it('groups by GC the same way and the footer folds everyone', () => {
    const byGc = costToWinByGc(rows)
    expect(byGc.map((r) => `${r.label} ${r.bids}`)).toEqual(['Summit GC 4', 'TCT Construction 1', 'No GC 2'])
    expect(byGc[0]).toMatchObject({ won: 2, lost: 1, open: 1, wonValue: 191000 })
    const t = costToWinTotal(rows)
    expect(t).toMatchObject({ label: 'Everyone', bids: 7, bidsWithTime: 5, won: 2, lost: 2, open: 2, unsent: 1, wonValue: 191000, lostValue: 185000 })
    expect(t.usd).toBeCloseTo(1384.23, 2)
    expect(costToWinRows(rows, 'gc')).toEqual(byGc)
  })
  it('words the tile', () => {
    expect(costToWinWords(costToWinTotal(rows))).toBe('$7.25 spent per $1k won')
    expect(costToWinWords(costToWinTotal([rows[0]!]))).toBe('nothing won yet in this window')
    expect(costToWinWords(costToWinTotal([rows[2]!]))).toBe('won without clocked time')
    expect(costToWinWords(costToWinTotal([]))).toBe('no pursuit time in this window')
  })
})
