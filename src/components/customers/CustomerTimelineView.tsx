import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { customerTimelineMissingWords, fetchCustomerTimeline, type CustomerTimelineLoad } from '../../lib/customers/fetchCustomerTimeline'
import {
  buildCustomerTimeline,
  timelineCardShown,
  timelineDayOfDate,
  timelineDayOfInstant,
  timelineDayWords,
  timelineMoney,
  type CustomerTimeline,
  type TimelineCard,
  type TimelineJob,
  type TimelineLaneCell,
  type TimelineRow,
} from '../../lib/customers/customerTimeline'
import {
  customerTimelineAsOfWords,
  customerTimelineJobWords,
  customerTimelineTiles,
  customerTimelineWhoWords,
} from '../../lib/customers/customerTimelineWords'
import CustomerViewSwitch from './CustomerViewSwitch'
import JobHoursStoryModal from '../jobs/JobHoursStoryModal'
import { useToastContext } from '../../contexts/ToastContext'
import { appUrl } from '../../lib/appOrigin'
import { customerTimelineHref } from '../../lib/customers/customerTimelineSearch'

/**
 * The Customer timeline (punch list #97): one customer's whole story on one spine of time,
 * today at the top. Each job is a rail from its first record to its final payment; office acts
 * with the customer sit left of the rails, what we put in sits right; a bar above says what they
 * owe us and the hours and materials not yet paid for, and once you scroll it reads those
 * numbers as of the day under it. The rules live in `lib/customers/customerTimeline.ts`; this
 * file draws them. Shown by the Customer profile window's Timeline view.
 */

type Show = 'all' | 'money' | 'field'
type DayRow = Extract<TimelineRow, { kind: 'day' }>

const LANE_W = 22
const LANE_W_PHONE = 14
/** Where a day row's node sits: level with its first card's top line. */
const NODE_Y = 21
const COMPACT_AFTER_PX = 120

function timelineJobColor(colorIndex: number | null): string {
  return colorIndex == null ? 'var(--text-faint)' : `var(--timeline-job-${colorIndex})`
}

const CARD_BG: Partial<Record<TimelineCard['kind'], string>> = {
  payment: 'var(--bg-green-tint)',
  closed: 'var(--bg-green-tint)',
  bill: 'var(--bg-amber-tint)',
  billSent: 'var(--bg-amber-tint)',
  promise: 'var(--bg-violet-100)',
  lien: 'var(--bg-red-tint)',
  collections: 'var(--bg-red-tint)',
  uncollectible: 'var(--bg-red-tint)',
}
const AMOUNT_COLOR: Partial<Record<TimelineCard['kind'], string>> = {
  payment: 'var(--text-green-700)',
  bill: 'var(--text-amber-800)',
  billSent: 'var(--text-amber-800)',
  lien: 'var(--text-red-600)',
}
const TITLE_COLOR: Partial<Record<TimelineCard['kind'], string>> = {
  promise: 'var(--text-violet-800)',
  lien: 'var(--text-red-600)',
  collections: 'var(--text-red-600)',
  uncollectible: 'var(--text-red-600)',
  closed: 'var(--text-green-700)',
}

const capStyle: CSSProperties = { fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)' }

