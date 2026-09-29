import { Fragment, type CSSProperties, type ReactNode } from 'react'
import type { BilledDatesLedger as LedgerModel, LedgerAction, LedgerRow, LedgerSegment, LedgerTone } from '../../lib/jobs/billedDatesLedger'
import { useMeasuredWidth } from '../../hooks/useMeasuredWidth'

/**
 * The dates block under a Billed / Collections row's money legend (v2.4168,
 * redrawn v2.4193): the time bar — the money bar's twin — over rows in the
 * legend's own grammar (a dot, the words, *how far from today* on the right)
 * and one bold verdict under a hairline. Pure presentation — every segment,
 * row and word comes from `buildBilledDatesLedger`. The Expected / They said
 * row opens the promise window; every deadline row and the verdict open the
 * job's Lien window.
 */

const INK: Record<LedgerTone, string> = {
  done: 'var(--text-strong)',
  plain: 'var(--text-strong)',
  green: 'var(--text-green-700)',
  amber: 'var(--text-amber-800)',
  red: 'var(--text-red-700)',
}
const DOT: Record<LedgerTone, string> = {
  done: 'var(--border-strong)',
  plain: 'var(--border-strong)',
  green: '#16a34a',
  amber: '#d97706',
  red: '#dc2626',
}
const LIVE_OUTLINE = '#2563eb'
const HATCH = 'repeating-linear-gradient(135deg, #fca5a5 0 3px, var(--bg-red-tint) 3px 6px)'

const SEGMENT_BG: Record<LedgerSegment['kind'], string> = {
  wait: 'var(--bg-subtle)',
  room: 'var(--bg-green-200)',
  short: HATCH,
  notice: 'var(--bg-amber-100)',
  closed: 'var(--border-strong)',
}
const SEGMENT_LABEL_INK: Record<LedgerSegment['kind'], string> = {
  wait: 'var(--text-700)',
  room: 'var(--text-green-800)',
  short: 'var(--text-red-800)',
  notice: 'var(--text-amber-800)',
  closed: '#ffffff',
}

/** ~9px bold system font: a shade under half an em per glyph, plus the padding. */
const textPx = (text: string) => Math.ceil(text.length * 5.4) + 8

function Dot({ tone, dot }: { tone: LedgerTone; dot: LedgerRow['dot'] }) {
  const color = DOT[tone]
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        boxSizing: 'border-box',
        border: `1.5px solid ${color}`,
        background: dot === 'filled' ? color : 'var(--surface)',
        marginRight: 6,
        flexShrink: 0,
      }}
    />
  )
}

const doorStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, width: '100%', minWidth: 0, padding: 0, border: 'none', background: 'none', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }
const rowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, minWidth: 0, color: 'var(--text-muted)' }

