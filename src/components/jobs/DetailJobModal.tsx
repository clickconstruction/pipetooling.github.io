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
import { fetchUserNamesForIds } from '../../lib/scheduleDispatchHub'
import {
  formatJobDetailModalDateFromYmd,
  formatJobDetailModalDateTitleFromYmd,
} from '../../lib/formatJobDetailModalDateYmd'
import { deriveRecordedBillingActivityDetail } from '../../lib/stagesJobReferenceDates'
import { buildServiceTypeTradePill } from '../../lib/serviceTypeTradePill'
import { composePctCompleteNoteBody } from '../../lib/jobs/stagesPctNote'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import {
  canExpandJobDetailMaterials,
  isStaffFullJobLedgerDetailRole,
  showJobCostBreakdownTeamLabor,
  showJobDetailJobTotal,
  showJobDetailProfitSection,
} from '../../lib/jobDetailModalRole'
import { buildJobProfitSummary } from '../../lib/jobs/jobProfitSummary'
import { tallyPartsTotalFromLines } from '../../lib/fetchJobMaterialsCostSnapshot'
import {
  scheduleFormatDateLongNoWeekday,
  scheduleFormatWeekdayOnly,
  scheduleFormatWindow,
} from '../../lib/jobScheduleChicago'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { isSubcontractorLikeRole } from '../../lib/subcontractorLikeRole'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { useToastContext } from '../../contexts/ToastContext'
import { useUpdateFocusOpenerBridge } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { useAuth, type UserRole } from '../../hooks/useAuth'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useJobMaterialsCostSnapshot } from '../../hooks/useJobMaterialsCostSnapshot'
import { useJobDetailSubLaborCost } from '../../hooks/useJobDetailSubLaborCost'
import { useJobDetailScheduleAndSessions } from '../../hooks/useJobDetailScheduleAndSessions'
import { useJobClockSessionBounds } from '../../hooks/useJobClockSessionBounds'
import { useJobThreadNotesForModal } from '../../hooks/useJobThreadNotesForModal'
import { formatClockSessionTimestampPartsChicago } from '../../lib/formatClockSessionTimestamp'
import { JobDetailMaterialsCostSection } from './JobDetailMaterialsCostSection'
import { JobDetailProfitSection } from './JobDetailProfitSection'
import JobChargesTimelineStandalone from './JobChargesTimelineStandalone'
import { JobDetailScheduleSessionsSection } from './JobDetailScheduleSessionsSection'
import { JobLedgerStatusPipeline } from './JobLedgerStatusPipeline'
import { JobThreadNotesPanel } from '../JobThreadNotesPanel'
import JobReportsModal from '../JobReportsModal'
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
  background: 'var(--bg-subtle)',
  border: '1px solid #e8eaee',
  borderRadius: 8,
}

function StackedClockSessionTimestamp({
  parts,
}: {
  parts: { date: string; time: string; relative: string } | null
}) {
  if (!parts) return <span>—</span>
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1.25,
      }}
    >
      <span>{parts.date}</span>
      <span>{parts.time}</span>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
        ({parts.relative})
      </span>
    </div>
  )
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
    color: 'var(--text-strong)',
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
          color: 'var(--text-muted)',
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
  color: 'var(--text-link)',
  cursor: 'pointer',
  textDecoration: 'underline',
  fontSize: '0.9375rem',
  wordBreak: 'break-word',
  display: 'inline-block',
}

const customerPanelValueStyle: CSSProperties = {
  fontSize: '0.9375rem',
  color: 'var(--text-strong)',
  wordBreak: 'break-word',
}

