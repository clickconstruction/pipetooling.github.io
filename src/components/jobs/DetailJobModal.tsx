import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import {
  fetchStreetViewImageBlob,
  fetchStreetViewMeta,
  googleStreetViewPanoUrl,
} from '../../lib/fetchStreetViewPreview'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import {
  formatJobDetailModalDateFromYmd,
  formatJobDetailModalDateTitleFromYmd,
} from '../../lib/formatJobDetailModalDateYmd'
import { deriveRecordedBillingActivityDetail } from '../../lib/stagesJobReferenceDates'
import {
  canExpandJobDetailMaterials,
  isStaffFullJobLedgerDetailRole,
  showJobDetailJobTotal,
} from '../../lib/jobDetailModalRole'
import {
  scheduleFormatDateLongNoWeekday,
  scheduleFormatWeekdayOnly,
  scheduleFormatWindow,
} from '../../lib/jobScheduleChicago'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useJobMaterialsCostSnapshot } from '../../hooks/useJobMaterialsCostSnapshot'
import { useJobDetailScheduleAndSessions } from '../../hooks/useJobDetailScheduleAndSessions'
import { useJobThreadNotesForModal } from '../../hooks/useJobThreadNotesForModal'
import { JobDetailMaterialsCostSection } from './JobDetailMaterialsCostSection'
import { JobDetailScheduleSessionsSection } from './JobDetailScheduleSessionsSection'
import { JobLedgerStatusPipeline } from './JobLedgerStatusPipeline'
import { JobThreadNotesPanel } from '../JobThreadNotesPanel'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { LimitedJobDetailSnapshot } from '../../types/limitedJobDetailSnapshot'

export type DetailJobScheduleContext = {
  workDate: string
  timeStart: string
  timeEnd: string
  note: string | null
}

/** Matches Dashboard `assignedJobs` / `list_assigned_jobs_for_dashboard` shape used for My schedule. */
export type DetailJobModalAssignedJobRow = {
  id: string
  hcp_number: string
  job_name: string
  job_address: string
  google_drive_link: string | null
  job_plans_link: string | null
  revenue: number | null
  project_id?: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  jobId: string
  scheduleContext: DetailJobScheduleContext | null
  authRole: string | null
  /** Dashboard assigned jobs (team); used to enrich limited path. */
  assignedJobsRows: DetailJobModalAssignedJobRow[]
  /** My schedule row label (`HCP · job_name`); used for immediate title before fetch completes. */
  prefillRowLabel?: string | null
  /** From Assigned Jobs when opening My schedule; maps link before fetch completes when set. */
  prefillAddress?: string | null
  /** After Edit job save from this modal (e.g. refresh schedule hub). */
  onEditJobSaved?: () => void
}

/** Split on first ` · ` so job names containing ` · ` stay intact. */
export function splitScheduleDetailRowLabel(label: string): { hcp: string; jobName: string } {
  const t = label.trim()
  const sep = ' · '
  const i = t.indexOf(sep)
  if (i === -1) return { hcp: '—', jobName: t || '—' }
  return {
    hcp: t.slice(0, i).trim() || '—',
    jobName: t.slice(i + sep.length).trim() || '—',
  }
}

function formatJobDetailModalTitle(hcp: string | null | undefined, jobName: string | null | undefined): string {
  const h = (hcp ?? '').trim() || '—'
  const n = (jobName ?? '').trim() || '—'
  return `Job Detail: ${h} | ${n}`
}

function googleMapsSearchUrlForAddress(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

function jobDetailBillingHoverTitle(
  isoYmd: string | null | undefined,
  activityTooltip: string | null | undefined,
): string | undefined {
  const iso = formatJobDetailModalDateTitleFromYmd(isoYmd)
  const tip = activityTooltip?.trim()
  if (iso && tip) return `${iso} — ${tip}`
  if (iso) return iso
  if (tip) return tip
  return undefined
}

/** Subtle panel behind a label/value pair (Job Detail date band). */
const detailRowSoftBoxStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  padding: '0.6rem 0.75rem',
  background: '#f9fafb',
  border: '1px solid #e8eaee',
  borderRadius: 8,
}

