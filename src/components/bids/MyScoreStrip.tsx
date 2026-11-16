/**
 * The estimator's own row (team scorecard, punch list #360, PR 5): one line at the top of the Bid Board, *Your score
 * · $42,300 · won above the hurdle on 2 bids*, or while nothing of theirs has scored, *2 of 5 of your priced bids can
 * be scored*. A press opens the sheet: the hurdle as one figure, then their bids by what happened to them, each bid
 * still to finish with its door to Labor. It draws only for a person with a bid in the window.
 */
import { useState, type CSSProperties } from 'react'
import type { EstimatorRow } from '../../lib/scorecard/estimatorScore'
import { MY_SCORE_WORDS as W, myScoreHasAnything, myScoreRowWords, myScoreStripWords } from '../../lib/scorecard/myScore'
import type { EstimatorScoresWire } from '../../lib/scorecard/scorecardWire'
import { PhoneSheet } from '../PhoneSheet'

const MUTED: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.45 }
const HEAD: CSSProperties = { margin: '0.4rem 0 0', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-strong)' }
const ROW: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem 0.75rem', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.7rem', fontSize: '0.875rem', minHeight: 44, boxSizing: 'border-box' }

export default function MyScoreStrip({ read, onOpenLabor }: { read: EstimatorScoresWire | null; /** Opens a bid's Labor tab; a row to finish offers it. */ onOpenLabor?: (bidId: string) => void }) {
  const [open, setOpen] = useState(false)
  if (!read || !myScoreHasAnything(read.estimator)) return null
  const e = read.estimator
  const strip = myScoreStripWords(e)
  const section = (head: string, rows: readonly EstimatorRow[], door = false) =>
    rows.length > 0 ? (
      <>
        <p style={HEAD}>{head}</p>
        {rows.map((r) => (
          <div key={`${head}-${r.bidId}`} style={ROW} data-my-score-row={r.bidId}>
            <span style={{ flex: '1 1 12rem', minWidth: 0 }}>{myScoreRowWords(r)}</span>
            {door && onOpenLabor ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onOpenLabor(r.bidId)
                }}
                style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, minHeight: 36, padding: '0 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }}
              >
                {W.openLabor}
              </button>
            ) : null}
          </div>
        ))}
      </>
    ) : null
  return (
    <>
      <button
        type="button"
        data-testid="my-score-strip"
        onClick={() => setOpen(true)}
        aria-label={`${W.open}: ${strip.figure} ${strip.words}`}
        style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem 0.6rem', flexWrap: 'wrap', width: '100%', textAlign: 'left', font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-700)', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', margin: '0 0 0.6rem', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box' }}
      >
        <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{W.title}</span>
        <b style={{ fontSize: '1rem', color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{strip.figure}</b>
        <span style={{ minWidth: 0 }}>{strip.words}</span>
      </button>
      {open ? (
        <PhoneSheet label={W.title} title={W.title} width={480} onClose={() => setOpen(false)}>
          <div data-testid="my-score-sheet" style={{ padding: '0.75rem 1rem 1rem', overflowY: 'auto', display: 'grid', gap: '0.45rem', minHeight: 0 }}>
            <p style={MUTED}>{W.windowLead(read.windowDays)}</p>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-base)', lineHeight: 1.45 }}>{W.hurdle(read.hurdlePerHourUsd)}</p>
            {section(W.finishHead, e.toFinish, true)}
            {section(W.awardedHead, e.awarded.filter((r) => r.kind === 'counted'))}
            {section(W.closedHead, e.closeouts)}
            {section(W.zeroHead, [...e.underHurdle, ...e.held.filter((r) => !r.needsEstimate)])}
            {section(W.waitingHead, e.waiting)}
          </div>
        </PhoneSheet>
      ) : null}
    </>
  )
}