function TimeBar({ bar }: { bar: NonNullable<LedgerModel['bar']> }) {
  const [barRef, barWidth] = useMeasuredWidth<HTMLDivElement>()
  const gapPx = 2
  const totalDays = bar.segments.reduce((s, x) => s + x.days, 0) || 1
  const n = bar.segments.length
  return (
    <div aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }} data-testid="ledger-bar">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6, fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        <span>{bar.startLabel}</span>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{bar.caption}</span>
        <span>{bar.endLabel}</span>
      </div>
      <div ref={barRef} style={{ display: 'flex', gap: gapPx, height: 14, minWidth: 0 }}>
        {bar.segments.map((s) => {
          const segPx = barWidth != null ? Math.max(14, (barWidth - gapPx * (n - 1)) * (s.days / totalDays)) : null
          const usedPct = Math.round(s.usedFrac * 1000) / 10
          // The label sits just past the used fill when it fits there, else against the right edge; hidden when it fits nowhere.
          const fitsAfterUsed = s.label !== '' && (segPx == null || segPx * s.usedFrac + textPx(s.label) <= segPx)
          const showLabel = fitsAfterUsed || (s.label !== '' && segPx != null && textPx(s.label) <= segPx)
          return (
            <div
              key={s.key}
              data-testid="ledger-segment"
              data-segment-kind={s.kind}
              data-segment-live={s.live ? 'true' : undefined}
              style={{
                flex: `${s.days} 1 0px`,
                position: 'relative',
                minWidth: 14,
                height: 14,
                borderRadius: 4,
                background: SEGMENT_BG[s.kind],
                overflow: 'hidden',
                boxSizing: 'border-box',
                outline: s.live ? `1px solid ${LIVE_OUTLINE}` : undefined,
                outlineOffset: -1,
              }}
            >
              {s.usedFrac > 0 && s.kind !== 'closed' ? <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${usedPct}%`, background: 'var(--border-strong)' }} /> : null}
              {showLabel ? (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: fitsAfterUsed ? `calc(${usedPct}% + 4px)` : undefined,
                    right: fitsAfterUsed ? undefined : 4,
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 9,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: SEGMENT_LABEL_INK[s.kind],
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}
                >
                  {s.label}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function BilledDatesLedger({
  ledger,
  evidence,
  onMoney,
  onLienDesk,
  compact = false,
}: {
  ledger: LedgerModel
  /** The customer's pay history line, drawn under the money row. */
  evidence?: ReactNode
  /** Opens They said… / New date… (absent for roles that may not record a promise). */
  onMoney?: () => void
  /** Opens the job's Lien window. */
  onLienDesk?: () => void
  compact?: boolean
}) {
  if (ledger.rows.length === 0) return null
  const handlerFor = (action: LedgerAction | null): (() => void) | undefined => {
    if (action === 'they-said' || action === 'new-date') return onMoney
    if (action === 'lien-desk') return onLienDesk
    return undefined
  }
  const doorTitle = (title: string, action: LedgerAction | null) => `${title}${action === 'they-said' ? ' — click to record what the customer said' : action === 'new-date' ? ' — click to record a new date the customer named' : ' — click to open the Lien window'}`
  const wrap: CSSProperties = { display: 'flex', flexDirection: 'column', gap: compact ? 4 : 5, width: '100%', maxWidth: '100%', marginTop: compact ? '0.35rem' : '0.5rem', fontSize: '0.75rem', lineHeight: 1.35, fontVariantNumeric: 'tabular-nums' }
  const v = ledger.verdict
  const verdictClick = v ? handlerFor(v.action) : undefined
  const verdictBody = v ? (
    <>
      <span style={{ color: v.tone === 'amber' || v.tone === 'red' ? INK[v.tone] : 'var(--text-strong)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.label}</span>
      <span style={{ color: INK[v.tone], whiteSpace: 'nowrap' }}>{v.value}</span>
    </>
  ) : null
  const verdictStyle: CSSProperties = { borderTop: '1px solid var(--border)', paddingTop: 3, marginTop: 1, fontWeight: 600 }
  return (
    <div className="billedDatesLedger" data-testid="billed-dates-ledger" aria-label={ledger.full} style={wrap}>
      {ledger.bar ? <TimeBar bar={ledger.bar} /> : null}
      {ledger.rows.map((r) => {
        const onClick = handlerFor(r.action)
        const valueInk = r.tone === 'done' || r.tone === 'plain' ? 'var(--text-strong)' : INK[r.tone]
        const body = (
          <>
            <span style={{ display: 'flex', alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <Dot tone={r.tone} dot={r.dot} />
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{[r.label, r.joiner, r.date].filter(Boolean).join(' ')}</span>
            </span>
            <span style={{ whiteSpace: 'nowrap', color: valueInk, fontWeight: r.bold || r.tone === 'amber' || r.tone === 'red' ? 600 : 400 }}>{r.far}</span>
          </>
        )
        return (
          <Fragment key={r.key}>
            {onClick ? (
              <button
                type="button"
                data-testid={`ledger-row-${r.key}`}
                title={doorTitle(r.title, r.action)}
                onClick={(e) => {
                  e.stopPropagation()
                  onClick()
                }}
                style={{ ...doorStyle, color: 'var(--text-muted)' }}
              >
                {body}
              </button>
            ) : (
              <div data-testid={`ledger-row-${r.key}`} title={r.title} style={rowStyle}>
                {body}
              </div>
            )}
            {r.sub ? <div style={{ paddingLeft: 14, marginTop: -3, fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</div> : null}
            {r.key === 'money' && evidence ? <div style={{ paddingLeft: 14, marginTop: -3, minWidth: 0 }}>{evidence}</div> : null}
          </Fragment>
        )
      })}
      {v ? (
        verdictClick ? (
          <button type="button" data-testid="ledger-verdict" title={doorTitle(v.title, v.action)} onClick={(e) => { e.stopPropagation(); verdictClick() }} style={{ ...doorStyle, ...verdictStyle }}>
            {verdictBody}
          </button>
        ) : (
          <div data-testid="ledger-verdict" title={v.title} style={{ ...rowStyle, ...verdictStyle }}>
            {verdictBody}
          </div>
        )
      ) : null}
    </div>
  )
}
