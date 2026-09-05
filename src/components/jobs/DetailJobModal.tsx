import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  resolveJobWindowMode,
  showJobCostBreakdownTeamLabor,
  showJobDetailJobTotal,
  showJobDetailProfitSection,
} from '../../lib/jobDetailModalRole'
import { buildJobProfitSummary } from '../../lib/jobs/jobProfitSummary'
import { mercuryCardTotalFromLines, tallyPartsTotalFromLines } from '../../lib/fetchJobMaterialsCostSnapshot'
import {
  scheduleFormatDateLongNoWeekday,
  scheduleFormatWeekdayOnly,
  scheduleFormatWindow,
} from '../../lib/jobScheduleChicago'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { companyWeekStartSundayContaining, getDefaultWeekRange } from '../../utils/dateUtils'
import { JobCalendarModal } from './JobCalendarModal'
import { ShareJobButton } from './ShareJobButton'
import { SupplyHouseShareModal } from './SupplyHouseShareModal'
import { useChecklistAddModal } from '../../contexts/ChecklistAddModalContext'
import { renderAccountManChip } from './jobsStagesRowShared'
import { buildAccountManDisplay } from '../../lib/jobs/accountMan'
import type { JobShareFields } from '../../lib/jobShare'
import { ScheduleJobModal } from './ScheduleJobModal'
import { isSubcontractorLikeRole } from '../../lib/subcontractorLikeRole'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { useToastContext } from '../../contexts/ToastContext'
import { useUpdateFocusOpenerBridge } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { useAuth, type UserRole } from '../../hooks/useAuth'
import PaidJobEmailSendModal from './PaidJobEmailSendModal'
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
import { PartnerJobSplitPanel } from '../partnerships/PartnerJobSplitPanel'
import JobChargesTimelineStandalone from './JobChargesTimelineStandalone'
import { JobDetailScheduleSessionsSection } from './JobDetailScheduleSessionsSection'
import { JobLedgerStatusPipeline } from './JobLedgerStatusPipeline'
import { JobThreadNotesPanel } from '../JobThreadNotesPanel'
import JobReportsModal from '../JobReportsModal'
import { formatDispatchNoteDaysAgoShortPhrase } from '../../utils/dispatchNoteDisplay'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { LimitedJobDetailSnapshot } from '../../types/limitedJobDetailSnapshot'
import GcHardHatIcon from '../icons/GcHardHatIcon'
import DevelopmentHouseIcon from '../icons/DevelopmentHouseIcon'

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
  job_pictures_link?: string | null
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
  /** Auto-open the Share-with-supply-house modal once the job loads (v2.1610 — Dispatch inbox one-click). */
  autoOpenSupplyHouseShare?: boolean
  /**
   * Job-window embedding (v2.1675): render as the window's Job tab — no own
   * overlay/card, no Escape listener, no ✕/Close (the window owns them).
   */
  paneMode?: boolean
  /** Pane mode: bump to re-run loadDetail after the Edit/Bill tabs save (autosave slices flush). */
  externalRefreshKey?: number
  /** Pane mode: reports the stacked-satellite state so the window's Escape owner can hold fire. */
  onEscBlockedChange?: ((blocked: boolean) => void) | null
  /**
   * Pane mode (v2.1676): hide everything BELOW the title/icons/Street-View
   * header. The Job window keeps this component mounted on every tab so the
   * shared header (and its live icon handlers + satellites) ride along; only
   * the read-view body yields to the Edit/Bill panes.
   */
  paneBodyHidden?: boolean
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

/** Name-first title (v2.1529): the job name carries the header; the number rides as a chip when present. */
function formatJobDetailModalTitleParts(
  hcp: string | null | undefined,
  jobName: string | null | undefined,
): { num: string | null; name: string } {
  const h = (hcp ?? '').trim()
  const n = (jobName ?? '').trim() || '—'
  return { num: h || null, name: n }
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
  gcCustomerName,
  developmentName,
}: {
  customerName: string | null | undefined
  customerPhone: string | null | undefined
  customerEmail: string | null | undefined
  gcCustomerName?: string | null
  developmentName?: string | null
}) {
  const name = customerName?.trim() ?? ''
  const phone = customerPhone?.trim() ?? ''
  const email = customerEmail?.trim() ?? ''
  const gcNameRaw = gcCustomerName?.trim() ?? ''
  // v2.1529 (Option B): the GC line only earns its row when it names a DIFFERENT
  // company — "Heron Construction Group" twice was pure noise.
  const gcName = gcNameRaw.toLowerCase() === name.toLowerCase() ? '' : gcNameRaw
  const devName = developmentName?.trim() ?? ''

  const openTel = () => {
    if (phone) openInExternalBrowser(`tel:${phone}`)
  }
  const openMailto = () => {
    if (email) openInExternalBrowser(`mailto:${email}`)
  }

  const contactChipStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 999,
    padding: '0.22rem 0.7rem',
    fontSize: '0.8125rem',
    color: 'var(--text-link)',
    cursor: 'pointer',
    maxWidth: '100%',
    minWidth: 0,
  }
  const missingChipStyle: CSSProperties = {
    ...contactChipStyle,
    color: 'var(--text-faint)',
    borderStyle: 'dashed',
    cursor: 'default',
  }
  const chipTextStyle: CSSProperties = {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ minWidth: 0 }}>
      <div style={name ? { fontSize: '1.02rem', fontWeight: 600, wordBreak: 'break-word' } : customerPanelMissingPlaceholderStyle}>
        {name || '[missing customer name]'}
      </div>
      {gcName ? (
        <div
          title="GC/Builder for this job"
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: 2, fontSize: '0.8125rem', color: 'var(--text-muted)' }}
        >
          <GcHardHatIcon size={12} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gcName}</span>
        </div>
      ) : null}
      {devName ? (
        <div
          title="Development for this job"
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: 2, fontSize: '0.8125rem', color: 'var(--text-muted)' }}
        >
          <DevelopmentHouseIcon size={12} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{devName}</span>
        </div>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
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
            style={contactChipStyle}
          >
            📞 <span style={chipTextStyle}>{phone}</span>
          </span>
        ) : (
          <span style={missingChipStyle} title="No phone on file">📞 <span style={chipTextStyle}>no phone</span></span>
        )}
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
            style={contactChipStyle}
          >
            ✉️ <span style={chipTextStyle}>{email}</span>
          </span>
        ) : (
          <span style={missingChipStyle} title="No email on file">✉️ <span style={chipTextStyle}>no email</span></span>
        )}
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

