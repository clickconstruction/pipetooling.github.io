import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import type { BidSchedule } from '../../lib/aiaBidSchedule'
import { bidImportLabel, bidImportWhoseFigure } from '../../lib/bids/jobImportFromBid'
import { BID_CARRY_WORDS, bidStageHoursWhy, bidStageLines, bidStageSplits, defaultBidStageSplitKey, type BidStageLine, type BidStageSplitKey } from '../../lib/bids/jobStagesFromBid'
import type { AwardBidBreakdown } from '../../lib/jobs/awardBaseline'
import type { LineBudgetSettings } from '../../lib/jobs/lineBudgets'
import { Money } from '../Money'

/**
 * How a won bid's price comes onto its job (punch list #397, PR 3).
 *
 * New Job from a bid used to ask one two-button question, *Start the job at $X?*, and Yes put the
 * whole price on one line, *Bid price*. The stages the bid knew were left behind, so the pace
 * card's rail, the Projects board and the stage checklists had nothing to read on the job. This
 * window asks the same question with three answers: as stages, as one line (what Yes did), or
 * start at $0 (what No did).
 *
 * Nothing here writes. The answer goes back to the job form, which lays the lines into Line Items
 * where the office can change every name and amount before the job is saved. The rows, the hours
 * and every word come from `jobStagesFromBid.ts`.
 */

export type BidCarryAnswer = { choice: 'stages'; lines: BidStageLine[] } | { choice: 'one' } | { choice: 'zero' } | { choice: 'cancel' }

export type BidCarryAsk = {
  carryValue: number
  /** The bid's agreed value as a number; null when the figure is what the GC was sent. */
  agreedValue: number | null
  bid: { bid_number: string | null; project_name: string | null }
  /** The chosen GC's name, else the bid's. */
  gcName: string | null
  /** The bid's own schedule of values as lines, when it has one. */
  schedule: BidSchedule | null
  /** The bid's breakdown, for each stage's hours. */
  breakdown: AwardBidBreakdown | null
  /** The customer's kind, which picks the chip that starts lit. */
  customerType: string | null
  settings: LineBudgetSettings
  /**
   * `split` = a job that already exists on one line (PR 4): the stages take that line's place, so
   * the window offers the stages or nothing, and says the job saves with them.
   */
  mode?: 'new' | 'split'
  /** In `split` mode: the name of the line the stages take the place of. */
  lineName?: string
}

type Choice = 'stages' | 'one' | 'zero'

