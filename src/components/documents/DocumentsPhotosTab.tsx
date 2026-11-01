/**
 * Documents → Photos (punch list #232, v2.6270): every photo uploaded to the app, newest first, across every job the
 * reader may see. A search box and two rows of chips (the source, and where the photo is) are asked of the server;
 * the rows group by day, each with its thumbnail, its caption, its job and customer, its source and person and time,
 * and the Drive line in the row's own words with the press that goes with it. A thumbnail opens the viewer; the
 * job's name opens the job window; the source chip opens the report's card, the Tally's On site tab on that box, or
 * the Messages thread. The rules are `lib/photos/uploadedPhotos.ts`; the reads `uploadedPhotosIo.ts`.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { supabase } from '../../lib/supabase'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { EmptyState } from '../EmptyState'
import { documentsQuietButton } from '../jobs/jobDocumentsStyles'
import { boxOnSiteLink } from '../../lib/materials/boxSearch'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { driveFileUrl } from '../../lib/photos/reportPhotos'
import { reportForViewFromJobLedgerRow, type ReportForJobLedgerRow } from '../../lib/reportForViewFromJobLedgerRow'
import ReportViewModal, { type ReportForView } from '../ReportViewModal'
import {
  PHOTOS_FOOT,
  PHOTOS_PAGE,
  captionWords,
  dayGroups,
  jobWindowPath,
  jobWords,
  photosEmptyWords,
  photosNarrowed,
  sizeWords,
  sourceChips,
  sourceWords,
  threadPath,
  timeWords,
  whereChips,
  whereWords,
  whoWords,
  type SourcePick,
  type UploadedPhotoRow,
  type WherePick,
} from '../../lib/photos/uploadedPhotos'
import { supabaseUploadedPhotosIo, type UploadedPhotosIo, type UploadedPhotosRead } from '../../lib/photos/uploadedPhotosIo'
import { UploadedPhotoTile } from './UploadedPhotoTile'
import { UploadedPhotoViewer } from './UploadedPhotoViewer'

/** Above the job window (1010) and the viewer (1100), so a report's card opened from the viewer reads on top. */
const REPORT_Z_INDEX = 1150

const chipStyle = (on: boolean): CSSProperties => ({
  ...documentsQuietButton,
  borderRadius: 999,
  ...(on ? { background: 'var(--bg-blue-tint)', border: '1px solid #3b82f6', color: 'var(--text-blue-700)', fontWeight: 600 } : {}),
})
const chipLabel: CSSProperties = { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.2rem' }
const dayHead: CSSProperties = { fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.6rem 0 0.15rem', borderBottom: '1px solid var(--border)', margin: 0 }
const rowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr) auto', gap: '0.75rem', alignItems: 'center', padding: '0.5rem 0.25rem', borderBottom: '1px solid var(--border)' }
const nameBtn: CSSProperties = { border: 'none', background: 'transparent', padding: 0, font: 'inherit', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }
const linkBtn: CSSProperties = { border: 'none', background: 'transparent', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }
const srcChip: CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '0 0.45rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, border: '1px solid var(--border-strong)', color: 'var(--text-700)', background: 'var(--surface)', lineHeight: '18px', cursor: 'pointer' }
const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)' }

/** A report's card from the job's own list, found by its id; null when the read refuses or the report is gone. */
async function loadReportForView(jobId: string, reportId: string): Promise<ReportForView | null> {
  const { data, error } = await supabase.rpc('list_reports_for_job_ledger', { p_job_id: jobId })
  if (error) return null
  const row = ((data ?? []) as ReportForJobLedgerRow[]).find((r) => r.id === reportId)
  return row ? reportForViewFromJobLedgerRow(row) : null
}