export type JobDetailAddLinkTarget = {
  field: 'google_drive_link' | 'job_pictures_link'
  label: string
}

/**
 * Customer Files / Customer Photos icon pair above the Address block. Blue =
 * link set (opens it); grey = missing (opens the add-link modal for roles
 * that can edit the job; inert for subcontractor-like viewers).
 */
function JobDetailLinkIcons({
  googleDriveLink,
  jobPicturesLink,
  canEdit,
  onAddLink,
}: {
  googleDriveLink: string | null | undefined
  jobPicturesLink: string | null | undefined
  canEdit: boolean
  onAddLink: (target: JobDetailAddLinkTarget) => void
}) {
  const items: Array<{
    field: JobDetailAddLinkTarget['field']
    label: string
    openLabel: string
    url: string
    path: string
  }> = [
    {
      field: 'google_drive_link',
      label: 'Customer Files',
      openLabel: 'Open Drive folder',
      url: googleDriveLink?.trim() ?? '',
      path: 'M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z',
    },
    {
      field: 'job_pictures_link',
      label: 'Customer Photos',
      openLabel: 'Open photos',
      url: jobPicturesLink?.trim() ?? '',
      path: 'M128 160C128 124.7 156.7 96 192 96L512 96C547.3 96 576 124.7 576 160L576 416C576 451.3 547.3 480 512 480L192 480C156.7 480 128 451.3 128 416L128 160zM56 192C69.3 192 80 202.7 80 216L80 512C80 520.8 87.2 528 96 528L456 528C469.3 528 480 538.7 480 552C480 565.3 469.3 576 456 576L96 576C60.7 576 32 547.3 32 512L32 216C32 202.7 42.7 192 56 192zM224 224C241.7 224 256 209.7 256 192C256 174.3 241.7 160 224 160C206.3 160 192 174.3 192 192C192 209.7 206.3 224 224 224zM420.5 235.5C416.1 228.4 408.4 224 400 224C391.6 224 383.9 228.4 379.5 235.5L323.2 327.6L298.7 297C294.1 291.3 287.3 288 280 288C272.7 288 265.8 291.3 261.3 297L197.3 377C191.5 384.2 190.4 394.1 194.4 402.4C198.4 410.7 206.8 416 216 416L488 416C496.7 416 504.7 411.3 508.9 403.7C513.1 396.1 513 386.9 508.4 379.4L420.4 235.4z',
    },
  ]
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
      {items.map((it) => {
        const has = it.url !== ''
        const inert = !has && !canEdit
        const title = has
          ? `${it.label} — ${it.openLabel}`
          : canEdit
            ? `${it.label} — no link yet, click to add one`
            : `${it.label} — no link yet`
        return (
          <button
            key={it.field}
            type="button"
            disabled={inert}
            onClick={(e) => {
              e.stopPropagation()
              if (has) openInExternalBrowser(it.url)
              else if (canEdit) onAddLink({ field: it.field, label: it.label })
            }}
            title={title}
            aria-label={title}
            style={{
              padding: '0.15rem',
              background: 'none',
              border: 'none',
              cursor: inert ? 'default' : 'pointer',
              color: has ? 'var(--text-blue-500)' : 'var(--text-faint)',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.35em" height="1.35em" fill="currentColor" aria-hidden="true">
              <path d={it.path} />
            </svg>
          </button>
        )
      })}
    </div>
  )
}

function DetailJobModalFilesPlansRow({
  jobPlansLink,
}: {
  jobPlansLink: string | null | undefined
}) {
  const plans = jobPlansLink?.trim() ?? ''
  if (!plans) return null
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
      <div style={{ minWidth: 0, textAlign: 'center' }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Job Plans</div>
        <button type="button" onClick={() => openInExternalBrowser(plans)} style={detailJobFilesPlansButtonStyle}>
          Open plans
        </button>
      </div>
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
    job_pictures_link: assigned.job_pictures_link ?? null,
    job_plans_link: assigned.job_plans_link,
    revenue: assigned.revenue,
    project_id: assigned.project_id ?? null,
    customer_name: null,
    customer_email: null,
    customer_phone: null,
    gc_customer_name: null,
    development_name: null,
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
            'id, hcp_number, job_name, job_address, google_drive_link, job_pictures_link, job_plans_link, revenue, project_id, customer_name, customer_email, customer_phone, last_work_date, status, account_manager_user_id, account_manager_relationship, account_manager:account_manager_user_id(name), gc_customer:gc_customer_id(name), development:development_id(name), service_types:service_type_id(name)',
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
      job_pictures_link: string | null
      job_plans_link: string | null
      revenue: number | null
      project_id: string | null
      customer_name: string | null
      customer_email: string | null
      customer_phone: string | null
      last_work_date: string | null
      status: string
      gc_customer?: { name: string | null } | { name: string | null }[] | null
      development?: { name: string | null } | { name: string | null }[] | null
      service_types?: { name: string } | null
    }
    const { service_types: st, gc_customer: gcEmbed, development: devEmbed, account_manager: amEmbed, ...rest } = r as typeof r & {
      account_manager?: { name: string | null } | { name: string | null }[] | null
    }
    const gcOne = Array.isArray(gcEmbed) ? gcEmbed[0] ?? null : gcEmbed ?? null
    const devOne = Array.isArray(devEmbed) ? devEmbed[0] ?? null : devEmbed ?? null
    const amOne = Array.isArray(amEmbed) ? amEmbed[0] ?? null : amEmbed ?? null
    return {
      ...rest,
      gc_customer_name: gcOne?.name ?? null,
      development_name: devOne?.name ?? null,
      account_manager_name: amOne?.name ?? null,
      service_type_name: st?.name ?? null,
    } as LimitedJobDetailSnapshot
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
  autoOpenSupplyHouseShare = false,
  paneMode = false,
  externalRefreshKey = 0,
  onEscBlockedChange = null,
  paneBodyHidden = false,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullJob, setFullJob] = useState<JobWithDetails | null>(null)
  const [limitedJob, setLimitedJob] = useState<LimitedJobDetailSnapshot | null>(null)
  const [streetViewImgUrl, setStreetViewImgUrl] = useState<string | null>(null)
  const [streetViewLatLng, setStreetViewLatLng] = useState<{ lat: number; lng: number } | null>(null)
  const [streetViewLoading, setStreetViewLoading] = useState(false)
  const [paidEmailModalOpen, setPaidEmailModalOpen] = useState(false)
  const streetViewBlobUrlRef = useRef<string | null>(null)
  const detailFetchIdRef = useRef(0)
  /** Job id the current fullJob/limitedJob belong to — same-id refreshes keep data on screen (v2.1757). */
  const lastLoadedJobIdRef = useRef<string | null>(null)
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
    // Same-job refresh (every Edit/Bill autosave bumps externalRefreshKey):
    // keep the current data on screen while refetching. Clearing it here made
    // mapsAddressLine blip to '' and back, which revoked + refetched the
    // Street View image — the shared header band flashed on every autosave
    // (v2.1757). Only a job SWITCH clears, so a new id never shows the old
    // job's data.
    if (lastLoadedJobIdRef.current !== jobId) {
      setFullJob(null)
      setLimitedJob(null)
    }
    try {
      if (isStaffFullJobLedgerDetailRole(authRole)) {
        const data = await fetchJobWithDetailsById(jobId)
        if (fetchId !== detailFetchIdRef.current) return
        if (!data) {
          setError('Job not found or you do not have access.')
          setFullJob(null)
          setLimitedJob(null)
          lastLoadedJobIdRef.current = null
          return
        }
        setFullJob(data)
        lastLoadedJobIdRef.current = jobId
        return
      }
      const assigned = assignedJobsRows.find((j) => j.id === jobId)
      const ledger = await fetchLimitedLedgerRow(jobId)
      if (fetchId !== detailFetchIdRef.current) return
      const merged = mergeLimitedFromAssignedAndLedger(assigned, ledger)
      if (!merged) {
        setError('Job not found or you do not have access.')
        setFullJob(null)
        setLimitedJob(null)
        lastLoadedJobIdRef.current = null
        return
      }
      setLimitedJob(merged)
      lastLoadedJobIdRef.current = jobId
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
      lastLoadedJobIdRef.current = null
      setFullJob(null)
      setLimitedJob(null)
      setError(null)
      setLoading(false)
      return
    }
    void loadDetail()
    // externalRefreshKey: the Job window bumps it when the Edit/Bill tabs save,
    // so the read view never shows stale data after a tab switch.
  }, [open, jobId, loadDetail, externalRefreshKey])

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

  const modalTitleParts = useMemo(() => {
    const data = fullJob ?? limitedJob
    if (data) return formatJobDetailModalTitleParts(data.hcp_number, data.job_name)
    if (error) return { num: null, name: 'Job Detail' }
    if (prefillRowLabel?.trim()) {
      const { hcp, jobName } = splitScheduleDetailRowLabel(prefillRowLabel)
      return formatJobDetailModalTitleParts(hcp === '—' ? '' : hcp, jobName)
    }
    return { num: null, name: 'Job Detail' }
  }, [fullJob, limitedJob, error, prefillRowLabel])
  /** Plain-text label for child dialogs (job calendar etc.). */
  const modalTitle = modalTitleParts.num
    ? `${modalTitleParts.num} · ${modalTitleParts.name}`
    : modalTitleParts.name

  /**
   * Job window (v2.1677): the display number for the trade pill — HCP first,
   * else C# (the app-wide precedence) — so the pill reads "961 PLUM" on every
   * tab even for Click-numbered jobs, whose title carries no number chip.
   */
  const paneJobNumber = useMemo(() => {
    const hcp = ((fullJob ?? limitedJob)?.hcp_number ?? '').trim()
    if (hcp) return hcp
    return (fullJob?.click_number ?? '').trim()
  }, [fullJob, limitedJob])

  const mapsAddressLine = useMemo(() => {
    const fromJob = (fullJob ?? limitedJob)?.job_address?.trim()
    if (fromJob) return fromJob
    return (prefillAddress ?? '').trim()
  }, [fullJob, limitedJob, prefillAddress])

  const accountManDisplay = useMemo(() => {
    const data = fullJob ?? limitedJob
    if (!data) return null
    const name = fullJob?.account_manager?.name ?? limitedJob?.account_manager_name ?? null
    return buildAccountManDisplay({
      account_manager_user_id: data.account_manager_user_id ?? null,
      account_manager_relationship: data.account_manager_relationship ?? null,
      account_manager: { name },
    })
  }, [fullJob, limitedJob])

  const shareFields = useMemo<JobShareFields>(() => {
    const data = fullJob ?? limitedJob
    if (data) return { hcpNumber: data.hcp_number, jobName: data.job_name, jobAddress: mapsAddressLine || null }
    if (prefillRowLabel?.trim()) {
      const { hcp, jobName } = splitScheduleDetailRowLabel(prefillRowLabel)
      return { hcpNumber: hcp, jobName, jobAddress: mapsAddressLine || null }
    }
    return { hcpNumber: null, jobName: null, jobAddress: mapsAddressLine || null }
  }, [fullJob, limitedJob, prefillRowLabel, mapsAddressLine])

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
    if (materialsSnapshot.tallyFetchFailed || materialsSnapshot.supplyInvoiceRpcFailed || materialsSnapshot.mercuryFetchFailed)
      return null
    return buildJobProfitSummary({
      revenue: fullJob.revenue != null ? Number(fullJob.revenue) : null,
      supplyInvoiceTotal: materialsSnapshot.supplyInvoiceTotal,
      cardChargesTotal: mercuryCardTotalFromLines(materialsSnapshot.mercuryAllocLines),
      tallyPartsTotal: tallyPartsTotalFromLines(materialsSnapshot.tallyPartLines),
      otherChargesTotal: (fullJob.materials ?? []).reduce(
        (s: number, m: { amount: number | string | null }) => s + (Number(m.amount) || 0),
        0,
      ),
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

  const { user: authUser, profileName, role: viewerAuthRole } = useAuth()
  // Share with supply house (v2.1605): office roles only; needs the full job.
  const canShareSupplyHouse =
    viewerAuthRole === 'dev' || viewerAuthRole === 'master_technician' || viewerAuthRole === 'assistant' || viewerAuthRole === 'controller'
  const [supplyHouseShareOpen, setSupplyHouseShareOpen] = useState(false)
  // One-shot auto-open from the Dispatch inbox's find-owner action (v2.1610):
  // waits for the full job (the share modal needs it), fires once.
  const supplyShareAutoOpenedRef = useRef(false)
  useEffect(() => {
    if (!autoOpenSupplyHouseShare || supplyShareAutoOpenedRef.current) return
    if (!fullJob || !canShareSupplyHouse) return
    supplyShareAutoOpenedRef.current = true
    setSupplyHouseShareOpen(true)
  }, [autoOpenSupplyHouseShare, fullJob, canShareSupplyHouse])
  const { showToast } = useToastContext()
  const checklistAddModal = useChecklistAddModal()
  /** Header send-as-task (v2.1529): same preset as the Pipeline row quick action. */
  const openSendJobAsTask = () => {
    if (!jobId) return
    const label = `${modalTitleParts.num ?? '—'} · ${modalTitleParts.name}`
    checklistAddModal?.openAddModal({
      preset: {
        title: `{{1:${label}}} — `,
        links: [`${window.location.origin}/jobs?jobDetail=${encodeURIComponent(jobId)}`],
      },
    })
  }
  /** Add-link modal for the grey Customer Files / Photos icons (office roles only). */
  const [addLinkTarget, setAddLinkTarget] = useState<JobDetailAddLinkTarget | null>(null)
  const [addLinkUrl, setAddLinkUrl] = useState('')
  const [addLinkSaving, setAddLinkSaving] = useState(false)
  const canEditJobLinks = authRole !== null && !isSubcontractorLikeRole(authRole as UserRole)
  /** Photos add-modal's "(Customer)" fallback: a second Add-Customer-Files dialog stacked above it. */
  const [stackedAddFilesOpen, setStackedAddFilesOpen] = useState(false)
  const [stackedFilesUrl, setStackedFilesUrl] = useState('')
  const [stackedFilesSaving, setStackedFilesSaving] = useState(false)
  const saveStackedFilesLink = async () => {
    if (!jobId) return
    const url = stackedFilesUrl.trim()
    if (!/^https?:\/\/\S+$/i.test(url)) {
      showToast('Enter a full link starting with http:// or https://', 'error')
      return
    }
    setStackedFilesSaving(true)
    try {
      await withSupabaseRetry(
        async () => supabase.from('jobs_ledger').update({ google_drive_link: url }).eq('id', jobId),
        'save customer files link from stacked Job Detail dialog',
      )
      showToast('Customer Files link saved.', 'success')
      setStackedAddFilesOpen(false)
      setStackedFilesUrl('')
      void loadDetail()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the link'), 'error')
    } finally {
      setStackedFilesSaving(false)
    }
  }
  const saveAddLink = async () => {
    if (!jobId || !addLinkTarget) return
    const url = addLinkUrl.trim()
    if (!/^https?:\/\/\S+$/i.test(url)) {
      showToast('Enter a full link starting with http:// or https://', 'error')
      return
    }
    setAddLinkSaving(true)
    try {
      await withSupabaseRetry(
        async () => supabase.from('jobs_ledger').update({ [addLinkTarget.field]: url }).eq('id', jobId),
        'save job link from Job Detail',
      )
      showToast(`${addLinkTarget.label} link saved.`, 'success')
      setAddLinkTarget(null)
      setAddLinkUrl('')
      void loadDetail()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the link'), 'error')
    } finally {
      setAddLinkSaving(false)
    }
  }
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

  const navigate = useNavigate()
  // Mirrors Jobs.tsx canOpenJobScheduleModal — the roles that can use the Dispatch job-week grid.
  const showWeekDispatchButton =
    Boolean(jobId) &&
    Boolean(fullJob) &&
    (authRole === 'dev' ||
      authRole === 'master_technician' ||
      isAssistantLike(authRole) ||
      authRole === 'superintendent')

  const handleOpenWeekDispatch = (selectedYmd?: string | null) => {
    if (!jobId) return
    const week = (selectedYmd ? companyWeekStartSundayContaining(selectedYmd) : null) ?? getDefaultWeekRange().start
    onClose()
    navigate(`/schedule-dispatch?jobId=${encodeURIComponent(jobId)}&week=${encodeURIComponent(week)}`)
  }

  // Header calendar icon → Job Calendar modal; its Schedule… opens ScheduleJobModal on the picked day.
  const [jobCalendarOpen, setJobCalendarOpen] = useState(false)
  const [detailScheduleModalOpen, setDetailScheduleModalOpen] = useState(false)
  const [detailScheduleInitialDate, setDetailScheduleInitialDate] = useState<string | null>(null)

  // v2.1104: Escape closes Job Detail — but never underneath a stacked overlay
  // (each satellite is gated by its open flag below; JobCalendarModal and the
  // paid-email modal close themselves on Esc, the rest keep their ✕).
  const detailEscBlocked =
    paidEmailModalOpen || reportsModalOpen || jobCalendarOpen || detailScheduleModalOpen || stackedAddFilesOpen
  useEffect(() => {
    // Pane mode: the Job window (or the embedded form's own listener) owns
    // Escape — a second listener here would double-close and skip the flush.
    if (!open || detailEscBlocked || paneMode) return
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || ev.defaultPrevented) return
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, detailEscBlocked, onClose, paneMode])

  // Pane mode: report the stacked-overlay state up so the window's Escape owner
  // (the embedded form) never closes the window underneath Reports / Calendar /
  // Schedule / paid-email / Add-files.
  useEffect(() => {
    if (!paneMode || !onEscBlockedChange) return
    onEscBlockedChange(detailEscBlocked)
    return () => onEscBlockedChange(false)
  }, [paneMode, onEscBlockedChange, detailEscBlocked])

  const jobFormModal = useJobFormModal()
  const showEditJobButton =
    // Pane mode: no ⚙ — the window's Edit tab replaced it (v2.1677).
    !paneMode &&
    Boolean(jobFormModal) &&
    !loading &&
    !error &&
    Boolean(jobId) &&
    // Only roles that get the tabbed window can edit (v2.2848): for anyone else
    // the ⚙ would route through the bridge straight back to this read pane.
    resolveJobWindowMode(authRole) === 'window'

  const handleEditJobClick = () => {
    if (!jobId || resolveJobWindowMode(authRole) !== 'window') return
    if (!jobFormModal) return
    jobFormModal.openEditJob(jobId, {
      ...(fullJob ? { initialJob: fullJob } : {}),
      onSaved: () => {
        setMaterialsCostRefreshKey((k) => k + 1)
        void loadDetail()
        onEditJobSaved?.()
      },
    })
    // Edit Job replaces (not stacks on) Job Detail: closing/saving Edit lands on
    // whatever was under Job Detail (e.g. the Add-job picker); its own "job
    // detail" footer button reopens Job Detail via the opener bridge.
    onClose()
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

  // Subcontractor-like roles have no /jobs access — the pill stays a plain badge for them.
  const tradePillOpensStages = Boolean(jobId) && !isSubcontractorLikeRole(authRole as UserRole) && authRole !== null

  const handleTradePillClick = () => {
    if (!jobId) return
    onClose()
    navigate(`/jobs?tab=stages&stagesJob=${encodeURIComponent(jobId)}`)
  }

  const showDetailHeaderRightCluster = headerTradePill != null || showEditJobButton || showWeekDispatchButton

  useBodyScrollLock(open && narrowViewport)

  if (!open) return null

  // Backdrop-close fires only for a click on the backdrop itself (`target ===
  // currentTarget`). The satellite modals further down (Reports, Job Calendar,
  // Schedule, paid-email) render their own fixed overlays as siblings of the
  // panel *inside* this div, so a plain `onClick={onClose}` closed Job Detail —
  // and every stacked modal with it — on any click inside them. That is what
  // made Reports → "Add additional report" look like a dead button (v2.1167).
  return (
    <div
      style={
        paneMode
          ? undefined
          : {
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1004,
              // Safe-area aware (v2.1607): in the installed app the webview runs under
              // the iOS status bar / call pill, which clipped the title. env() is 0 in
              // plain browsers, so desktop keeps the plain 1rem.
              padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
              ...(narrowViewport ? { overscrollBehavior: 'contain' as const } : {}),
            }
      }
      onClick={(e) => !paneMode && e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-labelledby="detail-job-modal-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          // Pane mode: the Job window's scroll container already pads 1.25rem —
          // padding here too doubled the whitespace under the tab bar (v2.1677).
          padding: paneMode ? 0 : '1.25rem',
          ...(accountManDisplay?.variant === 'only'
            ? { borderTop: '3px solid #dc2626', borderBottom: '3px solid #dc2626' }
            : {}),
          width: '100%',
          // Pane mode: the Job window's card provides size, scroll and shadow.
          ...(paneMode
            ? null
            : {
                maxWidth: 560,
                // min(…, 100%): a centered flex child taller than the overlay's padded
                // box overflows both ends and slides under the status bar (v2.1747).
                maxHeight: 'min(90vh, 100%)',
                overflow: 'auto',
                boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              }),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            // Wrap so on narrow screens the action row drops BELOW the title
            // instead of squeezing a long job name to one word per line.
            flexWrap: 'wrap',
            gap: '0.35rem 1rem',
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
              minWidth: 'min(100%, 240px)',
              paddingRight: showDetailHeaderRightCluster ? '0.5rem' : 0,
            }}
          >
            {/* Pane mode: the trade pill below carries the number ("961 PLUM"),
                so the title chip would show it twice (v2.1677). */}
            {modalTitleParts.num && !paneMode ? (
              <span
                style={{
                  display: 'inline-block',
                  padding: '0.1rem 0.5rem',
                  marginRight: '0.45rem',
                  borderRadius: 6,
                  background: 'var(--bg-blue-tint)',
                  color: 'var(--text-blue-700)',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  verticalAlign: 'text-bottom',
                }}
              >
                {modalTitleParts.num}
              </span>
            ) : null}
            {modalTitleParts.name}
          </h2>
          {/* One action row (v2.1529, Option B): pill · share · supply house · send-task · calendar · mail · gear · close.
              Narrow screens (v2.1607): full-width row under the title — the old
              55% cap forced a ragged two-line wrap once the cluster grew. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              // Pane mode: full-width row, pill + icons pinned left (the
              // "Link to" cluster whose marginLeft:auto used to split the row
              // retired in v2.1695).
              justifyContent: paneMode ? 'flex-start' : 'flex-end',
              flexWrap: 'wrap',
              gap: narrowViewport ? '0.3rem' : '0.15rem',
              flexShrink: 0,
              maxWidth: narrowViewport || paneMode ? '100%' : '55%',
              ...(narrowViewport || paneMode ? { width: '100%' } : {}),
            }}
          >
            {showDetailHeaderRightCluster && headerTradePill ? (
              <span style={{ marginRight: '0.25rem', display: 'inline-flex' }}>
                {tradePillOpensStages ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleTradePillClick()
                    }}
                    title={`${headerTradePillTitleText ?? headerTradePill.label} — open this job in Jobs → Stages`}
                    aria-label={`${headerTradePillTitleText ?? headerTradePill.label}: open this job in Jobs → Stages`}
                    style={{ ...headerTradePill.style, marginTop: 0, cursor: 'pointer' }}
                  >
                    {/* Job window: the pill carries the job number ("961 PLUM") —
                        C#-numbered jobs have no title chip, so this is where the
                        number lives (v2.1677). */}
                    {paneMode && paneJobNumber ? `${paneJobNumber} ${headerTradePill.label}` : headerTradePill.label}
                  </button>
                ) : (
                  <span style={{ ...headerTradePill.style, marginTop: 0 }} title={headerTradePillTitleText}>
                    {paneMode && paneJobNumber ? `${paneJobNumber} ${headerTradePill.label}` : headerTradePill.label}
                  </span>
                )}
              </span>
            ) : null}
            {/* Pane mode (v2.1706): pill left, every icon pushed right — this
                zero-width spacer's auto margin does the split. */}
            {paneMode ? <span aria-hidden style={{ marginLeft: 'auto' }} /> : null}
            {canShareSupplyHouse && fullJob ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setSupplyHouseShareOpen(true)
                }}
                title="Share with supply house — set up a job account"
                aria-label="Share with supply house"
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
                {/* Storefront glyph */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill="currentColor" aria-hidden>
                  <path d="M96 96L544 96L592 224L592 256C592 291.3 563.3 320 528 320C505.1 320 485 307.9 473.6 289.7C462.3 307.9 442.2 320 419.2 320C396.2 320 376.1 307.9 364.8 289.7C353.4 307.9 333.3 320 310.4 320C287.4 320 267.3 307.9 256 289.7C244.7 307.9 224.6 320 201.6 320C178.6 320 158.5 307.9 147.2 289.7C135.8 307.9 115.7 320 92.8 320C69.9 320 48 291.3 48 256L48 224L96 96zM112 352L112 544L288 544L288 432L384 432L384 544L528 544L528 352C534 352 550 350 560 344L560 544C560 561.7 545.7 576 528 576L112 576C94.3 576 80 561.7 80 544L80 344C90 350 106 352 112 352z" />
                </svg>
              </button>
            ) : null}
            {/* Paid-in-full email sits left of the calendar (owner call,
                v2.1709); the green "$" badge says PAID at a glance (v2.1706). */}
            {showDetailHeaderRightCluster && (authRole === 'dev' || authRole === 'master_technician') && jobId ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setPaidEmailModalOpen(true)
                }}
                title="Send paid-in-full email"
                aria-label="Send paid-in-full email"
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
                {/* 18px, not 20: the filled envelope is optically denser than
                    the outline neighbors. */}
                <span style={{ position: 'relative', display: 'inline-flex' }}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 512 512"
                    width={18}
                    height={18}
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48L48 64zM0 176L0 384c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-208L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z" />
                  </svg>
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: -5,
                      right: -5,
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      lineHeight: 1,
                      color: '#16a34a',
                      background: 'var(--surface)',
                      borderRadius: '50%',
                      padding: '1px 2px',
                    }}
                  >
                    $
                  </span>
                </span>
              </button>
            ) : null}
            {/* Calendar sits left of send-task (owner call, v2.1706). */}
            {showDetailHeaderRightCluster && showWeekDispatchButton ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setJobCalendarOpen(true)
                }}
                title="Open the job calendar — days scheduled, who, and every appointment"
                aria-label="Open the job calendar"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.35rem',
                  margin: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-link)',
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
                  <path d="M224 64C206.3 64 192 78.3 192 96L192 128L160 128C124.7 128 96 156.7 96 192L96 240L544 240L544 192C544 156.7 515.3 128 480 128L448 128L448 96C448 78.3 433.7 64 416 64C398.3 64 384 78.3 384 96L384 128L256 128L256 96C256 78.3 241.7 64 224 64zM96 288L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 288L96 288z" />
                </svg>
              </button>
            ) : null}
            {showWorkflowLink && jobId ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  openSendJobAsTask()
                }}
                title="Send this job to someone as a task"
                aria-label="Send job as a task"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.35rem',
                  margin: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: '#7c3aed',
                  borderRadius: 4,
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 640 640"
                  width={17}
                  height={17}
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M576 64L64 288L240 352L240 496L328 400L472 512L576 64z" />
                </svg>
              </button>
            ) : null}
            {showDetailHeaderRightCluster ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
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
            {/* Share anchors the far right (owner call, v2.1706). */}
            <ShareJobButton jobId={jobId} fields={shareFields} size={18} padding="0.35rem" color="var(--text-600)" />
            {!paneMode ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onClose()
                }}
                title="Close"
                aria-label="Close job detail"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.3rem 0.5rem',
                  margin: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '1.15rem',
                  lineHeight: 1,
                  borderRadius: 4,
                }}
              >
                ✕
              </button>
            ) : null}
          </div>
        </div>
        {accountManDisplay ? (
          <div style={{ marginTop: '0.4rem', fontSize: '0.8125rem' }}>{renderAccountManChip(accountManDisplay)}</div>
        ) : null}

        {/* Option B photo header (v2.1529): Street View leads as a slim banner with the
            address pinned on it; when there's no imagery (or still loading with nothing
            to show yet) the address falls back to a plain map-link row. */}
        {mapsAddressLine && (streetViewLoading || streetViewImgUrl) ? (
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
              height: 110,
              marginTop: '0.75rem',
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
                position: 'absolute',
                left: 8,
                bottom: 8,
                maxWidth: '80%',
                // On-photo scrim: fixed dark glass in both themes so white text always reads.
                background: 'rgba(10, 14, 20, 0.62)',
                color: '#fff',
                borderRadius: 6,
                padding: '0.3rem 0.6rem',
                fontSize: '0.8125rem',
                textDecoration: 'underline',
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              📍 {mapsAddressLine}
            </span>
          </div>
        ) : mapsAddressLine ? (
          <div style={{ marginTop: '0.75rem', minWidth: 0 }}>
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
              📍 {mapsAddressLine}
            </span>
          </div>
        ) : null}

        {/* Job-window header split (v2.1676): everything ABOVE this line —
            title, action icons, Street View / map band — stays visible on
            every tab; the read-view body below hides on Edit/Bill. */}
        <div style={paneBodyHidden ? { display: 'none' } : undefined}>
        {showTopBand ? (
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              {detailJob ? (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <DetailJobModalCustomerPanel
                    customerName={detailJob.customer_name}
                    customerPhone={detailJob.customer_phone}
                    customerEmail={detailJob.customer_email}
                    gcCustomerName={'gc_customer_name' in detailJob ? detailJob.gc_customer_name : detailJob.gcCustomer?.name ?? null}
                    developmentName={'development_name' in detailJob ? detailJob.development_name : detailJob.development?.name ?? null}
                  />
                </div>
              ) : (
                <div style={{ flex: 1, minWidth: 0 }} />
              )}
              <div style={{ flexShrink: 0 }}>
                <JobDetailLinkIcons
                  googleDriveLink={(fullJob ?? limitedJob)?.google_drive_link}
                  jobPicturesLink={(fullJob ?? limitedJob)?.job_pictures_link}
                  canEdit={canEditJobLinks}
                  onAddLink={(t) => {
                    setAddLinkTarget(t)
                    setAddLinkUrl('')
                  }}
                />
              </div>
            </div>
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
            </div>
            <div style={jobDetailStatusRowStyle}>
              <DetailRow label="Status" noBottomMargin centered>
                <JobLedgerStatusPipeline status={fullJob.status} />
              </DetailRow>
            </div>


            <DetailJobModalFilesPlansRow jobPlansLink={fullJob.job_plans_link} />

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
                {/* Count-aware (the old box read "View all reports" whether the
                    job had 0 or 10 — reports looked like they weren't showing
                    up at all); the subline is the newest report's meta. */}
                {(fullJob.report_count ?? 0) > 0 ? (
                  <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'underline' }}>
                    {fullJob.report_count} report{fullJob.report_count === 1 ? '' : 's'}
                  </span>
                ) : (
                  <span style={{ fontSize: '0.9375rem', color: 'var(--text-faint)' }}>No reports yet</span>
                )}
                {fullJob.latestReport?.created_at ? (
                  /* Who + when only — the template name was noise here (owner
                     call, v2.1709); the report link says what it is. */
                  <span style={{ fontSize: '0.71875rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {[
                      fullJob.latestReport.author_name?.trim(),
                      formatDispatchNoteDaysAgoShortPhrase(fullJob.latestReport.created_at),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                ) : null}
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
                failed={
                  profitLaborFailed ||
                  materialsSnapshot?.tallyFetchFailed === true ||
                  materialsSnapshot?.supplyInvoiceRpcFailed === true ||
                  materialsSnapshot?.mercuryFetchFailed === true
                }
                summary={profitSummary}
              />
            ) : null}
            {/* §3 partner split (PARTNERSHIPS_PLAN PR 5) — self-gating: renders
                only for devs on partner-flagged jobs; fail-soft pre-push. */}
            {authRole === 'dev' && jobId ? <PartnerJobSplitPanel jobId={jobId} /> : null}

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
            </div>
            <div style={jobDetailStatusRowStyle}>
              <DetailRow label="Status" noBottomMargin centered>
                <JobLedgerStatusPipeline status={limitedJob.status} />
              </DetailRow>
            </div>

            <DetailJobModalFilesPlansRow jobPlansLink={limitedJob.job_plans_link} />

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
            display: paneMode ? 'none' : 'flex',
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
      </div>

      {addLinkTarget ? (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1006 }}
          role="presentation"
          onClick={(e) => {
            e.stopPropagation()
            if (!addLinkSaving) setAddLinkTarget(null)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Add ${addLinkTarget.label} link`}
            style={{ background: 'var(--surface)', borderRadius: 8, width: 'min(94vw, 420px)', padding: '1rem 1.1rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'grid', gap: '0.6rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, color: 'var(--text-strong)', fontSize: '1rem' }}>Add {addLinkTarget.label} link</h3>
            <input
              type="url"
              value={addLinkUrl}
              onChange={(e) => setAddLinkUrl(e.target.value)}
              placeholder="https://…"
              aria-label={`${addLinkTarget.label} link URL`}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveAddLink()
              }}
              style={{ width: '100%', padding: '0.45rem 0.55rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
              {addLinkTarget.field === 'google_drive_link' ? (
                <button
                  type="button"
                  onClick={() =>
                    openInExternalBrowser(
                      'https://drive.google.com/drive/folders/1cOTvZrJFTUlxTiUMoESdMtTRvQgxft60?usp=drive_link',
                    )
                  }
                  title="Open the Company Customers folder in Drive to find this customer's folder"
                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.8125rem', border: 'none', background: 'none', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer', marginRight: 'auto' }}
                >
                  Company Customers
                </button>
              ) : (
                <span style={{ marginRight: 'auto', display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() =>
                      openInExternalBrowser(
                        'https://drive.google.com/drive/folders/1cOTvZrJFTUlxTiUMoESdMtTRvQgxft60?usp=drive_link',
                      )
                    }
                    title="Open the Company Customers folder in Drive"
                    style={{ padding: '0.35rem 0.25rem', fontSize: '0.8125rem', border: 'none', background: 'none', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    Company
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const drive = (fullJob ?? limitedJob)?.google_drive_link?.trim() ?? ''
                      if (drive) openInExternalBrowser(drive)
                      else {
                        setStackedFilesUrl('')
                        setStackedAddFilesOpen(true)
                      }
                    }}
                    title={
                      ((fullJob ?? limitedJob)?.google_drive_link?.trim() ?? '') !== ''
                        ? "Open this job's Customer Files folder"
                        : 'No Customer Files link yet — add one first'
                    }
                    style={{ padding: '0.35rem 0.25rem', fontSize: '0.8125rem', border: 'none', background: 'none', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    Customer
                  </button>
                </span>
              )}
              <button
                type="button"
                disabled={addLinkSaving}
                onClick={() => setAddLinkTarget(null)}
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', cursor: addLinkSaving ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={addLinkSaving}
                onClick={() => void saveAddLink()}
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.875rem', fontWeight: 600, border: 'none', borderRadius: 4, background: '#2563eb', color: 'white', cursor: addLinkSaving ? 'not-allowed' : 'pointer' }}
              >
                {addLinkSaving ? 'Saving…' : 'Save link'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {stackedAddFilesOpen ? (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1007 }}
          role="presentation"
          onClick={(e) => {
            e.stopPropagation()
            if (!stackedFilesSaving) setStackedAddFilesOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add Customer Files link"
            style={{ background: 'var(--surface)', borderRadius: 8, width: 'min(94vw, 420px)', padding: '1rem 1.1rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'grid', gap: '0.6rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, color: 'var(--text-strong)', fontSize: '1rem' }}>Add Customer Files link</h3>
            <input
              type="url"
              value={stackedFilesUrl}
              onChange={(e) => setStackedFilesUrl(e.target.value)}
              placeholder="https://…"
              aria-label="Customer Files link URL"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveStackedFilesLink()
              }}
              style={{ width: '100%', padding: '0.45rem 0.55rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() =>
                  openInExternalBrowser(
                    'https://drive.google.com/drive/folders/1cOTvZrJFTUlxTiUMoESdMtTRvQgxft60?usp=drive_link',
                  )
                }
                title="Open the Company Customers folder in Drive to find this customer's folder"
                style={{ padding: '0.35rem 0.5rem', fontSize: '0.8125rem', border: 'none', background: 'none', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer', marginRight: 'auto' }}
              >
                Company Customers
              </button>
              <button
                type="button"
                disabled={stackedFilesSaving}
                onClick={() => setStackedAddFilesOpen(false)}
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', cursor: stackedFilesSaving ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={stackedFilesSaving}
                onClick={() => void saveStackedFilesLink()}
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.875rem', fontWeight: 600, border: 'none', borderRadius: 4, background: '#2563eb', color: 'white', cursor: stackedFilesSaving ? 'not-allowed' : 'pointer' }}
              >
                {stackedFilesSaving ? 'Saving…' : 'Save link'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {jobCalendarOpen && fullJob ? (
        <JobCalendarModal
          job={fullJob}
          onClose={() => setJobCalendarOpen(false)}
          canOpenJobScheduleModal={showWeekDispatchButton}
          onOpenSchedule={(selectedYmd) => {
            setDetailScheduleInitialDate(selectedYmd)
            setDetailScheduleModalOpen(true)
          }}
          onOpenWeekDispatch={(selectedYmd) => {
            setJobCalendarOpen(false)
            handleOpenWeekDispatch(selectedYmd)
          }}
        />
      ) : null}
      {detailScheduleModalOpen && fullJob ? (
        <ScheduleJobModal
          key={fullJob.id}
          open
          onClose={() => {
            setDetailScheduleModalOpen(false)
            setDetailScheduleInitialDate(null)
          }}
          jobId={fullJob.id}
          jobTitle={`${(fullJob.hcp_number ?? '').trim() || '—'} · ${(fullJob.job_name ?? '').trim() || 'Job'}`}
          teamMembers={(fullJob.team_members ?? []).map((tm) => ({
            user_id: tm.user_id,
            name: tm.users?.name ?? null,
          }))}
          initialWorkDate={detailScheduleInitialDate}
        />
      ) : null}
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
      {paidEmailModalOpen && jobId ? (
        <PaidJobEmailSendModal
          jobId={jobId}
          jobLabel={modalTitle}
          jobStatus={fullJob?.status ?? null}
          onClose={() => setPaidEmailModalOpen(false)}
        />
      ) : null}
      {supplyHouseShareOpen && fullJob ? (
        <SupplyHouseShareModal open job={fullJob} onClose={() => setSupplyHouseShareOpen(false)} />
      ) : null}
    </div>
  )
}
