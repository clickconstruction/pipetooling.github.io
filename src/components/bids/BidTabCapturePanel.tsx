import { useMemo, useState, type CSSProperties } from 'react'

import {
  bidTabNoteLine,
  bidTabRangePosition,
  bidTabSummary,
  deriveBidTabInsight,
  hasAnyBidTabValue,
  parseBidTabCapture,
  type BidTabValues,
} from '../../lib/bidTabCapture'
import {
  buildTabLadder,
  deriveTabSummaryFromEntries,
  markEntryOurs,
  parseBidTabPaste,
  type BidTabEntryDraft,
} from '../../lib/bids/bidTabPaste'

const fieldLabelStyle: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)' }
const fieldInputStyle: CSSProperties = {
  padding: '0.35rem 0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  fontSize: '0.8125rem',
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  font: 'inherit',
  fontVariantNumeric: 'tabular-nums',
}

function moneyFieldText(n: number | null): string {
  return n != null ? String(n) : ''
}

export type BidTabCapturePanelProps = {
  /** Our own `bids.bid_value` — the insight line derives % over the low from it. */
  ourValue: number
  initial: BidTabValues
  saving: boolean
  /** `entries` is non-null only for a paste-mode save (the full per-bidder tab, v2.2296). */
  onSave: (values: BidTabValues, noteLine: string, entries?: BidTabEntryDraft[] | null) => void
  /** Secondary action — "Log without numbers" in call mode, "Cancel" when editing. */
  secondaryLabel: string
  onSecondary: () => void
  /** Clears the recorded tab (rendered only while editing an existing one). Quiet data fix — no history note. */
  onRemove?: () => void
  /** Hide the paste mode where saves are buffered (the call session's one-save model). */
  allowPaste?: boolean
}

/**
 * The bid-tab capture fields (v2.2081): low, high, "#N from the bottom, of M".
 * Phrased the way a GC reads a tab on the phone; every field optional. Shared
 * by the Waiting to hear "Bid tab received" flow and the Why we lost lens.
 */
