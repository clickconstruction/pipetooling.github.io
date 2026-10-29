/**
 * Materials on site, the office's tab on the Jobs page (punch list #209): with no job picked, the
 * desk across jobs (containers, lines on site, missing this week with the money, counts due,
 * credits due); with a job (`?job=<id>`), its four sections: On site by container, Movements,
 * Missing, Counts, plus Print labels and Correct the count. Reads the same store the field tab
 * writes; the spike keeps it on this device until the tables land.
 */
import { Suspense, lazy, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAddressGeocodeCoords } from '../../hooks/useAddressGeocodeCoords'
import { normalizeAddressForGeocodeKey } from '../../lib/map/normalizeAddressForGeocode'
import type { OnSiteMapPin } from '../materials/OnSiteMap'

const OnSiteMapLazy = lazy(() => import('../materials/OnSiteMap'))
import { supabase } from '../../lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { useToastContext } from '../../contexts/ToastContext'
import { useOnSiteDesk, useOnSiteJob, useOnSiteStoreVersion } from '../../hooks/useOnSiteStore'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { EmptyState } from '../EmptyState'
import { recoveryFailureFromError } from '../../lib/offlineRecoveryState'
import { containerLines, countDiffs, countIsDue, daysSince, groupByPlace, lastCountWords, lastCountedAt, linesOf, missingMoney, partKey, REASON_WORDS, STALE_COUNT_DAYS, type Container, type ContainerLine } from '../../lib/materials/onSite'
import { addContainer, addMovement, addPlace, jobIdsWithData, listContainers, listMovements, listPhotos, listPlaces, priceOf, rememberPrice, setOnSiteErrorHandler, unsortedContainer } from '../../lib/materials/onSiteStore'
import { invoiceNumber, manifestComparison, parseInvoiceText, SAMPLE_INVOICE_TEXT, type ParsedLine } from '../../lib/materials/manifest'
import { jobMaterialsSummary, staleWords } from '../../lib/materials/onSiteSummary'
import { flowFigure, officeFlow } from '../../lib/materials/flowRow'
import { boxAddress, boxCode, boxUrl, labelRows } from '../../lib/materials/labels'
import { photoMarkWords } from '../../lib/materials/photo'
import { BoxPhotos, CameraGlyph } from '../materials/PhotoPress'
import { FlowRow } from '../materials/FlowRow'

export type MaterialsJob = { id: string; hcp_number: string | null; job_name: string | null; customer_name?: string | null; job_address?: string | null; /** The job's Google Drive folder, where its invoices and photos live (jobs_ledger.google_drive_link). */ google_drive_link?: string | null }

type Props = {
  jobs: MaterialsJob[]
  byUserId: string | null
  byName: string
  onOpenJobDetail: (jobId: string) => void
}

