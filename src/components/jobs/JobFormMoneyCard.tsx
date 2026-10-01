import type { Ref } from 'react'
import { BILLED_COLOR, DRAFT_COLOR, PAID_COLOR, UNBILLED_COLOR } from './MoneyLifecycleBar'
import type { StageDraw, StagePlan } from '../../lib/jobs/stagePlan'
import type { JobBarSegment, JobDollarCoverage } from '../../lib/jobs/jobSegmentsCoverage'
import { dollarWords, showBillTabLines, type BillTabFigures, type BillTabLine } from '../../lib/jobs/billTabMoney'

/** Stage Plan colors for a block, as the old ② strip drew them (v2.3083): the row's draw, not only its invoice. */
const LATER_COLOR = 'var(--border-strong)'
const WAITS_HATCH = 'repeating-linear-gradient(-45deg, rgba(0,0,0,0.22) 0 4px, transparent 4px 8px)'
const COVER_HATCH = 'repeating-linear-gradient(-45deg, rgba(29,95,165,0.55) 0 5px, transparent 5px 10px)'

function segmentFill(seg: JobBarSegment): string {
  if (seg.kind === 'riders') return 'var(--border-strong)'
  if (seg.status === 'paid') return PAID_COLOR
  if (seg.status === 'billed') return BILLED_COLOR
  if (seg.status === 'ready_to_bill') return DRAFT_COLOR
  return UNBILLED_COLOR
}

function planFill(draw: StageDraw, hasInvoice: boolean): string {
  switch (draw) {
    case 'paid':
      return PAID_COLOR
    case 'billed':
      return BILLED_COLOR
    case 'ready':
      return hasInvoice ? DRAFT_COLOR : UNBILLED_COLOR
    case 'waits':
      return UNBILLED_COLOR
    default:
      return LATER_COLOR
  }
}

export type MoneyCardPicked = {
  count: number
  netDollars: number
  coveredDollars: number
  /** The cents-exact backstop: the picked lines would bill past what is left. */
  over: boolean
}

type JobFormMoneyCardProps = {
  figures: BillTabFigures
  /** Blocks in plan order; one per line, plus the riders. */
  segments: ReadonlyArray<JobBarSegment>
  lines: ReadonlyArray<BillTabLine>
  plan: StagePlan | null
  coverage: JobDollarCoverage | null
  /** % done: committed on blur or Enter (an immediate write, outside the autosave). Omit for a read-only %. */
  onPctCommit?: (pct: number | null) => void
  pctSaving?: boolean
  /** The GC run's "set the % done" door scrolls to and rings this field (v2.3819). */
  pctFocusRef?: Ref<HTMLDivElement>
  pctFocusFlash?: boolean
  selectedIds: ReadonlySet<string>
  onToggleSegment: (key: string) => void
  onBillRow: (fixtureId: string) => void
  billingFixtureId: string | null
  billingDisabled?: boolean
  picked: MoneyCardPicked
  onBillPicked: () => void
  billingPicked: boolean
  /** Split by line (v2.3349): the per-payer drafts the untagged lines would make; null on a job that is not split. */
  payerCarves?: Array<{ party: 'customer' | 'gc'; label: string; count: number; netDollars: number }> | null
  onCarveByPayer?: () => void
  carvingByPayer?: boolean
}

const FOCUS_RING = { borderRadius: 8, background: 'var(--bg-blue-tint)', boxShadow: '0 0 0 2px #93c5fd' } as const

/**
 * Edit Job → Bill, the money card (v2.4307): the job's money said once. Done, Paid, Billed (open),
 * Drafted and Left to bill; one bar with a block per line, colored by where its money is, and the
 * job's % done as a marker across it; then one row per line saying where its work and money stand,
 * with a tick box for a bill of picked lines and Bill it on a stage that is ready. It replaces the
 * ① money bar, the ② striped strip with its rows, and Still to bill. Words are `billTabMoney.ts`.
 */
