import { useCallback, useEffect, useMemo, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { User } from '@supabase/supabase-js'
import type { BidWithBuilder, EstimatorUser } from '../../types/bidWithBuilder'
import { Database } from '../../types/database'
import { supabase } from '../../lib/supabase'
import { loadJsPDF } from '../../lib/loadJsPDF'
import { formatCompactNoteDateTime } from '../../utils/dateUtils'
import { SELECT_BIDS_SUBMISSION_ENTRIES_WITH_CREATOR, noteByLineFromEmbed } from '../../lib/noteCreatorDisplay'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { effectiveSubmissionBidLastNoteIso, isSubmissionBidStaleForThreshold } from '../../lib/submissionFollowupStale'
import { submissionFollowupBidShareUrl } from '../../lib/submissionFollowupBidShareUrl'
import { formatBidDueTime } from '../../lib/bids/formatBidDueTime'
import { buildFollowupSheetHtml, type FollowupGroups, type FollowupProject } from '../../lib/bidDocuments/followupSheet'
import { printHtmlInNewWindow } from '../../lib/bidDocuments/htmlDoc'
import { bidEligibleForWorkingBoardArchive } from '../../lib/workingBoardArchiveEligibility'
import {
  formatCompactCurrency,
  formatTimeSinceLastContact,
  formatDateYYMMDD,
  formatBidNameWithValue,
  formatDesignDrawingPlanDate,
  bidDisplayName,
} from '../../lib/bids/bidFormatting'
import { SAFETY_ORANGE, SAFETY_ORANGE_BORDER, bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import { extractContactInfo } from '../../lib/bids/bidContactInfo'
import { getSubmissionSectionKey } from '../../lib/bids/submissionSections'
import { formatBidStaffDisplayName } from '../../lib/bids/bidBoardStaffOutcomes'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useBidPreview } from '../../contexts/BidPreviewModalContext'
import { useToastContext } from '../../contexts/ToastContext'
import { BidNotesTable, type BidSubmissionEntry } from '../bidNotes/BidNotesTable'
import { CustomerNotesTable } from '../customerNotes/CustomerNotesTable'
import {
  UnifiedBidCustomerNotes,
  UnifiedBidCustomerNotesActionButtons,
  type UnifiedNotesAddingKind,
} from '../bidBoard/UnifiedBidCustomerNotes'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import { BidSubmissionFollowupExpandableDetails } from './BidSubmissionFollowupExpandableDetails'

type CustomerContact = Database['public']['Tables']['customer_contacts']['Row']

type SubmissionSectionOpenState = {
  unsent: boolean
  pending: boolean
  won: boolean
  startedOrComplete: boolean
  lost: boolean
}

const SUBMISSION_UNSENT_SECTION_LABEL = 'Unsent / Working Bids'

type BidSubmissionFollowupTabProps = {
  bids: BidWithBuilder[]
  authUser: User | null
  selectedBid: BidWithBuilder | null
  onSelectBid: (bid: BidWithBuilder) => void
  onClearBid: () => void
  onEditBid: (bid: BidWithBuilder, opts?: { focus?: 'projectName' | 'gcBuilder' | 'bidValue' }) => void
  onOpenParty: (bid: BidWithBuilder) => void
  lastContactFromEntries: Record<string, string>
  customerContacts: CustomerContact[]
  estimatorUsers: EstimatorUser[]
  onError: (message: string) => void
  onReloadBids: () => void
  onReloadCustomerContacts: () => void
  canAddChecklistTask: boolean
  onAddChecklistTask: () => void
  onShowSentBidScript: () => void
  onShowBidQuestionScript: () => void
  // Kept in the parent because downloadApprovalPdf depends on parent-only state
  // (loadPOTotal, priceBookVersions, serviceTypes, coverLetter*ByBid maps).
  onDownloadApprovalPdf: () => void
  // Shared with the parent's submission-followup deep-link handler
  // (applySubmissionFollowupDeepLinkToBid), so they stay owned by the parent.
  summaryCardRef: RefObject<HTMLDivElement>
  submissionSectionOpen: SubmissionSectionOpenState
  setSubmissionSectionOpen: Dispatch<SetStateAction<SubmissionSectionOpenState>>
}

export function BidSubmissionFollowupTab({
  bids,
  authUser,
  selectedBid,
  onSelectBid,
  onClearBid,
  onEditBid,
  onOpenParty,
  lastContactFromEntries,
  customerContacts,
  estimatorUsers,
  onError,
  onReloadBids,
  onReloadCustomerContacts,
  canAddChecklistTask,
  onAddChecklistTask,
  onShowSentBidScript,
  onShowBidQuestionScript,
  onDownloadApprovalPdf,
  summaryCardRef,
  submissionSectionOpen,
  setSubmissionSectionOpen,
}: BidSubmissionFollowupTabProps) {
  const narrowViewport640 = useNarrowViewport640()
  const bidPreview = useBidPreview()
  const { showToast } = useToastContext()

  const [submissionSearchQuery, setSubmissionSearchQuery] = useState('')
  const [submissionFollowupStaleDaysInput, setSubmissionFollowupStaleDaysInput] = useState('')
  const [submissionFollowupNotesTab, setSubmissionFollowupNotesTab] = useState<'all' | 'bid' | 'customer'>('all')
  const [submissionFollowupUnifiedAddingKind, setSubmissionFollowupUnifiedAddingKind] =
    useState<UnifiedNotesAddingKind>(null)
  const [submissionFollowupBidTableAdding, setSubmissionFollowupBidTableAdding] = useState(false)
  const [submissionFollowupCustomerTableAdding, setSubmissionFollowupCustomerTableAdding] = useState(false)
  const [selectedAccountManagerForPrint, setSelectedAccountManagerForPrint] = useState<string>('')

  function toggleSubmissionSection(key: 'unsent' | 'pending' | 'won' | 'startedOrComplete' | 'lost') {
    setSubmissionSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => {
    setSubmissionFollowupNotesTab('all')
    setSubmissionFollowupUnifiedAddingKind(null)
    setSubmissionFollowupBidTableAdding(false)
    setSubmissionFollowupCustomerTableAdding(false)
  }, [selectedBid?.id])

  const submissionFollowupToolbarAddingKind: UnifiedNotesAddingKind =
    submissionFollowupNotesTab === 'all'
      ? submissionFollowupUnifiedAddingKind
      : submissionFollowupNotesTab === 'bid'
        ? submissionFollowupBidTableAdding
          ? 'bid'
          : null
        : submissionFollowupCustomerTableAdding
          ? 'customer'
          : null

  const handleSubmissionFollowupToolbarAddingKind = useCallback(
    (v: UnifiedNotesAddingKind) => {
      if (submissionFollowupNotesTab === 'all') {
        setSubmissionFollowupUnifiedAddingKind(v)
        return
      }
      if (submissionFollowupNotesTab === 'bid') {
        if (v === 'bid' || v === null) {
          setSubmissionFollowupBidTableAdding(v === 'bid')
          return
        }
        if (v === 'customer') {
          if (!selectedBid?.customers?.id) return
          setSubmissionFollowupUnifiedAddingKind(null)
          setSubmissionFollowupBidTableAdding(false)
          setSubmissionFollowupNotesTab('customer')
          setSubmissionFollowupCustomerTableAdding(true)
        }
        return
      }
      if (v === 'bid') {
        setSubmissionFollowupUnifiedAddingKind(null)
        setSubmissionFollowupCustomerTableAdding(false)
        setSubmissionFollowupNotesTab('bid')
        setSubmissionFollowupBidTableAdding(true)
        return
      }
      if (v === 'customer' || v === null) {
        setSubmissionFollowupCustomerTableAdding(v === 'customer')
      }
    },
    [submissionFollowupNotesTab, selectedBid?.customers?.id]
  )

  function handleSubmissionFollowupNotesTabPillClick(next: 'all' | 'bid' | 'customer') {
    setSubmissionFollowupUnifiedAddingKind(null)
    setSubmissionFollowupBidTableAdding(false)
    setSubmissionFollowupCustomerTableAdding(false)
    setSubmissionFollowupNotesTab(next)
  }

  const filteredBidsForSubmission = submissionSearchQuery.trim()
    ? bids.filter(
        (b) =>
          (b.project_name?.toLowerCase().includes(submissionSearchQuery.toLowerCase()) ?? false) ||
          (b.address?.toLowerCase().includes(submissionSearchQuery.toLowerCase()) ?? false) ||
          (b.customers?.name?.toLowerCase().includes(submissionSearchQuery.toLowerCase()) ?? false) ||
          (b.bids_gc_builders?.name?.toLowerCase().includes(submissionSearchQuery.toLowerCase()) ?? false)
      )
    : bids

  const uniqueAccountManagers = useMemo(() => {
    const managers = new Map<string, { id: string; name: string; count: number }>()
    bids.forEach((bid) => {
      const am = bid.account_manager
      const accountManager = am == null ? null : Array.isArray(am) ? am[0] ?? null : am
      if (accountManager && accountManager.id && accountManager.name) {
        const existing = managers.get(accountManager.id)
        if (existing) {
          existing.count++
        } else {
          managers.set(accountManager.id, {
            id: accountManager.id,
            name: accountManager.name,
            count: 1
          })
        }
      }
    })
    return Array.from(managers.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [bids])

  const unassignedBidsCount = useMemo(() => {
    return bids.filter((bid) => {
      const am = bid.account_manager
      const accountManager = am == null ? null : Array.isArray(am) ? am[0] ?? null : am
      return !accountManager
    }).length
  }, [bids])

  const totalBidsCount = useMemo(() => {
    return bids.length
  }, [bids])

  const submissionUnsent = filteredBidsForSubmission.filter(
    (b) => bidEligibleForWorkingBoardArchive(b) && !b.working_board_archived_at,
  )
  const submissionPending = filteredBidsForSubmission.filter((b) => b.bid_date_sent && b.outcome !== 'won' && b.outcome !== 'lost' && b.outcome !== 'started_or_complete')
  const submissionWon = filteredBidsForSubmission
    .filter((b) => b.outcome === 'won')
    .sort((a, b) => {
      // Handle null dates - put them at the end
      if (!a.estimated_job_start_date && !b.estimated_job_start_date) return 0
      if (!a.estimated_job_start_date) return 1
      if (!b.estimated_job_start_date) return -1
      
      // Sort by date ascending (earliest first)
      return a.estimated_job_start_date.localeCompare(b.estimated_job_start_date)
    })
  const submissionStartedOrComplete = filteredBidsForSubmission.filter((b) => b.outcome === 'started_or_complete')
  const submissionLost = filteredBidsForSubmission.filter((b) => b.outcome === 'lost')

  const submissionFollowupStaleDaysThresholdParsed = useMemo(() => {
    const t = Number.parseInt(submissionFollowupStaleDaysInput.trim(), 10)
    if (!Number.isFinite(t) || t < 1) return null
    return t
  }, [submissionFollowupStaleDaysInput])

  function submissionFollowupListRowBackground(bid: BidWithBuilder, isSelected: boolean): string | undefined {
    if (isSelected) return '#eff6ff'
    const n = submissionFollowupStaleDaysThresholdParsed
    if (n != null && isSubmissionBidStaleForThreshold(bid, lastContactFromEntries, customerContacts, n)) return '#fef2f2'
    return undefined
  }

  useEffect(() => {
    if (!bidPreview) return
    if (submissionFollowupStaleDaysThresholdParsed != null) {
      bidPreview.setSubmissionFollowupStaleOverlay({
        thresholdDays: submissionFollowupStaleDaysThresholdParsed,
        lastContactFromEntries,
        customerContacts,
      })
    } else {
      bidPreview.setSubmissionFollowupStaleOverlay(null)
    }
    return () => {
      bidPreview.setSubmissionFollowupStaleOverlay(null)
    }
  }, [
    bidPreview,
    submissionFollowupStaleDaysThresholdParsed,
    lastContactFromEntries,
    customerContacts,
  ])

  const submissionFollowupNav = useMemo(() => {
    if (!selectedBid) {
      return {
        list: [] as BidWithBuilder[],
        currentIndex: -1,
        total: 0,
        canPrev: false,
        canNext: false,
        inList: false,
      }
    }
    const sectionKey = getSubmissionSectionKey(selectedBid)
    if (!sectionKey) {
      return {
        list: [] as BidWithBuilder[],
        currentIndex: -1,
        total: 0,
        canPrev: false,
        canNext: false,
        inList: false,
      }
    }
    const list: BidWithBuilder[] =
      sectionKey === 'unsent'
        ? submissionUnsent
        : sectionKey === 'pending'
          ? submissionPending
          : sectionKey === 'won'
            ? submissionWon
            : sectionKey === 'startedOrComplete'
              ? submissionStartedOrComplete
              : submissionLost
    const currentIndex = list.findIndex((b) => b.id === selectedBid.id)
    const total = list.length
    const inList = currentIndex >= 0
    return {
      list,
      currentIndex,
      total,
      canPrev: inList && currentIndex > 0,
      canNext: inList && currentIndex < total - 1,
      inList,
    }
  }, [
    selectedBid,
    submissionUnsent,
    submissionPending,
    submissionWon,
    submissionStartedOrComplete,
    submissionLost,
  ])

  function navigateSubmissionFollowup(delta: -1 | 1) {
    if (!submissionFollowupNav.inList) return
    const next = submissionFollowupNav.list[submissionFollowupNav.currentIndex + delta]
    if (next) onSelectBid(next)
  }

  function handleScrollToSelectedBidRow() {
    if (!selectedBid) return
    const sectionKey = getSubmissionSectionKey(selectedBid)
    if (!sectionKey) return

    if (!submissionSectionOpen[sectionKey]) {
      setSubmissionSectionOpen((prev) => ({ ...prev, [sectionKey]: true }))
    }
    setTimeout(() => {
      document.getElementById(`submission-row-${selectedBid.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
  }

  function submissionFollowupUrlRow(label: string, url: string | null | undefined) {
    const trimmed = (url ?? '').trim()
    if (!trimmed) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', margin: 0, color: 'var(--text-faint)', fontWeight: 400 }}>
          {label} —
        </span>
      )
    }
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          flexWrap: 'wrap',
          margin: 0,
        }}
      >
        <a
          href={trimmed}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${label}`}
          onClick={(e) => {
            e.preventDefault()
            openInExternalBrowser(trimmed)
          }}
          style={{ color: 'var(--text-blue-500)', fontWeight: 600 }}
        >
          {label}
        </a>
        <button
          type="button"
          aria-label={`Copy ${label} URL`}
          title="Copy URL"
          onClick={() => {
            void (async () => {
              try {
                if (!navigator.clipboard?.writeText) {
                  showToast('Could not copy URL', 'error')
                  return
                }
                await navigator.clipboard.writeText(trimmed)
                showToast('Copied', 'success')
              } catch {
                showToast('Could not copy URL', 'error')
              }
            })()
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 3,
            background: 'transparent',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            color: 'var(--text-muted)',
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill="currentColor" aria-hidden="true">
            <path d="M480 400L288 400C279.2 400 272 392.8 272 384L272 128C272 119.2 279.2 112 288 112L421.5 112C425.7 112 429.8 113.7 432.8 116.7L491.3 175.2C494.3 178.2 496 182.3 496 186.5L496 384C496 392.8 488.8 400 480 400zM288 448L480 448C515.3 448 544 419.3 544 384L544 186.5C544 169.5 537.3 153.2 525.3 141.2L466.7 82.7C454.7 70.7 438.5 64 421.5 64L288 64C252.7 64 224 92.7 224 128L224 384C224 419.3 252.7 448 288 448zM160 192C124.7 192 96 220.7 96 256L96 512C96 547.3 124.7 576 160 576L352 576C387.3 576 416 547.3 416 512L416 496L368 496L368 512C368 520.8 360.8 528 352 528L160 528C151.2 528 144 520.8 144 512L144 256C144 247.2 151.2 240 160 240L176 240L176 192L160 192z" />
          </svg>
        </button>
      </div>
    )
  }

  async function downloadSubmissionSummaryPdf() {
    if (!selectedBid) return
    const b = selectedBid
    const JsPDF = await loadJsPDF()
    const doc = new JsPDF({ format: 'a4', unit: 'mm' })
    const margin = 20
    const lineHeight = 7
    let y = margin
    const push = (text: string) => {
      doc.text(text, margin, y)
      y += lineHeight
    }
    const pushLink = (label: string, url: string | null) => {
      doc.setFont('helvetica', 'bold')
      doc.text(label + ' ', margin, y)
      const labelW = doc.getTextWidth(label + ' ')
      doc.setFont('helvetica', 'normal')
      if (url?.trim()) {
        doc.setTextColor(0, 0, 255)
        const displayUrl = url.length > 70 ? url.slice(0, 67) + '...' : url
        doc.textWithLink(displayUrl, margin + labelW, y, { url })
        doc.setTextColor(0, 0, 0)
      } else {
        doc.text('—', margin + labelW, y)
      }
      y += lineHeight
    }

    doc.setFontSize(14)
    push(bidDisplayName(b) || 'Bid')
    y += lineHeight
    doc.setFontSize(11)
    push(`Bid Size: ${formatCompactCurrency(b.bid_value != null ? Number(b.bid_value) : null)}`)
    y += lineHeight
    push(`Builder Name: ${b.customers?.name ?? b.bids_gc_builders?.name ?? '—'}`)
    push(`Builder Address: ${b.customers?.address ?? b.bids_gc_builders?.address ?? '—'}`)
    push(`Builder Phone Number: ${b.customers ? extractContactInfo(b.customers.contact_info ?? null).phone || '—' : (b.bids_gc_builders?.contact_number ?? '—')}`)
    push(`Builder Email: ${b.customers ? extractContactInfo(b.customers.contact_info ?? null).email || '—' : (b.bids_gc_builders?.email ?? '—')}`)
    y += lineHeight
    push(`Project Name: ${b.project_name ?? '—'}`)
    push(`Project Address: ${b.address ?? '—'}`)
    y += lineHeight
    push(`Project Contact Name: ${b.gc_contact_name ?? '—'}`)
    push(`Project Contact Phone: ${b.gc_contact_phone ?? '—'}`)
    push(`Project Contact Email: ${b.gc_contact_email ?? '—'}`)
    y += lineHeight
    pushLink('Project Folder:', b.drive_link?.trim() || null)
    y += lineHeight
    pushLink('Job Plans:', b.plans_link?.trim() || null)
    y += lineHeight
    pushLink('CountTooling Plans:', b.count_tooling_plans_link?.trim() || null)
    y += lineHeight
    pushLink('Bid Submission:', b.bid_submission_link?.trim() || null)

    const filename = `Bid_Summary_${(bidDisplayName(b) || 'Bid').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40)}.pdf`
    doc.save(filename)
  }

  async function printFollowupSheet(accountManagerFilter: string) {
    if (!accountManagerFilter) return

    // Load all submission entries for the bids
    const { data: submissionEntries } = await supabase
      .from('bids_submission_entries')
      .select(SELECT_BIDS_SUBMISSION_ENTRIES_WITH_CREATOR)
      .order('occurred_at', { ascending: false })
    
    // Group entries by bid_id and take latest 3
    const entriesByBid = new Map<string, BidSubmissionEntry[]>()
    for (const entry of submissionEntries ?? []) {
      if (!entry.bid_id) continue
      const existing = entriesByBid.get(entry.bid_id) ?? []
      if (existing.length < 3) {
        existing.push(entry)
        entriesByBid.set(entry.bid_id, existing)
      }
    }

    const accountManagerOf = (b: BidWithBuilder) => {
      const am = b.account_manager
      return am == null ? null : Array.isArray(am) ? am[0] ?? null : am
    }
    const unassignedBids = bids.filter((b) => !accountManagerOf(b))
    const bidsForManager = (managerId: string) =>
      bids.filter((b) => accountManagerOf(b)?.id === managerId)

    const toProjectView = (bid: BidWithBuilder): FollowupProject => {
      const builderName = bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'
      const builderAddress = bid.customers?.address ?? bid.bids_gc_builders?.address ?? '—'
      const builderPhone = bid.customers
        ? extractContactInfo(bid.customers.contact_info ?? null).phone || '—'
        : (bid.bids_gc_builders?.contact_number ?? '—')
      const builderEmail = bid.customers
        ? extractContactInfo(bid.customers.contact_info ?? null).email || '—'
        : (bid.bids_gc_builders?.email ?? '—')
      const submissionEntries = (entriesByBid.get(bid.id) ?? []).map((entry) => ({
        contactMethod: entry.contact_method ?? null,
        notes: entry.notes ?? null,
        time: entry.occurred_at ? formatCompactNoteDateTime(entry.occurred_at) : '—',
        author: noteByLineFromEmbed(entry.created_by_user),
      }))
      return {
        projectName: bid.project_name ?? null,
        address: bid.address ?? null,
        builderName,
        builderAddress,
        builderPhone,
        builderEmail,
        projectContact: bid.gc_contact_name ?? null,
        projectContactPhone: bid.gc_contact_phone ?? null,
        projectContactEmail: bid.gc_contact_email ?? null,
        outcome: bid.outcome ?? null,
        bidDate: formatDateYYMMDD(bid.bid_due_date),
        bidDateSent: formatDateYYMMDD(bid.bid_date_sent),
        designDrawingPlanDate: formatDesignDrawingPlanDate(bid.design_drawing_plan_date),
        bidValue: formatCompactCurrency(bid.bid_value != null ? Number(bid.bid_value) : null),
        agreedValue: formatCompactCurrency(bid.agreed_value != null ? Number(bid.agreed_value) : null),
        distance: bid.distance_from_office ? parseFloat(bid.distance_from_office).toFixed(1) + ' mi' : '—',
        notes: bid.notes ?? null,
        submissionEntries,
      }
    }

    const toGroups = (bidList: BidWithBuilder[]): FollowupGroups => ({
      notYetWonOrLost: bidList
        .filter((b) => !b.outcome || (b.outcome !== 'won' && b.outcome !== 'lost' && b.outcome !== 'started_or_complete'))
        .map(toProjectView),
      won: bidList.filter((b) => b.outcome === 'won').map(toProjectView),
    })

    if (accountManagerFilter === 'ALL') {
      printHtmlInNewWindow(
        buildFollowupSheetHtml({
          mode: 'all',
          title: 'Followup Sheets - All Account Managers',
          managers: uniqueAccountManagers.map((manager) => ({
            name: manager.name,
            groups: toGroups(bidsForManager(manager.id)),
          })),
          unassigned: unassignedBidsCount > 0 ? toGroups(unassignedBids) : null,
        }),
      )
      return
    }

    if (accountManagerFilter === 'UNASSIGNED') {
      printHtmlInNewWindow(
        buildFollowupSheetHtml({
          mode: 'unassigned',
          title: 'Followup Sheet - Unassigned',
          groups: toGroups(unassignedBids),
        }),
      )
      return
    }

    const manager = uniqueAccountManagers.find((m) => m.id === accountManagerFilter)
    if (!manager) return
    printHtmlInNewWindow(
      buildFollowupSheetHtml({
        mode: 'manager',
        title: `Followup Sheet - ${manager.name}`,
        name: manager.name,
        groups: toGroups(bidsForManager(manager.id)),
      }),
    )
  }

  async function downloadFollowupSheetPdf(accountManagerFilter: string) {
    if (!accountManagerFilter) return

    // Load submission entries
    const { data: submissionEntries } = await supabase
      .from('bids_submission_entries')
      .select(SELECT_BIDS_SUBMISSION_ENTRIES_WITH_CREATOR)
      .order('occurred_at', { ascending: false })
    
    const entriesByBid = new Map<string, BidSubmissionEntry[]>()
    for (const entry of submissionEntries ?? []) {
      if (!entry.bid_id) continue
      const existing = entriesByBid.get(entry.bid_id) ?? []
      if (existing.length < 3) {
        existing.push(entry)
        entriesByBid.set(entry.bid_id, existing)
      }
    }

    const formatOutcome = (outcome: string | null): string => {
      if (!outcome) return '—'
      if (outcome === 'won') return 'Won'
      if (outcome === 'lost') return 'Lost'
      if (outcome === 'started_or_complete') return 'Started/Complete'
      return '—'
    }

    const JsPDF = await loadJsPDF()
    const doc = new JsPDF({ format: 'a4', unit: 'mm' })
    const margin = 10
    const lineHeight = 5
    let y = margin
    const pageH = doc.internal.pageSize.getHeight()

    const push = (text: string, bold = false): void => {
      if (y > pageH - margin) { doc.addPage(); y = margin }
      if (bold) doc.setFont('helvetica', 'bold')
      doc.text(text, margin, y)
      if (bold) doc.setFont('helvetica', 'normal')
      y += lineHeight
    }

    const pushLink = (label: string, value: string, linkType: 'tel' | 'mailto' | null = null): void => {
      if (y > pageH - margin) { doc.addPage(); y = margin }
      doc.setFont('helvetica', 'bold')
      doc.text(label + ' ', margin, y)
      const labelW = doc.getTextWidth(label + ' ')
      doc.setFont('helvetica', 'normal')
      
      if (value !== '—' && linkType) {
        // Create clickable link
        let url = ''
        if (linkType === 'tel') {
          const phoneClean = value.replace(/[^0-9+]/g, '')
          url = `tel:${phoneClean}`
        } else if (linkType === 'mailto') {
          url = `mailto:${value}`
        }
        
        doc.setTextColor(0, 0, 255)
        doc.textWithLink(value, margin + labelW, y, { url })
        doc.setTextColor(0, 0, 0)
      } else {
        doc.text(value, margin + labelW, y)
      }
      y += lineHeight
    }

    const renderSubmissionEntriesPdf = (bidId: string): void => {
      const entries = entriesByBid.get(bidId) ?? []
      if (entries.length === 0) return
      
      y += lineHeight * 0.3
      push('Recent Contact Attempts:', true)
      doc.setFontSize(9)
      
      entries.forEach((entry, idx) => {
        push(`  ${idx + 1}. Contact Method: ${entry.contact_method ?? '—'}`)
        push(`     Notes: ${entry.notes ?? '—'}`)
        push(`     Time: ${entry.occurred_at ? formatCompactNoteDateTime(entry.occurred_at) : '—'}`)
        push(`     ${noteByLineFromEmbed(entry.created_by_user)}`)
        y += lineHeight * 0.2
      })
      
      doc.setFontSize(10)
    }

    const renderProjectPdf = (bid: BidWithBuilder): void => {
      const builderName = bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'
      const builderAddress = bid.customers?.address ?? bid.bids_gc_builders?.address ?? '—'
      const builderPhone = bid.customers 
        ? extractContactInfo(bid.customers.contact_info ?? null).phone || '—' 
        : (bid.bids_gc_builders?.contact_number ?? '—')
      const builderEmail = bid.customers 
        ? extractContactInfo(bid.customers.contact_info ?? null).email || '—' 
        : (bid.bids_gc_builders?.email ?? '—')

      if (y > pageH - margin - 80) { doc.addPage(); y = margin }
      
      push(`Project: ${bid.project_name ?? '—'}`, true)
      push(`  Address: ${bid.address ?? '—'}`)
      push(`          Builder: ${builderName}`)
      pushLink('          Builder Phone:', builderPhone, 'tel')
      push(`          Builder Address: ${builderAddress}`)
      pushLink('          Builder Email:', builderEmail, 'mailto')
      push(`  Project Contact: ${bid.gc_contact_name ?? '—'}`)
      pushLink('  Project Contact Phone:', bid.gc_contact_phone ?? '—', 'tel')
      pushLink('  Project Contact Email:', bid.gc_contact_email ?? '—', 'mailto')
      push(`          Win/ Loss: ${formatOutcome(bid.outcome)}`)
      push(`          Bid Date: ${formatDateYYMMDD(bid.bid_due_date)}`)
      push(`          Bid Date Sent: ${formatDateYYMMDD(bid.bid_date_sent)}`)
      push(`          Design Drawing Plan Date: ${formatDesignDrawingPlanDate(bid.design_drawing_plan_date)}`)
      push(`  Bid Value: ${formatCompactCurrency(bid.bid_value != null ? Number(bid.bid_value) : null)}`)
      push(`  Agreed Value: ${formatCompactCurrency(bid.agreed_value != null ? Number(bid.agreed_value) : null)}`)
      push(`  Distance to Office: ${bid.distance_from_office ? parseFloat(bid.distance_from_office).toFixed(1) + ' mi' : '—'}`)
      push(`  Notes: ${bid.notes ?? '—'}`)
      renderSubmissionEntriesPdf(bid.id)
      y += lineHeight * 0.5
    }

    const renderUnassignedBids = (): void => {
      const unassignedBids = bids.filter(b => {
        const am = b.account_manager
        const accountManager = am == null ? null : Array.isArray(am) ? am[0] ?? null : am
        return !accountManager
      })
      const notYetWonOrLost = unassignedBids.filter(b => 
        !b.outcome || (b.outcome !== 'won' && b.outcome !== 'lost' && b.outcome !== 'started_or_complete')
      )
      const won = unassignedBids.filter(b => b.outcome === 'won')

      push('Not yet won or lost', true)
      if (notYetWonOrLost.length === 0) {
        push('None')
      } else {
        notYetWonOrLost.forEach(renderProjectPdf)
      }

      y += lineHeight
      push('Won', true)
      if (won.length === 0) {
        push('None')
      } else {
        won.forEach(renderProjectPdf)
      }
    }

    const renderManagerBids = (managerId: string): void => {
      const bidsForManager = bids.filter(b => {
        const am = b.account_manager
        const accountManager = am == null ? null : Array.isArray(am) ? am[0] ?? null : am
        return accountManager?.id === managerId
      })
      const notYetWonOrLost = bidsForManager.filter(b => 
        !b.outcome || (b.outcome !== 'won' && b.outcome !== 'lost' && b.outcome !== 'started_or_complete')
      )
      const won = bidsForManager.filter(b => b.outcome === 'won')

      push('Not yet won or lost', true)
      if (notYetWonOrLost.length === 0) {
        push('None')
      } else {
        notYetWonOrLost.forEach(renderProjectPdf)
      }

      y += lineHeight
      push('Won', true)
      if (won.length === 0) {
        push('None')
      } else {
        won.forEach(renderProjectPdf)
      }
    }

    // Generate PDF content
    if (accountManagerFilter === 'ALL') {
      doc.setFontSize(14)
      push('Followup Sheets - All Account Managers', true)
      y += lineHeight
      doc.setFontSize(10)
      
      // Add each account manager's section
      uniqueAccountManagers.forEach((manager, idx) => {
        if (idx > 0) { doc.addPage(); y = margin }
        doc.setFontSize(12)
        push(`Followup Sheet for ${manager.name}`, true)
        y += lineHeight * 0.5
        doc.setFontSize(10)
        renderManagerBids(manager.id)
      })
      
      // Add unassigned section
      if (unassignedBidsCount > 0) {
        doc.addPage()
        y = margin
        doc.setFontSize(12)
        push('Followup Sheet for Unassigned', true)
        y += lineHeight * 0.5
        doc.setFontSize(10)
        renderUnassignedBids()
      }
    } else if (accountManagerFilter === 'UNASSIGNED') {
      doc.setFontSize(12)
      push('Followup Sheet - Unassigned', true)
      y += lineHeight
      doc.setFontSize(10)
      renderUnassignedBids()
    } else {
      const manager = uniqueAccountManagers.find(m => m.id === accountManagerFilter)
      if (!manager) return
      doc.setFontSize(12)
      push(`Followup Sheet - ${manager.name}`, true)
      y += lineHeight
      doc.setFontSize(10)
      renderManagerBids(manager.id)
    }

    // Download the PDF
    const filename = accountManagerFilter === 'ALL' 
      ? 'followup-sheets-all.pdf'
      : accountManagerFilter === 'UNASSIGNED'
      ? 'followup-sheet-unassigned.pdf'
      : `followup-sheet-${uniqueAccountManagers.find(m => m.id === accountManagerFilter)?.name.toLowerCase().replace(/\s+/g, '-') ?? 'manager'}.pdf`
    
    doc.save(filename)
  }

  return (
    <div>
      {/* Print Followup Sheet UI + stale highlight */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>Highlight no update in last</span>
            <input
              id="submission-followup-stale-days"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={submissionFollowupStaleDaysInput}
              onChange={(e) => setSubmissionFollowupStaleDaysInput(e.target.value)}
              placeholder="—"
              aria-label="Highlight bids with no update within this many Chicago calendar days"
              style={{
                width: '3.25rem',
                padding: '0.35rem 0.4rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                fontSize: '0.875rem',
                boxSizing: 'border-box',
              }}
            />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>days</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label htmlFor="account-manager-print" style={{ fontWeight: 500 }}>
            Followup sheet for:
          </label>
          <select
            id="account-manager-print"
            value={selectedAccountManagerForPrint}
            onChange={(e) => setSelectedAccountManagerForPrint(e.target.value)}
            style={{ padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: '180px' }}
          >
            <option value="">Select...</option>
            <option value="ALL">ALL ({totalBidsCount})</option>
            <option value="UNASSIGNED">UNASSIGNED ({unassignedBidsCount})</option>
            {uniqueAccountManagers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name} ({manager.count})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => printFollowupSheet(selectedAccountManagerForPrint)}
            disabled={!selectedAccountManagerForPrint}
            style={{
              padding: '0.5rem 1rem',
              background: selectedAccountManagerForPrint ? '#3b82f6' : '#d1d5db',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: selectedAccountManagerForPrint ? 'pointer' : 'not-allowed',
              fontWeight: 500,
            }}
          >
            Print
          </button>
          <button
            type="button"
            onClick={() => void downloadFollowupSheetPdf(selectedAccountManagerForPrint)}
            disabled={!selectedAccountManagerForPrint}
            style={{
              padding: '0.5rem 1rem',
              background: selectedAccountManagerForPrint ? '#10b981' : '#d1d5db',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: selectedAccountManagerForPrint ? 'pointer' : 'not-allowed',
              fontWeight: 500,
            }}
          >
            PDF
          </button>
        </div>
      </div>

      {selectedBid && (
        <div
          ref={summaryCardRef}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '1.5rem 2rem',
            background: 'var(--surface)',
            marginBottom: '1.5rem',
            ...(narrowViewport640 ? { position: 'relative' } : {}),
          }}
        >
          {narrowViewport640 ? (
            <button
              type="button"
              onClick={() => onClearBid()}
              title="Close"
              aria-label="Close"
              style={bidDetailCloseFloatMobileStyle}
            >
              ×
            </button>
          ) : null}
          <div
            style={{
              display: 'flex',
              flexDirection: narrowViewport640 ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: narrowViewport640 ? 'stretch' : 'center',
              gap: narrowViewport640 ? '0.75rem' : 0,
              marginBottom: '1rem',
            }}
          >
            <BidWorkflowTabTitleWithPreview
              bid={selectedBid}
              previewEnabled={bidPreview != null}
              onOpenPreview={() => bidPreview?.openBidPreviewFromBid(selectedBid)}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                ...(narrowViewport640 ? { justifyContent: 'flex-end', flexWrap: 'wrap' } : {}),
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => navigateSubmissionFollowup(-1)}
                  disabled={!submissionFollowupNav.canPrev}
                  aria-label="Previous bid in this submission list"
                  title="Previous bid in this list"
                  style={{
                    padding: '0.35rem 0.6rem',
                    background: submissionFollowupNav.canPrev ? 'var(--bg-muted)' : 'var(--bg-subtle)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    cursor: submissionFollowupNav.canPrev ? 'pointer' : 'not-allowed',
                    fontSize: '1rem',
                    lineHeight: 1,
                    color: submissionFollowupNav.canPrev ? 'var(--text-strong)' : 'var(--text-faint)',
                  }}
                >
                  ←
                </button>
                <span
                  aria-live="polite"
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: submissionFollowupNav.inList ? 'var(--text-700)' : 'var(--text-faint)',
                    minWidth: '3.5rem',
                    textAlign: 'center',
                  }}
                >
                  {submissionFollowupNav.inList
                    ? `[${submissionFollowupNav.currentIndex + 1}/${submissionFollowupNav.total}]`
                    : '—'}
                </span>
                <button
                  type="button"
                  onClick={() => navigateSubmissionFollowup(1)}
                  disabled={!submissionFollowupNav.canNext}
                  aria-label="Next bid in this submission list"
                  title="Next bid in this list"
                  style={{
                    padding: '0.35rem 0.6rem',
                    background: submissionFollowupNav.canNext ? 'var(--bg-muted)' : 'var(--bg-subtle)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    cursor: submissionFollowupNav.canNext ? 'pointer' : 'not-allowed',
                    fontSize: '1rem',
                    lineHeight: 1,
                    color: submissionFollowupNav.canNext ? 'var(--text-strong)' : 'var(--text-faint)',
                  }}
                >
                  →
                </button>
              </div>
              <span aria-hidden style={{ color: 'var(--text-faint-300)', flexShrink: 0, userSelect: 'none' }}>|</span>
              {/* Share copies ?bidId=&tab=submission-followup; superintendent role is redirected off that tab by URL effect */}
              <button
                type="button"
                title="Copy link to this bid on Submission & Followup"
                aria-label="Copy link to this bid on Submission & Followup"
                onClick={() => {
                  void (async () => {
                    try {
                      if (!navigator.clipboard?.writeText) {
                        showToast('Could not copy link', 'error')
                        return
                      }
                      await navigator.clipboard.writeText(submissionFollowupBidShareUrl(selectedBid.id))
                      showToast('Link copied', 'success')
                    } catch {
                      showToast('Could not copy link', 'error')
                    }
                  })()
                }}
                style={{
                  padding: '0.5rem',
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => onEditBid(selectedBid)}
                title="Edit bid"
                style={{ padding: '0.5rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                  <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => void downloadSubmissionSummaryPdf()}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                PDF
              </button>
              {!narrowViewport640 ? (
                <button
                  type="button"
                  onClick={() => onClearBid()}
                  title="Close"
                  aria-label="Close"
                  style={bidDetailCloseXStyle}
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
          <div style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: narrowViewport640 ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)',
                gap: '1rem',
                alignItems: 'start',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto minmax(0, 1fr)',
                  columnGap: '0.75rem',
                  rowGap: '0.25rem',
                  alignItems: 'baseline',
                }}
              >
                <strong>Bid Size</strong>
                <span style={{ color: 'var(--text-strong)', wordBreak: 'break-word' }}>
                  {formatCompactCurrency(selectedBid.bid_value != null ? Number(selectedBid.bid_value) : null)}
                </span>
                <strong>Account Man</strong>
                <span style={{ color: 'var(--text-strong)', wordBreak: 'break-word' }}>
                  {formatBidStaffDisplayName(selectedBid.account_manager)}
                </span>
                <strong>Estimator</strong>
                <span style={{ color: 'var(--text-strong)', wordBreak: 'break-word' }}>
                  {formatBidStaffDisplayName(selectedBid.estimator)}
                </span>
              </div>
              <div>
                {(selectedBid.customers || selectedBid.bids_gc_builders) ? (
                  <>
                    <p style={{ margin: '0.25rem 0' }}>
                      <strong>Builder:</strong>{' '}
                      <button
                        type="button"
                        onClick={() => onOpenParty(selectedBid)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-blue-500)',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: 0,
                          textAlign: 'left',
                        }}
                      >
                        {selectedBid.customers?.name ?? selectedBid.bids_gc_builders?.name}
                      </button>
                    </p>
                    {(() => {
                      const addr = selectedBid.customers?.address ?? selectedBid.bids_gc_builders?.address
                      if (!addr?.trim()) return null
                      return <p style={{ margin: '0.25rem 0' }}>{addr}</p>
                    })()}
                    {(() => {
                      const phone = selectedBid.customers
                        ? extractContactInfo(selectedBid.customers.contact_info ?? null).phone
                        : selectedBid.bids_gc_builders?.contact_number
                      if (!phone?.trim()) return null
                      return <p style={{ margin: '0.25rem 0' }}>{phone}</p>
                    })()}
                    {(() => {
                      const email = selectedBid.customers
                        ? extractContactInfo(selectedBid.customers.contact_info ?? null).email
                        : selectedBid.bids_gc_builders?.email
                      if (!email?.trim()) return null
                      return <p style={{ margin: '0.25rem 0' }}>{email}</p>
                    })()}
                  </>
                ) : (
                  <p style={{ margin: '0.25rem 0' }}>
                    <button
                      type="button"
                      onClick={() => onEditBid(selectedBid, { focus: 'gcBuilder' })}
                      aria-label="Add builder for this bid"
                      style={{
                        padding: '0.375rem 0.75rem',
                        fontSize: '0.875rem',
                        background: 'var(--bg-muted)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        color: 'var(--text-700)',
                        fontWeight: 500,
                      }}
                    >
                      Add Builder
                    </button>
                  </p>
                )}
              </div>
              <div>
                {selectedBid.project_name?.trim() ? (
                  <>
                    <p style={{ margin: '0.25rem 0' }}>
                      <strong>Project:</strong> {selectedBid.project_name}
                    </p>
                    {selectedBid.address?.trim() ? (
                      <p style={{ margin: '0.25rem 0' }}>{selectedBid.address}</p>
                    ) : null}
                  </>
                ) : (
                  <p style={{ margin: '0.25rem 0' }}>
                    <button
                      type="button"
                      onClick={() => onEditBid(selectedBid, { focus: 'projectName' })}
                      aria-label="Add project name for this bid"
                      style={{
                        padding: '0.375rem 0.75rem',
                        fontSize: '0.875rem',
                        background: 'var(--bg-muted)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        color: 'var(--text-700)',
                        fontWeight: 500,
                      }}
                    >
                      Add Project
                    </button>
                  </p>
                )}
              </div>
              <div>
                {[selectedBid.gc_contact_name, selectedBid.gc_contact_phone, selectedBid.gc_contact_email].some((v) => (v ?? '').trim() !== '') ? (
                  <>
                    <p style={{ margin: '0.25rem 0' }}>
                      <strong>Project Contact:</strong> {selectedBid.gc_contact_name ?? '—'}
                    </p>
                    <p style={{ margin: '0.25rem 0' }}>{selectedBid.gc_contact_phone ?? '—'}</p>
                    {(selectedBid.gc_contact_email ?? '').trim() ? (
                      <p style={{ margin: '0.25rem 0' }}>{selectedBid.gc_contact_email}</p>
                    ) : null}
                  </>
                ) : (
                  <p style={{ margin: '0.25rem 0' }}>
                    <button
                      type="button"
                      onClick={() => onEditBid(selectedBid)}
                      aria-label="Add project contact for this bid"
                      style={{
                        padding: '0.375rem 0.75rem',
                        fontSize: '0.875rem',
                        background: 'var(--bg-muted)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        color: 'var(--text-700)',
                        fontWeight: 500,
                      }}
                    >
                      Add project contact
                    </button>
                  </p>
                )}
              </div>
            </div>
            <BidSubmissionFollowupExpandableDetails
              bid={selectedBid}
              narrowViewport640={narrowViewport640}
              estimatorUsers={estimatorUsers}
            />
          </div>
          <div
            style={{
              marginBottom: '1rem',
              marginTop: '1rem',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.75rem 1rem',
                minWidth: 0,
                flex: '1 1 auto',
                fontSize: '0.875rem',
                ...(narrowViewport640 ? { width: '100%' } : {}),
              }}
            >
              {submissionFollowupUrlRow('Project Folder', selectedBid.drive_link)}
              <span aria-hidden style={{ color: 'var(--text-faint-300)', flexShrink: 0, userSelect: 'none' }}>|</span>
              {submissionFollowupUrlRow('Job Plans', selectedBid.plans_link)}
              <span aria-hidden style={{ color: 'var(--text-faint-300)', flexShrink: 0, userSelect: 'none' }}>|</span>
              {submissionFollowupUrlRow('Bid Submission', selectedBid.bid_submission_link)}
              <span aria-hidden style={{ color: 'var(--text-faint-300)', flexShrink: 0, userSelect: 'none' }}>|</span>
              {submissionFollowupUrlRow('CountTooling Plans', selectedBid.count_tooling_plans_link)}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexShrink: 0,
                ...(narrowViewport640 ? { width: '100%', justifyContent: 'flex-end' } : {}),
              }}
            >
              <button
                type="button"
                onClick={handleScrollToSelectedBidRow}
                title="Go to bid in table"
                aria-label="Go to bid in table"
                style={{ padding: '0.5rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                  <path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM303 441L223 361C213.6 351.6 213.6 336.4 223 327.1C232.4 317.8 247.6 317.7 256.9 327.1L295.9 366.1L295.9 216C295.9 202.7 306.6 192 319.9 192C333.2 192 343.9 202.7 343.9 216L343.9 366.1L382.9 327.1C392.3 317.7 407.5 317.7 416.8 327.1C426.1 336.5 426.2 351.7 416.8 361L336.8 441C327.4 450.4 312.2 450.4 302.9 441z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => onDownloadApprovalPdf()}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
              >
                Approval PDF
              </button>
              {canAddChecklistTask ? (
                <button
                  type="button"
                  onClick={onAddChecklistTask}
                  disabled={!selectedBid?.id || !authUser?.id}
                  title="Add a checklist task with a link to this bid on Submission & Followup"
                  aria-label="Add checklist task with link to this bid on Submission & Followup"
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'var(--surface)',
                    color: 'var(--text-700)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    cursor:
                      !selectedBid?.id || !authUser?.id ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                    opacity: !selectedBid?.id || !authUser?.id ? 0.6 : 1,
                  }}
                >
                  Add checklist task
                </button>
              ) : null}
            </div>
          </div>
          <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
            <button
              type="button"
              onClick={() => onShowSentBidScript()}
              style={{ padding: '0.375rem 0.75rem', background: SAFETY_ORANGE, color: 'white', border: `1px solid ${SAFETY_ORANGE_BORDER}`, borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Sent Bid Script
            </button>
            <button
              type="button"
              onClick={() => onShowBidQuestionScript()}
              style={{ padding: '0.375rem 0.75rem', background: SAFETY_ORANGE, color: 'white', border: `1px solid ${SAFETY_ORANGE_BORDER}`, borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Bid Question Script
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              flexDirection: narrowViewport640 ? 'column' : 'row',
              alignItems: 'center',
              justifyContent: narrowViewport640 ? 'center' : 'flex-start',
              gap: '0.75rem',
              marginBottom: '0.75rem',
              width: '100%',
            }}
          >
            <div style={{ flexShrink: 0 }}>
              <UnifiedBidCustomerNotesActionButtons
                addingKind={submissionFollowupToolbarAddingKind}
                onAddingKindChange={handleSubmissionFollowupToolbarAddingKind}
                customerId={selectedBid.customers?.id ?? null}
                customerName={selectedBid.customers?.name ?? 'Customer'}
              />
            </div>
            <div
              aria-live="polite"
              style={{
                flex: narrowViewport640 ? 'none' : '1 1 auto',
                textAlign: 'center',
                minWidth: narrowViewport640 ? undefined : '10rem',
                maxWidth: '100%',
                fontSize: '0.875rem',
                ...(narrowViewport640 ? { width: '100%', wordBreak: 'break-word' } : {}),
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Last update: </span>
              <span style={{ color: 'var(--text-strong)', fontWeight: 500 }}>
                {formatTimeSinceLastContact(
                  effectiveSubmissionBidLastNoteIso(selectedBid, lastContactFromEntries, customerContacts),
                )}
              </span>
            </div>
            <div
              role="tablist"
              aria-label="Notes type"
              style={{
                display: 'inline-flex',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                overflow: 'hidden',
                flexShrink: 0,
                ...(narrowViewport640 ? {} : { marginLeft: 'auto' }),
              }}
            >
              <button
                type="button"
                role="tab"
                id="submission-followup-tab-all"
                aria-selected={submissionFollowupNotesTab === 'all'}
                aria-controls="submission-followup-notes-panel"
                onClick={() => handleSubmissionFollowupNotesTabPillClick('all')}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRight: '1px solid var(--border-strong)',
                  background: submissionFollowupNotesTab === 'all' ? '#3b82f6' : 'var(--surface)',
                  color: submissionFollowupNotesTab === 'all' ? '#ffffff' : 'var(--text-700)',
                  cursor: 'pointer',
                  fontWeight: submissionFollowupNotesTab === 'all' ? 600 : 400,
                  fontSize: '0.875rem',
                }}
              >
                All
              </button>
              <button
                type="button"
                role="tab"
                id="submission-followup-tab-bid"
                aria-selected={submissionFollowupNotesTab === 'bid'}
                aria-controls="submission-followup-notes-panel"
                onClick={() => handleSubmissionFollowupNotesTabPillClick('bid')}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRight: '1px solid var(--border-strong)',
                  background: submissionFollowupNotesTab === 'bid' ? '#3b82f6' : 'var(--surface)',
                  color: submissionFollowupNotesTab === 'bid' ? '#ffffff' : 'var(--text-700)',
                  cursor: 'pointer',
                  fontWeight: submissionFollowupNotesTab === 'bid' ? 600 : 400,
                  fontSize: '0.875rem',
                }}
              >
                Bid
              </button>
              <button
                type="button"
                role="tab"
                id="submission-followup-tab-customer"
                aria-selected={submissionFollowupNotesTab === 'customer'}
                aria-controls="submission-followup-notes-panel"
                disabled={!selectedBid.customers?.id}
                aria-disabled={!selectedBid.customers?.id}
                title={!selectedBid.customers?.id ? 'No linked customer on this bid.' : undefined}
                onClick={() => {
                  if (selectedBid.customers?.id) handleSubmissionFollowupNotesTabPillClick('customer')
                }}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: submissionFollowupNotesTab === 'customer' ? '#16a34a' : 'var(--surface)',
                  color: submissionFollowupNotesTab === 'customer' ? '#ffffff' : 'var(--text-700)',
                  cursor: !selectedBid.customers?.id ? 'not-allowed' : 'pointer',
                  fontWeight: submissionFollowupNotesTab === 'customer' ? 600 : 400,
                  fontSize: '0.875rem',
                  opacity: !selectedBid.customers?.id ? 0.5 : 1,
                }}
              >
                Customer
              </button>
            </div>
          </div>
          <div
            role="tabpanel"
            id="submission-followup-notes-panel"
            aria-labelledby={
              submissionFollowupNotesTab === 'bid'
                ? 'submission-followup-tab-bid'
                : submissionFollowupNotesTab === 'customer'
                  ? 'submission-followup-tab-customer'
                  : 'submission-followup-tab-all'
            }
          >
            {submissionFollowupNotesTab === 'bid' ? (
              <BidNotesTable
                bidId={selectedBid.id}
                title=""
                onLoadError={(m) => onError(m)}
                onMutated={() => { onReloadBids() }}
                adding={submissionFollowupBidTableAdding}
                onAddingChange={setSubmissionFollowupBidTableAdding}
                hideFooterAddButton
              />
            ) : submissionFollowupNotesTab === 'customer' ? (
              selectedBid.customers?.id ? (
                <CustomerNotesTable
                  customerId={selectedBid.customers.id}
                  customerName={selectedBid.customers.name ?? 'Customer'}
                  title=""
                  hasBidsAbove={false}
                  onLoadError={(m) => onError(m)}
                  onMutated={() => { onReloadCustomerContacts(); onReloadBids() }}
                  adding={submissionFollowupCustomerTableAdding}
                  onAddingChange={setSubmissionFollowupCustomerTableAdding}
                  hideFooterAddButton
                  useBidBoardCustomerChrome
                />
              ) : (
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  No linked customer — customer notes are not available for this bid.
                </p>
              )
            ) : (
              <UnifiedBidCustomerNotes
                bidId={selectedBid.id}
                customerId={selectedBid.customers?.id ?? null}
                customerName={selectedBid.customers?.name ?? 'Customer'}
                title=""
                onLoadError={(m) => onError(m)}
                onMutated={() => { onReloadCustomerContacts(); onReloadBids() }}
                hideActionButtons
                addingKind={submissionFollowupUnifiedAddingKind}
                onAddingKindChange={setSubmissionFollowupUnifiedAddingKind}
              />
            )}
          </div>
        </div>
      )}
      <input
        type="text"
        placeholder="Search bids (project name or GC/Builder)..."
        value={submissionSearchQuery}
        onChange={(e) => setSubmissionSearchQuery(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginTop: 0, marginBottom: '1rem', boxSizing: 'border-box' }}
      />
      <button
        type="button"
        onClick={() => toggleSubmissionSection('unsent')}
        aria-expanded={submissionSectionOpen.unsent}
        style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
      >
        <span aria-hidden>{submissionSectionOpen.unsent ? '\u25BC' : '\u25B6'}</span>
        {SUBMISSION_UNSENT_SECTION_LABEL} ({submissionUnsent.length})
      </button>
      {submissionSectionOpen.unsent && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={{ padding: '0.75rem', textAlign: 'center', width: 44, borderBottom: '1px solid var(--border)' }} title="Job Plans" />
                <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Pages</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Project / GC</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Bid Date</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Account Man</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Estimator</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Last Update</th>
                <th style={{ padding: '0.75rem', width: 44, borderBottom: '1px solid var(--border)' }} />
              </tr>
            </thead>
            <tbody>
              {submissionUnsent.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>No bids in this group</td></tr>
              ) : (
                submissionUnsent.map((bid) => (
                  <tr
                    key={bid.id}
                    id={`submission-row-${bid.id}`}
                    onClick={() => onSelectBid(bid)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: submissionFollowupListRowBackground(bid, selectedBid?.id === bid.id),
                    }}
                  >
                    <td style={{ padding: 0, textAlign: 'center', width: 44 }} onClick={(e) => e.stopPropagation()}>
                      {bid.plans_link ? (
                        <a href={bid.plans_link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openInExternalBrowser(bid.plans_link!) }} title="Job Plans" style={{ color: 'var(--text-blue-500)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill="currentColor">
                            <path d="M304 112L192 112C183.2 112 176 119.2 176 128L176 512C176 520.8 183.2 528 192 528L448 528C456.8 528 464 520.8 464 512L464 272L376 272C336.2 272 304 239.8 304 200L304 112zM444.1 224L352 131.9L352 200C352 213.3 362.7 224 376 224L444.1 224zM128 128C128 92.7 156.7 64 192 64L325.5 64C342.5 64 358.8 70.7 370.8 82.7L493.3 205.3C505.3 217.3 512 233.6 512 250.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM387.4 496L252.6 496C236.8 496 224 483.2 224 467.4C224 461 226.1 454.9 230 449.8L297.6 362.9C303 356 311.3 352 320 352C328.7 352 337 356 342.4 362.9L410 449.9C413.9 454.9 416 461.1 416 467.5C416 483.3 403.2 496.1 387.4 496.1zM240 288C257.7 288 272 302.3 272 320C272 337.7 257.7 352 240 352C222.3 352 208 337.7 208 320C208 302.3 222.3 288 240 288z"/>
                          </svg>
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-faint)', padding: '0.5rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{bid.plan_pages?.trim() ?? '—'}</td>
                    <td style={{ padding: '0.75rem' }}>{formatBidNameWithValue(bid)}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {formatDateYYMMDD(bid.bid_due_date)}
                      {formatBidDueTime(bid.bid_due_time) ? (
                        <span style={{ color: 'var(--text-muted)' }}>{` ${formatBidDueTime(bid.bid_due_time)}`}</span>
                      ) : null}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {(() => {
                        const am = bid.account_manager as EstimatorUser | null
                        return am ? (am.name || am.email) : '—'
                      })()}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {(() => {
                        const est = bid.estimator
                        const estimatorNorm = est == null ? null : Array.isArray(est) ? est[0] ?? null : est
                        return estimatorNorm ? (estimatorNorm.name || estimatorNorm.email) : '—'
                      })()}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {formatTimeSinceLastContact(
                        effectiveSubmissionBidLastNoteIso(bid, lastContactFromEntries, customerContacts),
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', width: 44 }}>
                      {selectedBid?.id === bid.id && (
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            title="Go to summary"
                            aria-label="Go to summary"
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectBid(bid)
                              setTimeout(() => summaryCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
                            }}
                            style={{ padding: '0.25rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                              <path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM337 199L417 279C426.4 288.4 426.4 303.6 417 312.9C407.6 322.2 392.4 322.3 383.1 312.9L344.1 273.9L344.1 424C344.1 437.3 333.4 448 320.1 448C306.8 448 296.1 437.3 296.1 424L296.1 273.9L257.1 312.9C247.7 322.3 232.5 322.3 223.2 312.9C213.9 303.5 213.8 288.3 223.2 279L303.2 199C312.6 189.6 327.8 189.6 337.1 199z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            title="Edit bid"
                            onClick={(e) => { e.stopPropagation(); onEditBid(bid) }}
                            style={{ padding: '0.25rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                              <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <button
        type="button"
        onClick={() => toggleSubmissionSection('pending')}
        aria-expanded={submissionSectionOpen.pending}
        style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
      >
        <span aria-hidden>{submissionSectionOpen.pending ? '\u25BC' : '\u25B6'}</span>
        Not yet won or lost ({submissionPending.length})
      </button>
      {submissionSectionOpen.pending && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={{ padding: '0.75rem', textAlign: 'center', width: 44, borderBottom: '1px solid var(--border)' }} title="Job Plans" />
                <th style={{ padding: '0.75rem', textAlign: 'center', width: 44, borderBottom: '1px solid var(--border)' }} title="Bid Submission" />
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Project / GC</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>GC/Builder (customer)</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Account Man</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Estimator</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Last Update</th>
                <th style={{ padding: '0.75rem', width: 44, borderBottom: '1px solid var(--border)' }} />
              </tr>
            </thead>
            <tbody>
              {submissionPending.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>No bids in this group</td></tr>
              ) : (
                submissionPending.map((bid) => (
                  <tr
                    key={bid.id}
                    id={`submission-row-${bid.id}`}
                    onClick={() => onSelectBid(bid)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: submissionFollowupListRowBackground(bid, selectedBid?.id === bid.id),
                    }}
                  >
                    <td style={{ padding: 0, textAlign: 'center', width: 44 }} onClick={(e) => e.stopPropagation()}>
                      {bid.plans_link ? (
                        <a href={bid.plans_link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openInExternalBrowser(bid.plans_link!) }} title="Job Plans" style={{ color: 'var(--text-blue-500)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill="currentColor">
                            <path d="M304 112L192 112C183.2 112 176 119.2 176 128L176 512C176 520.8 183.2 528 192 528L448 528C456.8 528 464 520.8 464 512L464 272L376 272C336.2 272 304 239.8 304 200L304 112zM444.1 224L352 131.9L352 200C352 213.3 362.7 224 376 224L444.1 224zM128 128C128 92.7 156.7 64 192 64L325.5 64C342.5 64 358.8 70.7 370.8 82.7L493.3 205.3C505.3 217.3 512 233.6 512 250.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM387.4 496L252.6 496C236.8 496 224 483.2 224 467.4C224 461 226.1 454.9 230 449.8L297.6 362.9C303 356 311.3 352 320 352C328.7 352 337 356 342.4 362.9L410 449.9C413.9 454.9 416 461.1 416 467.5C416 483.3 403.2 496.1 387.4 496.1zM240 288C257.7 288 272 302.3 272 320C272 337.7 257.7 352 240 352C222.3 352 208 337.7 208 320C208 302.3 222.3 288 240 288z"/>
                          </svg>
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-faint)', padding: '0.5rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: 0, textAlign: 'center', width: 44 }} onClick={(e) => e.stopPropagation()}>
                      {bid.bid_submission_link ? (
                        <a href={bid.bid_submission_link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openInExternalBrowser(bid.bid_submission_link!) }} title="Bid Submission" style={{ color: 'var(--text-blue-500)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill="currentColor">
                            <path d="M240 112L128 112C119.2 112 112 119.2 112 128L112 512C112 520.8 119.2 528 128 528L208 528L208 576L128 576C92.7 576 64 547.3 64 512L64 128C64 92.7 92.7 64 128 64L261.5 64C278.5 64 294.8 70.7 306.8 82.7L429.3 205.3C441.3 217.3 448 233.6 448 250.6L448 400.1L400 400.1L400 272.1L312 272.1C272.2 272.1 240 239.9 240 200.1L240 112.1zM380.1 224L288 131.9L288 200C288 213.3 298.7 224 312 224L380.1 224zM272 444L304 444C337.1 444 364 470.9 364 504C364 537.1 337.1 564 304 564L292 564L292 592C292 603 283 612 272 612C261 612 252 603 252 592L252 464C252 453 261 444 272 444zM304 524C315 524 324 515 324 504C324 493 315 484 304 484L292 484L292 524L304 524zM400 444L432 444C460.7 444 484 467.3 484 496L484 560C484 588.7 460.7 612 432 612L400 612C389 612 380 603 380 592L380 464C380 453 389 444 400 444zM432 572C438.6 572 444 566.6 444 560L444 496C444 489.4 438.6 484 432 484L420 484L420 572L432 572zM508 464C508 453 517 444 528 444L576 444C587 444 596 453 596 464C596 475 587 484 576 484L548 484L548 508L576 508C587 508 596 517 596 528C596 539 587 548 576 548L548 548L548 592C548 603 539 612 528 612C517 612 508 603 508 592L508 464z"/>
                          </svg>
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-faint)', padding: '0.5rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <div>
                        <div>{formatBidNameWithValue(bid)}</div>
                        {bid.address && (
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                            {bid.address}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'left' }}>
                      {(bid.customers || bid.bids_gc_builders) ? (
                        <button type="button" onClick={(e) => { e.stopPropagation(); onOpenParty(bid) }} style={{ background: 'none', border: 'none', color: 'var(--text-blue-500)', cursor: 'pointer', textDecoration: 'underline', padding: 0, textAlign: 'left' }}>
                          {bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {(() => {
                        const am = bid.account_manager as EstimatorUser | null
                        return am ? (am.name || am.email) : '—'
                      })()}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {(() => {
                        const est = bid.estimator
                        const estimatorNorm = est == null ? null : Array.isArray(est) ? est[0] ?? null : est
                        return estimatorNorm ? (estimatorNorm.name || estimatorNorm.email) : '—'
                      })()}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {formatTimeSinceLastContact(
                        effectiveSubmissionBidLastNoteIso(bid, lastContactFromEntries, customerContacts),
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', width: 44 }}>
                      {selectedBid?.id === bid.id && (
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            title="Go to summary"
                            aria-label="Go to summary"
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectBid(bid)
                              setTimeout(() => summaryCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
                            }}
                            style={{ padding: '0.25rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                              <path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM337 199L417 279C426.4 288.4 426.4 303.6 417 312.9C407.6 322.2 392.4 322.3 383.1 312.9L344.1 273.9L344.1 424C344.1 437.3 333.4 448 320.1 448C306.8 448 296.1 437.3 296.1 424L296.1 273.9L257.1 312.9C247.7 322.3 232.5 322.3 223.2 312.9C213.9 303.5 213.8 288.3 223.2 279L303.2 199C312.6 189.6 327.8 189.6 337.1 199z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            title="Edit bid"
                            onClick={(e) => { e.stopPropagation(); onEditBid(bid) }}
                            style={{ padding: '0.25rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                              <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <button
        type="button"
        onClick={() => toggleSubmissionSection('won')}
        aria-expanded={submissionSectionOpen.won}
        style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
      >
        <span aria-hidden>{submissionSectionOpen.won ? '\u25BC' : '\u25B6'}</span>
        Won ({submissionWon.length})
      </button>
      {submissionSectionOpen.won && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={{ padding: '0.75rem', textAlign: 'center', width: 44, borderBottom: '1px solid var(--border)' }} title="Project Folder" />
                <th style={{ padding: '0.75rem', textAlign: 'center', width: 44, borderBottom: '1px solid var(--border)' }} title="Job Plans" />
                <th style={{ padding: '0.75rem', textAlign: 'center', width: 44, borderBottom: '1px solid var(--border)' }} title="CountTooling Plans" />
                <th style={{ padding: '0.75rem', textAlign: 'center', width: 44, borderBottom: '1px solid var(--border)' }} title="Bid Submission" />
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Project / GC</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Start Date</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>GC/Builder (customer)</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Account Man</th>
                <th style={{ padding: '0.75rem', width: 44, borderBottom: '1px solid var(--border)' }} />
              </tr>
            </thead>
            <tbody>
              {submissionWon.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>No bids in this group</td></tr>
              ) : (
                submissionWon.map((bid) => (
                  <tr
                    key={bid.id}
                    id={`submission-row-${bid.id}`}
                    onClick={() => onSelectBid(bid)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: selectedBid?.id === bid.id ? '#eff6ff' : undefined,
                    }}
                  >
                    <td style={{ padding: 0, textAlign: 'center', width: 44 }} onClick={(e) => e.stopPropagation()}>
                      {bid.drive_link ? (
                        <a href={bid.drive_link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openInExternalBrowser(bid.drive_link!) }} title="Project Folder" style={{ color: 'var(--text-blue-500)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill="currentColor">
                            <path d="M129.5 464L179.5 304L558.9 304L508.9 464L129.5 464zM320.2 512L509 512C530 512 548.6 498.4 554.8 478.3L604.8 318.3C614.5 287.4 591.4 256 559 256L179.6 256C158.6 256 140 269.6 133.8 289.7L112.2 358.4L112.2 160C112.2 151.2 119.4 144 128.2 144L266.9 144C270.4 144 273.7 145.1 276.5 147.2L314.9 176C328.7 186.4 345.6 192 362.9 192L480.2 192C489 192 496.2 199.2 496.2 208L544.2 208C544.2 172.7 515.5 144 480.2 144L362.9 144C356 144 349.2 141.8 343.7 137.6L305.3 108.8C294.2 100.5 280.8 96 266.9 96L128.2 96C92.9 96 64.2 124.7 64.2 160L64.2 448C64.2 483.3 92.9 512 128.2 512L320.2 512z"/>
                          </svg>
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-faint)', padding: '0.5rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: 0, textAlign: 'center', width: 44 }} onClick={(e) => e.stopPropagation()}>
                      {bid.plans_link ? (
                        <a href={bid.plans_link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openInExternalBrowser(bid.plans_link!) }} title="Job Plans" style={{ color: 'var(--text-blue-500)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill="currentColor">
                            <path d="M304 112L192 112C183.2 112 176 119.2 176 128L176 512C176 520.8 183.2 528 192 528L448 528C456.8 528 464 520.8 464 512L464 272L376 272C336.2 272 304 239.8 304 200L304 112zM444.1 224L352 131.9L352 200C352 213.3 362.7 224 376 224L444.1 224zM128 128C128 92.7 156.7 64 192 64L325.5 64C342.5 64 358.8 70.7 370.8 82.7L493.3 205.3C505.3 217.3 512 233.6 512 250.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM387.4 496L252.6 496C236.8 496 224 483.2 224 467.4C224 461 226.1 454.9 230 449.8L297.6 362.9C303 356 311.3 352 320 352C328.7 352 337 356 342.4 362.9L410 449.9C413.9 454.9 416 461.1 416 467.5C416 483.3 403.2 496.1 387.4 496.1zM240 288C257.7 288 272 302.3 272 320C272 337.7 257.7 352 240 352C222.3 352 208 337.7 208 320C208 302.3 222.3 288 240 288z"/>
                          </svg>
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-faint)', padding: '0.5rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: 0, textAlign: 'center', width: 44 }} onClick={(e) => e.stopPropagation()}>
                      {bid.count_tooling_plans_link ? (
                        <a href={bid.count_tooling_plans_link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openInExternalBrowser(bid.count_tooling_plans_link!) }} title="CountTooling Plans" style={{ color: 'var(--text-blue-500)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill="currentColor">
                            <path d="M192 112L304 112L304 200C304 239.8 336.2 272 376 272L464 272L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 128C176 119.2 183.2 112 192 112zM352 131.9L444.1 224L376 224C362.7 224 352 213.3 352 200L352 131.9zM192 64C156.7 64 128 92.7 128 128L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 250.5C512 233.5 505.3 217.2 493.3 205.2L370.7 82.7C358.7 70.7 342.5 64 325.5 64L192 64zM298.2 359.6C306.8 349.5 305.7 334.4 295.6 325.8C285.5 317.2 270.4 318.3 261.8 328.4L213.8 384.4C206.1 393.4 206.1 406.6 213.8 415.6L261.8 471.6C270.4 481.7 285.6 482.8 295.6 474.2C305.6 465.6 306.8 450.4 298.2 440.4L263.6 400L298.2 359.6zM378.2 328.4C369.6 318.3 354.4 317.2 344.4 325.8C334.4 334.4 333.2 349.6 341.8 359.6L376.4 400L341.8 440.4C333.2 450.5 334.3 465.6 344.4 474.2C354.5 482.8 369.6 481.7 378.2 471.6L426.2 415.6C433.9 406.6 433.9 393.4 426.2 384.4L378.2 328.4z"/>
                          </svg>
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-faint)', padding: '0.5rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: 0, textAlign: 'center', width: 44 }} onClick={(e) => e.stopPropagation()}>
                      {bid.bid_submission_link ? (
                        <a href={bid.bid_submission_link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openInExternalBrowser(bid.bid_submission_link!) }} title="Bid Submission" style={{ color: 'var(--text-blue-500)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill="currentColor">
                            <path d="M240 112L128 112C119.2 112 112 119.2 112 128L112 512C112 520.8 119.2 528 128 528L208 528L208 576L128 576C92.7 576 64 547.3 64 512L64 128C64 92.7 92.7 64 128 64L261.5 64C278.5 64 294.8 70.7 306.8 82.7L429.3 205.3C441.3 217.3 448 233.6 448 250.6L448 400.1L400 400.1L400 272.1L312 272.1C272.2 272.1 240 239.9 240 200.1L240 112.1zM380.1 224L288 131.9L288 200C288 213.3 298.7 224 312 224L380.1 224zM272 444L304 444C337.1 444 364 470.9 364 504C364 537.1 337.1 564 304 564L292 564L292 592C292 603 283 612 272 612C261 612 252 603 252 592L252 464C252 453 261 444 272 444zM304 524C315 524 324 515 324 504C324 493 315 484 304 484L292 484L292 524L304 524zM400 444L432 444C460.7 444 484 467.3 484 496L484 560C484 588.7 460.7 612 432 612L400 612C389 612 380 603 380 592L380 464C380 453 389 444 400 444zM432 572C438.6 572 444 566.6 444 560L444 496C444 489.4 438.6 484 432 484L420 484L420 572L432 572zM508 464C508 453 517 444 528 444L576 444C587 444 596 453 596 464C596 475 587 484 576 484L548 484L548 508L576 508C587 508 596 517 596 528C596 539 587 548 576 548L548 548L548 592C548 603 539 612 528 612C517 612 508 603 508 592L508 464z"/>
                          </svg>
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-faint)', padding: '0.5rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{formatBidNameWithValue(bid)}</td>
                    <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.estimated_job_start_date)}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'left' }}>
                      {(bid.customers || bid.bids_gc_builders) ? (
                        <button type="button" onClick={(e) => { e.stopPropagation(); onOpenParty(bid) }} style={{ background: 'none', border: 'none', color: 'var(--text-blue-500)', cursor: 'pointer', textDecoration: 'underline', padding: 0, textAlign: 'left' }}>
                          {bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {(() => {
                        const am = bid.account_manager as EstimatorUser | null
                        return am ? (am.name || am.email) : '—'
                      })()}
                    </td>
                    <td style={{ padding: '0.75rem', width: 44 }}>
                      {selectedBid?.id === bid.id && (
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            title="Go to summary"
                            aria-label="Go to summary"
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectBid(bid)
                              setTimeout(() => summaryCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
                            }}
                            style={{ padding: '0.25rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                              <path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM337 199L417 279C426.4 288.4 426.4 303.6 417 312.9C407.6 322.2 392.4 322.3 383.1 312.9L344.1 273.9L344.1 424C344.1 437.3 333.4 448 320.1 448C306.8 448 296.1 437.3 296.1 424L296.1 273.9L257.1 312.9C247.7 322.3 232.5 322.3 223.2 312.9C213.9 303.5 213.8 288.3 223.2 279L303.2 199C312.6 189.6 327.8 189.6 337.1 199z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            title="Edit bid"
                            onClick={(e) => { e.stopPropagation(); onEditBid(bid) }}
                            style={{ padding: '0.25rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                              <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <button
        type="button"
        onClick={() => toggleSubmissionSection('startedOrComplete')}
        aria-expanded={submissionSectionOpen.startedOrComplete}
        style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
      >
        <span aria-hidden>{submissionSectionOpen.startedOrComplete ? '\u25BC' : '\u25B6'}</span>
        Started or Complete ({submissionStartedOrComplete.length})
      </button>
      {submissionSectionOpen.startedOrComplete && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Project / GC</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>GC/Builder (customer)</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Account Man</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Estimator</th>
                <th style={{ padding: '0.75rem', width: 80, borderBottom: '1px solid var(--border)' }} />
              </tr>
            </thead>
            <tbody>
              {submissionStartedOrComplete.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>No bids in this group</td></tr>
              ) : (
                submissionStartedOrComplete.map((bid) => (
                  <tr
                    key={bid.id}
                    id={`submission-row-${bid.id}`}
                    onClick={() => onSelectBid(bid)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: selectedBid?.id === bid.id ? '#eff6ff' : undefined,
                    }}
                  >
                    <td style={{ padding: '0.75rem' }}>{formatBidNameWithValue(bid)}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'left' }}>
                      {(bid.customers || bid.bids_gc_builders) ? (
                        <button type="button" onClick={(e) => { e.stopPropagation(); onOpenParty(bid) }} style={{ background: 'none', border: 'none', color: 'var(--text-blue-500)', cursor: 'pointer', textDecoration: 'underline', padding: 0, textAlign: 'left' }}>
                          {bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {(() => {
                        const am = bid.account_manager as EstimatorUser | null
                        return am ? (am.name || am.email) : '—'
                      })()}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {(() => {
                        const est = bid.estimator
                        const estimatorNorm = est == null ? null : Array.isArray(est) ? est[0] ?? null : est
                        return estimatorNorm ? (estimatorNorm.name || estimatorNorm.email) : '—'
                      })()}
                    </td>
                    <td style={{ padding: '0.75rem', width: 80 }}>
                      {selectedBid?.id === bid.id && (
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            title="Go to summary"
                            aria-label="Go to summary"
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectBid(bid)
                              setTimeout(() => summaryCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
                            }}
                            style={{ padding: '0.25rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                              <path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM337 199L417 279C426.4 288.4 426.4 303.6 417 312.9C407.6 322.2 392.4 322.3 383.1 312.9L344.1 273.9L344.1 424C344.1 437.3 333.4 448 320.1 448C306.8 448 296.1 437.3 296.1 424L296.1 273.9L257.1 312.9C247.7 322.3 232.5 322.3 223.2 312.9C213.9 303.5 213.8 288.3 223.2 279L303.2 199C312.6 189.6 327.8 189.6 337.1 199z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            title="Edit bid"
                            onClick={(e) => { e.stopPropagation(); onEditBid(bid) }}
                            style={{ padding: '0.25rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                              <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <button
        type="button"
        onClick={() => toggleSubmissionSection('lost')}
        aria-expanded={submissionSectionOpen.lost}
        style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
      >
        <span aria-hidden>{submissionSectionOpen.lost ? '\u25BC' : '\u25B6'}</span>
        Lost ({submissionLost.length})
      </button>
      {submissionSectionOpen.lost && (
      <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--bg-subtle)' }}>
            <tr>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Project / GC</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Bid Date</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Loss Reason</th>
              <th style={{ padding: '0.75rem', width: 44, borderBottom: '1px solid var(--border)' }} />
            </tr>
          </thead>
          <tbody>
            {submissionLost.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>No bids in this group</td></tr>
            ) : (
              submissionLost.map((bid) => (
                <tr
                  key={bid.id}
                  id={`submission-row-${bid.id}`}
                  onClick={() => onSelectBid(bid)}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: selectedBid?.id === bid.id ? '#eff6ff' : undefined,
                  }}
                >
                  <td style={{ padding: '0.75rem' }}>{bidDisplayName(bid) || bid.customers?.name || bid.bids_gc_builders?.name || bid.id.slice(0, 8)}</td>
                  <td style={{ padding: '0.75rem' }}>
                    {formatDateYYMMDD(bid.bid_due_date)}
                    {formatBidDueTime(bid.bid_due_time) ? (
                      <span style={{ color: 'var(--text-muted)' }}>{` ${formatBidDueTime(bid.bid_due_time)}`}</span>
                    ) : null}
                  </td>
                  <td style={{ padding: '0.75rem' }}>{(bid as { loss_reason?: string | null }).loss_reason?.trim() || '—'}</td>
                  <td style={{ padding: '0.75rem', width: 44 }}>
                    {selectedBid?.id === bid.id && (
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            title="Go to summary"
                            aria-label="Go to summary"
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectBid(bid)
                              setTimeout(() => summaryCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
                            }}
                            style={{ padding: '0.25rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                              <path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM337 199L417 279C426.4 288.4 426.4 303.6 417 312.9C407.6 322.2 392.4 322.3 383.1 312.9L344.1 273.9L344.1 424C344.1 437.3 333.4 448 320.1 448C306.8 448 296.1 437.3 296.1 424L296.1 273.9L257.1 312.9C247.7 322.3 232.5 322.3 223.2 312.9C213.9 303.5 213.8 288.3 223.2 279L303.2 199C312.6 189.6 327.8 189.6 337.1 199z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            title="Edit bid"
                            onClick={(e) => { e.stopPropagation(); onEditBid(bid) }}
                            style={{ padding: '0.25rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                              <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                            </svg>
                          </button>
                        </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}