export function DocumentsPhotosTab({ io: givenIo, loadReport = loadReportForView }: { io?: UploadedPhotosIo; loadReport?: (jobId: string, reportId: string) => Promise<ReportForView | null> }) {
  const io = useMemo(() => givenIo ?? supabaseUploadedPhotosIo(), [givenIo])
  const { role } = useAuth()
  const navigate = useNavigate()
  const jobDetail = useJobDetailModal()
  const [source, setSource] = useState<SourcePick>('all')
  const [where, setWhere] = useState<WherePick>('everywhere')
  const [typed, setTyped] = useState('')
  const [asked, setAsked] = useState('')
  const [limit, setLimit] = useState(PHOTOS_PAGE)
  const [read, setRead] = useState<UploadedPhotosRead | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(false)
  const [waiting, setWaiting] = useState<number | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [report, setReport] = useState<ReportForView | null>(null)

  // What was typed is asked for once the typing rests, so each key is not a read.
  useEffect(() => {
    const t = window.setTimeout(() => setAsked(typed), 300)
    return () => window.clearTimeout(t)
  }, [typed])

  const load = useCallback(async () => {
    setReading(true)
    try {
      const next = await io.list({ source, where, typed: asked, limit })
      setRead(next)
      setFailure(null)
    } catch (e) {
      setFailure(recoveryFailureFromError(e, 'The photos did not read.'))
    } finally {
      setReading(false)
    }
  }, [io, source, where, asked, limit])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let live = true
    void io.waiting().then((n) => {
      if (live) setWaiting(n)
    })
    return () => {
      live = false
    }
  }, [io, read])

  const rows = useMemo(() => read?.rows ?? [], [read])
  const groups = useMemo(() => dayGroups(rows, todayYmdInAppTz()), [rows])
  const narrowed = photosNarrowed({ source, where, typed: asked })
  const empty = photosEmptyWords(narrowed)
  const chips = sourceChips(role)

  const openJob = useCallback(
    (row: UploadedPhotoRow) => {
      if (!row.job_id) return
      if (jobDetail) jobDetail.openJobDetail({ jobId: row.job_id })
      else navigate(jobWindowPath(row.job_id))
    },
    [jobDetail, navigate],
  )

  const sourceDoor = useCallback(
    (row: UploadedPhotoRow): (() => void) | null => {
      if (row.source === 'report' && row.job_id && row.report_id) {
        const jobId = row.job_id
        const reportId = row.report_id
        return () => {
          void loadReport(jobId, reportId).then((r) => setReport(r))
        }
      }
      if (row.source === 'box' && row.job_id && row.container_id) {
        const to = boxOnSiteLink(row.job_id, row.container_id)
        return () => navigate(to)
      }
      if (row.source === 'checklist' && row.job_id) return () => openJob(row)
      if (row.source === 'message') {
        const to = threadPath(row)
        return to ? () => navigate(to) : null
      }
      return null
    },
    [loadReport, navigate, openJob],
  )

  const wherePress = (row: UploadedPhotoRow) => {
    const w = whereWords(row)
    if (w.press === 'drive' && row.drive_file_id) {
      return (
        <button type="button" style={linkBtn} onClick={() => openInExternalBrowser(driveFileUrl(row.drive_file_id!))}>
          Open ↗
        </button>
      )
    }
    if (w.press === 'folders' && row.job_id) {
      return (
        <button type="button" style={linkBtn} onClick={() => openJob(row)} title="The job window’s Documents tab makes the folders">
          Make the job’s Drive folders
        </button>
      )
    }
    if (w.press === 'thread') {
      const to = threadPath(row)
      return to ? (
        <Link to={to} style={{ color: 'var(--text-link)' }}>
          the thread
        </Link>
      ) : null
    }
    return null
  }

  return (
    <section aria-label="Photos" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <input
        type="search"
        value={typed}
        onChange={(ev) => {
          setTyped(ev.target.value)
          setLimit(PHOTOS_PAGE)
        }}
        placeholder="Find a photo: a job, a customer, a person, a stage"
        aria-label="Find a photo"
        style={{ width: '100%', padding: '0.5rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', boxSizing: 'border-box' }}
      />
      <div role="group" aria-label="Source" style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={chipLabel}>Source</span>
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={source === c.key}
            onClick={() => {
              setSource(c.key)
              setLimit(PHOTOS_PAGE)
            }}
            style={chipStyle(source === c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Where" style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={chipLabel}>Where</span>
        {whereChips(waiting).map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={where === c.key}
            onClick={() => {
              setWhere(c.key)
              setLimit(PHOTOS_PAGE)
            }}
            style={{ ...chipStyle(where === c.key), ...(c.key === 'waiting' && where !== 'waiting' && (waiting ?? 0) > 0 ? { color: 'var(--text-amber-800)', borderColor: 'var(--text-amber-800)', background: 'var(--bg-amber-100)' } : {}) }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {failure ? <OfflineRetryPanel failure={failure} onRetry={load} surface="documents-photos" idempotent busy={reading} /> : null}
      {read == null && !failure ? (
        <p style={{ ...muted, margin: 0 }}>Loading…</p>
      ) : read && rows.length === 0 ? (
        <div data-testid="documents-photos-empty">
          <EmptyState main={empty.main} tail={empty.tail} compact />
        </div>
      ) : read ? (
        <>
          {groups.map((g) => (
            <div key={g.ymd || 'none'}>
              <h3 style={dayHead}>{g.label}</h3>
              {g.rows.map((row) => {
                const w = whereWords(row)
                const tone = w.tone === 'filed' ? 'var(--text-green-800)' : w.tone === 'held' ? 'var(--text-amber-800)' : 'var(--text-muted)'
                const index = rows.indexOf(row)
                const door = sourceDoor(row)
                return (
                  <div key={`${row.source}-${row.id}`} data-testid="documents-photos-row" style={rowStyle}>
                    <button type="button" aria-label={`Open ${captionWords(row)}`} onClick={() => setOpen(index)} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
                      <UploadedPhotoTile row={row} io={io} />
                    </button>
                    <div style={{ minWidth: 0, display: 'grid', gap: '0.1rem' }}>
                      <button type="button" style={nameBtn} onClick={() => setOpen(index)}>
                        {captionWords(row)}
                      </button>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                        {row.job_id ? (
                          <button type="button" style={{ ...linkBtn, fontSize: '0.8125rem', color: 'var(--text-700)', textDecoration: 'underline', textDecorationColor: 'var(--border-strong)' }} onClick={() => openJob(row)}>
                            {jobWords(row)}
                          </button>
                        ) : (
                          jobWords(row)
                        )}
                      </div>
                      <div style={{ ...muted, display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {door ? (
                          <button type="button" style={srcChip} onClick={door} title="Open what the photo came with">
                            {sourceWords(row)}
                          </button>
                        ) : (
                          <span style={{ ...srcChip, cursor: 'default' }}>{sourceWords(row)}</span>
                        )}
                        <span>{[whoWords(row), timeWords(row.taken_at), sizeWords(row)].filter(Boolean).join(' · ')}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.8125rem', display: 'grid', gap: '0.1rem', justifyItems: 'end' }}>
                      <span style={{ color: tone, fontWeight: 600 }}>
                        {w.text}
                        {w.press === 'drive' ? <> · {wherePress(row)}</> : null}
                      </span>
                      {w.sub ? (
                        <span style={{ ...muted, maxWidth: 280 }}>
                          {w.sub}
                          {w.press && w.press !== 'drive' ? <> · {wherePress(row)}</> : null}
                        </span>
                      ) : w.press && w.press !== 'drive' ? (
                        <span style={muted}>{wherePress(row)}</span>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
          {read.more ? (
            <div>
              <button type="button" style={documentsQuietButton} disabled={reading} onClick={() => setLimit((n) => n + PHOTOS_PAGE)}>
                {reading ? 'Reading…' : 'Show more'}
              </button>
            </div>
          ) : null}
          <p style={{ ...muted, margin: 0 }}>{PHOTOS_FOOT}</p>
        </>
      ) : null}

      {open != null && rows[open] ? (
        <UploadedPhotoViewer
          rows={rows}
          index={open}
          io={io}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          onJob={openJob}
          onSource={sourceDoor(rows[open]!)}
          onPerson={(name) => {
            setTyped(name)
            setOpen(null)
          }}
        />
      ) : null}
      <ReportViewModal open={report != null} report={report} onClose={() => setReport(null)} viewerRole={role} zIndex={REPORT_Z_INDEX} />
    </section>
  )
}

export default DocumentsPhotosTab