const BLUE = '#2563eb'
const option = (on: boolean): CSSProperties => ({
  display: 'grid',
  gap: '0.45rem',
  width: '100%',
  textAlign: 'left',
  font: 'inherit',
  fontSize: '0.875rem',
  padding: '0.65rem 0.75rem',
  border: `1.5px solid ${on ? BLUE : 'var(--border-strong)'}`,
  borderRadius: 10,
  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: 'var(--text-base)',
})
const radio = (on: boolean): CSSProperties => ({ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${on ? BLUE : 'var(--text-muted)'}`, background: on ? BLUE : 'transparent', boxShadow: on ? 'inset 0 0 0 3px var(--surface)' : undefined, flex: 'none' })
const note: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)' }
const chip = (on: boolean): CSSProperties => ({ font: 'inherit', fontSize: '0.78rem', fontWeight: on ? 700 : 500, padding: '0.2rem 0.65rem', borderRadius: 999, border: `1px solid ${on ? BLUE : 'var(--border-strong)'}`, background: 'var(--surface)', color: on ? 'var(--text-blue-700)' : 'var(--text-base)', cursor: 'pointer' })

export function BidCarryWindow({ ask, onAnswer }: { ask: BidCarryAsk; onAnswer: (answer: BidCarryAnswer) => void }) {
  const splits = useMemo(() => bidStageSplits(ask.schedule), [ask.schedule])
  const [splitKey, setSplitKey] = useState<BidStageSplitKey | null>(() => defaultBidStageSplitKey(splits, ask.customerType))
  const split = splits.find((s) => s.key === splitKey) ?? splits[0] ?? null
  const result = useMemo(
    () => (split ? bidStageLines({ priceUsd: ask.carryValue, split, breakdown: ask.breakdown, settings: ask.settings, bid: ask.bid, agreed: ask.agreedValue != null, figure: ask.mode === 'split' ? BID_CARRY_WORDS.splitFigure : undefined }) : null),
    [split, ask.carryValue, ask.breakdown, ask.settings, ask.bid, ask.agreedValue, ask.mode],
  )
  // Stages can be offered only when a split gives two or more lines; a price too small to split keeps the old two answers.
  const canStage = !!result && result.lines.length >= 2
  const [choice, setChoice] = useState<Choice>(canStage ? 'stages' : 'one')
  const bidLabel = bidImportLabel(ask.bid, 'the bid')
  const splitting = ask.mode === 'split'

  // On the modal stack, so the job form under it leaves Escape to this window.
  const isTopmost = useModalStackEntry()
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || ev.defaultPrevented || !isTopmost()) return
      ev.preventDefault()
      onAnswer({ choice: 'cancel' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onAnswer, isTopmost])

  const confirm = () => {
    if (choice === 'stages' && result && canStage) onAnswer({ choice: 'stages', lines: result.lines })
    else if (splitting) onAnswer({ choice: 'cancel' })
    else onAnswer({ choice: choice === 'zero' ? 'zero' : 'one' })
  }
  const pick = (c: Choice) => () => setChoice(c)
  const head = (c: Choice, words: string) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontWeight: 600 }}>
      <span aria-hidden="true" style={radio(choice === c)} />
      {words}
    </span>
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={BID_CARRY_WORDS.ariaLabel}
      data-testid="bid-carry-window"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
    >
      <div style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, padding: '1.1rem 1.25rem', width: 'min(34rem, 94vw)', maxHeight: 'min(88vh, 100%)', overflowY: 'auto', boxShadow: '0 18px 50px rgba(0,0,0,0.35)', display: 'grid', gap: '0.6rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>{splitting ? BID_CARRY_WORDS.splitTitle(ask.bid.bid_number ? `B${String(ask.bid.bid_number).trim()}` : 'the bid') : BID_CARRY_WORDS.title(ask.carryValue)}</h3>
          <p style={{ margin: 0, ...note }}>{splitting ? BID_CARRY_WORDS.splitSub(ask.lineName ?? '', ask.carryValue) : BID_CARRY_WORDS.whose(bidImportWhoseFigure({ agreedValue: ask.agreedValue, bid: ask.bid, gcName: ask.gcName }))}</p>
        </div>

        {canStage && result && split ? (
          <div role="radio" aria-checked={choice === 'stages'} tabIndex={0} data-testid="bid-carry-stages" onClick={pick('stages')} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), setChoice('stages')) : undefined)} style={{ ...option(choice === 'stages'), cursor: 'pointer' }}>
            {head('stages', BID_CARRY_WORDS.asStages)}
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {splits.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={s.key === split.key}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSplitKey(s.key)
                    setChoice('stages')
                  }}
                  style={chip(s.key === split.key)}
                >
                  {s.label}
                </button>
              ))}
            </span>
            <span style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: '0.25rem 0.9rem', fontVariantNumeric: 'tabular-nums' }}>
              {result.preview.map((row, i) => (
                <span key={`${row.name}-${i}`} data-testid="bid-carry-row" style={{ display: 'contents' }}>
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{row.name}</span>
                  <span style={{ textAlign: 'right', whiteSpace: 'nowrap', color: row.hoursFrom === 'bid' ? 'var(--text-base)' : 'var(--text-muted)' }}>{BID_CARRY_WORDS.hours(row)}</span>
                  <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><Money amount={row.priceUsd} /></span>
                </span>
              ))}
              <span style={{ borderTop: '1px solid var(--border)', paddingTop: '0.25rem', fontWeight: 600 }}>{BID_CARRY_WORDS.total(result)}</span>
              <span style={{ borderTop: '1px solid var(--border)', paddingTop: '0.25rem', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>{Math.round(result.totalHours)} h</span>
              <span data-testid="bid-carry-total" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.25rem', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}><Money amount={result.totalUsd} /></span>
            </span>
            <span style={note}>
              {BID_CARRY_WORDS.dollarsFrom(split, bidLabel)} {BID_CARRY_WORDS.hoursFrom(result, bidLabel, bidStageHoursWhy(ask.breakdown, ask.bid, ask.settings))} {BID_CARRY_WORDS.anyTime}
            </span>
          </div>
        ) : null}

        {splitting ? null : (
          <>
            <button type="button" role="radio" aria-checked={choice === 'one'} data-testid="bid-carry-one" onClick={pick('one')} style={{ ...option(choice === 'one'), cursor: 'pointer' }}>
              {head('one', BID_CARRY_WORDS.asOneLine)}
              <span style={note}>{BID_CARRY_WORDS.oneLineNote(ask.carryValue)}</span>
            </button>

            <button type="button" role="radio" aria-checked={choice === 'zero'} data-testid="bid-carry-zero" onClick={pick('zero')} style={{ ...option(choice === 'zero'), cursor: 'pointer' }}>
              {head('zero', BID_CARRY_WORDS.startAtZero)}
              <span style={note}>{BID_CARRY_WORDS.startAtZeroNote}</span>
            </button>
          </>
        )}

        <p style={{ margin: 0, ...note }}>
          {splitting ? BID_CARRY_WORDS.splitSaves : `${choice !== 'zero' && ask.agreedValue == null ? `${BID_CARRY_WORDS.recordsAgreed} ` : ''}${BID_CARRY_WORDS.changeLater}`}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => onAnswer({ choice: 'cancel' })} style={{ font: 'inherit', fontSize: '0.8125rem', padding: '0.45rem 0.9rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
            {splitting ? BID_CARRY_WORDS.splitKeep : BID_CARRY_WORDS.cancel}
          </button>
          {splitting && !canStage ? null : <button type="button" data-testid="bid-carry-confirm" onClick={confirm} style={{ font: 'inherit', fontSize: '0.875rem', fontWeight: 600, padding: '0.45rem 0.95rem', border: 'none', borderRadius: 6, background: BLUE, color: '#fff', cursor: 'pointer' }}>
            {BID_CARRY_WORDS.confirm(choice, ask.carryValue, result?.lines.length ?? 0)}
          </button>}
        </div>
      </div>
    </div>
  )
}

export default BidCarryWindow