const BLUE = '#2563eb'
const btn: CSSProperties = { minHeight: 36, padding: '0 0.75rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }
const btnPrimary: CSSProperties = { ...btn, background: BLUE, borderColor: BLUE, color: '#fff' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
const sec: CSSProperties = { background: 'var(--surface)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 10, overflowX: 'auto', overflowY: 'hidden', minWidth: 0 }
const secH: CSSProperties = { margin: 0, padding: '0.6rem 0.9rem', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-strong)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }
const th: CSSProperties = { textAlign: 'left', padding: '0.4rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '0.28rem 0.6rem', fontSize: '0.85rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const num: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const chip = (tone: 'amber' | 'red' | 'green' | 'blue' | 'dim'): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 0.45rem',
  borderRadius: 999,
  fontSize: '0.72rem',
  fontWeight: 600,
  borderWidth: 1,
  borderStyle: 'solid',
  whiteSpace: 'nowrap',
  ...(tone === 'amber' ? { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderColor: 'var(--text-amber-800)' } : tone === 'red' ? { background: 'var(--bg-red-100)', color: 'var(--text-red-700)', borderColor: 'var(--text-red-700)' } : tone === 'green' ? { background: 'var(--bg-green-100)', color: 'var(--text-green-700)', borderColor: 'var(--text-green-700)' } : tone === 'blue' ? { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', borderColor: 'var(--text-blue-700)' } : { color: 'var(--text-muted)', borderColor: 'var(--border)' }),
})

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
/** A day and a time small enough that two lines sit in one row's height, or inline after a name. */
function Stamp({ iso, inline }: { iso: string; inline?: boolean }) {
  const d = new Date(iso)
  const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (inline) return <span style={{ ...muted, fontSize: '0.72rem' }}>{day} {time}</span>
  return <span style={{ display: 'inline-grid', lineHeight: 1.1, fontSize: '0.72rem', color: 'var(--text-700)', textAlign: 'right' }}><span>{day}</span><span style={muted}>{time}</span></span>
}
/** Dollars at full size, cents smaller: $444<small>.95</small>. For a label or a cell; `money()` for a sentence. */
function Money({ n }: { n: number }) {
  const s = money(n)
  const dot = s.lastIndexOf('.')
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      {s.slice(0, dot)}
      <span style={{ fontSize: '0.72em', opacity: 0.85 }}>{s.slice(dot)}</span>
    </span>
  )
}
function when(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
function jobLabel(j: MaterialsJob | undefined, id: string): string {
  if (!j) return `job ${id.slice(0, 8)}`
  return `${j.hcp_number || '—'} · ${j.job_name || j.customer_name || '—'}`
}
function unitPrice(line: Pick<ContainerLine, 'partKey'>): number | null {
  return priceOf(line.partKey)
}

export default function JobsMaterialsTab({ jobs, byUserId, byName, onOpenJobDetail }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  useOnSiteStoreVersion()
  const { showToast } = useToastContext()
  useEffect(() => { setOnSiteErrorHandler((m) => showToast(m, 'error')) }, [showToast])
  const desk = useOnSiteDesk()
  const jobId = searchParams.get('job')
  const now = new Date()
  const setJob = (id: string | null) =>
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      if (id) next.set('job', id)
      else next.delete('job')
      return next
    })

  const withData = jobIdsWithData()
  // A job the page's list does not hold (paid in full, closed) is read by id, so the desk still names it.
  const [extraJobs, setExtraJobs] = useState<MaterialsJob[]>([])
  const withDataKey = withData.join('|')
  useEffect(() => {
    const missing = withDataKey.split('|').filter((id) => id && !jobs.some((j) => j.id === id) && !extraJobs.some((j) => j.id === id))
    if (missing.length === 0) return
    void supabase
      .from('jobs_ledger')
      .select('id, hcp_number, job_name, job_address, google_drive_link')
      .in('id', missing)
      .then(({ data }) => {
        if (data && data.length) setExtraJobs((prev) => [...prev, ...(data as MaterialsJob[]).filter((d) => !prev.some((p) => p.id === d.id))])
      })
  }, [jobs, extraJobs, withDataKey])
  const allJobs = [...jobs, ...extraJobs]

  if (!jobId) {
    const rows = withData.map((id) => ({ id, job: allJobs.find((j) => j.id === id), sum: jobMaterialsSummary(listContainers(id), listMovements(id), now) }))
    rows.sort((a, b) => b.sum.missingMoneyWeek - a.sum.missingMoneyWeek || b.sum.stale.length - a.sum.stale.length)
    return (
      <div style={{ display: 'grid', gap: '0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Materials desk</h2>
          {desk.loading && !desk.loaded ? <span style={muted}>Loading…</span> : null}
          <span style={muted}>{rows.length} {rows.length === 1 ? 'job' : 'jobs'} with containers · what is on every site, what went missing this week, which containers have not been counted in {STALE_COUNT_DAYS} days</span>
        </div>
        <OfflineRetryPanel failure={desk.error ? recoveryFailureFromError(desk.raw, 'The materials desk did not load.') : null} onRetry={desk.retry} surface="materials-desk" idempotent />
        <div style={sec}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={{ ...th, minWidth: 240 }}>Job</th><th style={{ ...th, ...num }}>Containers</th><th style={{ ...th, ...num }}>On site, lines</th><th style={{ ...th, ...num }}>Missing this week</th><th style={th}>Counts</th><th style={{ ...th, ...num }}>Credits due</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td style={td} colSpan={6}><span style={muted}>No job has a container yet. Pick a job below and add one, or fill it with demo data.</span></td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} style={r.sum.missingMoneyWeek > 0 ? { background: 'var(--bg-amber-100)' } : undefined}>
                  <td style={td}><button type="button" style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }} onClick={() => setJob(r.id)}>{jobLabel(r.job, r.id)}</button></td>
                  <td style={{ ...td, ...num }}>{r.sum.containers}{listPlaces(r.id).length > 1 ? <span style={muted}> · {listPlaces(r.id).length} places</span> : null}</td>
                  <td style={{ ...td, ...num }}>{r.sum.onSiteLines}</td>
                  <td style={{ ...td, ...num, fontWeight: r.sum.missingMoneyWeek > 0 ? 700 : 400 }}><Money n={r.sum.missingMoneyWeek} /></td>
                  <td style={td}>{r.sum.stale.length === 0 ? <span style={chip('green')}>all this fortnight</span> : <span style={chip('amber')} title={r.sum.stale.map((c) => `${c.label} ${lastCountedAt(listMovements(r.id), c.id) ? `${daysSince(lastCountedAt(listMovements(r.id), c.id)!.at, now)} d` : 'never'}`).join(' · ')}>{staleWords(r.sum.stale)}</span>}</td>
                  <td style={{ ...td, ...num }}>{r.sum.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ ...muted, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            Open a job
            <select aria-label="Open a job" defaultValue="" onChange={(e) => { if (e.target.value) setJob(e.target.value) }} style={{ minHeight: 36, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', padding: '0 0.5rem', maxWidth: 360 }}>
              <option value="">Choose…</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{jobLabel(j, j.id)}</option>)}
            </select>
          </label>
          <span style={{ ...muted, fontSize: '0.75rem' }}>Spike: rows live on this device only.</span>
        </div>
      </div>
    )
  }

  return <JobView jobId={jobId} job={allJobs.find((j) => j.id === jobId)} byUserId={byUserId} byName={byName} onBack={() => setJob(null)} onOpenJobDetail={onOpenJobDetail} showToast={showToast} />
}

function JobView({ jobId, job, byUserId, byName, onBack, onOpenJobDetail, showToast }: { jobId: string; job: MaterialsJob | undefined; byUserId: string | null; byName: string; onBack: () => void; onOpenJobDetail: (id: string) => void; showToast: (m: string, t: 'success' | 'info' | 'error') => void }) {
  const now = new Date()
  const containers = listContainers(jobId).filter((c) => !c.retiredAt)
  const movements = listMovements(jobId)
  const places = listPlaces(jobId)
  const photos = listPhotos(jobId)
  const lines = containerLines(movements)
  const diffs = countDiffs(movements)
  const sum = jobMaterialsSummary(containers, movements, now)
  const [section, setSection] = useState<'onsite' | 'missing' | 'deliveries' | 'history'>('onsite')
  /** The green pill's two views: the list of boxes, or the site map (#209: the map is a view of On site, not a fifth step). */
  const [onSiteView, setOnSiteView] = useState<'list' | 'map'>('list')
  const flow = officeFlow(containers, movements, now, priceOf)
  const load = useOnSiteJob(jobId)
  /** The On site list narrowed to what needs a hand: boxes due a count, boxes with a Can't find since their last count. */
  const [onSiteFilter, setOnSiteFilter] = useState<'all' | 'due' | 'cannot'>('all')
  // The manifest: an invoice's text pasted, read into lines, looked over once, landed as a delivery into Unsorted.
  const [invoiceText, setInvoiceText] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [parsed, setParsed] = useState<ParsedLine[] | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [agentOpen, setAgentOpen] = useState(false)
  /** The job's Drive folder: where the invoice goes, as every job file does (#164). The app reads it from there. */
  const driveLink = (job?.google_drive_link ?? '').trim()
  const driveIsFolder = /drive\.google\.com\/drive\/(u\/\d+\/)?folders\//.test(driveLink)
  const comparison = manifestComparison(movements, priceOf)
  const boxCount = containers.filter((c) => c.kind !== 'unsorted').length
  const cannotBoxes = containers.filter((c) => c.kind !== 'unsorted' && linesOf(lines, c.id).some((l) => l.cannotFindSinceCount > 0))
  const shownContainers = onSiteFilter === 'all' ? containers : onSiteFilter === 'due' ? containers.filter((c) => sum.stale.some((s) => s.id === c.id)) : cannotBoxes
  /** One row per invoice or PO that landed: the Delivered rows with a source, newest first. */
  const deliveries = (() => {
    const by = new Map<string, { source: string; at: string; by: string; lines: number; qty: number }>()
    for (const m of movements) {
      if (m.reason !== 'delivered' || !m.source) continue
      const d = by.get(m.source) ?? { source: m.source, at: m.at, by: m.byName, lines: 0, qty: 0 }
      d.lines += 1
      d.qty += m.quantity
      if (m.at > d.at) d.at = m.at
      by.set(m.source, d)
    }
    return [...by.values()].sort((a, b) => (a.at < b.at ? 1 : -1))
  })()
  const walkedMoney = comparison.reduce((s, r) => s + (r.money ?? 0), 0)
  const readLines = () => { setParsed(parseInvoiceText(invoiceText)); const no = invoiceNumber(invoiceText); if (no && !invoiceNo.trim()) setInvoiceNo(no) }
  const landLines = () => {
    if (!parsed || parsed.length === 0) return
    const un = unsortedContainer(jobId)
    const source = invoiceNo.trim() || 'invoice'
    for (const l of parsed) {
      addMovement({ jobId, partId: null, partName: l.name, manufacturer: null, quantity: l.quantity, reason: 'delivered', fromContainerId: null, toContainerId: un.id, note: l.unit ? `${l.unit.toLowerCase()}` : '', byUserId, byName, source })
      if (l.unitPrice != null) rememberPrice(partKey(null, l.name), l.unitPrice)
    }
    showToast(`${parsed.length} ${parsed.length === 1 ? 'line' : 'lines'} from ${source} landed in Unsorted as a delivery.`, 'success')
    setParsed(null)
    setInvoiceText('')
    setInvoiceNo('')
  }
  const addr = job?.job_address?.trim() ?? ''
  const geocodeAsk = useMemo(() => (addr ? [{ key: normalizeAddressForGeocodeKey(addr), display: addr }] : []), [addr])
  const { coords: jobCoords } = useAddressGeocodeCoords(geocodeAsk, addr.length > 0, 'on-site map')
  const jobCenter = addr ? (jobCoords.get(normalizeAddressForGeocodeKey(addr)) ?? null) : null
  const mapPins: OnSiteMapPin[] = containers.filter((c) => c.lat != null && c.lng != null).map((c) => ({ id: c.id, label: c.label, lat: c.lat as number, lng: c.lng as number, tone: c.kind !== 'unsorted' && countIsDue(lastCountedAt(movements, c.id), now) ? 'amber' : 'ok' }))
  const [reasonFilter, setReasonFilter] = useState<string>('')
  const [whoFilter, setWhoFilter] = useState<string>('')
  const [window, setWindow] = useState<7 | 30>(7)
  /** The labels window: every box, or one (`only`) from a panel's Label button or the phone's link (`?label=<id>`). */
  const [labelsOpen, setLabelsOpen] = useState<{ only: string | null } | null>(null)
  const [labelParams, setLabelParams] = useSearchParams()
  useEffect(() => {
    const id = labelParams.get('label')
    if (!id) return
    setLabelsOpen({ only: id })
    setLabelParams((p) => { const n = new URLSearchParams(p); n.delete('label'); return n }, { replace: true })
  }, [labelParams, setLabelParams])
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newWhere, setNewWhere] = useState('')
  const [newPlaceId, setNewPlaceId] = useState<string>('')
  const [newPlaceName, setNewPlaceName] = useState('')
  const [correcting, setCorrecting] = useState<{ line: ContainerLine; value: string } | null>(null)
  const byLabel = (id: string | null) => containers.find((c) => c.id === id)?.label ?? (id ? 'a retired container' : '')
  const people = [...new Set(movements.map((m) => m.byName))].sort()
  const since = new Date(now.getTime() - window * 86_400_000).toISOString()
  const missingRows = diffs.filter((d) => d.at >= since && d.diff !== 0)
  const cannotRows = movements.filter((m) => m.reason === 'cannot_find' && m.at >= since)
  const weekMoney = sum.missingMoneyWeek

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      {/* One line that flows: the back chevron, the job with its address (which drops under the name when there is no room), Open the job pinned right. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
        <button type="button" aria-label="Back to the Materials desk" title="Materials desk" style={{ ...btn, width: 36, height: 36, minHeight: 36, padding: 0, justifyContent: 'center', flex: '0 0 auto', lineHeight: 1 }} onClick={onBack}>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" style={{ display: 'block' }}><path d="M8 1.5 3.5 6 8 10.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ flex: '1 1 auto', minWidth: 0, display: 'grid', gap: 1 }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{jobLabel(job, jobId)}</h2>
          {job?.job_address ? <span style={{ ...muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{job.job_address}</span> : null}
        </div>
        <button type="button" style={{ ...btn, minHeight: 32, fontSize: '0.8rem', fontWeight: 500, flex: '0 0 auto', whiteSpace: 'nowrap' }} onClick={() => onOpenJobDetail(jobId)}>Open the job</button>
      </div>
      {!load.loaded && load.loading ? <p style={{ ...muted, margin: 0 }}>Loading the boxes…</p> : null}
      <OfflineRetryPanel failure={load.error ? recoveryFailureFromError(load.raw, 'The boxes on this job did not load.') : null} onRetry={load.retry} surface="materials-on-site-office" idempotent />
      {/* The flow row (#209): the material's path left to right at the pills' height — came in → on site → used → missing — each figure in its colour, a badge where a hand is needed. */}
      <FlowRow
        role="tabs"
        label="Materials on site"
        pills={[
          { key: 'deliveries', word: 'came in', figure: flowFigure(flow.cameIn), tone: 'in', badge: flow.unsorted > 0 ? { text: flowFigure(flow.unsorted) } : null, on: section === 'deliveries', title: `${flowFigure(flow.cameIn)} pieces came in on ${deliveries.length} ${deliveries.length === 1 ? 'delivery' : 'deliveries'}${flow.unsorted > 0 ? ` · ${flowFigure(flow.unsorted)} waiting in Unsorted` : ''}`, onPress: () => setSection('deliveries') },
          { key: 'onsite', word: 'on site', figure: flowFigure(flow.onSite), tone: 'here', badge: flow.due > 0 ? { text: flowFigure(flow.due) } : null, on: section === 'onsite', title: `${flowFigure(flow.onSite)} pieces on site in ${flow.boxes} ${flow.boxes === 1 ? 'box' : 'boxes'}${flow.due > 0 ? ` · ${flow.due} need a hand` : ''}`, onPress: () => setSection('onsite') },
          { key: 'history', word: 'used', figure: flowFigure(flow.used), tone: 'out', on: section === 'history', title: `${flowFigure(flow.used)} pieces used · ${flowFigure(movements.length)} presses`, onPress: () => setSection('history') },
          { key: 'missing', word: 'missing', figure: flowFigure(flow.missing), tone: 'gap', badge: flow.missingMoney > 0 ? { text: money(flow.missingMoney), red: true } : null, on: section === 'missing', title: flow.missing > 0 ? `${flowFigure(flow.missing)} pieces missing this week · ${money(flow.missingMoney)} walked away` : 'Nothing missing this week', onPress: () => setSection('missing') },
        ]}
        trailing={section === 'onsite' ? (['list', 'map'] as const).map((v) => (
          <button key={v} type="button" aria-pressed={onSiteView === v} style={{ ...btn, minHeight: 28, fontSize: '0.75rem', padding: '0 0.6rem', borderRadius: 999, flex: '0 0 auto', whiteSpace: 'nowrap', ...(onSiteView === v ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) }} onClick={() => setOnSiteView(v)}>{v === 'list' ? 'List' : mapPins.length ? `Map · ${mapPins.length}` : 'Map'}</button>
        )) : null}
      />

      {section === 'onsite' && onSiteView === 'list' ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', scrollbarWidth: 'none', flex: '1 1 260px', minWidth: 0, paddingBottom: 2 }}>
            {([['all', `All · ${boxCount}`], ['due', `Due a count · ${sum.stale.length}`], ['cannot', `Can't find · ${cannotBoxes.length}`]] as const).map(([k, label]) => (
              <button key={k} type="button" style={{ ...btn, minHeight: 32, fontSize: '0.8rem', borderRadius: 999, flex: '0 0 auto', whiteSpace: 'nowrap', ...(onSiteFilter === k ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}), ...(k === 'due' && sum.stale.length === 0 ? { opacity: 0.5 } : {}), ...(k === 'cannot' && cannotBoxes.length === 0 ? { opacity: 0.5 } : {}) }} onClick={() => setOnSiteFilter(k)}>{label}</button>
            ))}
            </div>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', flex: '0 0 auto' }}>
              <button type="button" style={btn} onClick={() => setAdding((v) => !v)}>Add a container</button>
              <button type="button" style={{ ...btn, fontWeight: 500 }} disabled={boxCount === 0} onClick={() => setLabelsOpen({ only: null })}>Print labels</button>
            </span>
          </div>
      {adding ? (
        <div style={{ ...sec, padding: '0.75rem 0.9rem', display: 'flex', gap: '0.5rem', alignItems: 'end', flexWrap: 'wrap' }}>
          <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8rem', fontWeight: 600 }}>The stencil<input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="A1" aria-label="The stencil" style={{ minHeight: 36, borderRadius: 8, border: '1px solid var(--border-strong)', padding: '0 0.6rem', font: 'inherit', fontWeight: 800, textTransform: 'uppercase', width: 90, background: 'var(--surface)', color: 'var(--text-strong)' }} /></label>
          <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8rem', fontWeight: 600 }}>Which place<select value={newPlaceId} onChange={(e) => { setNewPlaceId(e.target.value); setNewPlaceName('') }} aria-label="Which place" style={{ minHeight: 36, borderRadius: 8, border: '1px solid var(--border-strong)', padding: '0 0.4rem', font: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)', maxWidth: 220 }}><option value="">No place yet</option>{places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8rem', fontWeight: 600 }}>Or a new place<input value={newPlaceName} onChange={(e) => setNewPlaceName(e.target.value)} placeholder="Laydown yard" aria-label="A new place" style={{ minHeight: 36, borderRadius: 8, border: '1px solid var(--border-strong)', padding: '0 0.6rem', font: 'inherit', width: 180, background: 'var(--surface)', color: 'var(--text-strong)' }} /></label>
          <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8rem', fontWeight: 600 }}>Where exactly<input value={newWhere} onChange={(e) => setNewWhere(e.target.value)} placeholder="by the north stair" aria-label="Where exactly" style={{ minHeight: 36, borderRadius: 8, border: '1px solid var(--border-strong)', padding: '0 0.6rem', font: 'inherit', width: 180, background: 'var(--surface)', color: 'var(--text-strong)' }} /></label>
          <button type="button" style={btnPrimary} disabled={!newLabel.trim() || containers.some((c) => c.label.toLowerCase() === newLabel.trim().toLowerCase())} onClick={() => { const loc = newPlaceName.trim() ? addPlace({ jobId, name: newPlaceName }).id : newPlaceId || null; addContainer({ jobId, label: newLabel.trim().toUpperCase(), kind: 'cage', where: newWhere, locationId: loc }); setNewLabel(''); setNewWhere(''); setNewPlaceName(''); setAdding(false); showToast(`${newLabel.trim().toUpperCase()} added.`, 'success') }}>Add {newLabel.trim().toUpperCase() || 'it'}</button>
          <span style={muted}>A cage, unless the crew says otherwise on their phone.</span>
        </div>
      ) : null}
          {(
        containers.length === 0 ? (
          <div style={sec}>
            <EmptyState main="No containers on this site yet." next={{ label: 'Add a container', onPress: () => setAdding(true) }} tail="adds the first with its stencil. Then a crew presses Count this box on each, and the first count is the truth." />
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {groupByPlace(shownContainers, places).map((g) => (
              <div key={g.place?.id ?? (g.containers[0]?.kind === 'unsorted' ? 'unsorted' : 'none')} style={{ display: 'grid', gap: '0.5rem' }}>
                {places.length > 0 && g.containers[0]?.kind !== 'unsorted' ? <h3 style={{ margin: '0.25rem 0 0', fontSize: '0.95rem', color: 'var(--text-strong)' }}>{g.place?.name ?? 'No place yet'} <span style={{ ...muted, fontWeight: 400 }}>· {g.containers.length} {g.containers.length === 1 ? 'container' : 'containers'}</span></h3> : null}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(480px, 100%), 1fr))', gap: '0.75rem' }}>
            {g.containers.map((c) => {
              const ls = linesOf(lines, c.id)
              const last = lastCountedAt(movements, c.id)
              const due = c.kind !== 'unsorted' && countIsDue(last, now)
              return (
                <div key={c.id} style={{ ...sec, borderColor: due ? 'var(--text-amber-800)' : 'var(--border)' }}>
                  <h3 style={secH}><span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{c.label}</span><span style={{ fontWeight: 500 }}>{c.kind === 'unsorted' ? 'delivered, not assigned storage' : `${c.kind}${c.where ? ` · ${c.where}` : ''}`}</span><span style={{ marginLeft: 'auto', ...muted, ...(due ? { color: 'var(--text-amber-700)', fontWeight: 600 } : {}) }}>{c.kind === 'unsorted' ? '' : lastCountWords(last, now)}</span>{c.kind !== 'unsorted' ? <button type="button" aria-label={`Print the label for ${c.label}`} title={`Print the label for ${c.label}: the stencil, the code and its lines to write on`} style={{ ...btn, minHeight: 28, fontSize: '0.75rem', padding: '0 0.55rem', fontWeight: 500, flex: '0 0 auto' }} onClick={() => setLabelsOpen({ only: c.id })}>Label</button> : null}{(() => { const ps = photos.filter((p) => p.containerId === c.id); return ps.length ? <span title={ps.map((p) => p.fileName).join('\n')} style={{ ...muted, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 500 }}><CameraGlyph /> {photoMarkWords(ps, now)}</span> : null })()}</h3>
                  {(() => { const ps = photos.filter((p) => p.containerId === c.id); return ps.length ? <div style={{ padding: '0.5rem 0.9rem 0.25rem' }}><BoxPhotos photos={ps} canAct={false} size={44} /></div> : null })()}
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead><tr><th style={{ ...th, minWidth: 150 }}>Part</th><th style={{ ...th, ...num }}>On hand</th><th style={th}>Last count</th><th style={{ ...th, width: 160 }}></th></tr></thead>
                    <tbody>
                      {ls.length === 0 ? <tr><td style={td} colSpan={4}><span style={muted}>Empty.</span></td></tr> : null}
                      {ls.map((l) => {
                        const flagged = l.cannotFindSinceCount > 0 || (l.lastCountDiff ?? 0) < 0
                        const editing = correcting?.line.partKey === l.partKey && correcting.line.containerId === l.containerId
                        return (
                          <tr key={l.partKey} style={flagged ? { background: 'var(--bg-amber-100)' } : undefined}>
                            <td style={td}>{l.partName}{l.manufacturer ? <span style={muted}> · {l.manufacturer}</span> : null}{!l.partId ? <span style={{ ...muted, fontSize: '0.7rem', marginLeft: '0.35rem' }} title="Typed on site, not yet tied to a part in the parts book">typed</span> : null}</td>
                            <td style={{ ...td, ...num, fontWeight: 700 }}>{l.onHand}</td>
                            <td style={td}>{l.lastCountDiff == null ? <span style={muted}>never</span> : l.lastCountDiff === 0 ? <span style={chip('green')}>right</span> : l.lastCountDiff < 0 ? <span style={chip('amber')}>{-l.lastCountDiff} missing</span> : <span style={chip('blue')}>{l.lastCountDiff} found</span>}{l.cannotFindSinceCount > 0 ? <> <span style={chip('amber')}>{l.cannotFindSinceCount} can't find</span></> : null}</td>
                            <td style={{ ...td, ...num }}>
                              {editing ? (
                                <span style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                                  <input type="number" value={correcting.value} aria-label="The corrected count" onChange={(e) => setCorrecting({ line: l, value: e.target.value })} style={{ width: 56, minHeight: 32, borderRadius: 6, border: '1px solid var(--border-strong)', padding: '0 0.4rem', font: 'inherit', textAlign: 'right', background: 'var(--surface)', color: 'var(--text-strong)' }} />
                                  <button type="button" style={{ ...btnPrimary, minHeight: 32, ...(correcting.value.trim() === '' ? { opacity: 0.45 } : {}) }} disabled={correcting.value.trim() === ''} onClick={() => { const n = Math.max(0, Math.round(Number(correcting.value))); addMovement({ jobId, partId: l.partId, partName: l.partName, manufacturer: l.manufacturer, quantity: n, reason: 'counted', fromContainerId: l.containerId, toContainerId: null, note: 'office correction', byUserId, byName }); setCorrecting(null); showToast(`${l.partName} in ${c.label} set to ${n}, as an office correction.`, 'success') }}>{correcting.value.trim() === '' ? 'Save' : `Save ${Math.max(0, Math.round(Number(correcting.value)))}`}</button>
                                  <button type="button" aria-label="Cancel" title="Cancel" style={{ ...btn, minHeight: 32, minWidth: 32, padding: 0, fontWeight: 500 }} onClick={() => setCorrecting(null)}>×</button>
                                </span>
                              ) : (
                                <button type="button" style={{ ...btn, minHeight: 30, fontSize: '0.75rem', fontWeight: 500 }} title="Correct the count: an office count on this line, kept as a row with a note" onClick={() => setCorrecting({ line: l, value: String(l.onHand) })}>Correct…</button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })}
                </div>
              </div>
            ))}
          </div>
        )
          )}
        </div>
      ) : null}

      {section === 'missing' ? (
        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <div style={sec}>
            <h5 style={secH}>Bought · reported · left · walked away<span style={{ marginLeft: 'auto', fontWeight: 500, fontSize: '0.75rem', color: 'var(--text-muted)' }}>per part across the job, at the invoice price where one landed</span></h5>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr><th style={{ ...th, minWidth: 180 }}>Part</th><th style={{ ...th, ...num }}>Bought</th><th style={{ ...th, ...num }}>Added on site</th><th style={{ ...th, ...num }}>Used</th><th style={{ ...th, ...num }}>Returned</th><th style={{ ...th, ...num }}>Taken, damaged</th><th style={{ ...th, ...num }}>Can’t find</th><th style={{ ...th, ...num }}>Left</th><th style={{ ...th, ...num }}>Walked away</th><th style={{ ...th, ...num }}>Money</th><th style={{ ...th, ...num }}>Last count</th></tr></thead>
              <tbody>
                {comparison.length === 0 ? <tr><td style={td} colSpan={11}><EmptyState compact main="No deliveries or presses on this job yet." next={{ label: 'Deliveries', onPress: () => setSection('deliveries') }} tail="lands the first invoice as a delivery, and the crew’s presses fill the rest." /></td></tr> : null}
                {comparison.map((r) => (
                  <tr key={r.partKey} style={r.walkedAway > 0 ? { background: 'var(--bg-amber-100)' } : undefined}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.partName}{r.manufacturer ? <span style={muted}> · {r.manufacturer}</span> : null}</td>
                    <td style={{ ...td, ...num, fontWeight: 700 }}>{r.bought}</td>
                    <td style={{ ...td, ...num }}>{r.addedOnSite || ''}</td>
                    <td style={{ ...td, ...num }}>{r.used || ''}</td>
                    <td style={{ ...td, ...num }}>{r.returned || ''}</td>
                    <td style={{ ...td, ...num }}>{r.takenOrDamaged || ''}</td>
                    <td style={{ ...td, ...num }}>{r.cannotFind || ''}</td>
                    <td style={{ ...td, ...num, fontWeight: 700 }}>{r.left}</td>
                    <td style={{ ...td, ...num, fontWeight: 700 }}>{r.walkedAway > 0 ? r.walkedAway : <span style={chip('green')}>0</span>}</td>
                    <td style={{ ...td, ...num }}>{r.money != null ? <Money n={r.money} /> : r.walkedAway > 0 ? <span style={muted}>no price</span> : ''}</td>
                    <td style={{ ...td, ...num }}>{r.lastCountAt ? <Stamp iso={r.lastCountAt} /> : <span style={chip('amber')}>never</span>}</td>
                  </tr>
                ))}
                {comparison.length ? <tr><td style={{ ...td, fontWeight: 700 }} colSpan={9}>Walked away, priced</td><td style={{ ...td, ...num, fontWeight: 700 }}><Money n={walkedMoney} /></td><td style={td}></td></tr> : null}
              </tbody>
            </table>
            <p style={{ ...muted, margin: 0, padding: '0.5rem 0.9rem 0.75rem' }}>Walked away is bought plus added, minus used, returned, taken and left. It is only as true as the Used presses and the last count: a box nobody counted can hide a gap, and an honest count shows it.</p>
          </div>
        <div style={sec}>
          <h3 style={secH}>Reported this week · counts that came up short, and every Can't find<span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.3rem' }}>{([7, 30] as const).map((d) => <button key={d} type="button" style={{ ...btn, minHeight: 28, fontSize: '0.75rem', ...(window === d ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) }} onClick={() => setWindow(d)}>{d} days</button>)}</span></h3>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={th}>Part</th><th style={th}>Container</th><th style={{ ...th, ...num }}>Expected</th><th style={{ ...th, ...num }}>Counted</th><th style={{ ...th, ...num }}>Missing</th><th style={{ ...th, ...num }}>Money</th><th style={th}>Who, when</th></tr></thead>
            <tbody>
              {missingRows.length === 0 && cannotRows.length === 0 ? <tr><td style={td} colSpan={7}><EmptyState compact main={`Nothing missing in the last ${window} days.`} /></td></tr> : null}
              {missingRows.map((d) => {
                const price = unitPrice(d)
                const m = missingMoney(d.diff, price)
                return (
                  <tr key={d.movementId} style={d.diff < 0 ? { background: 'var(--bg-amber-100)' } : undefined}>
                    <td style={td}>{d.partName}{d.manufacturer ? <span style={muted}> · {d.manufacturer}</span> : null}</td>
                    <td style={td}>{byLabel(d.containerId)}</td>
                    <td style={{ ...td, ...num }}>{d.expected}</td>
                    <td style={{ ...td, ...num }}>{d.counted}</td>
                    <td style={{ ...td, ...num, fontWeight: 700 }}>{d.diff < 0 ? -d.diff : <span style={chip('blue')}>{d.diff} found</span>}</td>
                    <td style={{ ...td, ...num }}>{m == null ? <span style={muted}>{price == null ? 'no price' : ''}</span> : <><Money n={m} /> <span style={chip('dim')}>demo price</span></>}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{d.byName} <Stamp iso={d.at} inline /></td>
                  </tr>
                )
              })}
              {cannotRows.map((m) => {
                const pk = partKey(m.partId, m.partName)
                const price = unitPrice({ partKey: pk })
                const mm = missingMoney(-m.quantity, price)
                return (
                  <tr key={m.id} style={{ background: 'var(--bg-red-100)' }}>
                    <td style={td}>{m.partName}{m.manufacturer ? <span style={muted}> · {m.manufacturer}</span> : null}</td>
                    <td style={td}>{byLabel(m.fromContainerId)}</td>
                    <td style={{ ...td, ...num }}>—</td>
                    <td style={{ ...td, ...num }}>—</td>
                    <td style={{ ...td, ...num, fontWeight: 700 }}>{m.quantity} <span style={chip('red')}>can't find</span></td>
                    <td style={{ ...td, ...num }}>{mm == null ? <span style={muted}>no price</span> : <><Money n={mm} /> <span style={chip('dim')}>demo price</span></>}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{m.byName} <Stamp iso={m.at} inline />{m.note ? <span style={muted}> · {m.note}</span> : null}</td>
                  </tr>
                )
              })}
              <tr><td style={{ ...td, fontWeight: 700 }} colSpan={5}>In the last {window} days</td><td style={{ ...td, ...num, fontWeight: 700 }}>{money(window === 7 ? weekMoney : missingRows.reduce((s, d) => s + (missingMoney(d.diff, unitPrice(d)) ?? 0), 0) + cannotRows.reduce((s, m) => s + (missingMoney(-m.quantity, unitPrice({ partKey: partKey(m.partId, m.partName) })) ?? 0), 0))}</td><td style={td}></td></tr>
            </tbody>
          </table>
        </div>
        </div>
      ) : null}

      {section === 'deliveries' ? (
        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <div style={sec}>
            <h5 style={secH}>Land an invoice as a delivery<span style={{ marginLeft: 'auto', fontWeight: 500, fontSize: '0.75rem', color: 'var(--text-muted)' }}>The invoice lives in the job’s Drive folder. The app reads it from there and shows the lines for a once-over before they land.</span></h5>
            <div style={{ padding: '0.75rem 0.9rem', display: 'grid', gap: '0.6rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {driveLink ? (
                  <a href={driveLink} target="_blank" rel="noopener noreferrer" style={{ ...btnPrimary, minHeight: 40, textDecoration: 'none' }}>Add the invoice to the job’s Drive folder</a>
                ) : (
                  <button type="button" style={{ ...btnPrimary, minHeight: 40 }} onClick={() => onOpenJobDetail(jobId)}>Set the job’s Drive folder</button>
                )}
                <button type="button" style={{ ...btn, fontWeight: 500 }} onClick={() => setPasteOpen((v) => !v)}>{pasteOpen ? 'Hide the text' : 'Paste the text instead'}</button>
                <button type="button" style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }} onClick={() => setAgentOpen(true)}>Or have your agent do it via MCP</button>
                <label style={{ ...muted, display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>Invoice #<input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="INV-48812" aria-label="Invoice number" style={{ minHeight: 32, borderRadius: 6, border: '1px solid var(--border-strong)', padding: '0 0.5rem', font: 'inherit', width: 130, background: 'var(--surface)', color: 'var(--text-strong)' }} /></label>
              </div>
              <p style={{ ...muted, margin: 0 }}>{driveLink ? (driveIsFolder ? 'The folder opens in Drive. Drop the invoice there, PDF or photo. The build reads new invoices from that folder with the model and lists them here; until then, paste the text.' : 'The job’s Drive link is not a folder. Edit the job and paste its folder link, then drop the invoice there.') : 'This job has no Drive folder yet. Edit the job and paste its folder link; every file of the job lives there.'}</p>
              {pasteOpen ? <textarea value={invoiceText} onChange={(e) => { setInvoiceText(e.target.value); setParsed(null) }} rows={7} placeholder={'25  EA  3/4" copper 90   4.70   117.50\n4   EA  3/4" ball valve  18.60   74.40'} aria-label="The invoice’s text" style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid var(--border-strong)', padding: '0.5rem 0.7rem', font: 'inherit', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8rem', background: 'var(--surface)', color: 'var(--text-strong)' }} /> : null}
              {pasteOpen ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" style={{ ...btnPrimary, ...(invoiceText.trim() ? {} : { opacity: 0.45 }) }} disabled={!invoiceText.trim()} onClick={readLines}>Read the lines</button>
                  <button type="button" style={{ ...btn, fontWeight: 500 }} onClick={() => { setInvoiceText(SAMPLE_INVOICE_TEXT); setParsed(null) }}>Try a sample invoice</button>
                </div>
              ) : null}
              {parsed ? (
                parsed.length === 0 ? (
                  <p style={{ ...muted, margin: 0 }}>No line read as a quantity and a part. A line reads when it starts with a count, like “25 EA 3/4 copper 90”, or ends with one.</p>
                ) : (
                  <>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead><tr><th style={{ ...th, ...num }}>Qty</th><th style={th}>Unit</th><th style={th}>Part, as the invoice names it</th><th style={{ ...th, ...num }}>Price</th><th style={th}></th></tr></thead>
                      <tbody>
                        {parsed.map((l, i) => (
                          <tr key={i}>
                            <td style={{ ...td, ...num }}><input type="number" value={l.quantity} aria-label="Quantity" onChange={(e) => setParsed(parsed.map((x, j) => (j === i ? { ...x, quantity: Math.max(0, Math.round(Number(e.target.value))) } : x)))} style={{ width: 64, minHeight: 30, borderRadius: 6, border: '1px solid var(--border-strong)', padding: '0 0.4rem', font: 'inherit', textAlign: 'right', background: 'var(--surface)', color: 'var(--text-strong)' }} /></td>
                            <td style={{ ...td, ...muted }}>{l.unit ?? ''}</td>
                            <td style={td}><input value={l.name} aria-label="Part" onChange={(e) => setParsed(parsed.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} style={{ width: '100%', boxSizing: 'border-box', minHeight: 30, borderRadius: 6, border: '1px solid var(--border-strong)', padding: '0 0.5rem', font: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)' }} /></td>
                            <td style={{ ...td, ...num }}>{l.unitPrice != null ? money(l.unitPrice) : <span style={muted}>—</span>}</td>
                            <td style={{ ...td, ...num }}><button type="button" aria-label="Leave this line out" title="Leave this line out" style={{ ...btn, minHeight: 30, minWidth: 30, padding: 0, fontWeight: 500 }} onClick={() => setParsed(parsed.filter((_, j) => j !== i))}>×</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button type="button" style={{ ...btnPrimary, minHeight: 40 }} disabled={parsed.filter((l) => l.quantity > 0 && l.name.trim()).length === 0} onClick={landLines}>Add {parsed.filter((l) => l.quantity > 0 && l.name.trim()).length} {parsed.length === 1 ? 'line' : 'lines'} to Unsorted as a delivery</button>
                      <span style={muted}>Each line becomes a Delivered row with the invoice as its source. A crew puts them in cages from Unsorted.</span>
                    </div>
                  </>
                )
              ) : null}
            </div>
          </div>
          <div style={sec}>
            <h5 style={secH}>Deliveries so far<span style={{ marginLeft: 'auto', fontWeight: 500, fontSize: '0.75rem', color: 'var(--text-muted)' }}>one row per invoice or PO that landed</span></h5>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr><th style={th}>Source</th><th style={th}>When</th><th style={th}>By</th><th style={{ ...th, ...num }}>Lines</th><th style={{ ...th, ...num }}>Pieces</th></tr></thead>
              <tbody>
                {deliveries.length === 0 ? <tr><td style={td} colSpan={5}><span style={muted}>No delivery has landed yet. Paste an invoice above, or mark lines delivered on the bid's Procure step.</span></td></tr> : null}
                {deliveries.map((d) => (
                  <tr key={d.source}><td style={{ ...td, fontWeight: 700 }}>{d.source}</td><td style={td}>{when(d.at)}</td><td style={td}>{d.by}</td><td style={{ ...td, ...num }}>{d.lines}</td><td style={{ ...td, ...num }}>{d.qty}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {section === 'history' ? (
        <div style={sec}>
          <h3 style={secH}>History · every press, newest first
            <select aria-label="Filter by reason" value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)} style={{ marginLeft: 'auto', minHeight: 30, borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.8rem', fontWeight: 500 }}>
              <option value="">Every reason</option>
              {Object.entries(REASON_WORDS).map(([k, w]) => <option key={k} value={k}>{w.past}</option>)}
            </select>
            <select aria-label="Filter by person" value={whoFilter} onChange={(e) => setWhoFilter(e.target.value)} style={{ minHeight: 30, borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.8rem', fontWeight: 500 }}>
              <option value="">Everyone</option>
              {people.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </h3>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={th}>When</th><th style={th}>What</th><th style={th}>Part</th><th style={{ ...th, ...num }}>Qty</th><th style={th}>Where</th><th style={th}>Who</th><th style={th}>Note</th></tr></thead>
            <tbody>
              {[...movements].sort((a, b) => (a.at < b.at ? 1 : -1)).filter((m) => (!reasonFilter || m.reason === reasonFilter) && (!whoFilter || m.byName === whoFilter)).map((m) => {
                const sign = m.reason === 'counted' ? '' : m.reason === 'delivered' ? '+' : m.reason === 'moved' ? '' : '−'
                const where = m.reason === 'delivered' ? `→ ${byLabel(m.toContainerId)}${m.source ? ` · ${m.source}` : ''}` : m.reason === 'moved' ? `${byLabel(m.fromContainerId)} → ${byLabel(m.toContainerId)}` : m.reason === 'returned' ? `${byLabel(m.fromContainerId)} → the supply house` : m.reason === 'taken' ? `${byLabel(m.fromContainerId)} → ${m.note || 'off site'}` : byLabel(m.fromContainerId)
                return (
                  <tr key={m.id}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{when(m.at)}</td>
                    <td style={td}>{REASON_WORDS[m.reason].past}{m.reason === 'returned' ? <> <span style={chip('blue')}>credit due</span></> : null}</td>
                    <td style={td}>{m.partName}</td>
                    <td style={{ ...td, ...num }}>{sign}{m.quantity}</td>
                    <td style={td}>{where}</td>
                    <td style={td}>{m.byName}</td>
                    <td style={{ ...td, ...muted }}>{m.reason === 'taken' ? '' : m.note}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {section === 'onsite' && onSiteView === 'map' ? (
        <div style={{ ...sec, padding: '0.75rem 0.9rem', display: 'grid', gap: '0.5rem' }}>
          <p style={{ margin: 0, ...muted }}>{mapPins.length ? `${mapPins.length} of ${containers.filter((c) => c.kind !== 'unsorted').length} boxes pinned by the crew. Amber pins are due a count.` : 'No box is pinned yet. A crew pins a box from its screen on the phone, where they stand.'}</p>
          <Suspense fallback={<p style={muted}>Loading the map…</p>}>
            <OnSiteMapLazy center={jobCenter} pins={mapPins} height={560} />
          </Suspense>
        </div>
      ) : null}


      {agentOpen ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setAgentOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Have your agent land it" style={{ ...sec, overflow: 'auto', width: 'min(560px, 100%)', maxHeight: '90vh', padding: '1rem 1.25rem', display: 'grid', gap: '0.75rem', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Have your agent land it</h2>
            <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.45rem', fontSize: '0.9rem' }}>
              <li>Connect the agent to the dev MCP server: Settings → Your account → Dev MCP keys → Issue a key.</li>
              <li>Tell it in words: <i>“Land invoice 48812 on job 972 from the PDF in my downloads.”</i></li>
              <li>Coming next: it reads the file, calls <code>plan_delivery</code> and shows you the lines. You say yes. It calls <code>apply_delivery</code> with the plan’s hash, and the lines land in Unsorted with the invoice as their source, the same as the button here.</li>
            </ol>
            <p style={{ ...muted, margin: 0 }}>The verbs, when they land: <code>read_on_site(job)</code> for the containers, the lines and what is missing; <code>plan_delivery</code> → <code>apply_delivery</code> for an invoice or a PO; <code>plan_count</code> → <code>apply_count</code> for an office correction. They land with the tables in the first build PR. Until then the spike keeps its rows on this device, where an agent cannot reach them.</p>
            <button type="button" style={{ ...btn, justifySelf: 'end' }} onClick={() => setAgentOpen(false)}>Close</button>
          </div>
        </div>
      ) : null}
      {labelsOpen ? <LabelsModal jobLabel={jobLabel(job, jobId)} containers={containers.filter((c) => c.kind !== 'unsorted')} lines={lines} places={places} only={labelsOpen.only} onClose={() => setLabelsOpen(null)} /> : null}
    </div>
  )
}

/** The half sheet per container: the stencil big, the job, a QR that is a plain link to the container's screen. Always light, for paper. */
function LabelsModal({ jobLabel: jl, containers, lines, places, only, onClose }: { jobLabel: string; containers: Container[]; lines: ContainerLine[]; places: ReadonlyArray<{ id: string; name: string }>; only: string | null; onClose: () => void }) {
  const shown = only ? containers.filter((c) => c.id === only) : containers
  const one = shown.length === 1 ? shown[0] : null
  const lth: CSSProperties = { textAlign: 'left', padding: '0.2rem 0.3rem', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#374151', borderBottom: '2px solid #111827' }
  /** Rows tall enough for a pen on paper: about 8 mm printed. */
  const cell: CSSProperties = { borderBottom: '1px solid #9ca3af', padding: '0 0.3rem', height: '1.9rem', fontSize: '0.84rem', verticalAlign: 'bottom', color: '#111827' }
  return (
    <div className="on-site-labels" style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={onClose}>
      {/* Printing draws the labels alone, one a sheet: the page behind and the window's chrome stay off the paper. */}
      <style>{`@media print { body * { visibility: hidden !important; } .on-site-labels, .on-site-labels * { visibility: visible !important; } .on-site-labels { position: absolute !important; inset: 0 !important; padding: 0 !important; background: #fff !important; display: block !important; } .on-site-labels-dialog { box-shadow: none !important; max-height: none !important; width: 100% !important; border-radius: 0 !important; padding: 0 !important; overflow: visible !important; } .on-site-labels-chrome { display: none !important; } .on-site-label { break-inside: avoid; page-break-inside: avoid; border-radius: 0 !important; } }`}</style>
      <div role="dialog" aria-modal="true" aria-label={one ? `Print the label for ${one.label}` : 'Print labels'} className="on-site-labels-dialog" data-theme="light" style={{ background: '#ffffff', color: '#111827', borderRadius: 10, width: 'min(640px, 100%)', maxHeight: '90vh', overflow: 'auto', padding: '1rem 1.25rem', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div className="on-site-labels-chrome" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{one ? `Label · ${one.label}` : `Labels · ${jl}`}</h2>
            <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{one ? 'One sheet: the stencil, the code, and the lines to write on.' : `${shown.length} ${shown.length === 1 ? 'label' : 'labels'}, one a sheet. The camera opens the box from the code.`}</span>
          </div>
          <button type="button" style={{ ...btnPrimary, flex: '0 0 auto' }} onClick={() => window.print()}>{shown.length === 1 ? 'Print 1 label' : `Print ${shown.length} labels`}</button>
          <button type="button" style={{ ...btn, flex: '0 0 auto' }} onClick={onClose}>Close</button>
        </div>
        <div style={{ display: 'grid', gap: '0.9rem' }}>
          {shown.map((c) => {
            const rows = labelRows(linesOf(lines, c.id))
            const place = places.find((p) => p.id === c.locationId)?.name ?? ''
            const kind = c.kind === 'box' ? 'box' : c.kind === 'cage' ? 'cage' : 'pile'
            return (
              <div key={c.id} className="on-site-label" style={{ border: '2px solid #111827', borderRadius: 10, padding: '0.9rem 1rem', display: 'grid', gap: '0.7rem', breakInside: 'avoid' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 104px', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '3.4rem', fontWeight: 900, lineHeight: 1, letterSpacing: '0.02em' }}>{c.label}</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.4rem' }}>{jl}</div>
                    <div style={{ fontSize: '0.78rem', color: '#374151' }}>{c.kind}{place ? ` · ${place}` : ''}{c.where ? ` · ${c.where}` : ''}</div>
                  </div>
                  <div style={{ display: 'grid', justifyItems: 'center', gap: 2 }}>
                    <QRCodeSVG value={boxUrl(c.id)} size={96} level="M" bgColor="#ffffff" fgColor="#111111" marginSize={1} />
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', color: '#374151' }}>{boxCode(c.id)}</div>
                  </div>
                </div>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead><tr><th style={lth}>In this {kind}</th><th style={{ ...lth, width: 64, textAlign: 'right' }}>On hand</th><th style={{ ...lth, width: 80, textAlign: 'right' }}>Counted</th></tr></thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td style={cell}>{r ? <>{r.partName}{r.manufacturer ? <span style={{ color: '#6b7280' }}> · {r.manufacturer}</span> : null}</> : null}</td>
                        <td style={{ ...cell, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r ? r.onHand : null}</td>
                        <td style={cell}></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Scan the code to open this {kind} on your phone, or go to {boxAddress(c.id)}. Write what you add on a blank line.</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