export function JobFormMoneyCard({
  figures,
  segments,
  lines,
  plan,
  coverage,
  onPctCommit,
  pctSaving = false,
  pctFocusRef,
  pctFocusFlash = false,
  selectedIds,
  onToggleSegment,
  onBillRow,
  billingFixtureId,
  billingDisabled = false,
  picked,
  onBillPicked,
  billingPicked,
  payerCarves = null,
  onCarveByPayer,
  carvingByPayer = false,
}: JobFormMoneyCardProps) {
  const total = segments.reduce((s, seg) => s + seg.dollars, 0)
  const lineByKey = new Map(lines.map((l) => [l.key, l] as const))
  const pct = figures.pctDone
  const showLines = showBillTabLines(lines)
  const blockFill = (seg: JobBarSegment): string => {
    const c = coverage?.bySegmentKey[seg.key]
    if (seg.status === 'unbilled' && c?.fullyCovered) return BILLED_COLOR
    const row = plan && seg.kind === 'line' ? plan.byFixtureId.get(seg.key) : null
    return row ? planFill(row.draw, !!row.invoiceId) : segmentFill(seg)
  }

  return (
    <div className="jobMoneyCard" data-testid="money-card">
      <div className="jobMoneyFigs">
        <div
          className="jobMoneyFig"
          ref={pctFocusRef}
          data-job-form-focus={pctFocusFlash ? 'pct' : undefined}
          style={pctFocusFlash ? FOCUS_RING : undefined}
        >
          <span className="k">Done</span>
          <span className="v" data-testid="money-done">
            {figures.done != null ? dollarWords(figures.done) : '—'}
          </span>
          <label className="jobMoneyPctLabel">
            {onPctCommit ? (
              <input
                key={`pct-${pct ?? 'null'}`}
                className="jobMoneyPct"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                defaultValue={pct != null ? pct : ''}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v === '') {
                    onPctCommit(null)
                    return
                  }
                  const n = Math.round(Number(v))
                  if (!Number.isNaN(n) && n >= 0 && n <= 100) onPctCommit(n)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                }}
                disabled={pctSaving}
                aria-label="Percent complete"
              />
            ) : (
              <span>{pct != null ? pct : '—'}</span>
            )}{' '}
            % done
          </label>
        </div>
        <div className="jobMoneyFig">
          <span className="k">Paid</span>
          <span className="v" style={{ color: 'var(--text-green-800)' }}>
            {dollarWords(figures.paid)}
          </span>
        </div>
        <div className="jobMoneyFig">
          <span className="k">Billed, open</span>
          <span className="v" style={{ color: 'var(--text-blue-700)' }}>
            {dollarWords(figures.billedOpen)}
          </span>
        </div>
        {figures.drafted > 0 ? (
          <div className="jobMoneyFig">
            <span className="k">Drafted</span>
            <span className="v" style={{ color: 'var(--text-blue-700)' }} title="On a bill that has not gone out yet">
              {dollarWords(figures.drafted)}
            </span>
          </div>
        ) : null}
        <div className="jobMoneyFig">
          <span className="k">Left to bill</span>
          <span className="v">{dollarWords(figures.leftToBill)}</span>
        </div>
      </div>

      {segments.length > 0 && total > 0 ? (
        <div className={`jobMoneyBar${pct != null ? ' hasMark' : ''}`}>
          {pct != null ? (
            <span
              className="jobMoneyMarkLabel"
              style={pct < 8 ? { left: 0 } : pct > 92 ? { right: 0 } : { left: `${pct}%`, transform: 'translateX(-50%)' }}
            >
              {pct}% done
            </span>
          ) : null}
          <div className="jobMoneyBlocks">
            {segments.map((seg) => {
              const line = lineByKey.get(seg.key)
              const c = coverage?.bySegmentKey[seg.key]
              const coveredPct = seg.status === 'unbilled' && c && c.coveredDollars > 0 && seg.dollars > 0 ? Math.min(100, (c.coveredDollars / seg.dollars) * 100) : 0
              const isPicked = !!line?.selectable && selectedIds.has(seg.key)
              const row = plan && seg.kind === 'line' ? plan.byFixtureId.get(seg.key) : null
              const name = line?.label ?? seg.label
              const words = line ? [line.workWords, line.moneyWords].filter(Boolean).join(' · ') : ''
              return (
                <button
                  key={seg.key}
                  type="button"
                  className={`jobMoneyBlock${isPicked ? ' picked' : ''}`}
                  disabled={!line?.selectable}
                  onClick={() => onToggleSegment(seg.key)}
                  aria-pressed={line?.selectable ? isPicked : undefined}
                  aria-label={`${name}: ${dollarWords(seg.dollars)}, ${words}${line?.selectable ? (isPicked ? ', picked for a bill' : ', press to pick it for a bill') : ''}`}
                  title={`${name} · ${dollarWords(seg.dollars)} · ${words}`}
                  style={{
                    width: `${(seg.dollars / total) * 100}%`,
                    background: blockFill(seg),
                    backgroundImage: row?.draw === 'waits' && !c?.fullyCovered ? WAITS_HATCH : undefined,
                  }}
                >
                  {coveredPct > 0 ? <span aria-hidden className="cover" style={{ width: `${coveredPct}%`, background: COVER_HATCH }} /> : null}
                </button>
              )
            })}
          </div>
          {pct != null ? <span aria-hidden className="jobMoneyMark" style={{ left: `${pct}%` }} /> : null}
        </div>
      ) : null}

      {figures.doneNotBilled != null && figures.doneNotBilled > 0 ? (
        <div className="jobMoneyDoneNotBilled" data-testid="money-done-not-billed">
          {dollarWords(figures.doneNotBilled)} done, not billed
        </div>
      ) : null}

      {showLines ? (
        <div className="jobMoneyLines" data-testid="money-lines">
          {lines.map((l) => {
            const seg = segments.find((s) => s.key === l.key)
            const busy = billingFixtureId === l.key
            return (
              <div key={l.key} className="jobMoneyLine" data-testid={`money-line-${l.key}`}>
                <span className="tick">
                  {l.selectable ? (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(l.key)}
                      onChange={() => onToggleSegment(l.key)}
                      aria-label={`Pick ${l.label} for a bill`}
                    />
                  ) : (
                    <span aria-hidden className="dot" style={{ background: seg ? blockFill(seg) : 'var(--border-strong)' }} />
                  )}
                </span>
                <span className="what">
                  <b className="nm">{l.label}</b>
                  <span className={`words tone-${l.tone}`}>
                    {l.workWords ? `${l.workWords} · ` : ''}
                    {l.moneyWords}
                  </span>
                </span>
                <b className="amt">{dollarWords(l.amount)}</b>
                {l.billIt ? (
                  <button type="button" className="jobMoneyBillIt" disabled={billingDisabled || busy} onClick={() => onBillRow(l.key)}>
                    {busy ? 'Billing…' : 'Bill it'}
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}

      {picked.count > 0 || (payerCarves && payerCarves.length > 0 && onCarveByPayer) ? (
        <div className="jobMoneyPicked">
          {payerCarves && payerCarves.length > 0 && onCarveByPayer ? (
            <button
              type="button"
              data-testid="carve-by-payer"
              className="jobMoneyPickedBtn"
              onClick={onCarveByPayer}
              disabled={carvingByPayer || billingPicked}
              title="Split by line: one Ready-to-Bill draft per payer from every unbilled line, each already addressed"
            >
              {carvingByPayer
                ? 'Making bills…'
                : `Make ${payerCarves.length} bill${payerCarves.length === 1 ? '' : 's'} by payer — ${payerCarves.map((c) => `${c.label} ${dollarWords(c.netDollars)}`).join(' · ')}`}
            </button>
          ) : null}
          {picked.count > 0 ? (
            <>
              <button type="button" className="jobMoneyPickedBtn" data-testid="bill-picked" onClick={onBillPicked} disabled={billingPicked || picked.over}>
                {billingPicked ? 'Making the bill…' : `Bill the ${picked.count} picked · ${dollarWords(picked.netDollars)}`}
              </button>
              <span className={picked.over ? 'jobMoneyPickedNote over' : 'jobMoneyPickedNote'}>
                {picked.over
                  ? `More than the ${dollarWords(figures.leftToBill)} left to bill. Money already paid or billed covers the rest.`
                  : picked.coveredDollars > 0
                    ? `A draft for what is left on them. The ${dollarWords(picked.coveredDollars)} already covered is taken off.`
                    : 'A draft for exactly these lines. They lock in ① Line Items.'}
              </span>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
