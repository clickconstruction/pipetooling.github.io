import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { UserRole } from '../../hooks/useAuth'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { useToastContext } from '../../contexts/ToastContext'
import { useBidPreview } from '../../contexts/BidPreviewModalContext'
import { upsertBidNotesReadWatermark } from '../../lib/userBidNotesReadState'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import {
  MY_BID_OTHERS_VISIBLE_STEP,
  MY_BIDS_DASHBOARD_ROW_LIMIT,
  bucketMyBidCustomerContactsFromOthers,
  bucketMyBidSubmissionsFromOthers,
  buildMyBidRows,
  collectMyBidNoteAuthorIds,
  formatMyBidPreviewDate,
  formatRelativeCompactAgo,
  truncateMyBidNotePreview,
  type MyBidBaseRow,
  type MyBidCustomerContactRow,
  type MyBidReadStateRow,
  type MyBidRow,
  type MyBidSubmissionEntryRow,
} from '../../lib/dashboardMyBids'
import { MyBidsSectionSkeleton } from './DashboardSkeletons'

export function DashboardMyBidsSection({
  authUserId,
  role,
  isMobile,
  onContentVisibleChange,
}: {
  authUserId: string | undefined
  role: UserRole | null
  isMobile: boolean
  /** Reports the data half of the section's render gate so the parent's SectionDock entry can mirror it. */
  onContentVisibleChange: (visible: boolean) => void
}) {
  const { showToast } = useToastContext()
  const bidPreview = useBidPreview()

  const [myBids, setMyBids] = useState<MyBidRow[]>([])
  const [myBidsLoading, setMyBidsLoading] = useState(false)
  const [hiddenBidIds, setHiddenBidIds] = useState<Set<string>>(new Set())
  const [hiddenBidsExpanded, setHiddenBidsExpanded] = useState(false)
  const [sentBidsExpanded, setSentBidsExpanded] = useState(false)
  const myBidsPrimaryCollapseAppliedRef = useRef(false)
  const [myBidsSectionExpanded, setMyBidsSectionExpanded] = useState(role === 'primary' ? false : true)
  const [myBidOthersVisibleLimits, setMyBidOthersVisibleLimits] = useState<
    Record<string, { bid: number; customer: number }>
  >({})
  const [myBidOthersNoteDetailsOpen, setMyBidOthersNoteDetailsOpen] = useState<Set<string>>(() => new Set())

  const toggleMyBidOthersNoteDetails = useCallback((key: string, open: boolean) => {
    setMyBidOthersNoteDetailsOpen((prev) => {
      const next = new Set(prev)
      if (open) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  const myBidsVisibleCount = useMemo(
    () => myBids.reduce((acc, b) => acc + (hiddenBidIds.has(b.id) ? 0 : 1), 0),
    [myBids, hiddenBidIds],
  )

  useEffect(() => {
    if (role !== 'primary' || myBidsPrimaryCollapseAppliedRef.current) return
    setMyBidsSectionExpanded(false)
    myBidsPrimaryCollapseAppliedRef.current = true
  }, [role])

  useEffect(() => {
    const hasBidsAccess =
      role === 'dev' ||
      role === 'master_technician' ||
      isAssistantLike(role) ||
      role === 'estimator' ||
      role === 'primary' ||
      role === 'superintendent'
    if (!authUserId || !hasBidsAccess) return
    let cancelled = false
    setMyBidsLoading(true)
    void (async () => {
      try {
        const uidForFilter = authUserId
        const rawRows = await withSupabaseRetry(
          async () =>
            supabase
              .from('bids')
              .select(
                'id, project_name, bid_due_date, bid_date_sent, outcome, customer_id, estimator_id, account_manager_id, service_type:service_types(name)'
              )
              .or(`estimator_id.eq.${uidForFilter},account_manager_id.eq.${uidForFilter}`)
              .or('outcome.is.null,outcome.neq.lost')
              .order('bid_due_date', { ascending: true, nullsFirst: false })
              .limit(MY_BIDS_DASHBOARD_ROW_LIMIT),
          'load dashboard my bids'
        )
        if (cancelled) return
        const baseRows = (rawRows ?? []) as MyBidBaseRow[]
        const bidIds = baseRows.map((r) => r.id)
        const uid = authUserId
        if (bidIds.length === 0) {
          if (!cancelled) setMyBids([])
          return
        }

        const [readStateRows, entryRows] = await Promise.all([
          withSupabaseRetry(
            async () =>
              supabase.from('user_bid_notes_read_state').select('*').eq('user_id', uid).in('bid_id', bidIds),
            'load bid notes read state'
          ),
          withSupabaseRetry(
            async () =>
              supabase
                .from('bids_submission_entries')
                .select('id, bid_id, created_at, created_by, notes, occurred_at, contact_method')
                .in('bid_id', bidIds),
            'load bid submission entries for unread'
          ),
        ])
        const customerIds = [
          ...new Set(
            baseRows
              .map((r) => r.customer_id)
              .filter((cid): cid is string => cid != null && cid !== '')
          ),
        ]
        let contactRows: MyBidCustomerContactRow[] = []
        if (customerIds.length > 0) {
          contactRows =
            (await withSupabaseRetry(
              async () =>
                supabase
                  .from('customer_contacts')
                  .select('id, customer_id, created_at, created_by, details, contact_date, contact_method')
                  .in('customer_id', customerIds),
              'load customer contacts for unread'
            )) ?? []
        }
        if (cancelled) return

        const bidListsFromOthers = bucketMyBidSubmissionsFromOthers(
          (entryRows ?? []) as MyBidSubmissionEntryRow[],
          uid
        )
        const customerListsFromOthers = bucketMyBidCustomerContactsFromOthers(contactRows, uid)

        const authorIds = collectMyBidNoteAuthorIds(bidListsFromOthers, customerListsFromOthers)
        const authorLabelById = new Map<string, string>()
        if (authorIds.size > 0) {
          const authors =
            (await withSupabaseRetry(
              async () =>
                supabase.from('users').select('id, name, email').in('id', [...authorIds]),
              'load users for my bids note authors'
            )) ?? []
          for (const u of authors as Array<{ id: string; name: string | null; email: string }>) {
            authorLabelById.set(u.id, (u.name?.trim() || u.email || 'Someone').trim())
          }
        }

        const myBidsBuilt: MyBidRow[] = buildMyBidRows({
          baseRows,
          readStateRows: (readStateRows ?? []) as MyBidReadStateRow[],
          bidListsFromOthers,
          customerListsFromOthers,
          authorLabelById,
          userId: uid,
        })
        if (!cancelled) setMyBids(myBidsBuilt)
      } catch {
        if (!cancelled) setMyBids([])
      } finally {
        if (!cancelled) setMyBidsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUserId, role])

  useEffect(() => {
    if (!authUserId || typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(`dashboard_my_bids_hidden_${authUserId}`)
      if (raw) {
        const arr = JSON.parse(raw) as string[]
        if (Array.isArray(arr)) setHiddenBidIds(new Set(arr))
      }
    } catch {
      /* ignore */
    }
  }, [authUserId])

  function hideBid(bidId: string) {
    const next = new Set(hiddenBidIds)
    next.add(bidId)
    setHiddenBidIds(next)
    if (authUserId && typeof window !== 'undefined') {
      localStorage.setItem(`dashboard_my_bids_hidden_${authUserId}`, JSON.stringify([...next]))
    }
  }

  function unhideBid(bidId: string) {
    const next = new Set(hiddenBidIds)
    next.delete(bidId)
    setHiddenBidIds(next)
    if (authUserId && typeof window !== 'undefined') {
      localStorage.setItem(`dashboard_my_bids_hidden_${authUserId}`, JSON.stringify([...next]))
    }
  }

  const markMyBidNotesReadAsViewed = useCallback(
    async (bidId: string) => {
      if (!authUserId) return
      try {
        await upsertBidNotesReadWatermark(authUserId, bidId)
        setMyBids((prev) =>
          prev.map((b) =>
            b.id === bidId
              ? {
                  ...b,
                  unreadBidNotes: false,
                  unreadCustomerNotes: false,
                  othersBidUpdates: [],
                  othersCustomerUpdates: [],
                }
              : b
          )
        )
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not mark notes as read'), 'error')
      }
    },
    [authUserId, showToast]
  )

  const adjustMyBidOthersLimit = useCallback(
    (bidId: string, stream: 'bid' | 'customer', op: 'more' | 'all' | 'less', total: number) => {
      setMyBidOthersVisibleLimits((prev) => {
        const cur = prev[bidId] ?? { bid: 1, customer: 1 }
        const v = stream === 'bid' ? cur.bid : cur.customer
        let nv = v
        if (op === 'more') nv = Math.min(v + MY_BID_OTHERS_VISIBLE_STEP, total)
        else if (op === 'all') nv = total
        else nv = 1
        return {
          ...prev,
          [bidId]: {
            bid: stream === 'bid' ? nv : cur.bid,
            customer: stream === 'customer' ? nv : cur.customer,
          },
        }
      })
    },
    []
  )

  useEffect(() => {
    const ids = new Set(myBids.map((x) => x.id))
    setMyBidOthersVisibleLimits((prev) => {
      let changed = false
      const next: Record<string, { bid: number; customer: number }> = { ...prev }
      for (const k of Object.keys(next)) {
        if (!ids.has(k)) {
          delete next[k]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [myBids])

  const hasVisibleContent = myBidsLoading || myBids.some((b) => !hiddenBidIds.has(b.id))
  useEffect(() => {
    onContentVisibleChange(hasVisibleContent)
  }, [hasVisibleContent, onContentVisibleChange])

  return (
    <>
      {(role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'estimator' || role === 'primary') && (myBidsLoading || myBids.some((b) => !hiddenBidIds.has(b.id))) && (
        <div id="dash-bids" style={{ marginBottom: '1rem', scrollMarginTop: 8 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: !isMobile && !myBidsSectionExpanded ? 'flex-start' : 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginBottom: !isMobile && !myBidsSectionExpanded ? 0 : '0.5rem',
            }}
          >
            {isMobile ? (
              <h2 style={{ fontSize: '1.125rem', margin: 0 }}>
                {myBidsLoading ? 'My Bids' : `My Bids (${myBidsVisibleCount})`}
              </h2>
            ) : (
              <button
                type="button"
                onClick={() => setMyBidsSectionExpanded((prev) => !prev)}
                aria-expanded={myBidsSectionExpanded}
                aria-label={
                  myBidsLoading
                    ? 'My Bids, loading'
                    : `My Bids, ${myBidsVisibleCount} ${myBidsVisibleCount === 1 ? 'bid' : 'bids'}`
                }
                style={{
                  margin: 0,
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span aria-hidden>{myBidsSectionExpanded ? '▼' : '▶'}</span>
                <h2 style={{ fontSize: '1.125rem', margin: 0 }}>
                  {myBidsLoading ? 'My Bids' : `My Bids (${myBidsVisibleCount})`}
                </h2>
              </button>
            )}
            {(isMobile || myBidsSectionExpanded) && (
              <Link
                to="/bids?new=true"
                style={{
                  padding: '0.35rem 0.75rem',
                  background: '#3b82f6',
                  color: 'white',
                  borderRadius: 6,
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                New Bid
              </Link>
            )}
          </div>
          {(isMobile || myBidsSectionExpanded) && (myBidsLoading ? (
            <MyBidsSectionSkeleton />
          ) : (
            <>
              {(() => {
                const visibleBids = myBids.filter((b) => !hiddenBidIds.has(b.id))
                const unsentBids = visibleBids.filter((b) => !b.bid_date_sent)
                const sentBids = visibleBids.filter((b) => b.bid_date_sent != null)
                const myBidPillEstimator: CSSProperties = {
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '0.15rem 0.45rem',
                  borderRadius: 4,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  background: 'var(--bg-blue-200)',
                  border: '1px solid #93c5fd',
                  color: 'var(--text-blue-800)',
                }
                const myBidPillAccountManager: CSSProperties = {
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '0.15rem 0.45rem',
                  borderRadius: 4,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  background: '#ede9fe',
                  border: '1px solid #c4b5fd',
                  color: '#5b21b6',
                }
                const renderBidItem = (b: typeof myBids[0], cardStyle: CSSProperties, mode: 'visible' | 'hidden' = 'visible') => {
                  const status =
                    !b.bid_date_sent
                      ? 'Unsent'
                      : b.outcome === 'won'
                        ? 'Won'
                        : b.outcome === 'started_or_complete'
                          ? 'Started or Complete'
                          : 'Pending'
                  const dueStr = b.bid_due_date
                    ? new Date(b.bid_due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
                    : '—'
                  const hasUnread = b.unreadBidNotes || b.unreadCustomerNotes
                  const myBidMetaBold: CSSProperties = { fontWeight: 600 }
                  return (
                    <li key={b.id} style={{ marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Link
                          to={`/bids?bidId=${encodeURIComponent(b.id)}&tab=submission-followup`}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            display: 'block',
                            padding: '0.5rem 0.75rem',
                            ...cardStyle,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'row',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: '0.5rem',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontWeight: 500 }}>{b.project_name || 'Untitled'}</span>
                              {b.service_type_name && (
                                <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>({b.service_type_name})</span>
                              )}
                            </div>
                            <div
                              style={{
                                flexShrink: 0,
                                display: 'flex',
                                flexWrap: 'wrap',
                                justifyContent: 'flex-end',
                                alignItems: 'flex-start',
                                gap: '0.25rem',
                              }}
                            >
                              {(b.myBidRoles === 'estimator' || b.myBidRoles === 'both') && (
                                <span style={myBidPillEstimator}>Estimator</span>
                              )}
                              {(b.myBidRoles === 'account_manager' || b.myBidRoles === 'both') && (
                                <span style={myBidPillAccountManager}>Account Manager</span>
                              )}
                            </div>
                          </div>
                          <div style={{ marginTop: '0.25rem', color: 'var(--text-600)' }}>
                            Due {dueStr} · {status}
                          </div>
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            bidPreview?.openBidPreview(b.id)
                          }}
                          style={{
                            flexShrink: 0,
                            padding: '0.35rem 0.55rem',
                            background: 'var(--bg-muted)',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 4,
                            cursor: 'pointer',
                            color: 'var(--text-700)',
                            fontSize: '0.8125rem',
                          }}
                          title="Preview bid"
                        >
                          Preview
                        </button>
                        {mode === 'visible' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              hideBid(b.id)
                            }}
                            style={{
                              flexShrink: 0,
                              padding: '0.35rem',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--text-muted)',
                            }}
                            title="Hide bid"
                            aria-label="Hide bid"
                          >
                            <svg width="16" height="16" viewBox="0 0 640 640" fill="currentColor" style={{ display: 'block' }}>
                              <path d="M73 39.1C63.6 29.7 48.4 29.7 39.1 39.1C29.8 48.5 29.7 63.7 39 73.1L567 601.1C576.4 610.5 591.6 610.5 600.9 601.1C610.2 591.7 610.3 576.5 600.9 567.2L504.5 470.8C507.2 468.4 509.9 466 512.5 463.6C559.3 420.1 590.6 368.2 605.5 332.5C608.8 324.6 608.8 315.8 605.5 307.9C590.6 272.2 559.3 220.2 512.5 176.8C465.4 133.1 400.7 96.2 319.9 96.2C263.1 96.2 214.3 114.4 173.9 140.4L73 39.1zM208.9 175.1C241 156.2 278.1 144 320 144C385.2 144 438.8 173.6 479.9 211.7C518.4 247.4 545 290 558.5 320C544.9 350 518.3 392.5 479.9 428.3C476.8 431.1 473.7 433.9 470.5 436.7L425.8 392C439.8 371.5 448 346.7 448 320C448 249.3 390.7 192 320 192C293.3 192 268.5 200.2 248 214.2L208.9 175.1zM390.9 357.1L282.9 249.1C294 243.3 306.6 240 320 240C364.2 240 400 275.8 400 320C400 333.4 396.7 346 390.9 357.1zM135.4 237.2L101.4 203.2C68.8 240 46.4 279 34.5 307.7C31.2 315.6 31.2 324.4 34.5 332.3C49.4 368 80.7 420 127.5 463.4C174.6 507.1 239.3 544 320.1 544C357.4 544 391.3 536.1 421.6 523.4L384.2 486C364.2 492.4 342.8 496 320 496C254.8 496 201.2 466.4 160.1 428.3C121.6 392.6 95 350 81.5 320C91.9 296.9 110.1 266.4 135.5 237.2z" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => unhideBid(b.id)}
                            style={{
                              flexShrink: 0,
                              padding: '0.2rem 0.5rem',
                              fontSize: '0.8125rem',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              background: 'var(--surface)',
                              color: 'var(--text-700)',
                              cursor: 'pointer',
                            }}
                          >
                            Add back
                          </button>
                        )}
                      </div>
                      {hasUnread ? (
                        <div
                          role="region"
                          aria-label={`Unread notes for ${b.project_name || 'bid'}`}
                          style={{
                            marginTop: '0.35rem',
                            marginLeft: '0.5rem',
                            padding: '0.6rem 0.75rem 0.6rem 1rem',
                            background: 'var(--bg-amber-tint)',
                            border: '1px solid #fcd34d',
                            borderLeft: '3px solid #f59e0b',
                            borderRadius: 6,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '0.5rem',
                              flexWrap: 'wrap',
                              marginBottom:
                                (b.unreadBidNotes && b.othersBidUpdates.length > 0) ||
                                (b.unreadCustomerNotes && b.othersCustomerUpdates.length > 0)
                                  ? '0.5rem'
                                  : 0,
                            }}
                          >
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>Unread updates</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                void markMyBidNotesReadAsViewed(b.id)
                              }}
                              style={{
                                flexShrink: 0,
                                padding: '0.35rem 0.6rem',
                                fontSize: '0.8125rem',
                                border: '1px solid #d97706',
                                borderRadius: 4,
                                background: 'var(--surface)',
                                color: 'var(--text-amber-900)',
                                cursor: 'pointer',
                                fontWeight: 500,
                              }}
                            >
                              Mark read
                            </button>
                          </div>
                          {b.unreadBidNotes && b.othersBidUpdates.length > 0 ? (
                            <div style={{ marginTop: '0.35rem' }}>
                              {(() => {
                                const lim = myBidOthersVisibleLimits[b.id] ?? { bid: 1, customer: 1 }
                                const bidTotal = b.othersBidUpdates.length
                                const bidLimit = Math.min(Math.max(1, lim.bid), bidTotal)
                                const bidSlice = b.othersBidUpdates.slice(0, bidLimit)
                                const othersBtn: CSSProperties = {
                                  padding: 0,
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.8125rem',
                                  color: 'var(--text-amber-800)',
                                  textDecoration: 'underline',
                                  fontWeight: 500,
                                }
                                return (
                                  <>
                                    <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'flex-start',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        flexWrap: 'wrap',
                                        marginBottom: '0.35rem',
                                      }}
                                    >
                                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>
                                        Recent Bid Notes
                                      </span>
                                      <div
                                        style={{
                                          display: 'flex',
                                          gap: '0.75rem',
                                          flexWrap: 'wrap',
                                          alignItems: 'center',
                                        }}
                                      >
                                        {bidTotal > bidLimit ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              adjustMyBidOthersLimit(b.id, 'bid', 'more', bidTotal)
                                            }}
                                            style={othersBtn}
                                          >
                                            Show more
                                          </button>
                                        ) : null}
                                        {bidTotal > bidLimit && bidLimit > 1 ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              adjustMyBidOthersLimit(b.id, 'bid', 'all', bidTotal)
                                            }}
                                            style={othersBtn}
                                          >
                                            Show all
                                          </button>
                                        ) : null}
                                        {bidLimit > 1 ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              adjustMyBidOthersLimit(b.id, 'bid', 'less', bidTotal)
                                            }}
                                            style={othersBtn}
                                          >
                                            Show less
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                    {bidSlice.map((item, idx) => {
                                      const teaser =
                                        truncateMyBidNotePreview(item.text, 90) || 'No note text'
                                      const detailKey = `bid:${item.id}`
                                      const isNoteOpen = myBidOthersNoteDetailsOpen.has(detailKey)
                                      const fullBody = item.text?.trim() ? item.text : 'No note text.'
                                      return (
                                        <details
                                          key={item.id}
                                          open={isNoteOpen}
                                          onToggle={(e) => {
                                            toggleMyBidOthersNoteDetails(
                                              detailKey,
                                              (e.currentTarget as HTMLDetailsElement).open
                                            )
                                          }}
                                          style={{ marginTop: idx > 0 ? '0.5rem' : 0 }}
                                        >
                                          <summary
                                            style={{
                                              cursor: 'pointer',
                                              fontSize: '0.8125rem',
                                              color: 'var(--text-amber-900)',
                                              listStyle: 'none',
                                            }}
                                          >
                                            {isNoteOpen ? (
                                              <span
                                                style={{
                                                  fontWeight: 400,
                                                  whiteSpace: 'pre-wrap',
                                                  display: 'block',
                                                  maxHeight: 200,
                                                  overflowY: 'auto',
                                                  lineHeight: 1.45,
                                                }}
                                              >
                                                <span style={myBidMetaBold}>
                                                  ({formatRelativeCompactAgo(item.createdAt)})
                                                </span>{' '}
                                                {fullBody} -{' '}
                                                <span style={myBidMetaBold}>{item.authorLabel ?? 'Someone'}</span>
                                                {' '}·{' '}
                                                {formatMyBidPreviewDate(item.createdAt)}
                                              </span>
                                            ) : (
                                              <span style={{ fontWeight: 400 }}>
                                                {teaser} -{' '}
                                                <span style={myBidMetaBold}>
                                                  {item.authorLabel ?? 'Someone'} (
                                                  {formatRelativeCompactAgo(item.createdAt)})
                                                </span>
                                              </span>
                                            )}
                                          </summary>
                                          {isNoteOpen && item.contactMethod ? (
                                            <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#a16207' }}>
                                              <span>Method: {item.contactMethod}</span>
                                            </div>
                                          ) : null}
                                        </details>
                                      )
                                    })}
                                  </>
                                )
                              })()}
                            </div>
                          ) : null}
                          {b.unreadCustomerNotes && b.othersCustomerUpdates.length > 0 ? (
                            <div style={{ marginTop: '0.5rem' }}>
                              {(() => {
                                const lim = myBidOthersVisibleLimits[b.id] ?? { bid: 1, customer: 1 }
                                const custTotal = b.othersCustomerUpdates.length
                                const custLimit = Math.min(Math.max(1, lim.customer), custTotal)
                                const custSlice = b.othersCustomerUpdates.slice(0, custLimit)
                                const othersBtn: CSSProperties = {
                                  padding: 0,
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.8125rem',
                                  color: 'var(--text-amber-800)',
                                  textDecoration: 'underline',
                                  fontWeight: 500,
                                }
                                return (
                                  <>
                                    <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'flex-start',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        flexWrap: 'wrap',
                                        marginBottom: '0.35rem',
                                      }}
                                    >
                                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>
                                        Recent Customer Notes
                                      </span>
                                      <div
                                        style={{
                                          display: 'flex',
                                          gap: '0.75rem',
                                          flexWrap: 'wrap',
                                          alignItems: 'center',
                                        }}
                                      >
                                        {custTotal > custLimit ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              adjustMyBidOthersLimit(b.id, 'customer', 'more', custTotal)
                                            }}
                                            style={othersBtn}
                                          >
                                            Show more
                                          </button>
                                        ) : null}
                                        {custTotal > custLimit && custLimit > 1 ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              adjustMyBidOthersLimit(b.id, 'customer', 'all', custTotal)
                                            }}
                                            style={othersBtn}
                                          >
                                            Show all
                                          </button>
                                        ) : null}
                                        {custLimit > 1 ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              adjustMyBidOthersLimit(b.id, 'customer', 'less', custTotal)
                                            }}
                                            style={othersBtn}
                                          >
                                            Show less
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                    {custSlice.map((item, idx) => {
                                      const teaser =
                                        truncateMyBidNotePreview(item.text, 90) || 'No note text'
                                      const detailKey = `cust:${item.id}`
                                      const isNoteOpen = myBidOthersNoteDetailsOpen.has(detailKey)
                                      const fullBody = item.text?.trim() ? item.text : 'No note text.'
                                      return (
                                        <details
                                          key={item.id}
                                          open={isNoteOpen}
                                          onToggle={(e) => {
                                            toggleMyBidOthersNoteDetails(
                                              detailKey,
                                              (e.currentTarget as HTMLDetailsElement).open
                                            )
                                          }}
                                          style={{ marginTop: idx > 0 ? '0.5rem' : 0 }}
                                        >
                                          <summary
                                            style={{
                                              cursor: 'pointer',
                                              fontSize: '0.8125rem',
                                              color: 'var(--text-amber-900)',
                                              listStyle: 'none',
                                            }}
                                          >
                                            {isNoteOpen ? (
                                              <span
                                                style={{
                                                  fontWeight: 400,
                                                  whiteSpace: 'pre-wrap',
                                                  display: 'block',
                                                  maxHeight: 200,
                                                  overflowY: 'auto',
                                                  lineHeight: 1.45,
                                                }}
                                              >
                                                <span style={myBidMetaBold}>
                                                  ({formatRelativeCompactAgo(item.createdAt)})
                                                </span>{' '}
                                                {fullBody} -{' '}
                                                <span style={myBidMetaBold}>{item.authorLabel ?? 'Someone'}</span>
                                                {' '}·{' '}
                                                {formatMyBidPreviewDate(item.createdAt)}
                                              </span>
                                            ) : (
                                              <span style={{ fontWeight: 400 }}>
                                                {teaser} -{' '}
                                                <span style={myBidMetaBold}>
                                                  {item.authorLabel ?? 'Someone'} (
                                                  {formatRelativeCompactAgo(item.createdAt)})
                                                </span>
                                              </span>
                                            )}
                                          </summary>
                                          {isNoteOpen && (item.contactMethod || item.contactDate) ? (
                                            <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#a16207' }}>
                                              {item.contactMethod ? <span>Method: {item.contactMethod}</span> : null}
                                              {item.contactMethod && item.contactDate ? ' · ' : null}
                                              {item.contactDate ? (
                                                <span>Contact: {formatMyBidPreviewDate(item.contactDate)}</span>
                                              ) : null}
                                            </div>
                                          ) : null}
                                        </details>
                                      )
                                    })}
                                  </>
                                )
                              })()}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  )
                }
                const unsentCardStyle: CSSProperties = { background: 'var(--bg-blue-tint)', border: '1px solid #bfdbfe', borderRadius: 4, color: 'var(--text-blue-800)', textDecoration: 'none', fontSize: '0.875rem' }
                const sentCardStyle: CSSProperties = { background: 'var(--bg-blue-tint)', border: '1px solid #bfdbfe', borderRadius: 4, color: 'var(--text-blue-800)', textDecoration: 'none', fontSize: '0.875rem' }
                const hiddenBidCardStyle: CSSProperties = {
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-700)',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                }
                return (
                  <>
                    {unsentBids.length === 0 && sentBids.length > 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No unsent bids</p>
                    ) : null}
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {unsentBids.map((b) => renderBidItem(b, unsentCardStyle))}
                    </ul>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <Link
                        to="/bids?tab=bid-board"
                        style={{
                          fontSize: '0.875rem',
                          color: 'var(--text-link)',
                          textDecoration: 'underline',
                        }}
                      >
                        View all
                      </Link>
                      <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {sentBids.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSentBidsExpanded((x) => !x)}
                            style={{
                              padding: 0,
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              color: 'var(--text-link)',
                              textDecoration: 'underline',
                            }}
                          >
                            Sent bids ({sentBids.length}) {sentBidsExpanded ? '▲' : '▼'}
                          </button>
                        )}
                        {hiddenBidIds.size > 0 && (
                          <button
                            type="button"
                            onClick={() => setHiddenBidsExpanded((x) => !x)}
                            style={{
                              padding: 0,
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              color: 'var(--text-link)',
                              textDecoration: 'underline',
                            }}
                          >
                            View hidden ({hiddenBidIds.size})
                          </button>
                        )}
                      </span>
                    </div>
                    {sentBidsExpanded && sentBids.length > 0 && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Sent bids</div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {sentBids.map((b) => renderBidItem(b, sentCardStyle))}
                        </ul>
                      </div>
                    )}
              {hiddenBidsExpanded && hiddenBidIds.size > 0 && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Hidden bids</div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {myBids.filter((b) => hiddenBidIds.has(b.id)).map((b) => renderBidItem(b, hiddenBidCardStyle, 'hidden'))}
                  </ul>
                </div>
              )}
            </>
          )
        })()}
      </>
          ))}
        </div>
      )}
    </>
  )
}