const customerPanelMissingPlaceholderStyle: CSSProperties = {
  ...customerPanelValueStyle,
  color: 'var(--text-faint)',
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
      <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Customer</div>
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
  background: 'var(--surface)',
  border: '1px solid var(--border-indigo-soft)',
  borderRadius: 4,
  cursor: 'pointer',
  color: 'var(--text-blue-700)',
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
          <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Customer Files</div>
          <button type="button" onClick={() => openInExternalBrowser(drive)} style={detailJobFilesPlansButtonStyle}>
            Open Drive folder
          </button>
        </div>
      ) : null}
      {plans ? (
        <div style={{ minWidth: 0, textAlign: 'center' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Job Plans</div>
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
    service_type_name: null,
  }
}

async function fetchLimitedLedgerRow(jobId: string): Promise<LimitedJobDetailSnapshot | null> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('jobs_ledger')
          .select(
            'id, hcp_number, job_name, job_address, google_drive_link, job_plans_link, revenue, project_id, customer_name, customer_email, customer_phone, last_bill_date, last_work_date, status, service_types:service_type_id(name)',
          )
          .eq('id', jobId)
          .maybeSingle(),
      'DetailJobModal limited jobs_ledger',
    )
    if (!data || typeof data !== 'object' || !('id' in data)) return null
    const r = data as {
      id: string
      hcp_number: string
      job_name: string
      job_address: string
      google_drive_link: string | null
      job_plans_link: string | null
      revenue: number | null
      project_id: string | null
      customer_name: string | null
      customer_email: string | null
      customer_phone: string | null
      last_bill_date: string | null
      last_work_date: string | null
      status: string
      service_types?: { name: string } | null
    }
    const { service_types: st, ...rest } = r
    return { ...rest, service_type_name: st?.name ?? null } as LimitedJobDetailSnapshot
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
  const [reportsModalOpen, setReportsModalOpen] = useState(false)
  // Archived users are hidden by the users RLS for non-dev viewers, so the team_members
  // embed comes back with a null name and the list showed raw UUIDs. Resolve those via
  // the RPC-backed helper (list_user_display_names), which can name archived users.
  const [teamMemberNameFallback, setTeamMemberNameFallback] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    const missing = (fullJob?.team_members ?? [])
      .filter((tm) => !(tm.users?.name ?? '').trim())
      .map((tm) => tm.user_id)
    if (missing.length === 0) {
      setTeamMemberNameFallback(new Map())
      return
    }
    let cancelled = false
    void fetchUserNamesForIds(missing).then(({ data }) => {
      if (!cancelled) setTeamMemberNameFallback(data)
    })
    return () => {
      cancelled = true
    }
  }, [fullJob])

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

  useEffect(() => {
    if (!open) setReportsModalOpen(false)
  }, [open])

  useEffect(() => {
    setReportsModalOpen(false)
  }, [jobId])

  const showWorkflowLink = !isSubcontractorLikeRole(authRole as UserRole) && authRole !== null

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

  // Profit band (masters/devs): sub labor from the labor books, parts from the
  // materials snapshot's tally lines, revenue from the full job row.
  const showProfitSection = useMemo(
    () => Boolean(open && jobId && showJobDetailProfitSection(authRole) && fullJob != null),
    [open, jobId, authRole, fullJob],
  )
  const {
    loading: profitLaborLoading,
    data: profitLaborData,
    failed: profitLaborFailed,
  } = useJobDetailSubLaborCost(showProfitSection, fullJob?.hcp_number ?? null)
  const profitSummary = useMemo(() => {
    if (!showProfitSection || fullJob == null || profitLaborData == null || materialsSnapshot == null) return null
    if (materialsSnapshot.tallyFetchFailed) return null
    return buildJobProfitSummary({
      revenue: fullJob.revenue != null ? Number(fullJob.revenue) : null,
      tallyPartsTotal: tallyPartsTotalFromLines(materialsSnapshot.tallyPartLines),
      laborJobs: profitLaborData.laborJobs,
      mileageCost: profitLaborData.mileageCost,
      timePerMile: profitLaborData.timePerMile,
    })
  }, [showProfitSection, fullJob, profitLaborData, materialsSnapshot])

  const scheduleSessionsEnabled = Boolean(open && jobId && fullJob && scheduleTimeSectionOpen)
  const {
    loading: scheduleSessionsLoading,
    error: scheduleSessionsError,
    scheduleBlocks: detailScheduleBlocks,
    clockSessions: detailClockSessions,
    scheduleTruncated: detailScheduleTruncated,
    sessionsTruncated: detailSessionsTruncated,
  } = useJobDetailScheduleAndSessions(open, jobId ?? null, scheduleSessionsEnabled)

  const clockSessionBoundsEnabled = Boolean(open && jobId && fullJob)
  const { bounds: clockSessionBounds } = useJobClockSessionBounds(
    open,
    jobId ?? null,
    clockSessionBoundsEnabled,
    materialsCostRefreshKey,
  )
  const jobStartParts = useMemo(
    () => formatClockSessionTimestampPartsChicago(clockSessionBounds.firstClockedInAt),
    [clockSessionBounds.firstClockedInAt],
  )
  const lastWorkParts = useMemo(
    () => formatClockSessionTimestampPartsChicago(clockSessionBounds.lastClockedOutAt),
    [clockSessionBounds.lastClockedOutAt],
  )

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
  const { requestOpenUpdateFocus } = useUpdateFocusOpenerBridge()

  // Stages "% complete" flow, transplanted from the Jobs Stages activity panel:
  // same roles, same note-plus-pct write (replaces the old Completeness card).
  const canEditJobPctComplete = useMemo(
    () =>
      authRole === 'dev' ||
      authRole === 'master_technician' ||
      isAssistantLike(authRole) ||
      authRole === 'primary',
    [authRole],
  )
  const [pctSaving, setPctSaving] = useState(false)
  const commitPctWithNote = useCallback(
    async (value: number, note: string) => {
      if (!jobId) return
      setPctSaving(true)
      try {
        const posted = await threadNotes.submitNoteWithBody(composePctCompleteNoteBody(value, note), 'draft')
        if (!posted) return
        const { error: err } = await supabase.from('jobs_ledger').update({ pct_complete: value }).eq('id', jobId)
        if (err) throw err
        showToast(`Set to ${value}% complete`, 'success')
        void loadDetail()
      } catch (e: unknown) {
        showToast(formatErrorMessage(e, 'Failed to update % complete'), 'error')
      } finally {
        setPctSaving(false)
      }
    },
    [jobId, threadNotes, showToast, loadDetail],
  )

  const jobFormModal = useJobFormModal()
  const showEditJobButton =
    Boolean(jobFormModal) &&
    !loading &&
    !error &&
    Boolean(jobId) &&
    !isSubcontractorLikeRole(authRole as UserRole) &&
    authRole !== null

  const handleEditJobClick = () => {
    if (!jobFormModal || !jobId || isSubcontractorLikeRole(authRole as UserRole)) return
    jobFormModal.openEditJob(jobId, {
      ...(fullJob ? { initialJob: fullJob } : {}),
      onSaved: () => {
        setMaterialsCostRefreshKey((k) => k + 1)
        void loadDetail()
        onEditJobSaved?.()
      },
    })
  }

  const headerTradePill = useMemo(() => {
    if (fullJob) return buildServiceTypeTradePill(fullJob.serviceType?.name)
    if (limitedJob) return buildServiceTypeTradePill(limitedJob.service_type_name)
    return null
  }, [fullJob, limitedJob])

  const headerTradePillTitleText = useMemo(() => {
    if (fullJob?.serviceType?.name?.trim()) return fullJob.serviceType.name.trim()
    if (!fullJob && limitedJob?.service_type_name?.trim()) return limitedJob.service_type_name.trim()
    return undefined
  }, [fullJob, limitedJob])

  const showDetailHeaderRightCluster = headerTradePill != null || showEditJobButton

  useBodyScrollLock(open && narrowViewport)

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
        ...(narrowViewport ? { overscrollBehavior: 'contain' as const } : {}),
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-labelledby="detail-job-modal-title"
        style={{
          background: 'var(--surface)',
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
            alignItems: 'center',
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
              paddingRight: showDetailHeaderRightCluster ? '0.5rem' : 0,
            }}
          >
            {modalTitle}
          </h2>
          {showDetailHeaderRightCluster ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              {headerTradePill ? (
                <span
                  style={{ ...headerTradePill.style, marginTop: 0 }}
                  title={headerTradePillTitleText}
                >
                  {headerTradePill.label}
                </span>
              ) : null}
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
                    color: 'var(--text-600)',
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
            </div>
          ) : null}
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
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: 2 }}>Address</div>
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
                        color: 'var(--text-link)',
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
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: '0.875rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      Scheduled block - {scheduleFormatWeekdayOnly(scheduleContext.workDate)}
                    </div>
                    <div style={{ color: 'var(--text-700)' }}>
                      {scheduleFormatDateLongNoWeekday(scheduleContext.workDate)} ·{' '}
                      {scheduleFormatWindow(scheduleContext.timeStart, scheduleContext.timeEnd)}
                    </div>
                    {scheduleContext.note?.trim() ? (
                      <div style={{ color: 'var(--text-muted)', marginTop: 6, wordBreak: 'break-word' }}>
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
            <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: 4 }}>Street View</div>
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
                border: '1px solid var(--border)',
                overflow: 'hidden',
                background: 'var(--bg-muted)',
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
                    color: 'var(--text-muted)',
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
          style={{ marginTop: '0.75rem' }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <JobThreadNotesPanel
            activity={threadNotes.activity}
            loading={threadNotes.loading}
            canPost={threadNotes.canPost}
            draft={threadNotes.draft}
            onDraftChange={threadNotes.setDraft}
            onSubmit={() => void threadNotes.submitNote()}
            submitting={threadNotes.submitting}
            jobThreadStampActions={{
              onArrived: () => void threadNotes.submitStamp('arrived'),
              onLeaving: () => {
                void (async () => {
                  const ok = await threadNotes.submitStamp('leaving')
                  if (ok) requestOpenUpdateFocus()
                })()
              },
            }}
            pctComplete={fullJob?.pct_complete ?? null}
            canEditPct={canEditJobPctComplete && fullJob != null}
            pctSaving={pctSaving}
            onCommitPct={(value, note) => void commitPctWithNote(value, note)}
            showSectionTitle={false}
            showEmptyPlaceholder={false}
            showComposerLabel={false}
            viewerRole={authRole as UserRole | null}
          />
        </div>

        {loading ? <p style={{ margin: '1rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</p> : null}
        {error ? (
          <p style={{ margin: '1rem 0 0', fontSize: '0.875rem', color: 'var(--text-red-700)', whiteSpace: 'pre-wrap' }}>{error}</p>
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
                    background: 'var(--bg-blue-tint)',
                    color: 'var(--text-blue-700)',
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
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-faint)' }}>No team members listed.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
                  {fullJob.team_members.map((tm) => (
                    <li key={tm.id} style={{ marginBottom: 4 }}>
                      {tm.users?.name?.trim() || teamMemberNameFallback.get(tm.user_id) || '…'}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ marginTop: '1rem', ...jobDetailDateBandStyle }}>
              <DetailRow label="Job Start" noBottomMargin centered softBox>
                <StackedClockSessionTimestamp parts={jobStartParts} />
              </DetailRow>
              <DetailRow label="Last Work" noBottomMargin centered softBox>
                <StackedClockSessionTimestamp parts={lastWorkParts} />
              </DetailRow>
              <button
                type="button"
                onClick={() => setReportsModalOpen(true)}
                aria-label="Open reports for this job"
                style={{
                  ...detailRowSoftBoxStyle,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'inherit',
                }}
              >
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: 2 }}>
                  Reports
                </span>
                <span style={{ fontSize: '0.9375rem', color: 'var(--text-link)', textDecoration: 'underline' }}>
                  View all reports
                </span>
              </button>
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
                  color: 'var(--text-strong)',
                  textAlign: 'center',
                }}
              >
                <span aria-hidden style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
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
                      border: '1px solid var(--border-strong)',
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
              <>
                <JobDetailMaterialsCostSection
                  loading={materialsSnapshotLoading}
                  snapshot={materialsSnapshot}
                  canExpand={canExpandJobDetailMaterials(authRole)}
                  billedMaterials={fullJob.materials ?? []}
                />
                <JobChargesTimelineStandalone job={fullJob} includeTeamLabor={showJobCostBreakdownTeamLabor(authRole)} />
              </>
            ) : null}

            {showProfitSection ? (
              <JobDetailProfitSection
                loading={profitLaborLoading || materialsSnapshotLoading}
                failed={profitLaborFailed || materialsSnapshot?.tallyFetchFailed === true}
                summary={profitSummary}
              />
            ) : null}

            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.5rem' }}>Specific Work (Fixtures / Tie-ins / Repair)</div>
              {(fullJob.fixtures ?? []).length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-faint)' }}>None</p>
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
                          color: 'var(--text-muted)',
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
                            <span style={{ color: 'var(--text-muted)' }}>
                              {' '}
                              @ {formatCurrency(Number(f.line_unit_price))} ea.
                            </span>
                          ) : null}
                        </span>
                        {(f.line_description ?? '').trim() ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: 2, whiteSpace: 'pre-wrap' }}>
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
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-faint)' }}>None</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {fullJob.payments.map((p) => (
                    <li
                      key={p.id}
                      style={{
                        padding: '0.45rem 0.5rem',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        marginBottom: 6,
                        fontSize: '0.875rem',
                      }}
                    >
                      {formatCurrency(Number(p.amount ?? 0))}
                      {p.payment_type?.trim() ? (
                        <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>Type: {p.payment_type.trim()}</span>
                      ) : null}
                      {p.reference_number?.trim() ? (
                        <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>Ref: {p.reference_number.trim()}</span>
                      ) : null}
                      {p.note?.trim() ? <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{p.note.trim()}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.5rem' }}>Invoices</div>
              {(fullJob.invoices ?? []).length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-faint)' }}>None</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {fullJob.invoices.map((inv) => (
                    <li
                      key={inv.id}
                      style={{
                        padding: '0.45rem 0.5rem',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        marginBottom: 6,
                        fontSize: '0.875rem',
                      }}
                    >
                      {formatCurrency(Number(inv.amount ?? 0))}
                      <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{inv.status ?? ''}</span>
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
                    background: 'var(--bg-blue-tint)',
                    color: 'var(--text-blue-700)',
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

            <div
              style={{
                marginTop: '1rem',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-faint)', maxWidth: '100%' }}>
                Payments and invoices are not shown in this view.
              </p>
              {isSubcontractorLikeRole(authRole as UserRole) ? (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--text-faint)', maxWidth: '100%' }}>
                  You are assigned on this job.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div
          style={{
            marginTop: '1rem',
            display: 'flex',
            justifyContent: 'flex-end',
            width: '100%',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.875rem',
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Close
          </button>
        </div>
      </div>

      {reportsModalOpen && fullJob ? (
        <JobReportsModal
          open
          onClose={() => setReportsModalOpen(false)}
          jobId={fullJob.id}
          hcpNumber={fullJob.hcp_number}
          jobName={fullJob.job_name}
          jobAddress={fullJob.job_address}
          authUserId={authUser?.id ?? null}
          userRole={authRole as UserRole | null}
          zIndex={1100}
        />
      ) : null}
    </div>
  )
}