function Lane({ cell, width, nodeY, highlight, dim }: { cell: TimelineLaneCell; width: number; nodeY: number | null; highlight: string | null; dim: boolean }) {
  const box: CSSProperties = { position: 'relative', width, flexShrink: 0, alignSelf: 'stretch', opacity: dim ? 0.3 : 1 }
  if (!cell) return <div style={box} />
  const isOther = cell.state === 'other'
  const color = isOther ? (highlight ?? 'var(--text-faint)') : timelineJobColor(cell.colorIndex)
  const line = cell.state === 'collections' ? 'var(--text-red-600)' : color
  const strip: CSSProperties = { position: 'absolute', left: '50%', transform: 'translateX(-50%)', boxSizing: 'border-box' }
  if (cell.extent === 'top' && nodeY != null) {
    strip.top = 0
    strip.height = nodeY
  } else if (cell.extent === 'bottom' && nodeY != null) {
    strip.top = nodeY
    strip.bottom = 0
  } else {
    strip.top = 0
    strip.bottom = 0
  }
  if (cell.state === 'waiting') {
    strip.width = 0
    strip.borderLeft = `2px dashed ${line}`
  } else if (cell.state === 'working') {
    strip.width = 6
    strip.background = line
  } else if (cell.state === 'billed' || cell.state === 'collections') {
    strip.width = 6
    strip.borderLeft = `2px solid ${line}`
    strip.borderRight = `2px solid ${line}`
  } else {
    strip.width = highlight ? 4 : 2
    strip.background = color
    strip.opacity = highlight ? 1 : 0.55
  }
  let node = null
  if (nodeY != null && cell.mark) {
    const at: CSSProperties = { position: 'absolute', left: '50%', top: nodeY, transform: 'translate(-50%, -50%)', borderRadius: '50%', boxSizing: 'border-box', zIndex: 1 }
    if (cell.mark === 'start') node = <span aria-hidden style={{ ...at, width: 16, height: 16, border: `3px solid ${color}`, background: 'var(--surface)' }} />
    else if (cell.mark === 'end')
      node = (
        <span aria-hidden style={{ ...at, width: 18, height: 18, background: color, color: 'var(--surface)', fontSize: 11, fontWeight: 800, lineHeight: '18px', textAlign: 'center' }}>
          ✓
        </span>
      )
    else if (cell.state === 'billed' || cell.state === 'collections')
      node = <span aria-hidden style={{ ...at, width: 10, height: 10, background: 'var(--surface)', border: `2px solid ${line}` }} />
    else node = <span aria-hidden style={{ ...at, width: 10, height: 10, background: line, boxShadow: '0 0 0 2px var(--surface)' }} />
  }
  return (
    <div style={box}>
      {cell.extent !== 'none' ? <div style={strip} /> : null}
      {node}
    </div>
  )
}

function Rails({ lanes, count, width, nodeY, focus, greyHighlight }: { lanes: TimelineLaneCell[]; count: number; width: number; nodeY: number | null; focus: string | null; greyHighlight: string | null }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignSelf: 'stretch' }}>
      {Array.from({ length: count }, (_, i) => {
        const cell = lanes[i] ?? null
        const dim = focus != null && cell != null && (cell.state === 'other' ? greyHighlight == null : cell.jobId !== focus)
        return <Lane key={i} cell={cell} width={width} nodeY={nodeY} highlight={cell?.state === 'other' ? greyHighlight : null} dim={dim} />
      })}
    </div>
  )
}

/** A fold's lines past this many wait behind "show all". */
const ITEMS_SHOWN = 5

