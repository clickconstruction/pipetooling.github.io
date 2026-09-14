import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import type { StagesMoneyBarModel } from '../../lib/stagesMoneyBar'
import type { ProgressPaymentView } from '../../lib/jobs/progressPaymentCell'
import StagesStageBar from './StagesStageBar'
import type { StagesBillSentPctAlert } from '../../lib/jobs/stagesBillSentPctAlert'

const PAID_COLOR = '#16a34a'
const BILLED_COLOR = '#2563eb'
const UNBILLED_COLOR = '#f59e0b'

type StagesProgressPaymentCellProps = {
  model: StagesMoneyBarModel
  /** Current pct_complete (0–100) or null; seeds the editable input / read-only label. */
  pctComplete: number | null
  pctSaving?: boolean
  /**
   * Commit a new pct (null = cleared). Fired on blur / Enter, mirroring the old
   * inline input. Omit to render pct as read-only text (later-stage tables).
   */
  onPctCommit?: (pct: number | null) => void
  /** Optional row-specific detail line (e.g. this row's invoice amount), rendered under the legend. */
  footnote?: React.ReactNode
  /**
   * When the job has no bid value, render "no bid value" as a red clickable
   * box instead of muted text (v2.1082) — clicking should open Edit Job at
   * ① Line Items so the user can add the value. Omit for plain text.
   */
  onNoBidValueClick?: () => void
  /**
   * Mobile cards (v2.1244): swap the four-row legend for one condensed line
   * (Paid · Billed · Unbilled? · Left). The pct control, bar, dot, and no-bid
   * state are unchanged; the table keeps the full legend.
   */
  compact?: boolean
  /**
   * v2.3419 (Where the Job Is): the bar on every row — chips when the job has
   * stages, one bar whose top channel is work and whose bottom channel is the
   * money poured in order, and one line of words. Omitted = the classic money
   * bar with the yellow dot (older callers and tests only).
   */
  view?: ProgressPaymentView | null
  /**
   * v2.3411: a bill has gone out and no percent is recorded — the box wears a
   * red outline, "% done" turns red, and one red line under it names the send
   * day (`stagesBillSentPctAlert`). Null / omitted = the plain box.
   */
  billSentAlert?: StagesBillSentPctAlert | null
  /**
   * v2.3421 (the door): when the view offers it — two or more priced lines the
   * dictionary did not read as stages — a quiet *Set stages* link under the
   * words opens Bill → ① Line Items with the selectors lit. Omit to hide it.
   */
  onSetStagesClick?: () => void
}

function swatch(color?: string) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: 2,
        marginRight: 5,
        background: color ?? 'var(--bg-subtle)',
        border: color ? undefined : '1px solid var(--border)',
        verticalAlign: 'baseline',
      }}
    />
  )
}

/**
 * Merged "Progress & payment" cell body for the Stages tables: editable % +
 * total on top, a paid/unbilled bar of the total bill, and a labeled legend.
 * Pure presentation — all math comes in via the model (see stagesMoneyBar.ts).
 */
