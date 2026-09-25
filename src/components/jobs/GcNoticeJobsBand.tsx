import { useMemo, useState, type CSSProperties } from 'react'
import type { GcOnNoticeData } from '../../hooks/useGcOnNoticeData'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { progressPaymentForJob } from '../../lib/jobs/progressPaymentForJob'
import { jobWindowTiles } from '../../lib/jobs/jobWindowBar'
import { buildEditJobBillingBar } from '../../lib/jobs/editJobBillingBar'
import {
  buildGcNoticeBand,
  GC_NOTICE_BAND_ORDERS,
  gcNoticeBandStageWords,
  type GcNoticeBandDoor,
  type GcNoticeBandJobInput,
  type GcNoticeBandLine,
  type GcNoticeBandOrder,
  type GcNoticeBandRow,
  type GcNoticeBandStage,
} from '../../lib/jobs/gcNoticeJobsBand'
import StagesProgressPaymentCell from './StagesProgressPaymentCell'

/**
 * Put a GC on notice — "The jobs, by stage" (v2.3819, punch list #43): the
 * band between the brief and Step 1. Every job with unpaid work under the GC,
 * grouped by the stage on record, each with its line items and the money
 * poured onto them, the Pipeline's own Progress & payment cell, the Job
 * window's three tiles, and one or two chips saying what looks wrong — each a
 * door into the Job window on the field that fixes it. The kernel is
 * `gcNoticeJobsBand`; the modal owns the data and the doors.
 */
export type GcNoticeJobsBandProps = {
  data: GcOnNoticeData
  todayYmd: string
  isMobile: boolean
  /** The row → the Job window on its Job tab. Falls back to the Edit door when absent. */
  onOpenJob?: (jobId: string) => void
  /** A chip, a line or the bar → the Job window on the field that fixes it. */
  onOpenEditJob: (jobId: string, focus: Exclude<GcNoticeBandDoor, 'job'>) => void
}

const ORDER_KEY = 'gcNoticeBandOrder'
const OPEN_KEY = 'gcNoticeBandOpen'

function readStored<T extends string>(key: string, allowed: ReadonlyArray<T>, fallback: T): T {
  try {
    const v = window.localStorage.getItem(key)
    return v && (allowed as ReadonlyArray<string>).includes(v) ? (v as T) : fallback
  } catch {
    return fallback
  }
}
function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* per-browser convenience only */
  }
}

