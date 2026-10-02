import type { CSSProperties, ReactNode } from 'react'
import type { ProgressPaymentView } from '../../lib/jobs/progressPaymentCell'
import { buildJobMoneyBar, MONEY_BAR_TONE, MONEY_BAR_TRACK, stageNameLabel, type MoneyBarBillMark } from '../../lib/jobs/jobMoneyBar'
import { useMeasuredWidth } from '../../hooks/useMeasuredWidth'

/**
 * The Pipeline row's bar (v2.4351, progress bar pass 4). Each block is a line item or a
 * stage, sized by its price, and its money fills it from the left — green paid, blue
 * billed, amber done but not billed, grey not yet — the same meaning each color has in
 * the legend under it and on the Bill tab's money card. A dark tick marks the job's %
 * done (hollow when the % is older than the last day worked). On a stage job the stage
 * names sit under their own blocks, the crew's stage in bold. No words under the bar: the
 * crew and the day they worked are in Crew & Dates, the % date beside the % box.
 *
 * Before v2.4351 it drew work as a blue fill with money as a 3 px line under it, chips
 * above it, and a line of words under it (v2.3198 / v2.3419). Pure presentation over
 * `buildJobMoneyBar`; the only state is the measured width that decides which stage
 * names fit.
 */

/** The bar: a full-width unstyled button around it when it opens Bill. */
function BarShell({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  if (!onClick) return <>{children}</>
  return (
    <button
      type="button"
      onClick={onClick}
      title={STAGE_CLICK_TITLE}
      data-stage-bar
      style={{ display: 'block', width: '100%', padding: 0, margin: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', minWidth: 0 }}
    >
      {children}
    </button>
  )
}

export const STAGE_CLICK_TITLE = 'Open Bill → ① Line Items'

const BAR_HEIGHT = 12
const BLOCK_GAP = 2

function tickStyle(leftPct: number, hollow: boolean): CSSProperties {
  const w = hollow ? 5 : 3
  return {
    position: 'absolute',
    top: 0,
    height: BAR_HEIGHT + 6,
    width: w,
    // Centered on the %; held inside the bar at 0 and 100.
    left: `clamp(0px, calc(${leftPct}% - ${w / 2}px), calc(100% - ${w}px))`,
    borderRadius: 2,
    boxSizing: 'border-box',
    background: hollow ? 'var(--surface)' : 'var(--text-strong)',
    border: hollow ? '1.5px solid var(--text-strong)' : 'none',
    pointerEvents: 'none',
  }
}

export function StagesStageBar({ view, pctComplete, compact = false, onStageClick, billMark = null }: {
  view: ProgressPaymentView
  pctComplete: number | null
  compact?: boolean
  onStageClick?: () => void
  /** v2.4353: on a bill row of a job with two or more bills, which part of the bar is this row's bill (`billMarkFor`). */
  billMark?: MoneyBarBillMark | null
}) {
  const [barRef, barWidth] = useMeasuredWidth<HTMLDivElement>()
  const bar = buildJobMoneyBar(view, { pctComplete })
  if (bar.blocks.length === 0) return null
  const gaps = BLOCK_GAP * (bar.blocks.length - 1)
  const blockPx = (widthPct: number) => (barWidth != null ? Math.max(0, (barWidth - gaps) * (widthPct / 100)) : null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '0.15rem' : '0.2rem', minWidth: 0 }} data-progress-mode={view.mode}>
      <BarShell onClick={onStageClick}>
        <div
          ref={barRef}
          role="img"
          aria-label={view.words.full}
          title={`${bar.blocks.map((b) => b.title).join('\n')}${bar.tick ? `\n${bar.tick.pct}% done${bar.tick.hollow ? ', older than the last day worked' : ''}` : ''}${onStageClick ? `\n${STAGE_CLICK_TITLE}` : ''}`}
          data-money-bar
          style={{ position: 'relative', padding: billMark?.kind === 'bracket' ? '3px 0 9px' : '3px 0', minWidth: 0 }}
        >
          <div style={{ display: 'flex', gap: BLOCK_GAP, height: BAR_HEIGHT, minWidth: 0 }}>
            {bar.blocks.map((b) => (
              <div
                key={b.key}
                title={b.title}
                data-money-block
                style={{ flex: `${b.widthPct} 1 0px`, minWidth: 6, height: BAR_HEIGHT, borderRadius: 3, overflow: 'hidden', display: 'flex', background: MONEY_BAR_TRACK }}
              >
                {b.slices.map((s) => (
                  <span key={s.tone} data-money-slice={s.tone} style={{ width: `${s.pct}%`, background: MONEY_BAR_TONE[s.tone] }} />
                ))}
              </div>
            ))}
          </div>
          {bar.tick ? <span aria-hidden data-progress-tick={bar.tick.hollow ? 'hollow' : 'solid'} style={tickStyle(bar.tick.leftPct, bar.tick.hollow)} /> : null}
          {billMark?.kind === 'bracket' ? (
            <span
              aria-hidden
              data-bill-bracket
              title={billMark.title}
              style={{ position: 'absolute', bottom: 0, height: 6, left: `${billMark.leftPct}%`, width: `${billMark.widthPct}%`, border: '2px solid var(--text-strong)', borderTop: 'none', borderRadius: '0 0 2px 2px', boxSizing: 'border-box' }}
            />
          ) : null}
        </div>
      </BarShell>

      {bar.names ? (
        <div role="list" aria-label="Stages" style={{ display: 'flex', gap: BLOCK_GAP, minWidth: 0, fontSize: '0.65625rem', lineHeight: 1.2 }}>
          {bar.names.map((n) => {
            // On a bill row the stage its bill names is the bold one (v2.4353); else the crew's stage.
            const bold = billMark?.kind === 'stage' ? n.key === billMark.key : n.bold
            return (
            <span
              key={n.key}
              role="listitem"
              title={`Stage ${n.number} · ${n.name}${billMark?.kind === 'stage' && bold ? ` · ${billMark.title}` : n.done ? ' · done' : n.bold ? ' · the crew is on it' : ''}`}
              style={{
                flex: `${n.widthPct} 1 0px`,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: bold ? 700 : 400,
                color: bold ? 'var(--text-strong)' : 'var(--text-muted)',
              }}
            >
              {stageNameLabel(n, blockPx(n.widthPct))}
            </span>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default StagesStageBar
