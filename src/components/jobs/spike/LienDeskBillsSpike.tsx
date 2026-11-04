import type { CSSProperties } from 'react'
import { formatUsdNoCents } from '../../../lib/jobs/jobFormatting'
import type { LienCalendarAxis, LienCalendarJob } from '../../../lib/jobs/lienCalendar'
import {
  formatBilledDay,
  spikeBillMarks,
  spikeBillTitle,
  spikeJobBillsWords,
  spikeNoticeWords,
  spikePropertyMoneyWords,
  spikePropertySub,
  type SpikeBill,
  type SpikeBillRow,
  type SpikeBillShape,
  type SpikePropertyGroup,
} from '../../../lib/jobs/spike/lienBillsSpike'
import { LienJobNumber } from '../LienJobNumber'

/**
 * SPIKE (2026-11-04, `to-dos/lien-deadlines-bills-spike/SPIKE.md`): the pieces the Deadlines board
 * draws when the dev toggle is on. Shape A: a property heading per customer-and-address under the GC,
 * its job rows, then the bills behind them as a nested table (number · job · billed day · month ·
 * which notice names it · where it sits on the ruler · open). Shape B: the same property heading, no
 * table — each bill is a mark on its job's own row and its words sit under the job's money.
 * Nothing here ships: the toggle is DEV-only and the kernels live in `lib/jobs/spike/`.
 */

const TONE: Record<'green' | 'amber' | 'red' | 'grey', string> = {
  green: 'var(--text-green-700)',
  amber: 'var(--text-amber-800)',
  red: 'var(--text-red-700)',
  grey: 'var(--text-muted)',
}
/** The board's columns (the tab's own GRID): label, the shared axis, the money. Kept in step by hand in the spike. */
const GRID: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 300px) minmax(0, 1fr) 11rem', alignItems: 'center' }
const LINE_Y = 26
const TRACK_H = 40
const BILL_INK = 'var(--text-700)'
const BILL_PAID_INK = '#15803d'

/** The dev-only toggle on the toolbar: off · A · B. */
export function SpikeBillsToggle({ shape, onPick }: { shape: SpikeBillShape; onPick: (s: SpikeBillShape) => void }) {
  return (
    <span role="group" aria-label="Spike: bills under each GC" data-testid="lien-spike-toggle" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
      <span style={{ whiteSpace: 'nowrap' }}>Spike · bills</span>
      {(['off', 'A', 'B'] as const).map((s) => (
        <button key={s} type="button" aria-pressed={shape === s} onClick={() => onPick(s)} style={{ font: 'inherit', fontSize: '0.6875rem', fontWeight: shape === s ? 700 : 500, padding: '2px 8px', borderRadius: 999, border: `1px solid ${shape === s ? 'var(--border-blue)' : 'var(--border)'}`, background: shape === s ? 'var(--bg-blue-tint)' : 'var(--surface)', color: shape === s ? 'var(--text-700)' : 'var(--text-muted)', cursor: 'pointer' }}>
          {s === 'off' ? 'off' : `shape ${s}`}
        </button>
      ))}
    </span>
  )
}

/**
 * The property heading: a fold, the address, the customer and the counts; the money column carries the
 * sub-group's open total (the same figures its job rows add to) and what the bills owe and were paid.
 */
export function SpikePropertyHeader({ g, open, onToggle, phone }: { g: SpikePropertyGroup; open: boolean; onToggle: () => void; phone?: boolean }) {
  const words = spikePropertyMoneyWords(g)
  if (phone) {
    return (
      <button type="button" aria-expanded={open} onClick={onToggle} data-testid="lien-spike-property" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0 10px', alignItems: 'center', width: '100%', minHeight: 44, padding: '6px 12px', border: 'none', borderTop: '1px solid var(--border-strong)', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span aria-hidden style={{ color: 'var(--text-muted)', marginRight: 6 }}>{open ? '▾' : '▸'}</span>
            {g.label}
          </span>
          <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingLeft: 16 }}>{spikePropertySub(g)}</span>
        </span>
        <span style={{ textAlign: 'right' }}>
          <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(g.totals.open)}</span>
          <span style={{ display: 'block', fontSize: '0.625rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{words}</span>
        </span>
      </button>
    )
  }
  return (
    <div style={{ ...GRID, background: 'var(--bg-muted)', borderTop: '1px solid var(--border-strong)', borderBottom: '1px solid var(--border)', minHeight: 40 }} data-testid="lien-spike-property">
      <button type="button" aria-expanded={open} onClick={onToggle} style={{ textAlign: 'left', border: 'none', background: 'none', padding: '4px 10px 4px 18px', display: 'flex', gap: 8, alignItems: 'center', minWidth: 0, cursor: 'pointer', color: 'inherit', width: '100%', font: 'inherit' }}>
        <span aria-hidden style={{ color: 'var(--text-muted)' }}>{open ? '▾' : '▸'}</span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.label}</span>
          <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{spikePropertySub(g)}</span>
        </span>
      </button>
      <div />
      <div style={{ padding: '0 14px', textAlign: 'right' }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(g.totals.open)}</div>
        <div title={words} style={{ fontSize: '0.625rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{words}</div>
      </div>
    </div>
  )
}