function CardItems({ items }: { items: string[] }) {
  const [all, setAll] = useState(false)
  const shown = all || items.length <= ITEMS_SHOWN + 1 ? items : items.slice(0, ITEMS_SHOWN)
  return (
    <>
      <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {shown.map((item, i) => (
          <li key={i} style={{ overflowWrap: 'anywhere' }}>
            {item}
          </li>
        ))}
      </ul>
      {shown.length < items.length ? (
        <button type="button" onClick={() => setAll(true)} style={{ border: 'none', background: 'none', padding: 0, marginTop: 2, cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-link)' }}>
          show all {items.length}
        </button>
      ) : null}
    </>
  )
}

function CardView({
  card,
  job,
  phone,
  dimmed,
  onOpenJob,
  onShowDays,
}: {
  card: TimelineCard
  job: TimelineJob | null
  phone: boolean
  dimmed: boolean
  onOpenJob: (jobId: string) => void
  onShowDays: (job: TimelineJob) => void
}) {
  const color = job ? timelineJobColor(job.colorIndex) : 'var(--text-faint)'
  const accent = `3px solid ${color}`
  const sideStyle: CSSProperties = phone
    ? { borderLeft: accent, marginLeft: card.side === 'field' ? 14 : 0 }
    : card.side === 'office'
      ? { borderRight: accent }
      : { borderLeft: accent }
  return (
    <div
      data-card-kind={card.kind}
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '6px 10px',
        background: CARD_BG[card.kind] ?? (phone && card.side === 'field' ? 'var(--bg-subtle)' : 'var(--surface)'),
        maxWidth: phone ? undefined : 440,
        minWidth: 0,
        boxSizing: 'border-box',
        opacity: dimmed ? 0.3 : 1,
        transition: 'opacity .15s',
        ...sideStyle,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 8px' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{timelineDayWords(card.ymd)}</span>
        {job ? (
          <button
            type="button"
            onClick={() => onOpenJob(job.id)}
            title="Open the job"
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, color, letterSpacing: '0.02em', textAlign: 'left' }}
          >
            {customerTimelineJobWords(job)}
          </button>
        ) : null}
        {job?.payerName ? <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>{job.payerName} pays</span> : null}
        {phone ? <span style={{ ...capStyle, fontSize: '0.6rem' }}>{card.side}</span> : null}
        <span style={{ fontWeight: 600, color: TITLE_COLOR[card.kind] ?? 'var(--text-strong)' }}>{card.title}</span>
        {card.amount != null ? (
          <span style={{ fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: AMOUNT_COLOR[card.kind] ?? 'var(--text-strong)' }}>
            {timelineMoney(card.amount)}
          </span>
        ) : null}
      </div>
      {card.lines.length > 0 ? <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{card.lines.join(' · ')}</div> : null}
      {card.quote ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-base)', fontStyle: 'italic', marginTop: 2, overflowWrap: 'anywhere' }}>“{card.quote}”</div>
      ) : null}
      {card.by ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>{card.kind === 'promise' ? `${card.by} said it` : `by ${card.by}`}</div> : null}
      {card.items.length > 0 ? <CardItems items={card.items} /> : null}
      {card.hours ? (
        <>
          {card.hours.shareOfJob != null && card.hours.shareOfJob < 0.995 ? (
            <div aria-hidden style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(card.hours.shareOfJob * 100)}%`, height: '100%', background: color }} />
            </div>
          ) : null}
          {card.hours.crew.length > 0 || job ? (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
              {card.hours.crew.map((name) => (
                <span key={name} style={{ fontSize: '0.68rem', border: '1px solid var(--border)', borderRadius: 9999, padding: '0 7px', color: 'var(--text-muted)' }}>
                  {name}
                </span>
              ))}
              {job ? (
                <button
                  type="button"
                  onClick={() => onShowDays(job)}
                  style={{ border: 'none', background: 'none', padding: 0, marginLeft: 4, cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-link)' }}
                >
                  show the days ›
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export default function CustomerTimelineView({ customerId, onClose, onShowProfile }: { customerId: string; onClose: () => void; onShowProfile: () => void }) {
  const phone = useIsMobile()
  const jobDetail = useJobDetailModal()
  const { showToast } = useToastContext()
  const [load, setLoad] = useState<(CustomerTimelineLoad & { nowMs: number }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [show, setShow] = useState<Show>('all')
  const [focus, setFocus] = useState<string | null>(null)
  const [compact, setCompact] = useState(false)
  const [asOfYmd, setAsOfYmd] = useState<string | null>(null)
  /** The job whose crew days are open in the hours story (the man-hours chip's window). */
  const [hoursJob, setHoursJob] = useState<TimelineJob | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoad(null)
    setError(null)
    fetchCustomerTimeline(customerId)
      .then((l) => {
        if (!cancelled) setLoad({ ...l, nowMs: Date.now() })
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(formatErrorMessage(e, 'Could not load the timeline'))
      })
    return () => {
      cancelled = true
    }
  }, [customerId])

  const todayYmd = todayYmdInAppTz()
  const timeline: CustomerTimeline | null = useMemo(() => (load ? buildCustomerTimeline(load.input, todayYmd, load.nowMs) : null), [load, todayYmd])
  const jobsById = useMemo(() => new Map((timeline?.jobs ?? []).map((j) => [j.id, j])), [timeline])
  const snapshotByYmd = useMemo(
    () => new Map((timeline?.rows ?? []).filter((r): r is DayRow => r.kind === 'day').map((r) => [r.ymd, r.snapshot])),
    [timeline],
  )
  const focusJob = focus ? (jobsById.get(focus) ?? null) : null

  const onScroll = useCallback(() => {
    if (frame.current != null) return
    frame.current = window.requestAnimationFrame(() => {
      frame.current = null
      const el = scrollRef.current
      if (!el) return
      setCompact(el.scrollTop > COMPACT_AFTER_PX)
      const top = el.getBoundingClientRect().top
      const dayRows = el.querySelectorAll<HTMLElement>('[data-day-row]')
      let first: HTMLElement | null = null
      for (const r of dayRows) {
        if (r.getBoundingClientRect().bottom > top + 4) {
          first = r
          break
        }
      }
      setAsOfYmd(!first || first === dayRows[0] ? null : (first.dataset.dayRow ?? null))
    })
  }, [])
  useEffect(
    () => () => {
      if (frame.current != null) window.cancelAnimationFrame(frame.current)
    },
    [],
  )

  const name = (load?.input.customer.name ?? '').trim() || 'Customer'
  const laneTotal = timeline ? timeline.laneCount + (timeline.hasOtherLane ? 1 : 0) : 0
  const laneW = phone ? LANE_W_PHONE : LANE_W
  const railW = laneTotal * laneW + 16
  const grid: CSSProperties = phone ? { display: 'grid', gridTemplateColumns: `${railW}px minmax(0, 1fr)` } : { display: 'grid', gridTemplateColumns: `minmax(0, 1fr) ${railW}px minmax(0, 1fr)` }
  const greyHighlightAt = (ymd: string): string | null =>
    focusJob && focusJob.lane == null && ymd >= focusJob.firstSeenYmd && ymd <= (focusJob.paidYmd ?? todayYmd) ? 'var(--text-link)' : null
  const openJob = (jobId: string) => jobDetail?.openJobDetail({ jobId })
  const sinceYmd = load ? timelineDayOfDate(load.input.customer.dateMet) || timelineDayOfInstant(load.input.customer.createdAt) || null : null
  const missingWords = load ? customerTimelineMissingWords(load) : ''
  const copyLink = async () => {
    const url = appUrl(customerTimelineHref(customerId))
    try {
      await navigator.clipboard.writeText(url)
      showToast('Link copied. It opens this timeline on the Pipeline.', 'success')
    } catch {
      showToast(`Copy this link: ${url}`, 'info')
    }
  }

  const titleBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
      <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-strong)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</h2>
      <CustomerViewSwitch view="timeline" onChange={(v) => (v === 'profile' ? onShowProfile() : undefined)} />
      <button
        type="button"
        onClick={() => void copyLink()}
        title="Copy a link that opens this timeline on the Pipeline"
        style={{ marginLeft: 'auto', border: '1px solid var(--border)', borderRadius: 9999, background: 'var(--surface)', color: 'var(--text-link)', fontSize: '0.75rem', fontWeight: 600, padding: '2px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        Copy link
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: 4 }}
      >
        ×
      </button>
    </div>
  )

  if (error) {
    return (
      <>
        {titleBar}
        <div style={{ padding: '1.25rem' }}>
          <p style={{ color: 'var(--text-red-600)', fontSize: '0.875rem', margin: 0 }}>{error}</p>
        </div>
      </>
    )
  }
  if (!timeline || !load) {
    return (
      <>
        {titleBar}
        <p style={{ padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }} role="status">
          Loading the timeline…
        </p>
      </>
    )
  }

  const tiles = customerTimelineTiles(timeline.summary)
  const openJobs = timeline.jobs.filter((j) => j.open)
  const renderRow = (row: TimelineRow) => {
    if (row.kind === 'quiet') {
      return (
        <div key={row.key} style={{ ...grid, minHeight: 48 }}>
          {phone ? <div /> : null}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: phone ? 'flex-start' : 'flex-end', padding: phone ? '0 0 0 10px' : '0 12px 0 0', fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-faint)' }}>
            <span>
              <b style={{ fontStyle: 'normal', color: 'var(--text-muted)' }}>{row.label}</b> · {timelineDayWords(row.fromYmd)} → {timelineDayWords(row.toYmd)} · nothing open, nothing owed
            </span>
          </div>
          {phone ? null : <div />}
        </div>
      )
    }
    if (row.kind === 'month' || row.kind === 'gap') {
      const label = (
        <span style={row.kind === 'month' ? { ...capStyle, letterSpacing: '0.08em', paddingTop: 12, display: 'inline-block' } : { fontSize: '0.7rem', color: 'var(--text-faint)' }}>
          {row.label}
        </span>
      )
      const height = row.kind === 'gap' ? Math.min(96, 18 + Math.round(row.days * 0.9)) : undefined
      const rails = <Rails lanes={row.lanes} count={laneTotal} width={laneW} nodeY={null} focus={focus} greyHighlight={greyHighlightAt(row.ymd)} />
      return phone ? (
        <div key={row.key} style={{ ...grid, minHeight: height }}>
          {rails}
          <div style={{ display: 'flex', alignItems: row.kind === 'gap' ? 'center' : 'flex-end', padding: '0 0 0 10px' }}>{label}</div>
        </div>
      ) : (
        <div key={row.key} style={{ ...grid, minHeight: height }}>
          <div style={{ display: 'flex', alignItems: row.kind === 'gap' ? 'center' : 'flex-end', justifyContent: 'flex-end', padding: '0 12px 0 0' }}>{label}</div>
          {rails}
          <div />
        </div>
      )
    }
    const office = row.office.filter((c) => timelineCardShown(c, show))
    const field = row.field.filter((c) => timelineCardShown(c, show))
    if (office.length === 0 && field.length === 0) return null
    const card = (c: TimelineCard) => (
      <CardView
        key={c.key}
        card={c}
        job={c.jobId ? (jobsById.get(c.jobId) ?? null) : null}
        phone={phone}
        dimmed={focus != null && !c.jobIds.includes(focus)}
        onOpenJob={openJob}
        onShowDays={setHoursJob}
      />
    )
    const rails = <Rails lanes={row.lanes} count={laneTotal} width={laneW} nodeY={NODE_Y} focus={focus} greyHighlight={greyHighlightAt(row.ymd)} />
    return phone ? (
      <div key={row.key} data-day-row={row.ymd} style={grid}>
        {rails}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '5px 0 5px 10px', minWidth: 0 }}>
          {office.map(card)}
          {field.map(card)}
        </div>
      </div>
    ) : (
      <div key={row.key} data-day-row={row.ymd} style={grid}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, padding: '5px 12px 5px 0', minWidth: 0 }}>{office.map(card)}</div>
        {rails}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: '5px 0 5px 12px', minWidth: 0 }}>{field.map(card)}</div>
      </div>
    )
  }

  const asOfSnapshot = asOfYmd ? snapshotByYmd.get(asOfYmd) : undefined
  const pill = (on: boolean): CSSProperties => ({
    border: `1px solid ${on ? 'var(--text-strong)' : 'var(--border)'}`,
    background: on ? 'var(--text-strong)' : 'var(--surface)',
    color: on ? 'var(--surface)' : 'var(--text-700)',
    borderRadius: 9999,
    padding: '2px 10px',
    fontSize: '0.75rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  })

  return (
    <>
      {titleBar}
      <div style={{ padding: compact ? '6px 16px' : '10px 16px 8px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        {!compact ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'baseline', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {customerTimelineWhoWords(timeline, sinceYmd).map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
        ) : null}
        <div
          style={
            compact
              ? phone
                ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0 10px' }
                : { display: 'flex', flexWrap: 'wrap', gap: '2px 16px', alignItems: 'baseline' }
              : { display: 'grid', gridTemplateColumns: phone ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 8 }
          }
        >
          {tiles.map((t) =>
            compact ? (
              <span key={t.key} data-tile={t.key} style={{ display: 'inline-flex', gap: 5, alignItems: 'baseline', minWidth: 0, whiteSpace: 'nowrap' }}>
                <span style={{ ...capStyle, fontSize: phone ? '0.58rem' : capStyle.fontSize }}>{t.label}</span>
                <span style={{ fontWeight: 700, fontSize: phone ? '0.85rem' : undefined, fontVariantNumeric: 'tabular-nums', color: t.alert ? 'var(--text-amber-800)' : 'var(--text-strong)' }}>{t.value}</span>
              </span>
            ) : (
              <div key={t.key} data-tile={t.key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', background: 'var(--bg-subtle)', minWidth: 0 }}>
                <div style={capStyle}>{t.label}</div>
                <div style={{ fontSize: phone ? '1.05rem' : '1.25rem', fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', color: t.alert ? 'var(--text-amber-800)' : 'var(--text-strong)' }}>{t.value}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={t.sub}>
                  {t.sub}
                </div>
              </div>
            ),
          )}
        </div>
        {asOfYmd && asOfSnapshot ? (
          <div role="status" style={{ marginTop: 5, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {customerTimelineAsOfWords(asOfYmd, asOfSnapshot)}
          </div>
        ) : null}
        {missingWords ? <div style={{ marginTop: 5, fontSize: '0.75rem', color: 'var(--text-amber-800)' }}>{missingWords}</div> : null}
        {!compact ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, minWidth: 0 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>Show</span>
            {(
              [
                ['all', 'Everything'],
                ['money', 'Money'],
                ['field', 'Field'],
              ] as Array<[Show, string]>
            ).map(([key, label]) => (
              <button key={key} type="button" aria-pressed={show === key} onClick={() => setShow(key)} style={pill(show === key)}>
                {label}
              </button>
            ))}
            {openJobs.length > 0 ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto', minWidth: 0, flex: 1, paddingBottom: 2 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0, marginLeft: 6 }}>Open jobs</span>
                {openJobs.map((j) => (
                  <button
                    key={j.id}
                    type="button"
                    aria-pressed={focus === j.id}
                    onClick={() => setFocus((f) => (f === j.id ? null : j.id))}
                    title={focus === j.id ? 'Show every job' : 'Show this job and dim the rest'}
                    style={{ ...pill(false), display: 'inline-flex', alignItems: 'center', gap: 6, borderColor: focus === j.id ? timelineJobColor(j.colorIndex) : 'var(--border)', opacity: focus != null && focus !== j.id ? 0.5 : 1 }}
                  >
                    <span aria-hidden style={{ width: 9, height: 9, borderRadius: 9999, background: timelineJobColor(j.colorIndex), flexShrink: 0 }} />
                    {customerTimelineJobWords(j)}
                    {j.owedNow > 0.005 ? <span style={{ fontWeight: 700, color: 'var(--text-amber-800)' }}>{timelineMoney(j.owedNow)}</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div ref={scrollRef} onScroll={onScroll} data-timeline-scroller style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '0 16px 32px' }}>
        {timeline.rows.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nothing on record for this customer yet. The timeline fills in as jobs are made for them.</p>
        ) : (
          <>
            <div style={{ ...grid, alignItems: 'end' }}>
              {phone ? null : <div style={{ ...capStyle, textAlign: 'right', padding: '10px 12px 4px 0' }}>Office · with the customer</div>}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {Array.from({ length: laneTotal }, (_, i) => {
                  const cell = timeline.openToday[i] ?? null
                  const color = cell ? (cell.state === 'other' ? 'var(--text-faint)' : timelineJobColor(cell.colorIndex)) : 'transparent'
                  return (
                    <span key={i} aria-hidden style={{ width: laneW, textAlign: 'center', color, fontSize: phone ? 10 : 13, lineHeight: 1, paddingTop: 10 }}>
                      {cell ? '▲' : ''}
                    </span>
                  )
                })}
              </div>
              <div style={{ ...capStyle, padding: phone ? '10px 0 4px 10px' : '10px 0 4px 12px' }}>{phone ? 'Office, then field, day by day' : 'Field · what we put in'}</div>
            </div>
            {timeline.rows.map(renderRow)}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)', paddingTop: 14, marginTop: 22, borderTop: '1px dashed var(--border)' }}>
              <span>◯ card made or first record</span>
              <span>▮ working</span>
              <span>▯ billed, waiting on their money</span>
              <span>┆ waiting to start</span>
              <span style={{ color: 'var(--text-red-600)' }}>▯ in Collections</span>
              <span>✓ paid in full</span>
              {timeline.hasOtherLane ? <span>│ {timeline.otherJobCount} other jobs share the grey rail</span> : null}
              <span>▲ still open today</span>
            </div>
          </>
        )}
      </div>
      {hoursJob ? (
        <JobHoursStoryModal jobId={hoursJob.id} hcpNumber={hoursJob.numberLabel} jobName={hoursJob.label} onClose={() => setHoursJob(null)} />
      ) : null}
    </>
  )
}