export default function StagesProgressPaymentCell({ model, pctComplete, pctSaving, onPctCommit, footnote, onNoBidValueClick, compact = false, view = null, billSentAlert = null, onSetStagesClick }: StagesProgressPaymentCellProps) {
  // The legend's amber and empty rows belong to the classic money reading; on a
  // job drawn as stages the bar already says which stage the money is on.
  const stageBar = view?.mode === 'stages'
  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }
  const labelStyle: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
  const alert = billSentAlert ?? null
  const pctLabelStyle: React.CSSProperties = alert ? { ...labelStyle, color: 'var(--text-red-700)', fontWeight: 600 } : labelStyle
  const amountStyle: React.CSSProperties = { fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }

  return (
    // v2.3446: `width: 100%` + `maxWidth: 100%` — the unified table (Ready to
    // Bill / Billed / Collections) centers this cell in a flex column, where a
    // flex item's width is its content's; the words line is nowrap, so the cell
    // grew to the sentence and spilled under the action buttons. Bounded to the
    // wrapper, the bar and the sentence clip inside the column like the job table.
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '0.2rem' : '0.3rem', minWidth: compact ? 0 : '11rem', width: '100%', maxWidth: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
      <div style={rowStyle}>
        <span style={{ whiteSpace: 'nowrap' }}>
          {onPctCommit ? (
            <>
              <input
                key={`pct-${pctComplete ?? 'null'}`}
                type="number"
                min={0}
                max={100}
                defaultValue={pctComplete != null ? pctComplete : ''}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v === '') {
                    onPctCommit(null)
                    return
                  }
                  const raw = Math.round(Number(v))
                  if (Number.isNaN(raw)) return
                  // Out-of-range entries normalize to the nearest bound (110 → 100)
                  // instead of silently not saving (v2.1928).
                  const n = Math.min(100, Math.max(0, raw))
                  if (n !== raw) e.target.value = String(n)
                  onPctCommit(n)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  }
                }}
                disabled={!!pctSaving}
                placeholder=""
                aria-label="Percent complete"
                aria-invalid={alert ? true : undefined}
                title={alert?.title}
                data-bill-sent-alert={alert ? 'on' : undefined}
                style={{
                  width: '2.75rem',
                  padding: '0.15rem 0.25rem',
                  fontSize: '0.8125rem',
                  textAlign: 'center',
                  border: alert ? '2px solid var(--text-red-600)' : 'none',
                  borderBottom: alert ? '2px solid var(--text-red-600)' : '1px solid var(--border-strong)',
                  borderRadius: alert ? 4 : 0,
                  background: alert ? 'var(--bg-red-tint)' : 'transparent',
                }}
              />
              <span style={pctLabelStyle}> % done</span>
            </>
          ) : pctComplete != null ? (
            <span style={labelStyle}>
              <span style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{pctComplete}</span> % done
            </span>
          ) : alert ? (
            // Read-only viewer (no edit right): the same red box, empty, so the
            // board reads the same for everyone even if only the office can fill it.
            <span style={pctLabelStyle} title={alert.title} data-bill-sent-alert="on">
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: '2.75rem',
                  minHeight: '1.1em',
                  verticalAlign: 'middle',
                  border: '2px solid var(--text-red-600)',
                  borderRadius: 4,
                  background: 'var(--bg-red-tint)',
                }}
              />{' '}
              % done
            </span>
          ) : (
            <span style={labelStyle}>&nbsp;</span>
          )}
        </span>
        {model.hasBar ? (
          <span style={{ ...labelStyle, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {`${formatUsdNoCents(model.total)} bid`}
          </span>
        ) : onNoBidValueClick ? (
          <button
            type="button"
            onClick={onNoBidValueClick}
            title="No bid value on this job — click to open it and add line items"
            style={{
              padding: '0.15rem 0.5rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'white',
              background: '#dc2626',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            no bid value
          </button>
        ) : (
          <span style={{ ...labelStyle, whiteSpace: 'nowrap' }}>no bid value</span>
        )}
      </div>
      {alert ? (
        <div
          data-bill-sent-alert-line
          title={alert.title}
          style={{ fontSize: '0.6875rem', color: 'var(--text-red-700)', lineHeight: 1.2 }}
        >
          {alert.label}
        </div>
      ) : null}

      {view ? (
        <>
          <StagesStageBar view={view} compact={compact} />
          {view.offerSetStages && onSetStagesClick ? (
            <button
              type="button"
              onClick={onSetStagesClick}
              data-set-stages-door
              title="These lines could be stages — open Bill → ① Line Items and set Order on the ones that wait their turn"
              style={{ alignSelf: 'flex-start', padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', fontSize: '0.6875rem', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 2 }}
            >
              Set stages
            </button>
          ) : null}
        </>
      ) : (
      <div
        title={
          model.hasBar
            ? [
                `Paid ${formatUsdNoCents(model.paid)}`,
                model.billedUnpaid > 0 ? `billed but unpaid ${formatUsdNoCents(model.billedUnpaid)}` : null,
                model.doneNotBilled != null
                  ? `done but not billed ${formatUsdNoCents(model.doneNotBilled)} · not done ${formatUsdNoCents(model.notDone ?? 0)}`
                  : 'set % complete to see unbilled work',
                pctComplete != null ? `field progress ${Math.round(pctComplete)}% (yellow dot)` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : [
                'No bid value on this job yet',
                pctComplete != null ? `field progress ${Math.round(pctComplete)}% (yellow dot)` : null,
              ]
                .filter(Boolean)
                .join(' · ')
        }
        style={{ position: 'relative' }}
      >
        {model.hasBar ? (
          <div
            style={{
              display: 'flex',
              height: 10,
              borderRadius: 4,
              overflow: 'hidden',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
            }}
          >
            {model.paidFrac > 0 && <div style={{ width: `${model.paidFrac * 100}%`, background: PAID_COLOR }} />}
            {model.billedFrac > 0 && <div style={{ width: `${model.billedFrac * 100}%`, background: BILLED_COLOR }} />}
            {model.unbilledFrac > 0 && <div style={{ width: `${model.unbilledFrac * 100}%`, background: UNBILLED_COLOR }} />}
          </div>
        ) : (
          <div style={{ height: 10, borderRadius: 4, background: 'var(--bg-subtle)', border: '1px dashed var(--border-strong)' }} />
        )}
        {pctComplete != null ? (
          // Field-progress marker — same yellow dot as the Edit-Job break-off track;
          // sits at pct% across the bar (0% = left edge, 100% = right edge). Work
          // progress is independent of money, so it also renders on the dashed
          // no-bid-value track.
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: `${Math.min(100, Math.max(0, pctComplete))}%`,
              top: '50%',
              width: 10,
              height: 10,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: '#facc15',
              border: '1px solid #ca8a04',
              boxSizing: 'border-box',
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>
      )}

      {compact ? (
        <div
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.1rem 0.3rem', fontSize: '0.75rem' }}
          title="Payments received · invoiced but unpaid · done but not billed · bid minus payments"
        >
          <span style={{ color: '#15803d', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {swatch(PAID_COLOR)}Paid {model.paid > 0 ? formatUsdNoCents(model.paid) : '—'}
          </span>
          <span aria-hidden style={{ color: 'var(--text-faint)' }}>·</span>
          <span style={{ color: 'var(--text-blue-700)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {swatch(BILLED_COLOR)}Billed {model.billedUnpaid > 0 ? formatUsdNoCents(model.billedUnpaid) : '—'}
          </span>
          {!stageBar && model.doneNotBilled != null && model.doneNotBilled > 0 ? (
            <>
              <span aria-hidden style={{ color: 'var(--text-faint)' }}>·</span>
              <span style={{ color: 'var(--text-amber-700)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {swatch(UNBILLED_COLOR)}Done, not billed {formatUsdNoCents(model.doneNotBilled)}
              </span>
            </>
          ) : null}
          <span aria-hidden style={{ color: 'var(--text-faint)' }}>·</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            Left {model.hasBar || model.paid > 0 ? formatUsdNoCents(model.owed) : '—'}
          </span>
        </div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
        {/* Each label leads with ITS OWN slice's share of the job total (slices + the
            un-done remainder sum to 100%): "80% Paid · 20% Billed · 0% Unbilled" reads
            as collected 80%, another 20% billed and waiting, nothing done-but-unbilled. */}
        <div style={rowStyle} title="Payments received on this job; the % is the green slice's share of the job total">
          <span style={{ ...labelStyle, fontVariantNumeric: 'tabular-nums' }}>
            {swatch(PAID_COLOR)}
            {model.hasBar ? `${Math.round(model.paidFrac * 100)}% ` : ''}Paid
          </span>
          <span style={amountStyle}>{model.paid > 0 ? formatUsdNoCents(model.paid) : '—'}</span>
        </div>
        <div style={rowStyle} title="Invoiced to the customer but not yet paid; the % is the blue slice's share of the job total">
          <span style={{ ...labelStyle, fontVariantNumeric: 'tabular-nums' }}>
            {swatch(BILLED_COLOR)}
            {model.hasBar ? `${Math.round(model.billedFrac * 100)}% ` : ''}Billed
          </span>
          <span style={amountStyle}>{model.billedUnpaid > 0 ? formatUsdNoCents(model.billedUnpaid) : '—'}</span>
        </div>
        {/* v2.3416: the amber row prints the amber slice's OWN dollars (done − paid −
            billed), and the empty track gets a row of its own, so the four rows and
            their percents sum to the bid. The old row printed done − paid beside the
            amber percent, which still held the billed money. */}
        {stageBar ? null : (
        <div style={rowStyle} title="Work finished but on no bill yet (% done × bid − paid − billed); the % is the amber slice's share of the job total">
          <span style={{ ...labelStyle, fontVariantNumeric: 'tabular-nums' }}>
            {swatch(UNBILLED_COLOR)}
            {model.hasBar && model.doneNotBilled != null
              ? `${Math.round(model.unbilledFrac * 100)}% `
              : ''}
            Done, not billed
          </span>
          <span style={amountStyle} data-done-not-billed>{model.doneNotBilled != null ? formatUsdNoCents(model.doneNotBilled) : '—'}</span>
        </div>
        )}
        {stageBar || !model.hasBar || model.notDone == null ? null : (
        <div style={rowStyle} title="Work not done yet (bid − % done × bid); the empty part of the bar">
          <span style={{ ...labelStyle, fontVariantNumeric: 'tabular-nums' }}>
            {swatch()}
            {`${Math.max(0, 100 - Math.round(model.paidFrac * 100) - Math.round(model.billedFrac * 100) - Math.round(model.unbilledFrac * 100))}% `}
            Not done
          </span>
          <span style={amountStyle} data-not-done>{formatUsdNoCents(model.notDone)}</span>
        </div>
        )}
        <div
          style={{ ...rowStyle, borderTop: '1px solid var(--border)', paddingTop: '0.15rem' }}
          title="Bid total minus payments received"
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Left on Job</span>
          <span style={{ ...amountStyle, fontWeight: 600 }}>
            {model.hasBar || model.paid > 0 ? formatUsdNoCents(model.owed) : '—'}
          </span>
        </div>
      </div>
      )}
      {footnote != null && (
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'center' }}>{footnote}</div>
      )}
    </div>
  )
}