/** Shape A: the bills behind a property's jobs as a nested table, each row on the board's three columns. */
export function SpikeBillsTable({ g, axis, open, onToggle, onOpenJob, onOpenJobWindow }: { g: SpikePropertyGroup; axis: LienCalendarAxis; open: boolean; onToggle: () => void; onOpenJob: (jobId: string) => void; onOpenJobWindow?: (jobId: string) => void }) {
  const n = g.totals.bills
  return (
    <div data-testid="lien-spike-bills-table" style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{ ...GRID, minHeight: 26, background: 'var(--surface)' }}>
        <button type="button" aria-expanded={open} onClick={onToggle} style={{ textAlign: 'left', border: 'none', background: 'none', padding: '3px 10px 3px 30px', display: 'flex', gap: 6, alignItems: 'center', font: 'inherit', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer' }}>
          <span aria-hidden style={{ color: 'var(--text-muted)' }}>{open ? '▾' : '▸'}</span>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{n === 0 ? 'No bill sent on these jobs yet' : `${n} ${n === 1 ? 'bill' : 'bills'} behind these jobs`}</span>
        </button>
        <div />
        <div style={{ padding: '0 14px', textAlign: 'right', fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{open && n > 0 ? 'bill · job · billed · notice' : n > 0 ? `${formatUsdNoCents(g.totals.billsOpen)} open` : null}</div>
      </div>
      {open
        ? g.bills.map((r) => <SpikeBillTableRow key={r.bill.invoiceId} r={r} axis={axis} onOpen={() => onOpenJob(r.job.jobId)} onOpenJob={onOpenJobWindow ? () => onOpenJobWindow(r.job.jobId) : undefined} />)
        : null}
    </div>
  )
}

function SpikeBillTableRow({ r, axis, onOpen, onOpenJob }: { r: SpikeBillRow; axis: LienCalendarAxis; onOpen: () => void; onOpenJob?: () => void }) {
  const { bill, job, notice } = r
  const nw = spikeNoticeWords(notice, bill.settled)
  const offAxis = Boolean(bill.sentYmd) && bill.sentYmd < axis.startYmd
  const pct = bill.sentYmd ? (offAxis ? 0 : axis.pct(bill.sentYmd)) : null
  const settled = bill.settled
  return (
    <div role="row" data-testid="lien-spike-bill-row" style={{ ...GRID, minHeight: 30, background: 'var(--surface)', borderTop: '1px dashed var(--border)', color: settled ? 'var(--text-muted)' : undefined }}>
      <div onClick={onOpen} title="Open the job’s Lien window" style={{ minWidth: 0, padding: '3px 10px 3px 44px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', cursor: 'pointer' }}>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' }}>{bill.number}</span>
        <LienJobNumber number={job.number} muted onOpen={onOpenJob} />
        <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{bill.sentYmd ? formatBilledDay(bill.sentYmd) : 'no day'}</span>
        <span style={{ color: TONE[nw.tone], fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{nw.text}</span>
      </div>
      <div style={{ position: 'relative', height: 30 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 15, height: 1, borderTop: '1px dotted var(--border-strong)' }} />
        {pct != null ? (
          <span role="img" aria-label={spikeBillTitle(r)} title={spikeBillTitle(r)} style={{ position: 'absolute', left: `calc(${pct}% - 5px)`, top: 10, width: 10, height: 10, borderRadius: 2, transform: 'rotate(45deg)', background: settled ? 'var(--surface)' : BILL_INK, border: `2px solid ${settled ? BILL_PAID_INK : BILL_INK}`, boxSizing: 'border-box' }} />
        ) : null}
        {pct != null && offAxis ? <span style={{ position: 'absolute', left: 10, top: 9, fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>◂ {formatBilledDay(bill.sentYmd)}</span> : null}
        {notice.ymd && !offAxis ? <span aria-hidden style={{ position: 'absolute', left: `${axis.pct(notice.ymd)}%`, top: 11, width: 0, height: 8, borderLeft: `2px solid ${TONE[nw.tone]}`, opacity: 0.7 }} /> : null}
      </div>
      <div style={{ padding: '0 14px', textAlign: 'right', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
        {settled ? <span>{formatUsdNoCents(bill.billed)} · paid</span> : bill.paid > 0 ? <span>{formatUsdNoCents(bill.owed)} <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>of {formatUsdNoCents(bill.billed)}</span></span> : <span>{formatUsdNoCents(bill.owed)}</span>}
      </div>
    </div>
  )
}

/** Shape B: a job's bills as marks under its own track line, over the track the row already draws. */
export function SpikeBillMarksLayer({ job, bills, axis, onOpen }: { job: LienCalendarJob; bills: ReadonlyArray<SpikeBill> | undefined; axis: LienCalendarAxis; onOpen: () => void }) {
  const marks = spikeBillMarks(job, bills, axis)
  if (marks.length === 0) return null
  return (
    <div aria-hidden={false} data-testid="lien-spike-bill-marks" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: TRACK_H, pointerEvents: 'none' }}>
      {marks.map((m) => {
        const title = spikeBillTitle(m)
        return (
          <button key={m.bill.invoiceId} type="button" aria-label={title} title={title} onClick={onOpen} style={{ position: 'absolute', left: m.offAxis ? 2 : `calc(${m.pct}% - 4px)`, top: LINE_Y - 4, width: 8, height: 8, padding: 0, borderRadius: 2, transform: 'rotate(45deg)', background: m.bill.settled ? 'var(--surface)' : BILL_INK, border: `2px solid ${m.bill.settled ? BILL_PAID_INK : BILL_INK}`, boxSizing: 'border-box', cursor: 'pointer', pointerEvents: 'auto', zIndex: 2 }} />
        )
      })}
    </div>
  )
}

/** Shape B: the line under a job's money. */
export function SpikeJobBillsLine({ bills }: { bills: ReadonlyArray<SpikeBill> | undefined }) {
  const words = spikeJobBillsWords(bills)
  return (
    <div data-testid="lien-spike-job-bills" title={bills?.map((b) => `${b.number} · ${formatUsdNoCents(b.owed)}${b.sentYmd ? ` · ${formatBilledDay(b.sentYmd)}` : ''}${b.settled ? ' · paid' : ''}`).join('\n')} style={{ fontSize: '0.625rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
      {bills && bills.length ? <span aria-hidden style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 1, transform: 'rotate(45deg)', background: BILL_INK, flex: 'none' }} /> : null}
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{words}</span>
    </div>
  )
}

/** Phone, shape A: one line per bill under the property's jobs. */
export function SpikeBillsPhoneList({ g, onOpenJob }: { g: SpikePropertyGroup; onOpenJob: (jobId: string) => void }) {
  if (g.totals.bills === 0) return <div style={{ padding: '6px 12px 8px', fontSize: '0.6875rem', color: 'var(--text-muted)', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>No bill sent on these jobs yet.</div>
  return (
    <div data-testid="lien-spike-bills-phone" style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ padding: '5px 12px 2px', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        {g.totals.bills} {g.totals.bills === 1 ? 'bill' : 'bills'} · {formatUsdNoCents(g.totals.billsOpen)} open
      </div>
      {g.bills.map((r) => {
        const nw = spikeNoticeWords(r.notice, r.bill.settled)
        return (
          <div key={r.bill.invoiceId} role="row" onClick={() => onOpenJob(r.job.jobId)} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0 8px', padding: '4px 12px 4px 20px', fontSize: '0.75rem', borderTop: '1px dashed var(--border)', cursor: 'pointer', color: r.bill.settled ? 'var(--text-muted)' : undefined }}>
            <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{r.bill.number}</strong> · {r.job.number}
              {r.bill.sentYmd ? ` · ${formatBilledDay(r.bill.sentYmd)}` : ''}
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.bill.settled ? `${formatUsdNoCents(r.bill.billed)} paid` : formatUsdNoCents(r.bill.owed)}</span>
            <span style={{ gridColumn: '1 / -1', fontSize: '0.6875rem', color: TONE[nw.tone], fontWeight: 600 }}>{nw.text}</span>
          </div>
        )
      })}
    </div>
  )
}