const faint: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', overflow: 'hidden' }
const th: CSSProperties = { textAlign: 'left', fontSize: '0.69rem', fontWeight: 600, color: 'var(--text-muted)', padding: '7px 12px', background: 'var(--bg-subtle)', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '9px 12px', borderTop: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.8125rem' }
const linkBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.75rem', color: 'var(--text-link)', fontWeight: 600 }
const stageChip = (stage: GcNoticeBandStage): CSSProperties => {
  const c =
    stage === 'working'
      ? { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)' }
      : stage === 'billed' || stage === 'ready_to_bill'
        ? { bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-700)' }
        : stage === 'collections'
          ? { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)' }
          : { bg: 'var(--bg-muted)', fg: 'var(--text-700)' }
  return { display: 'inline-block', padding: '0 6px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 700, lineHeight: '18px', whiteSpace: 'nowrap', background: c.bg, color: c.fg }
}
const readingChip = (tone: 'red' | 'amber'): CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 6,
  fontSize: '0.72rem',
  fontWeight: 700,
  lineHeight: 1.3,
  textAlign: 'left',
  cursor: 'pointer',
  font: 'inherit',
  border: `1px solid ${tone === 'red' ? 'var(--border-red, #fca5a5)' : 'var(--border-amber)'}`,
  background: tone === 'red' ? 'var(--bg-red-tint)' : 'var(--bg-amber-tint)',
  color: tone === 'red' ? 'var(--text-red-600)' : 'var(--text-amber-800)',
})
const LINE_STATE_WORDS: Record<GcNoticeBandLine['state'], { words: string; bg: string; fg: string }> = {
  paid: { words: 'paid', bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)' },
  billed: { words: 'billed', bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-700)' },
  part: { words: 'part paid · part billed', bg: 'var(--bg-muted)', fg: 'var(--text-700)' },
  done: { words: 'done · not billed', bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' },
  todo: { words: 'not started', bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
}

function lineStateWords(l: GcNoticeBandLine): string {
  if (l.state === 'part') {
    const parts = [l.paid > 0.5 ? `${formatUsdNoCents(l.paid)} paid` : null, l.billed > 0.5 ? `${formatUsdNoCents(l.billed)} billed` : null, l.done > 0.5 ? `${formatUsdNoCents(l.done)} done` : null].filter(Boolean)
    return parts.join(' · ') || LINE_STATE_WORDS.part.words
  }
  return LINE_STATE_WORDS[l.state].words
}

export default function GcNoticeJobsBand({ data, todayYmd, isMobile, onOpenJob, onOpenEditJob }: GcNoticeJobsBandProps) {
  const [order, setOrder] = useState<GcNoticeBandOrder>(() => readStored(ORDER_KEY, GC_NOTICE_BAND_ORDERS.map((o) => o.key), 'stage'))
  const [open, setOpen] = useState<boolean>(() => readStored(OPEN_KEY, ['open', 'closed'], 'open') === 'open')
  const label = (jobId: string): string => {
    const j = data.desk.jobsById[jobId]
    const n = j ? effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—' : '—'
    const name = (j?.job_name ?? '').trim()
    return name ? `${n} · ${name}` : n
  }
  const inputs = useMemo<GcNoticeBandJobInput[]>(
    () =>
      data.jobs.map((j) => {
        const job = data.desk.jobsById[j.jobId]
        const w = data.workByJob[j.jobId]
        return {
          jobId: j.jobId,
          status: w?.status ?? j.jobStatus,
          revenue: job?.revenue ?? null,
          paymentsMade: job?.payments_made ?? null,
          pctComplete: w?.pctComplete ?? null,
          lastWorkYmd: job?.last_work_date ?? null,
          address: job?.job_address ?? '',
          work: w ?? null,
        }
      }),
    [data],
  )
  const band = useMemo(() => buildGcNoticeBand(inputs, todayYmd, order, (jobId) => (data.desk.jobsById[jobId]?.job_address ?? '').trim()), [inputs, todayYmd, order, data])
  if (band.counts.jobs === 0) return null
  const c = band.counts
  const pickOrder = (o: GcNoticeBandOrder) => {
    setOrder(o)
    writeStored(ORDER_KEY, o)
  }
  const toggleOpen = () => {
    setOpen((v) => {
      writeStored(OPEN_KEY, v ? 'closed' : 'open')
      return !v
    })
  }
  const openRow = (jobId: string) => (onOpenJob ? onOpenJob(jobId) : onOpenEditJob(jobId, 'line-items'))
  const openDoor = (jobId: string, door: GcNoticeBandDoor) => (door === 'job' ? openRow(jobId) : onOpenEditJob(jobId, door))

  const renderRow = (r: GcNoticeBandRow) => {
    const job = data.desk.jobsById[r.jobId]
    const w = data.workByJob[r.jobId]
    const pp = job && w ? progressPaymentForJob({ id: r.jobId, revenue: job.revenue, payments_made: job.payments_made, pct_complete: r.pct, status: r.status, fixtures: w.fixtures, invoices: w.invoices, payments: w.payments }, null, todayYmd) : null
    const tiles = jobWindowTiles(buildEditJobBillingBar({ total: r.total, payments: w?.payments ?? [{ amount: r.paid, invoice_id: null }], invoices: w?.invoices ?? [] }))
    const chips = r.readings.map((rd) => (
      <button key={rd.key} type="button" title={rd.title} onClick={(e) => { e.stopPropagation(); openDoor(r.jobId, rd.door) }} style={readingChip(rd.tone)} data-testid="gc-notice-band-chip" data-door={rd.door} data-tone={rd.tone}>
        {rd.label} <span style={{ fontWeight: 500, opacity: 0.85, whiteSpace: 'nowrap' }}>→ {rd.doorLabel}</span>
      </button>
    ))
    const stageCell = (
      <div style={{ display: 'grid', gap: 4, justifyItems: 'start' }}>
        <span style={stageChip(r.stage)}>{r.status ? r.status.replace(/_/g, ' ').replace(/^\w/, (m) => m.toUpperCase()) : '—'}</span>
        {chips.length ? chips : <span style={{ ...faint, color: 'var(--text-green-800)', fontWeight: 600 }}>✓ reads right</span>}
      </div>
    )
    const lines = r.lines.length ? (
      <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
        {r.lines.map((l) => {
          const s = LINE_STATE_WORDS[l.state]
          return (
            <button key={l.id} type="button" onClick={(e) => { e.stopPropagation(); onOpenEditJob(r.jobId, 'line-items') }} title={`${l.name || 'Line'} · ${formatUsdNoCents(l.price)} · ${lineStateWords(l)} — opens the bill at ① Line Items`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: 8, alignItems: 'baseline', font: 'inherit', fontSize: '0.75rem', background: 'none', border: 'none', padding: '1px 4px', borderRadius: 4, cursor: 'pointer', textAlign: 'left', color: 'inherit', minWidth: 0 }} data-testid="gc-notice-band-line">
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, color: l.migrated ? 'var(--text-muted)' : undefined, fontStyle: l.migrated ? 'italic' : undefined }}>{l.name || '(unnamed line)'}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)', whiteSpace: 'nowrap' }}>{formatUsdNoCents(l.price)}</span>
              <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '0 6px', borderRadius: 5, lineHeight: '16px', whiteSpace: 'nowrap', background: s.bg, color: s.fg }}>{lineStateWords(l)}</span>
            </button>
          )
        })}
      </div>
    ) : (
      <span style={faint}>no lines on the job</span>
    )
    const progress = pp ? (
      <StagesProgressPaymentCell model={pp.model} view={pp.view} pctComplete={r.pct} compact onStageClick={() => onOpenEditJob(r.jobId, 'line-items')} onNoBidValueClick={() => onOpenEditJob(r.jobId, 'line-items')} />
    ) : (
      <span style={faint}>{r.pct != null ? `${Math.round(r.pct)}% done` : 'no % recorded'}</span>
    )
    const openCell = (
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: '0.875rem' }}>{formatUsdNoCents(r.open)}</div>
        <div style={{ ...faint, fontSize: '0.68rem', color: r.doneNotBilled > 0.5 || (r.open > 0.5 && r.billedUnpaid <= 0.5) ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
          {r.open <= 0.5 ? 'nothing open' : r.billedUnpaid > 0.5 && r.open - r.billedUnpaid > 0.5 ? `${formatUsdNoCents(r.billedUnpaid)} on bills · ${formatUsdNoCents(r.open - r.billedUnpaid)} not billed` : r.billedUnpaid > 0.5 ? 'on bills' : 'nothing billed yet'}
        </div>
        <span style={{ ...linkBtn, fontSize: '0.7rem' }}>Open ↗</span>
      </div>
    )
    const jobCell = (
      <>
        <strong>{label(r.jobId)}</strong>
        <div style={faint}>{(job?.job_address ?? '').trim() || '—'}</div>
        {r.lastWorkYmd ? <div style={faint}>last on site {formatYmdMonthDay(r.lastWorkYmd)}</div> : null}
      </>
    )
    const rowStyle: CSSProperties = { cursor: 'pointer' }
    if (isMobile) {
      return (
        <tr key={r.jobId} onClick={() => openRow(r.jobId)} style={rowStyle} data-testid="gc-notice-band-row" data-stage={r.stage} data-wrong={r.readings.length > 0 ? 'yes' : 'no'}>
          <td style={td} colSpan={5}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{jobCell}</span>
              <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatUsdNoCents(r.open)}</span>
            </div>
            <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
              {stageCell}
              {progress}
              {lines}
            </div>
          </td>
        </tr>
      )
    }
    return (
      <tr key={r.jobId} onClick={(e) => { if (!(e.target as HTMLElement).closest('button, input, a')) openRow(r.jobId) }} style={rowStyle} title="Open the job" data-testid="gc-notice-band-row" data-stage={r.stage} data-wrong={r.readings.length > 0 ? 'yes' : 'no'}>
        <td style={{ ...td, width: '17%' }}>{jobCell}</td>
        <td style={{ ...td, width: '18%' }}>{stageCell}</td>
        <td style={{ ...td, width: '26%' }}>{lines}</td>
        <td style={{ ...td, width: '22%' }}>{progress}</td>
        <td style={{ ...td, width: '17%', textAlign: 'right', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gap: '2px 8px', justifyContent: 'end', fontSize: '0.72rem' }}>
            {[['Total', tiles.total], ['Billed', tiles.billed], ['Paid', tiles.paid]].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: '0.58rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{k}</div>
                <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 4 }}>{openCell}</div>
        </td>
      </tr>
    )
  }

  return (
    <section data-testid="gc-notice-band" aria-label="The jobs, by stage" style={{ display: 'grid', gap: '0.6rem', paddingBottom: '1.1rem', marginBottom: '1.1rem', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem 1rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em' }}>The jobs, by stage</h3>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '72ch' }}>Every job with unpaid work under this GC, by the stage on record, against what the work and the money say. A chip opens the job on the field that fixes it; a row opens the job; a line opens its bill. Mark the record right before the notices claim against it.</p>
        </div>
        <button type="button" style={linkBtn} onClick={toggleOpen} aria-expanded={open} data-testid="gc-notice-band-toggle">
          {open ? 'Hide the jobs ▴' : `Show the ${c.jobs} job${c.jobs === 1 ? '' : 's'} ▾`}
        </button>
      </div>
      <div data-testid="gc-notice-band-head" style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem 1rem', flexWrap: 'wrap', alignItems: 'baseline', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
        <div style={{ display: 'flex', gap: '0.35rem 0.75rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
          <span>{gcNoticeBandStageWords(band)}</span>
          <span aria-hidden="true">·</span>
          {c.wrong > 0 ? <strong style={{ color: 'var(--text-red-600)' }}>{c.wrong} look{c.wrong === 1 ? 's' : ''} wrong</strong> : <strong style={{ color: 'var(--text-green-800)' }}>every record reads right</strong>}
          <span aria-hidden="true">·</span>
          <span><strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(c.total)}</strong> job total</span>
          <span><strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(c.billed)}</strong> billed{c.billedUnpaid > 0.5 ? <span style={faint}> ({formatUsdNoCents(c.billedUnpaid)} unpaid)</span> : null}</span>
          <span><strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(c.paid)}</strong> paid</span>
          {c.doneNotBilled > 0.5 ? <span style={{ color: 'var(--text-amber-800)' }}><strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(c.doneNotBilled)}</strong> done, not billed</span> : null}
        </div>
        {open ? (
          <div role="group" aria-label="Order" style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem' }}>
            {GC_NOTICE_BAND_ORDERS.map((o) => (
              <button key={o.key} type="button" onClick={() => pickOrder(o.key)} aria-pressed={order === o.key} style={{ ...linkBtn, color: order === o.key ? 'var(--text-700)' : 'var(--text-link)', textDecoration: order === o.key ? 'underline' : undefined, textUnderlineOffset: 3 }} data-testid="gc-notice-band-order">
                {o.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {open ? (
        <div style={card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: isMobile ? undefined : 'fixed' }}>
              {isMobile ? null : (
                <thead>
                  <tr>
                    <th style={th}>Job</th>
                    <th style={th}>Stage on record · what looks wrong</th>
                    <th style={th}>The work</th>
                    <th style={th}>Progress &amp; payment</th>
                    <th style={{ ...th, textAlign: 'right' }}>Job total · Billed · Paid · Open</th>
                  </tr>
                </thead>
              )}
              <tbody>
                {band.groups.map((g) => (
                  <GroupRows key={g.key} label={g.label} count={g.rows.length} open={g.open} wrong={g.wrong} stage={order === 'stage' ? (g.key as GcNoticeBandStage) : null}>
                    {g.rows.map(renderRow)}
                  </GroupRows>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {open ? (
        <div style={faint}>
          The bar is the Pipeline's own cell: the top channel is how far the crew is, the edge under it the money on that stretch — paid, billed, done and not billed. A chip is one of the Pipeline's readings (<em>set % done</em>, <em>done, not billed</em>, <em>quiet</em>) or the stage the evidence says against the stage on record. Opening a job here keeps this window where it is; ✕ on the job brings you back, re-read.
        </div>
      ) : null}
    </section>
  )
}

function GroupRows({ label, count, open, wrong, stage, children }: { label: string; count: number; open: number; wrong: number; stage: GcNoticeBandStage | null; children: React.ReactNode }) {
  return (
    <>
      <tr data-testid="gc-notice-band-group">
        <td colSpan={5} style={{ ...td, background: 'var(--bg-subtle)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-700)', padding: '6px 12px' }}>
          {stage ? <span style={{ ...stageChip(stage), marginRight: 8 }}>{label}</span> : <span style={{ marginRight: 8 }}>{label}</span>}
          {count} job{count === 1 ? '' : 's'} <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>· {formatUsdNoCents(open)} open · {wrong ? <strong style={{ color: 'var(--text-red-600)' }}>{wrong} look{wrong === 1 ? 's' : ''} wrong</strong> : 'all read right'}</span>
        </td>
      </tr>
      {children}
    </>
  )
}