export function BidTabCapturePanel({ ourValue, initial, saving, onSave, secondaryLabel, onSecondary, onRemove, allowPaste = true }: BidTabCapturePanelProps) {
  const [lowText, setLowText] = useState(() => moneyFieldText(initial.low))
  const [highText, setHighText] = useState(() => moneyFieldText(initial.high))
  const [rankText, setRankText] = useState(() => moneyFieldText(initial.rankFromLow))
  const [countText, setCountText] = useState(() => moneyFieldText(initial.bidderCount))
  // Paste mode (v2.2296): the whole tab from a GC email, one rung per bidder.
  const [mode, setMode] = useState<'fields' | 'paste'>('fields')
  const [pasteText, setPasteText] = useState('')
  const [pasteEntries, setPasteEntries] = useState<BidTabEntryDraft[]>([])
  const [pasteSkipped, setPasteSkipped] = useState<string[]>([])

  const parsed = useMemo(
    () => parseBidTabCapture({ lowText, highText, rankText, countText }),
    [lowText, highText, rankText, countText],
  )
  const insight = useMemo(
    () => (parsed.errors.length === 0 ? deriveBidTabInsight(parsed.values, ourValue) : null),
    [parsed, ourValue],
  )

  const canSave = parsed.errors.length === 0 && hasAnyBidTabValue(parsed.values)

  const pasteLadder = useMemo(() => buildTabLadder(pasteEntries), [pasteEntries])
  const pasteSummary = useMemo(() => deriveTabSummaryFromEntries(pasteEntries), [pasteEntries])
  // Our value on THIS tab: the flagged rung beats bid_value (rounds happen).
  const pasteOurValue = pasteEntries.find((e) => e.isOurs)?.amount ?? ourValue
  const pasteInsight = useMemo(
    () => (pasteEntries.length > 0 ? deriveBidTabInsight(pasteSummary, pasteOurValue) : null),
    [pasteEntries.length, pasteSummary, pasteOurValue],
  )

  const applyPaste = (text: string) => {
    setPasteText(text)
    const { entries, skippedLines } = parseBidTabPaste(text)
    setPasteEntries(entries)
    setPasteSkipped(skippedLines)
  }

  return (
    <div
      style={{
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        background: 'var(--surface)',
        padding: '0.65rem 0.8rem',
        marginBottom: '0.6rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', margin: '0 0 0.45rem' }}>
        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          The bid tab — as the GC reads it
        </p>
        {allowPaste ? (
          <span style={{ display: 'inline-flex', gap: '0.3rem' }}>
            {(['fields', 'paste'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                style={{
                  padding: '0.12rem 0.6rem',
                  borderRadius: 999,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  font: 'inherit',
                  border: mode === m ? '2px solid #2563eb' : '1px solid var(--border-strong)',
                  background: mode === m ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                  color: mode === m ? 'var(--text-blue-700)' : 'var(--text-muted)',
                }}
              >
                {m === 'fields' ? 'Type the numbers' : 'Paste the tab'}
              </button>
            ))}
          </span>
        ) : null}
      </div>
      {allowPaste && mode === 'paste' ? (
        <div>
          <textarea
            value={pasteText}
            onChange={(e) => applyPaste(e.target.value)}
            placeholder={'Paste the project’s lines from the GC’s email…\n$40,500\n$39,919 - Click Plumbing\n$115,000'}
            rows={pasteText ? 3 : 5}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              border: '1px dashed var(--border-strong)',
              borderRadius: 8,
              background: 'var(--bg-subtle)',
              color: 'var(--text-strong)',
              fontSize: '0.8rem',
              fontFamily: 'ui-monospace, Menlo, monospace',
              padding: '0.5rem 0.6rem',
              resize: 'vertical',
            }}
          />
          {pasteEntries.length > 0 ? (
            <>
              <p style={{ margin: '0.5rem 0 0.2rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {pasteEntries.length} bid{pasteEntries.length === 1 ? '' : 's'} found — lowest first.
                {pasteEntries.some((e) => e.isOurs)
                  ? ' We marked the line that says “Click” — tap another rung if that’s wrong.'
                  : ' Tap the rung that’s ours.'}
              </p>
              <div>
                {pasteLadder.map((rung) => {
                  const draftIndex = pasteEntries.findIndex((e) => e === rung || (e.amount === rung.amount && e.isOurs === rung.isOurs && e.bidderName === rung.bidderName))
                  return (
                    <div
                      key={`${rung.rank}-${rung.amount}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.3rem 0.4rem',
                        borderTop: '1px solid var(--border)',
                        fontSize: '0.8125rem',
                        background: rung.isOurs ? 'var(--bg-blue-tint)' : undefined,
                        borderRadius: rung.isOurs ? 6 : undefined,
                      }}
                    >
                      <span style={{ color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums', width: '1.2rem', textAlign: 'right', flexShrink: 0, fontSize: '0.72rem' }}>{rung.rank}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: rung.isOurs ? 'var(--text-blue-700)' : 'var(--text-strong)', width: '5.6rem', flexShrink: 0 }}>
                        ${Math.round(rung.amount).toLocaleString('en-US')}
                      </span>
                      <span style={{ flex: 1, height: 7, borderRadius: 4, background: 'var(--bg-muted)', overflow: 'hidden', minWidth: 40 }}>
                        <span style={{ display: 'block', height: '100%', width: `${rung.widthPct}%`, background: rung.isOurs ? '#2563eb' : rung.rank === 1 ? '#16a34a' : 'var(--border-strong)' }} />
                      </span>
                      {rung.alternateAmount != null ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>alt ${Math.round(rung.alternateAmount).toLocaleString('en-US')}</span>
                      ) : null}
                      {rung.bidderName && !rung.isOurs ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '7rem' }}>{rung.bidderName}</span>
                      ) : null}
                      {rung.isOurs ? (
                        <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '0.05rem 0.4rem', borderRadius: 5, background: '#2563eb', color: 'white', whiteSpace: 'nowrap' }}>OURS</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPasteEntries((prev) => markEntryOurs(prev, draftIndex))}
                          style={{ fontSize: '0.7rem', padding: '0.08rem 0.5rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap', font: 'inherit' }}
                        >
                          ours?
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {bidTabSummary(pasteSummary, pasteOurValue) ?? ''}
              </p>
              {pasteInsight ? (
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: pasteInsight.tone === 'warn' ? 'var(--text-amber-800)' : 'var(--text-emerald-800)' }}>
                  {pasteInsight.line}
                </p>
              ) : null}
            </>
          ) : pasteText.trim() && pasteSkipped.length > 0 ? (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>
              No dollar amounts found yet — lines need a $ amount (or one bare number per line).
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', alignItems: 'center' }}>
            <button
              type="button"
              disabled={saving || pasteEntries.length === 0}
              onClick={() => onSave(pasteSummary, bidTabNoteLine(pasteSummary, pasteOurValue), pasteEntries)}
              style={{
                padding: '0.35rem 0.8rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: 6,
                background: '#3b82f6',
                color: '#fff',
                cursor: saving || pasteEntries.length === 0 ? 'not-allowed' : 'pointer',
                opacity: saving || pasteEntries.length === 0 ? 0.55 : 1,
                font: 'inherit',
              }}
            >
              {saving ? 'Saving…' : 'Save tab'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onSecondary}
              style={{ padding: '0.35rem 0.7rem', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', font: 'inherit' }}
            >
              {secondaryLabel}
            </button>
          </div>
        </div>
      ) : null}
      {(!allowPaste || mode === 'fields') && (
      <div>
      <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={fieldLabelStyle}>Low bid</span>
          <input
            type="text"
            inputMode="decimal"
            value={lowText}
            onChange={(e) => setLowText(e.target.value)}
            placeholder="230k"
            style={{ ...fieldInputStyle, width: '6.5rem' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={fieldLabelStyle}>High bid</span>
          <input
            type="text"
            inputMode="decimal"
            value={highText}
            onChange={(e) => setHighText(e.target.value)}
            placeholder="310k"
            style={{ ...fieldInputStyle, width: '6.5rem' }}
          />
        </label>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={fieldLabelStyle}>We were #</span>
            <input
              type="text"
              inputMode="numeric"
              value={rankText}
              onChange={(e) => setRankText(e.target.value)}
              placeholder="2"
              style={{ ...fieldInputStyle, width: '3rem' }}
            />
          </label>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', paddingBottom: '0.42rem' }}>from the bottom, of</span>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={fieldLabelStyle}>bids on the tab</span>
            <input
              type="text"
              inputMode="numeric"
              value={countText}
              onChange={(e) => setCountText(e.target.value)}
              placeholder="6"
              style={{ ...fieldInputStyle, width: '3rem' }}
            />
          </label>
        </div>
      </div>
      {parsed.errors.length > 0 ? (
        <p style={{ margin: '0.55rem 0 0', fontSize: '0.8125rem', color: 'var(--text-red-800)' }}>{parsed.errors[0]}</p>
      ) : insight ? (
        <p style={{ margin: '0.55rem 0 0', fontSize: '0.8125rem', color: insight.tone === 'warn' ? 'var(--text-amber-800)' : 'var(--text-emerald-800)' }}>
          {insight.line}
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', alignItems: 'center' }}>
        <button
          type="button"
          disabled={saving || !canSave}
          onClick={() => onSave(parsed.values, bidTabNoteLine(parsed.values, ourValue))}
          style={{
            padding: '0.35rem 0.8rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            border: 'none',
            borderRadius: 6,
            background: '#3b82f6',
            color: '#fff',
            cursor: saving || !canSave ? 'not-allowed' : 'pointer',
            opacity: saving || !canSave ? 0.55 : 1,
            font: 'inherit',
          }}
        >
          {saving ? 'Saving…' : 'Save bid tab'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onSecondary}
          style={{
            padding: '0.35rem 0.7rem',
            fontSize: '0.8125rem',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          {secondaryLabel}
        </button>
        {onRemove && hasAnyBidTabValue(initial) ? (
          <button
            type="button"
            disabled={saving}
            onClick={onRemove}
            title="Clear the recorded bid tab from this bid"
            style={{
              marginLeft: 'auto',
              padding: '0.35rem 0.7rem',
              fontSize: '0.75rem',
              border: 'none',
              background: 'none',
              color: 'var(--text-red-800)',
              textDecoration: 'underline',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            Remove bid tab
          </button>
        ) : null}
      </div>
      </div>
      )}
    </div>
  )
}

/**
 * The recorded FULL tab (v2.2296): one rung per bidder, ours highlighted, the
 * rung above ours annotated with the dollar gap. Renders under the summary
 * line only when a paste kept the whole tab; old four-number captures never
 * see it.
 */
export function BidTabEntriesLadder({ entries }: { entries: readonly BidTabEntryDraft[] }) {
  const ladder = buildTabLadder(entries)
  if (ladder.length === 0) return null
  const oursRank = ladder.find((r) => r.isOurs)?.rank ?? null
  return (
    <div style={{ margin: '0.35rem 0 0', maxWidth: '26rem' }}>
      {ladder.map((rung) => (
        <div
          key={`${rung.rank}-${rung.amount}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.22rem 0.4rem',
            fontSize: '0.78rem',
            background: rung.isOurs ? 'var(--bg-blue-tint)' : undefined,
            borderRadius: rung.isOurs ? 6 : undefined,
          }}
        >
          <span style={{ color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums', width: '1.1rem', textAlign: 'right', flexShrink: 0, fontSize: '0.7rem' }}>{rung.rank}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: rung.isOurs ? 'var(--text-blue-700)' : 'var(--text-700)', width: '5.4rem', flexShrink: 0 }}>
            ${Math.round(rung.amount).toLocaleString('en-US')}
          </span>
          <span style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-muted)', overflow: 'hidden', minWidth: 30 }}>
            <span style={{ display: 'block', height: '100%', width: `${rung.widthPct}%`, background: rung.isOurs ? '#2563eb' : rung.rank === 1 ? '#16a34a' : 'var(--border-strong)' }} />
          </span>
          {rung.alternateAmount != null ? (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>alt ${Math.round(rung.alternateAmount).toLocaleString('en-US')}</span>
          ) : null}
          {rung.bidderName && !rung.isOurs ? (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '6.5rem' }}>{rung.bidderName}</span>
          ) : null}
          {rung.isOurs ? (
            <span style={{ fontSize: '0.64rem', fontWeight: 700, padding: '0.04rem 0.38rem', borderRadius: 5, background: '#2563eb', color: 'white', whiteSpace: 'nowrap' }}>OURS</span>
          ) : oursRank != null && rung.rank === oursRank + 1 && rung.gapBelow != null ? (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>+${Math.round(rung.gapBelow).toLocaleString('en-US')}</span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export type BidTabRecordedLineProps = {
  values: BidTabValues
  ourValue: number
  onEdit: () => void
}

/** The recorded tab as one line + a low→high range strip (amber dot = us). */
export function BidTabRecordedLine({ values, ourValue, onEdit }: BidTabRecordedLineProps) {
  const summary = bidTabSummary(values, ourValue)
  if (!summary) return null
  const pos = bidTabRangePosition(values, ourValue)
  return (
    <div style={{ margin: '0.35rem 0 0' }}>
      <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: '0.45rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            padding: '0.1rem 0.5rem',
            borderRadius: 999,
            background: 'var(--bg-emerald-tint)',
            color: 'var(--text-emerald-800)',
            letterSpacing: '0.03em',
          }}
        >
          BID TAB
        </span>
        <span style={{ color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>{summary}</span>
        <button
          type="button"
          onClick={onEdit}
          style={{
            padding: 0,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: 'var(--text-link)',
            textDecoration: 'underline',
            font: 'inherit',
            fontSize: '0.75rem',
          }}
        >
          edit
        </button>
      </p>
      {pos != null ? (
        <div style={{ position: 'relative', height: 14, maxWidth: '20rem', margin: '0.4rem 0 0' }}>
          <div style={{ position: 'absolute', top: 5, left: 0, width: '100%', height: 6, borderRadius: 999, background: 'var(--bg-muted)' }} />
          <span style={{ position: 'absolute', top: 3, left: 0, width: 9, height: 9, borderRadius: 999, background: 'var(--text-green-600)' }} title="Low bid" />
          <span style={{ position: 'absolute', top: 3, right: 0, width: 9, height: 9, borderRadius: 999, background: 'var(--text-muted)' }} title="High bid" />
          <span
            style={{ position: 'absolute', top: 3, transform: 'translateX(-50%)', left: `${pos}%`, width: 9, height: 9, borderRadius: 999, background: 'var(--text-amber-700)', boxShadow: '0 0 0 2px var(--surface)' }}
            title="Our bid"
          />
        </div>
      ) : null}
    </div>
  )
}