function DetailRow({
  label,
  children,
  noBottomMargin,
  centered,
  softBox,
}: {
  label: string
  children: ReactNode
  /** Use inside flex/grid bands that provide gap; default keeps spacing for stacked rows. */
  noBottomMargin?: boolean
  /** Label + value aligned to center (Job Detail date/status/revenue band). */
  centered?: boolean
  /** Light filled panel (three date rows in Job Detail). */
  softBox?: boolean
}) {
  const bottom = noBottomMargin ? 0 : '0.65rem'
  const valueStyle: CSSProperties = {
    fontSize: '0.9375rem',
    color: '#111827',
    wordBreak: 'break-word',
    ...(centered
      ? { display: 'flex', justifyContent: 'center', flexWrap: 'wrap', textAlign: 'center' }
      : {}),
  }
  const inner = (
    <>
      <div
        style={{
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: '#6b7280',
          marginBottom: 2,
          textAlign: centered ? 'center' : 'left',
        }}
      >
        {label}
      </div>
      <div style={valueStyle}>{children}</div>
    </>
  )
  return (
    <div
      style={{
        marginBottom: bottom,
        textAlign: centered ? 'center' : 'left',
        ...(softBox ? detailRowSoftBoxStyle : {}),
      }}
    >
      {inner}
    </div>
  )
}

const linkLikeValueStyle: CSSProperties = {
  color: '#2563eb',
  cursor: 'pointer',
  textDecoration: 'underline',
  fontSize: '0.9375rem',
  wordBreak: 'break-word',
  display: 'inline-block',
}

const customerPanelValueStyle: CSSProperties = {
  fontSize: '0.9375rem',
  color: '#111827',
  wordBreak: 'break-word',
}

const customerPanelMissingPlaceholderStyle: CSSProperties = {
  ...customerPanelValueStyle,
  color: '#9ca3af',
}

function DetailJobModalCustomerPanel({
  customerName,
  customerPhone,
  customerEmail,
}: {
  customerName: string | null | undefined
  customerPhone: string | null | undefined
  customerEmail: string | null | undefined
}) {
  const name = customerName?.trim() ?? ''
  const phone = customerPhone?.trim() ?? ''
  const email = customerEmail?.trim() ?? ''

  const openTel = () => {
    if (phone) openInExternalBrowser(`tel:${phone}`)
  }
  const openMailto = () => {
    if (email) openInExternalBrowser(`mailto:${email}`)
  }

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>Customer</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div style={name ? customerPanelValueStyle : customerPanelMissingPlaceholderStyle}>
            {name || '[missing name]'}
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          {phone ? (
            <span
              role="link"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                openTel()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  openTel()
                }
              }}
              title="Call phone number"
              aria-label="Customer phone — call number"
              style={linkLikeValueStyle}
            >
              {phone}
            </span>
          ) : (
            <div style={customerPanelMissingPlaceholderStyle}>[missing phone]</div>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          {email ? (
            <span
              role="link"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                openMailto()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  openMailto()
                }
              }}
              title="Compose email to customer"
              aria-label="Customer email — compose message"
              style={linkLikeValueStyle}
            >
              {email}
            </span>
          ) : (
            <div style={customerPanelMissingPlaceholderStyle}>[missing email]</div>
          )}
        </div>
      </div>
    </div>
  )
}

const detailJobFilesPlansButtonStyle: CSSProperties = {
  display: 'inline-block',
  padding: '0.35rem 0.65rem',
  fontSize: '0.875rem',
  background: '#fff',
  border: '1px solid #c7d2fe',
  borderRadius: 4,
  cursor: 'pointer',
  color: '#1d4ed8',
}

