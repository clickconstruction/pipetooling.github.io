import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import type { StagesMoneyBarModel } from '../../lib/stagesMoneyBar'
import type { ProgressPaymentView } from '../../lib/jobs/progressPaymentCell'
import { buildJobMoneyBar, MONEY_BAR_TRACK, type MoneyBarBillMark } from '../../lib/jobs/jobMoneyBar'
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
   * The Pipeline row's bar (v2.4351, pass 4): blocks colored by their money, a
   * tick for the % done, stage names under the blocks; with it the % date sits
   * beside the box, the legend leaves out $0 rows and a job with no price shows
   * Add the price. Omitted = the classic money bar with the yellow dot (older
   * callers and tests only).
   */
  view?: ProgressPaymentView | null
  /**
   * v2.3411: a bill has gone out and no percent is recorded — the box wears a
   * red outline, "% done" turns red, and one red line under it names the send
   * day (`stagesBillSentPctAlert`). Null / omitted = the plain box.
   */
  billSentAlert?: StagesBillSentPctAlert | null
  /**
   * v2.3461: every stage chip and the bar open Bill → ① Line Items (the place
   * stages are set — the v2.3421 *Set stages* link is gone). Omit for a bar
   * that only tells.
   */
  onStageClick?: () => void
  /** v2.4353: a bill row's own bill on the bar (`billMarkFor`); null on job rows and single-bill jobs. */
  billMark?: MoneyBarBillMark | null
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
export default function StagesProgressPaymentCell({ model, pctComplete, pctSaving, onPctCommit, footnote, onNoBidValueClick, compact = false, view = null, billSentAlert = null, onStageClick, billMark = null }: StagesProgressPaymentCellProps) {
  // The legend's amber and empty rows belong to the classic money reading; on a
  // job drawn as stages the bar already says which stage the money is on.
  const stageBar = view?.mode === 'stages'
  // v2.4351: with the pass-4 bar, the % date beside the box, no $0 legend rows,
  // and the no-price state in place of the bar.
  const barDate = view ? buildJobMoneyBar(view, { pctComplete }).date : null
  const noPrice = view != null && !model.hasBar
  const hasMoney = (v: number | null | undefined) => v != null && v > 0.005
  /** A legend row prints when the classic bar asks for every row, else only when it carries money. */
  const legendShows = (v: number | null | undefined) => !view || hasMoney(v)
  const legendHidden = noPrice && !hasMoney(model.paid)
  /** What the grey part of the bar holds: the bid less paid, billed and done-not-billed, in the
   *  whole dollars those rows print, so the printed rows add up to the printed bid. */
  const greyUsd = Math.max(0, Math.round(model.total) - Math.round(Math.min(model.paid, model.total)) - Math.round(model.billedUnpaid) - Math.round(model.doneNotBilled ?? 0))
  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }
  // whiteSpace nowrap (v2.3462): a legend label never wraps — "Done, not billed" used to break onto two lines in the 12rem column; the column is 14.5rem now.
  const labelStyle: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }
  const alert = billSentAlert ?? null
  const pctLabelStyle: React.CSSProperties = alert ? { ...labelStyle, color: 'var(--text-red-700)', fontWeight: 600 } : labelStyle
  const amountStyle: React.CSSProperties = { fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }

  return (
    // v2.3446: `width: 100%` + `maxWidth: 100%` — the unified table (Ready to
    // Bill / Billed / Collections) centers this cell in a flex column, where a
    // flex item's width is its content's; the words line is nowrap, so the cell
    // grew to the sentence and spilled under the action buttons. Bounded to the
    // wrapper, the bar and the sentence clip inside the column like the job table.
    <div className="stagesMoney" style={{ display: 'flex', flexDirection: 'column', gap: compact ? '0.2rem' : '0.3rem', minWidth: compact ? 0 : '11rem', width: '100%', maxWidth: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
      {/* v2.4351: the row may wrap — a bid that does not fit beside the % date drops under it, held right.
          v2.4387: the date is its own item, so a long one drops a line or ends in … instead of running out of the cell. */}
      <div style={{ ...rowStyle, flexWrap: 'wrap', gap: view ? '2px 0.3rem' : '2px 0.35rem', justifyContent: view ? 'flex-start' : rowStyle.justifyContent }}>
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
                // v2.4387: no spinner arrows beside the pass-4 bar — they covered "100" in the narrow box.
                className={view ? 'no-spinner' : undefined}
                style={{
                  // v2.4351: 2.25rem (was 2.75) — the % date beside the box keeps a five-figure
                  // bid on the same line. v2.4387: 2rem, spinners off — "$44,000 bid" missed by 3 px.
                  width: view ? '2rem' : '2.75rem',
                  // v2.4128: no vertical padding and a tight line box, so the
                  // underline sits at the number's own bottom edge instead of a
                  // quarter-inch under it, and the "% done · $X bid" row is one text line tall.
                  padding: view ? '0 0.2rem' : '0 0.25rem',
                  lineHeight: 1.15,
                  height: '1.15em',
                  boxSizing: 'content-box',
                  verticalAlign: 'baseline',
                  fontSize: '0.8125rem',
                  textAlign: 'center',
                  border: alert ? '2px solid var(--text-red-600)' : 'none',
                  borderBottom: alert ? '2px solid var(--text-red-600)' : '1px solid var(--border-strong)',
                  borderRadius: alert ? 4 : 0,
                  background: alert ? 'var(--bg-red-tint)' : 'transparent',
                }}
              />
              {/* v2.4387: no space beside the pass-4 box — the centred number leaves room enough. */}
              <span style={pctLabelStyle}>{view ? '% done' : ' % done'}</span>
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
        {barDate && (onPctCommit || pctComplete != null) ? (
          <span
            data-pct-date={barDate.stale ? 'stale' : 'fresh'}
            title={barDate.title}
            style={{ fontSize: '0.6875rem', color: barDate.stale ? 'var(--text-amber-700)' : 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
          >{`· ${barDate.text}`}</span>
        ) : null}
        {model.hasBar ? (
          <span style={{ ...labelStyle, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
            {`${formatUsdNoCents(model.total)} bid`}
          </span>
        ) : noPrice ? null : onNoBidValueClick ? (
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
        noPrice ? (
          // v2.4351: no lines priced — an empty dashed track and the one thing to do, in
          // place of the red pill, a sentence and a legend of dashes.
          <div data-no-price style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <div aria-hidden style={{ height: 12, margin: '3px 0', border: '1.5px dashed var(--border-strong)', borderRadius: 3, boxSizing: 'border-box' }} />
            <div style={{ ...rowStyle, flexWrap: 'wrap', rowGap: 4 }}>
              <span style={labelStyle}>No price yet</span>
              {onNoBidValueClick ? (
                <button
                  type="button"
                  onClick={onNoBidValueClick}
                  title="No line items are priced on this job. Open it at ① Line Items to add them."
                  style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'white', background: '#dc2626', border: 'none', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 'auto' }}
                >
                  Add the price ›
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <StagesStageBar view={view} pctComplete={pctComplete} compact={compact} onStageClick={onStageClick} billMark={billMark} />
        )
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

      {legendHidden ? null : compact ? (
        <div
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.1rem 0.3rem', fontSize: '0.75rem' }}
          title="Payments received · invoiced but unpaid · done but not billed · bid minus payments"
        >
          {[
            legendShows(model.paid) ? (
              <span key="paid" style={{ color: '#15803d', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {swatch(PAID_COLOR)}Paid {model.paid > 0 ? formatUsdNoCents(model.paid) : '—'}
              </span>
            ) : null,
            legendShows(model.billedUnpaid) ? (
              <span key="billed" style={{ color: 'var(--text-blue-700)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {swatch(BILLED_COLOR)}Billed {model.billedUnpaid > 0 ? formatUsdNoCents(model.billedUnpaid) : '—'}
              </span>
            ) : null,
            !stageBar && hasMoney(model.doneNotBilled) ? (
              <span key="done-not-billed" style={{ color: 'var(--text-amber-700)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {swatch(UNBILLED_COLOR)}Done, not billed {formatUsdNoCents(model.doneNotBilled ?? 0)}
              </span>
            ) : null,
            <span key="left" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              Left {model.hasBar || model.paid > 0 ? formatUsdNoCents(model.owed) : '—'}
            </span>,
          ]
            .filter(Boolean)
            .flatMap((item, i) => (i === 0 ? [item] : [<span key={`sep-${i}`} aria-hidden style={{ color: 'var(--text-faint)' }}>·</span>, item]))}
        </div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
        {/* Each label leads with ITS OWN slice's share of the job total (slices + the
            un-done remainder sum to 100%): "80% Paid · 20% Billed · 0% Unbilled" reads
            as collected 80%, another 20% billed and waiting, nothing done-but-unbilled.
            v2.4351: beside the pass-4 bar a row with no money is left out — the rows
            that print still sum to the bid. */}
        {legendShows(model.paid) ? (
        <div style={rowStyle} title="Payments received on this job; the % is the green slice's share of the job total">
          <span style={{ ...labelStyle, fontVariantNumeric: 'tabular-nums' }}>
            {swatch(PAID_COLOR)}
            {model.hasBar ? `${Math.round(model.paidFrac * 100)}% ` : ''}Paid
          </span>
          <span style={amountStyle}>{model.paid > 0 ? formatUsdNoCents(model.paid) : '—'}</span>
        </div>
        ) : null}
        {legendShows(model.billedUnpaid) ? (
        <div style={rowStyle} title="Invoiced to the customer but not yet paid; the % is the blue slice's share of the job total">
          <span style={{ ...labelStyle, fontVariantNumeric: 'tabular-nums' }}>
            {swatch(BILLED_COLOR)}
            {model.hasBar ? `${Math.round(model.billedFrac * 100)}% ` : ''}Billed
          </span>
          <span style={amountStyle}>{model.billedUnpaid > 0 ? formatUsdNoCents(model.billedUnpaid) : '—'}</span>
        </div>
        ) : null}
        {/* v2.3416: the amber row prints the amber slice's OWN dollars (done − paid −
            billed), and the empty track gets a row of its own, so the four rows and
            their percents sum to the bid. The old row printed done − paid beside the
            amber percent, which still held the billed money. */}
        {stageBar || !legendShows(model.doneNotBilled) ? null : (
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
        {/* v2.4387: the grey part's own dollars. With billing ahead of the % the grey is smaller
            than the work not done, and the row read "0% Not done $11,273" beside a bid it overran. */}
        {stageBar || !model.hasBar || model.notDone == null || !legendShows(greyUsd) ? null : (
        <div style={rowStyle} title="Work not done and not billed yet; the grey part of the bar">
          <span style={{ ...labelStyle, fontVariantNumeric: 'tabular-nums' }}>
            {swatch(view ? MONEY_BAR_TRACK : undefined)}
            {`${Math.max(0, 100 - Math.round(model.paidFrac * 100) - Math.round(model.billedFrac * 100) - Math.round(model.unbilledFrac * 100))}% `}
            Not done
          </span>
          <span style={amountStyle} data-not-done>{formatUsdNoCents(greyUsd)}</span>
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