function DetailJobModalFilesPlansRow({
  googleDriveLink,
  jobPlansLink,
}: {
  googleDriveLink: string | null | undefined
  jobPlansLink: string | null | undefined
}) {
  const drive = googleDriveLink?.trim() ?? ''
  const plans = jobPlansLink?.trim() ?? ''
  if (!drive && !plans) return null
  return (
    <div
      style={{
        marginTop: '0.75rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
        gap: '0.75rem',
        alignItems: 'start',
      }}
    >
      {drive ? (
        <div style={{ minWidth: 0, textAlign: 'center' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>Job Files</div>
          <button type="button" onClick={() => openInExternalBrowser(drive)} style={detailJobFilesPlansButtonStyle}>
            Open Drive folder
          </button>
        </div>
      ) : null}
      {plans ? (
        <div style={{ minWidth: 0, textAlign: 'center' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>Job Plans</div>
          <button type="button" onClick={() => openInExternalBrowser(plans)} style={detailJobFilesPlansButtonStyle}>
            Open plans
          </button>
        </div>
      ) : null}
    </div>
  )
}

function mergeLimitedFromAssignedAndLedger(
  assigned: DetailJobModalAssignedJobRow | undefined,
  ledger: LimitedJobDetailSnapshot | null,
): LimitedJobDetailSnapshot | null {
  if (ledger) return ledger
  if (!assigned) return null
  return {
    id: assigned.id,
    hcp_number: assigned.hcp_number,
    job_name: assigned.job_name,
    job_address: assigned.job_address,
    google_drive_link: assigned.google_drive_link,
    job_plans_link: assigned.job_plans_link,
    revenue: assigned.revenue,
    project_id: assigned.project_id ?? null,
    customer_name: null,
    customer_email: null,
    customer_phone: null,
    last_bill_date: null,
    last_work_date: null,
    status: 'working',
  }
}

async function fetchLimitedLedgerRow(jobId: string): Promise<LimitedJobDetailSnapshot | null> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('jobs_ledger')
          .select(
            'id, hcp_number, job_name, job_address, google_drive_link, job_plans_link, revenue, project_id, customer_name, customer_email, customer_phone, last_bill_date, last_work_date, status',
          )
          .eq('id', jobId)
          .maybeSingle(),
      'DetailJobModal limited jobs_ledger',
    )
    if (!data || typeof data !== 'object' || !('id' in data)) return null
    return data as unknown as LimitedJobDetailSnapshot
  } catch {
    return null
  }
}

export default function DetailJobModal({
  open,
  onClose,
  jobId,
  scheduleContext,
  authRole,
  assignedJobsRows,
  prefillRowLabel = null,
  prefillAddress = null,
  onEditJobSaved,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullJob, setFullJob] = useState<JobWithDetails | null>(null)
  const [limitedJob, setLimitedJob] = useState<LimitedJobDetailSnapshot | null>(null)
  const [streetViewImgUrl, setStreetViewImgUrl] = useState<string | null>(null)
  const [streetViewLatLng, setStreetViewLatLng] = useState<{ lat: number; lng: number } | null>(null)
  const [streetViewLoading, setStreetViewLoading] = useState(false)
  const streetViewBlobUrlRef = useRef<string | null>(null)
  const detailFetchIdRef = useRef(0)
  const [materialsCostRefreshKey, setMaterialsCostRefreshKey] = useState(0)
  const [scheduleTimeSectionOpen, setScheduleTimeSectionOpen] = useState(false)
  const [jobDetailScheduleSessionsFilter, setJobDetailScheduleSessionsFilter] = useState('')

  const loadDetail = useCallback(async () => {
    if (!open || !jobId) return
    const fetchId = ++detailFetchIdRef.current
    setLoading(true)
    setError(null)
    setFullJob(null)
    setLimitedJob(null)
    try {
      if (isStaffFullJobLedgerDetailRole(authRole)) {
        const data = await fetchJobWithDetailsById(jobId)
        if (fetchId !== detailFetchIdRef.current) return
        if (!data) {
          setError('Job not found or you do not have access.')
          return
        }
        setFullJob(data)
        return
      }
      const assigned = assignedJobsRows.find((j) => j.id === jobId)
      const ledger = await fetchLimitedLedgerRow(jobId)
      if (fetchId !== detailFetchIdRef.current) return
      const merged = mergeLimitedFromAssignedAndLedger(assigned, ledger)
      if (!merged) {
        setError('Job not found or you do not have access.')
        return
      }
      setLimitedJob(merged)
    } catch (e) {
      if (fetchId === detailFetchIdRef.current) {
        setError(formatErrorMessage(e))
      }
    } finally {
      if (fetchId === detailFetchIdRef.current) {
        setLoading(false)
      }
    }
  }, [open, jobId, authRole, assignedJobsRows])

  useEffect(() => {
    if (!open || !jobId) {
      detailFetchIdRef.current += 1
      setFullJob(null)
      setLimitedJob(null)
      setError(null)
      setLoading(false)
      return
    }
    void loadDetail()
  }, [open, jobId, loadDetail])

  useEffect(() => {
    if (!open) setScheduleTimeSectionOpen(false)
  }, [open])

  useEffect(() => {
    setScheduleTimeSectionOpen(false)
  }, [jobId])

  useEffect(() => {
    setJobDetailScheduleSessionsFilter('')
  }, [jobId, open])

  const showWorkflowLink = authRole !== 'subcontractor' && authRole !== null

  const modalTitle = useMemo(() => {
    const data = fullJob ?? limitedJob
    if (data) return formatJobDetailModalTitle(data.hcp_number, data.job_name)
    if (error) return 'Job Detail'
    if (prefillRowLabel?.trim()) {
      const { hcp, jobName } = splitScheduleDetailRowLabel(prefillRowLabel)
      return formatJobDetailModalTitle(hcp, jobName)
    }
    return 'Job Detail'
  }, [fullJob, limitedJob, error, prefillRowLabel])

  const mapsAddressLine = useMemo(() => {
    const fromJob = (fullJob ?? limitedJob)?.job_address?.trim()
    if (fromJob) return fromJob
    return (prefillAddress ?? '').trim()
  }, [fullJob, limitedJob, prefillAddress])

  const detailJob = useMemo(() => {
    if (loading || error) return null
    return (fullJob ?? limitedJob) ?? null
  }, [loading, error, fullJob, limitedJob])

  const showMaterialsCostSection = useMemo(
    () =>
      Boolean(
        open &&
          jobId &&
          canExpandJobDetailMaterials(authRole) &&
          (fullJob != null ||
            (limitedJob != null && (authRole === 'superintendent' || authRole === 'estimator'))),
      ),
    [open, jobId, authRole, fullJob, limitedJob],
  )

  const { loading: materialsSnapshotLoading, data: materialsSnapshot } = useJobMaterialsCostSnapshot(
    jobId,
    showMaterialsCostSection,
    materialsCostRefreshKey,
  )

  const scheduleSessionsEnabled = Boolean(open && jobId && fullJob && scheduleTimeSectionOpen)
  const {
    loading: scheduleSessionsLoading,
    error: scheduleSessionsError,
    scheduleBlocks: detailScheduleBlocks,
    clockSessions: detailClockSessions,
    scheduleTruncated: detailScheduleTruncated,
    sessionsTruncated: detailSessionsTruncated,
  } = useJobDetailScheduleAndSessions(open, jobId ?? null, scheduleSessionsEnabled)

  const fullJobRecordedBilling = useMemo(
    () => (fullJob ? deriveRecordedBillingActivityDetail(fullJob) : null),
    [fullJob],
  )

  const narrowViewport = useNarrowViewport640()
  const jobDetailDateBandStyle = useMemo(
    (): CSSProperties =>
      narrowViewport
        ? {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.65rem',
          }
        : {
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '0.5rem',
            justifyItems: 'center',
            marginBottom: '0.65rem',
          },
    [narrowViewport],
  )

  const jobDetailStatusRowStyle = useMemo(
    (): CSSProperties => ({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      marginBottom: '0.65rem',
    }),
    [],
  )

  const topBandLeftActive = Boolean(mapsAddressLine || scheduleContext)
  const showTopBand = topBandLeftActive || Boolean(detailJob)

  useEffect(() => {
    let cancelled = false

    const revokeBlobUrl = () => {
      if (streetViewBlobUrlRef.current) {
        URL.revokeObjectURL(streetViewBlobUrlRef.current)
        streetViewBlobUrlRef.current = null
      }
    }

    if (!open || !mapsAddressLine.trim()) {
      revokeBlobUrl()
      setStreetViewImgUrl(null)
      setStreetViewLatLng(null)
      setStreetViewLoading(false)
      return () => {
        cancelled = true
      }
    }

    revokeBlobUrl()
    setStreetViewImgUrl(null)
    setStreetViewLatLng(null)
    setStreetViewLoading(true)

    ;(async () => {
      try {
        const meta = await fetchStreetViewMeta(mapsAddressLine)
        if (cancelled) return
        if (!meta) {
          setStreetViewLatLng(null)
          setStreetViewImgUrl(null)
          setStreetViewLoading(false)
          return
        }
        setStreetViewLatLng(meta)
        const blob = await fetchStreetViewImageBlob(mapsAddressLine)
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        streetViewBlobUrlRef.current = url
        setStreetViewImgUrl(url)
      } catch {
        if (!cancelled) {
          revokeBlobUrl()
          setStreetViewImgUrl(null)
          setStreetViewLatLng(null)
        }
      } finally {
        if (!cancelled) setStreetViewLoading(false)
      }
    })()

    return () => {
      cancelled = true
      revokeBlobUrl()
    }
  }, [open, mapsAddressLine])

  const openMapsAddress = () => {
    if (!mapsAddressLine) return
    openInExternalBrowser(googleMapsSearchUrlForAddress(mapsAddressLine))
  }

  const openStreetView = () => {
    if (!mapsAddressLine) return
    if (streetViewLatLng) {
      openInExternalBrowser(googleStreetViewPanoUrl(streetViewLatLng.lat, streetViewLatLng.lng))
      return
    }
    openInExternalBrowser(googleMapsSearchUrlForAddress(mapsAddressLine))
  }

  const { user: authUser, profileName } = useAuth()
  const { showToast } = useToastContext()
  const threadNotes = useJobThreadNotesForModal(open ? jobId : null, open, {
    authUserId: authUser?.id,
    showToast,
    authorDisplayName: authUser?.id ? profileName : undefined,
  })

  const jobFormModal = useJobFormModal()
  const showEditJobButton =
    Boolean(jobFormModal) &&
    !loading &&
    !error &&
    Boolean(jobId) &&
    authRole !== 'subcontractor' &&
    authRole !== null

  const handleEditJobClick = () => {
    if (!jobFormModal || !jobId || authRole === 'subcontractor') return
    jobFormModal.openEditJob(jobId, {
      ...(fullJob ? { initialJob: fullJob } : {}),
      onSaved: () => {
        setMaterialsCostRefreshKey((k) => k + 1)
        void loadDetail()
        onEditJobSaved?.()
      },
    })
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1004,
        padding: '1rem',
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-labelledby="detail-job-modal-title"
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
            width: '100%',
          }}
        >
          <h2
            id="detail-job-modal-title"
            style={{
              margin: 0,
              fontSize: '1.125rem',
              wordBreak: 'break-word',
              flex: 1,
              minWidth: 0,
              paddingRight: '0.5rem',
            }}
          >
            {modalTitle}
          </h2>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexShrink: 0 }}>
            {showEditJobButton ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleEditJobClick()
                }}
                title="Edit job"
                aria-label="Edit job"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.35rem',
                  margin: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: '#4b5563',
                  borderRadius: 4,
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 640 640"
                  width={20}
                  height={20}
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                </svg>
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.875rem',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Close
            </button>
          </div>
        </div>

        {showTopBand ? (
          <div
            style={{
              marginTop: '0.75rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
              gap: '0.75rem',
              alignItems: 'start',
            }}
          >
            {topBandLeftActive ? (
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {mapsAddressLine ? (
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6b7280', marginBottom: 2 }}>Address</div>
                    <span
                      role="link"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        openMapsAddress()
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          openMapsAddress()
                        }
                      }}
                      title="Open address in Google Maps"
                      aria-label="Open address in Google Maps"
                      style={{
                        color: '#2563eb',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        fontSize: '0.9375rem',
                        wordBreak: 'break-word',
                        display: 'inline-block',
                      }}
                    >
                      {mapsAddressLine}
                    </span>
                  </div>
                ) : null}
                {scheduleContext ? (
                  <div
                    style={{
                      minWidth: 0,
                      padding: '0.65rem 0.75rem',
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      fontSize: '0.875rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      Scheduled block - {scheduleFormatWeekdayOnly(scheduleContext.workDate)}
                    </div>
                    <div style={{ color: '#374151' }}>
                      {scheduleFormatDateLongNoWeekday(scheduleContext.workDate)} ·{' '}
                      {scheduleFormatWindow(scheduleContext.timeStart, scheduleContext.timeEnd)}
                    </div>
                    {scheduleContext.note?.trim() ? (
                      <div style={{ color: '#6b7280', marginTop: 6, wordBreak: 'break-word' }}>
                        {scheduleContext.note.trim()}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {detailJob ? (
              <DetailJobModalCustomerPanel
                customerName={detailJob.customer_name}
                customerPhone={detailJob.customer_phone}
                customerEmail={detailJob.customer_email}
              />
            ) : null}
          </div>
        ) : null}

        {mapsAddressLine && (streetViewLoading || streetViewImgUrl) ? (
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>Street View</div>
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                openStreetView()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  openStreetView()
                }
              }}
              title="Open Street View in Google Maps"
              aria-label="Open Street View in Google Maps"
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16 / 9',
                maxHeight: 200,
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                overflow: 'hidden',
                background: '#f3f4f6',
                cursor: streetViewImgUrl ? 'pointer' : 'default',
                padding: 0,
                display: 'block',
                textAlign: 'left' as const,
              }}
            >
              {streetViewLoading ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8125rem',
                    color: '#6b7280',
                  }}
                >
                  Loading preview…
                </div>
              ) : null}
              {streetViewImgUrl ? (
                <img
                  src={streetViewImgUrl}
                  alt={`Street View near ${mapsAddressLine}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    verticalAlign: 'top',
                  }}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        <div
          style={{ marginTop: '0.75rem', maxHeight: 320, overflowY: 'auto' }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <JobThreadNotesPanel
            notes={threadNotes.notes}
            loading={threadNotes.loading}
            canPost={threadNotes.canPost}
            draft={threadNotes.draft}
            onDraftChange={threadNotes.setDraft}
            onSubmit={() => void threadNotes.submitNote()}
            submitting={threadNotes.submitting}
            showSectionTitle={false}
            showEmptyPlaceholder={false}
            showComposerLabel={false}
          />
        </div>

        {loading ? <p style={{ margin: '1rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>Loading…</p> : null}
        {error ? (
          <p style={{ margin: '1rem 0 0', fontSize: '0.875rem', color: '#b91c1c', whiteSpace: 'pre-wrap' }}>{error}</p>
        ) : null}

        {!loading && !error && fullJob ? (
          <div style={{ marginTop: '1rem' }}>
            {showWorkflowLink && fullJob.project_id ? (
              <div style={{ marginBottom: '0.75rem' }}>
                <Link
                  to={`/workflows/${fullJob.project_id}`}
                  style={{
                    fontSize: '0.875rem',
                    padding: '0.25rem 0.5rem',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    borderRadius: 4,
                    textDecoration: 'none',
                    fontWeight: 500,
                    display: 'inline-block',
                  }}
                >
                  Project: {fullJob.project?.name ?? 'Open workflow'}
                </Link>
              </div>
            ) : null}
            <div style={jobDetailDateBandStyle}>
              <DetailRow label="Last work date" noBottomMargin centered softBox>
                <span title={formatJobDetailModalDateTitleFromYmd(fullJob.last_work_date) ?? undefined}>
                  {formatJobDetailModalDateFromYmd(fullJob.last_work_date) ?? '—'}
                </span>
              </DetailRow>
              <DetailRow label="Last bill date" noBottomMargin centered softBox>
                <span
                  title={
                    jobDetailBillingHoverTitle(
                      fullJobRecordedBilling?.ymd,
                      fullJobRecordedBilling?.tooltip,
                    ) ?? undefined
                  }
                >
                  {formatJobDetailModalDateFromYmd(fullJobRecordedBilling?.ymd) ?? '—'}
                </span>
              </DetailRow>
              <DetailRow label="Last manual bill date" noBottomMargin centered softBox>
                <span title={formatJobDetailModalDateTitleFromYmd(fullJob.last_bill_date) ?? undefined}>
                  {formatJobDetailModalDateFromYmd(fullJob.last_bill_date) ?? '—'}
                </span>
              </DetailRow>
            </div>
            <div style={jobDetailStatusRowStyle}>
              <DetailRow label="Status" noBottomMargin centered>
                <JobLedgerStatusPipeline status={fullJob.status} />
              </DetailRow>
            </div>

            <DetailJobModalFilesPlansRow googleDriveLink={fullJob.google_drive_link} jobPlansLink={fullJob.job_plans_link} />

            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.5rem' }}>Assigned Team</div>
              {(fullJob.team_members ?? []).length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#9ca3af' }}>No team members listed.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
                  {fullJob.team_members.map((tm) => (
                    <li key={tm.id} style={{ marginBottom: 4 }}>
                      {tm.users?.name?.trim() || tm.user_id}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setScheduleTimeSectionOpen((v) => !v)}
                aria-expanded={scheduleTimeSectionOpen}
                aria-controls="job-detail-schedule-sessions-panel"
                id="job-detail-schedule-sessions-toggle"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  width: '100%',
                  margin: 0,
                  padding: '0.15rem 0',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  font: 'inherit',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  color: '#111827',
                  textAlign: 'center',
                }}
              >
                <span aria-hidden style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                  {scheduleTimeSectionOpen ? '▼' : '▶'}
                </span>
                Schedule and recorded time
              </button>
              {scheduleTimeSectionOpen ? (
                <div id="job-detail-schedule-sessions-panel" role="region" aria-labelledby="job-detail-schedule-sessions-toggle">
                  <input
                    type="search"
                    value={jobDetailScheduleSessionsFilter}
                    onChange={(e) => setJobDetailScheduleSessionsFilter(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Filter schedule and sessions"
                    aria-label="Filter schedule blocks and clock sessions"
                    title="Narrow calendar blocks and clock sessions in the lists below."
                    style={{
                      display: 'block',
                      width: '100%',
                      marginBottom: '0.5rem',
                      padding: '0.4rem 0.5rem',
                      fontSize: '0.875rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      boxSizing: 'border-box',
                    }}
                  />
                  <JobDetailScheduleSessionsSection
                    hideTitle
                    loading={scheduleSessionsLoading}
                    error={scheduleSessionsError}
                    scheduleBlocks={detailScheduleBlocks}
                    clockSessions={detailClockSessions}
                    scheduleTruncated={detailScheduleTruncated}
                    sessionsTruncated={detailSessionsTruncated}
                    filterQuery={jobDetailScheduleSessionsFilter}
                  />
                </div>
              ) : null}
            </div>

            {showMaterialsCostSection ? (
              <JobDetailMaterialsCostSection
                loading={materialsSnapshotLoading}
                snapshot={materialsSnapshot}
                canExpand={canExpandJobDetailMaterials(authRole)}
                billedMaterials={fullJob.materials ?? []}
              />
            ) : null}

            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.5rem' }}>Specific Work (Fixtures / Tie-ins / Repair)</div>
              {(fullJob.fixtures ?? []).length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#9ca3af' }}>None</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {fullJob.fixtures.map((f, index) => (
                    <li
                      key={f.id}
                      style={{
                        marginBottom: 6,
                        fontSize: '0.875rem',
                        display: 'flex',
                        gap: '0.35rem',
                        alignItems: 'flex-start',
                      }}
                    >
                      <span
                        style={{
                          color: '#6b7280',
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          flexShrink: 0,
                        }}
                      >
                        [{index + 1}]
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span>
                          {f.name || '—'} × {f.count}
                          {f.line_unit_price != null &&
                          Number.isFinite(Number(f.line_unit_price)) &&
                          Number(f.line_unit_price) > 0 ? (
                            <span style={{ color: '#6b7280' }}>
                              {' '}
                              @ ${formatCurrency(Number(f.line_unit_price))} ea.
                            </span>
                          ) : null}
                        </span>
                        {(f.line_description ?? '').trim() ? (
                          <div style={{ color: '#6b7280', fontSize: '0.8125rem', marginTop: 2, whiteSpace: 'pre-wrap' }}>
                            {(f.line_description ?? '').trim()}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {showJobDetailJobTotal(authRole) ? (
              <div style={{ marginTop: '1rem' }}>
                <DetailRow label="Job Total" noBottomMargin centered>
                  {fullJob.revenue != null ? formatCurrency(Number(fullJob.revenue)) : '—'}
                </DetailRow>
              </div>
            ) : null}

            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.5rem' }}>Payments</div>
              {(fullJob.payments ?? []).length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#9ca3af' }}>None</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {fullJob.payments.map((p) => (
                    <li
                      key={p.id}
                      style={{
                        padding: '0.45rem 0.5rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: 4,
                        marginBottom: 6,
                        fontSize: '0.875rem',
                      }}
                    >
                      {formatCurrency(Number(p.amount ?? 0))}
                      {p.payment_type?.trim() ? (
                        <span style={{ color: '#6b7280', marginLeft: 8 }}>Type: {p.payment_type.trim()}</span>
                      ) : null}
                      {p.reference_number?.trim() ? (
                        <span style={{ color: '#6b7280', marginLeft: 8 }}>Ref: {p.reference_number.trim()}</span>
                      ) : null}
                      {p.note?.trim() ? <span style={{ color: '#6b7280', marginLeft: 8 }}>{p.note.trim()}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.5rem' }}>Invoices</div>
              {(fullJob.invoices ?? []).length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#9ca3af' }}>None</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {fullJob.invoices.map((inv) => (
                    <li
                      key={inv.id}
                      style={{
                        padding: '0.45rem 0.5rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: 4,
                        marginBottom: 6,
                        fontSize: '0.875rem',
                      }}
                    >
                      {formatCurrency(Number(inv.amount ?? 0))}
                      <span style={{ color: '#6b7280', marginLeft: 8 }}>{inv.status ?? ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        {!loading && !error && limitedJob ? (
          <div style={{ marginTop: '1rem' }}>
            {showWorkflowLink && limitedJob.project_id ? (
              <div style={{ marginBottom: '0.75rem' }}>
                <Link
                  to={`/workflows/${limitedJob.project_id}`}
                  style={{
                    fontSize: '0.875rem',
                    padding: '0.25rem 0.5rem',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    borderRadius: 4,
                    textDecoration: 'none',
                    fontWeight: 500,
                    display: 'inline-block',
                  }}
                >
                  Open project workflow
                </Link>
              </div>
            ) : null}
            <div style={jobDetailDateBandStyle}>
              <DetailRow label="Last work date" noBottomMargin centered softBox>
                <span title={formatJobDetailModalDateTitleFromYmd(limitedJob.last_work_date) ?? undefined}>
                  {formatJobDetailModalDateFromYmd(limitedJob.last_work_date) ?? '—'}
                </span>
              </DetailRow>
              {/* No invoices/payments on limited fetch — cannot derive recorded billing */}
              <DetailRow label="Last bill date" noBottomMargin centered softBox>
                —
              </DetailRow>
              <DetailRow label="Last manual bill date" noBottomMargin centered softBox>
                <span title={formatJobDetailModalDateTitleFromYmd(limitedJob.last_bill_date) ?? undefined}>
                  {formatJobDetailModalDateFromYmd(limitedJob.last_bill_date) ?? '—'}
                </span>
              </DetailRow>
            </div>
            <div style={jobDetailStatusRowStyle}>
              <DetailRow label="Status" noBottomMargin centered>
                <JobLedgerStatusPipeline status={limitedJob.status} />
              </DetailRow>
            </div>

            <DetailJobModalFilesPlansRow googleDriveLink={limitedJob.google_drive_link} jobPlansLink={limitedJob.job_plans_link} />

            {showMaterialsCostSection ? (
              <JobDetailMaterialsCostSection
                loading={materialsSnapshotLoading}
                snapshot={materialsSnapshot}
                canExpand={canExpandJobDetailMaterials(authRole)}
                billedMaterials={[]}
              />
            ) : null}

            {showJobDetailJobTotal(authRole) ? (
              <div style={{ marginTop: '1rem' }}>
                <DetailRow label="Job Total" noBottomMargin centered>
                  {limitedJob.revenue != null ? formatCurrency(Number(limitedJob.revenue)) : '—'}
                </DetailRow>
              </div>
            ) : null}

            <p style={{ margin: '1rem 0 0', fontSize: '0.8125rem', color: '#9ca3af' }}>
              Payments and invoices are not shown in this view.
            </p>
            {authRole === 'subcontractor' ? (
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: '#9ca3af' }}>You are assigned on this job.</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
