import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
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
  MY_BID_STATE_WORDS,
  MY_BIDS_CUT_WORDS,
  MY_BIDS_DASHBOARD_ROW_LIMIT,
  MY_BIDS_HIDDEN_GLOSS,
  MY_BIDS_HIDDEN_HEADING,
  MY_BIDS_NOT_LOST_FILTER,
  MY_BIDS_ON_THE_BOARD_FILTER,
  MY_BIDS_READ_ORDER,
  bucketMyBidCustomerContactsFromOthers,
  bucketMyBidSubmissionsFromOthers,
  buildMyBidRows,
  buildMyBidsCard,
  collectMyBidNoteAuthorIds,
  formatMyBidPreviewDate,
  formatRelativeCompactAgo,
  isMyBidOffTheBoard,
  myBidGroupLabel,
  myBidHasUnread,
  myBidState,
  myBidWhen,
  myBidsReadIsCut,
  myBidsStartsOpen,
  truncateMyBidNotePreview,
  type MyBidBaseRow,
  type MyBidCustomerContactRow,
  type MyBidOthersBidItem,
  type MyBidOthersCustomerItem,
  type MyBidReadStateRow,
  type MyBidRow,
  type MyBidSubmissionEntryRow,
} from '../../lib/dashboardMyBids'
import { MyBidsSectionSkeleton } from './DashboardSkeletons'
import { EmptyState } from '../EmptyState'
import { MY_BIDS_ONLY_HIDDEN_EMPTY, MY_BIDS_UNSENT_EMPTY } from '../../lib/dashboard/dashboardEmptyWords'
import { NEEDS_YOU_RAIL } from '../../lib/dashboard/needsYouPalette'
import { WorkedOutValue } from '../valuesInPlace/ValuesInPlace'
import { DashboardCardHead, DashboardCardTitle } from './DashboardCardTitle'

export function DashboardMyBidsSection({
  authUserId,
  role,
  onContentVisibleChange,
}: {
  authUserId: string | undefined
  role: UserRole | null
  /** Reports the data half of the section's render gate so the parent's SectionDock entry can mirror it. */
  onContentVisibleChange: (visible: boolean) => void
}) {
  const { showToast } = useToastContext()
  const bidPreview = useBidPreview()

  const [myBids, setMyBids] = useState<MyBidRow[]>([])
  const [myBidsLoading, setMyBidsLoading] = useState(false)
  const [hiddenBidIds, setHiddenBidIds] = useState<Set<string>>(new Set())
  /** True when the read came back full, so older bids may be left out. */
  const [readCut, setReadCut] = useState(false)
  /** The groups drawn open. Unsent is the work, so it starts open; nothing remembers a press. */
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(['unsent']))
  const myBidsPrimaryCollapseAppliedRef = useRef(false)
  const [myBidsSectionExpanded, setMyBidsSectionExpanded] = useState(() => myBidsStartsOpen(role))
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

  const card = useMemo(() => buildMyBidsCard(myBids, hiddenBidIds), [myBids, hiddenBidIds])
  const myBidsVisibleCount = card.shown

  useEffect(() => {
    if (myBidsStartsOpen(role) || myBidsPrimaryCollapseAppliedRef.current) return
    setMyBidsSectionExpanded(false)
    myBidsPrimaryCollapseAppliedRef.current = true
  }, [role])

  useEffect(() => {
    // Matches the render gate below (v2.2634 — superintendent removed: the
    // extraction-era quirk had supers fetching bids that never displayed,
    // wasted queries on every super dashboard load).
    const hasBidsAccess =
      role === 'dev' ||
      role === 'master_technician' ||
      isAssistantLike(role) ||
      role === 'estimator' ||
      role === 'primary'
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
                'id, project_name, bid_due_date, bid_date_sent, outcome, customer_id, estimator_id, account_manager_id, created_at, working_board_archived_at, adopted_into_bid_id, service_type:service_types(name)'
              )
              .or(`estimator_id.eq.${uidForFilter},account_manager_id.eq.${uidForFilter}`)
              .or(MY_BIDS_NOT_LOST_FILTER)
              // What the Bid Board no longer lists is not listed here (punch list #426): an adopted bid, and an unsent one archived from the board.
              .is('adopted_into_bid_id', null)
              .or(MY_BIDS_ON_THE_BOARD_FILTER)
              // The limit cuts the oldest decided bids, never the newest due dates.
              .order(MY_BIDS_READ_ORDER[0].column, { ascending: MY_BIDS_READ_ORDER[0].ascending, nullsFirst: MY_BIDS_READ_ORDER[0].nullsFirst })
              .order(MY_BIDS_READ_ORDER[1].column, { ascending: MY_BIDS_READ_ORDER[1].ascending, nullsFirst: MY_BIDS_READ_ORDER[1].nullsFirst })
              .limit(MY_BIDS_DASHBOARD_ROW_LIMIT),
          'load dashboard my bids'
        )
        if (cancelled) return
        setReadCut(myBidsReadIsCut((rawRows ?? []).length))
        const baseRows = ((rawRows ?? []) as MyBidBaseRow[]).filter((r) => !isMyBidOffTheBoard(r))
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

  // The card draws while the person has any bid, hidden or not (punch list #426): with every bid hidden it
  // used to go, and its way back to them with it.
  const hasVisibleContent = myBidsLoading || myBids.length > 0
  useEffect(() => {
    onContentVisibleChange(hasVisibleContent)
  }, [hasVisibleContent, onContentVisibleChange])

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const rolePill = (kind: 'estimator' | 'account_manager'): CSSProperties => ({
    fontSize: '0.6875rem',
    fontWeight: 600,
    padding: '0.15rem 0.45rem',
    borderRadius: 4,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    background: kind === 'estimator' ? 'var(--bg-blue-200)' : 'var(--bg-violet-100)',
    border: kind === 'estimator' ? '1px solid #93c5fd' : '1px solid var(--border-violet)',
    color: kind === 'estimator' ? 'var(--text-blue-800)' : 'var(--text-violet-800)',
  })
  const wordPress: CSSProperties = {
    flexShrink: 0,
    minHeight: 44,
    padding: '0 0.8rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 6,
    background: 'var(--surface)',
    color: 'var(--text-700)',
    fontFamily: 'inherit',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
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
  const metaBold: CSSProperties = { fontWeight: 600 }

  /** One stream of someone else's notes inside the amber box: the bid's own notes, or the customer's. */
  const othersStream = (b: MyBidRow, stream: 'bid' | 'customer') => {
    const items: Array<MyBidOthersBidItem | MyBidOthersCustomerItem> = stream === 'bid' ? b.othersBidUpdates : b.othersCustomerUpdates
    const lim = myBidOthersVisibleLimits[b.id] ?? { bid: 1, customer: 1 }
    const total = items.length
    const limit = Math.min(Math.max(1, stream === 'bid' ? lim.bid : lim.customer), total)
    const adjust = (op: 'more' | 'all' | 'less') => adjustMyBidOthersLimit(b.id, stream, op, total)
    return (
      <div style={{ marginTop: stream === 'bid' ? '0.35rem' : '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>{stream === 'bid' ? 'Recent Bid Notes' : 'Recent Customer Notes'}</span>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {total > limit ? (
              <button type="button" onClick={() => adjust('more')} style={othersBtn}>
                Show more
              </button>
            ) : null}
            {total > limit && limit > 1 ? (
              <button type="button" onClick={() => adjust('all')} style={othersBtn}>
                Show all
              </button>
            ) : null}
            {limit > 1 ? (
              <button type="button" onClick={() => adjust('less')} style={othersBtn}>
                Show less
              </button>
            ) : null}
          </div>
        </div>
        {items.slice(0, limit).map((item, idx) => {
          const text = item.text
          const teaser = truncateMyBidNotePreview(text, 90) || 'No note text'
          const detailKey = `${stream === 'bid' ? 'bid' : 'cust'}:${item.id}`
          const isNoteOpen = myBidOthersNoteDetailsOpen.has(detailKey)
          const fullBody = text?.trim() ? text : 'No note text.'
          const contactDate = 'contactDate' in item ? item.contactDate : undefined
          return (
            <details
              key={item.id}
              open={isNoteOpen}
              onToggle={(e) => toggleMyBidOthersNoteDetails(detailKey, (e.currentTarget as HTMLDetailsElement).open)}
              style={{ marginTop: idx > 0 ? '0.5rem' : 0 }}
            >
              <summary style={{ cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-amber-900)', listStyle: 'none' }}>
                {isNoteOpen ? (
                  <span style={{ fontWeight: 400, whiteSpace: 'pre-wrap', display: 'block', maxHeight: 200, overflowY: 'auto', lineHeight: 1.45 }}>
                    <span style={metaBold}>({formatRelativeCompactAgo(item.createdAt)})</span> {fullBody} -{' '}
                    <span style={metaBold}>{item.authorLabel ?? 'Someone'}</span>
                    {' '}·{' '}
                    {formatMyBidPreviewDate(item.createdAt)}
                  </span>
                ) : (
                  <span style={{ fontWeight: 400 }}>
                    {teaser} -{' '}
                    <span style={metaBold}>
                      {item.authorLabel ?? 'Someone'} ({formatRelativeCompactAgo(item.createdAt)})
                    </span>
                  </span>
                )}
              </summary>
              {isNoteOpen && (item.contactMethod || contactDate) ? (
                <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#a16207' }}>
                  {item.contactMethod ? <span>Method: {item.contactMethod}</span> : null}
                  {item.contactMethod && contactDate ? ' · ' : null}
                  {contactDate ? <span>Contact: {formatMyBidPreviewDate(contactDate)}</span> : null}
                </div>
              ) : null}
            </details>
          )
        })}
      </div>
    )
  }

  /** The amber box under a bid with unread updates: someone else's notes since the last Mark read. */
  const unreadBox = (b: MyBidRow) => (
    <div
      role="region"
      aria-label={`Unread notes for ${b.project_name || 'bid'}`}
      style={{
        marginTop: '0.35rem',
        marginLeft: '0.5rem',
        padding: '0.35rem 0.5rem 0.6rem 1rem',
        background: 'var(--bg-amber-tint)',
        border: '1px solid var(--border-amber)',
        borderLeft: '3px solid #f59e0b',
        borderRadius: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>Unread updates</span>
        <button
          type="button"
          onClick={() => void markMyBidNotesReadAsViewed(b.id)}
          style={{ ...wordPress, border: '1px solid #d97706', color: 'var(--text-amber-900)', fontWeight: 500 }}
        >
          Mark read
        </button>
      </div>
      {b.unreadBidNotes && b.othersBidUpdates.length > 0 ? othersStream(b, 'bid') : null}
      {b.unreadCustomerNotes && b.othersCustomerUpdates.length > 0 ? othersStream(b, 'customer') : null}
    </div>
  )

  /**
   * One bid: a box whose edge says how soon it wants a look, the name across the full width, then when it is
   * due or was sent, with the role chips beside it. A press on the bid opens the bid's window (the owner's
   * pick of 2026-11-23, one press per bid), which has a door to every tab of it. The word press on the right
   * hides it, or shows it again.
   */
  const bidBox = (b: MyBidRow, mode: 'shown' | 'hidden') => {
    const when = myBidWhen(b)
    const name = b.project_name || 'Untitled'
    return (
      <li key={b.id} data-my-bid={b.id}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderLeft: `4px solid ${NEEDS_YOU_RAIL[mode === 'hidden' ? 'gray' : when.tone]}`,
            borderRadius: 8,
            padding: '0.65rem 0.875rem',
          }}
        >
          <button
            type="button"
            data-my-bid-open
            onClick={() => bidPreview?.openBidPreview(b.id)}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 44,
              display: 'grid',
              alignContent: 'center',
              gap: '0.3rem',
              margin: 0,
              padding: 0,
              border: 'none',
              background: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: 'var(--text-700)',
            }}
          >
            <span style={{ fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.3, overflowWrap: 'anywhere', color: mode === 'hidden' ? 'var(--text-700)' : 'var(--text-link)' }}>{name}</span>
            <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem 0.6rem', fontSize: '0.8125rem' }}>
              <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0 0.4rem', fontVariantNumeric: 'tabular-nums' }}>
                {mode === 'hidden' ? <span style={{ color: 'var(--text-muted)' }}>{MY_BID_STATE_WORDS[myBidState(b)]}</span> : null}
                {when.label ? <span style={{ color: 'var(--text-muted)' }}>{when.label}</span> : null}
                <WorkedOutValue>{when.value}</WorkedOutValue>
                {when.tail ? when.late && mode === 'shown' ? <WorkedOutValue tone="red">{when.tail}</WorkedOutValue> : <span style={{ color: 'var(--text-muted)' }}>{when.tail}</span> : null}
              </span>
              {card.showTrade && b.service_type_name ? <span style={{ color: 'var(--text-muted)' }}>{b.service_type_name}</span> : null}
              <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                {b.myBidRoles === 'estimator' || b.myBidRoles === 'both' ? <span style={rolePill('estimator')}>Estimator</span> : null}
                {b.myBidRoles === 'account_manager' || b.myBidRoles === 'both' ? <span style={rolePill('account_manager')}>Account Manager</span> : null}
              </span>
            </span>
          </button>
          {mode === 'shown' ? (
            <button type="button" onClick={() => hideBid(b.id)} aria-label={`Hide, ${name}`} style={wordPress}>
              Hide
            </button>
          ) : (
            <button type="button" onClick={() => unhideBid(b.id)} aria-label={`Show again, ${name}`} style={wordPress}>
              Show again
            </button>
          )}
        </div>
        {mode === 'shown' && myBidHasUnread(b) ? unreadBox(b) : null}
      </li>
    )
  }

  /** A group's heading: the fold, the state in the Bid Board's words, its count, and what in it wants a look. */
  const groupHead = (key: string, heading: string, count: number, label: string, gloss: string, flags: ReactNode) => {
    const open = openGroups.has(key)
    return (
      <h3 style={{ margin: 0 }}>
        <button
          type="button"
          onClick={() => toggleGroup(key)}
          aria-expanded={open}
          aria-label={label}
          data-my-bids-group={key}
          style={{
            width: '100%',
            minHeight: 44,
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr)',
            columnGap: '0.5rem',
            alignItems: 'center',
            margin: 0,
            padding: '0.4rem 0',
            border: 'none',
            background: 'none',
            textAlign: 'left',
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: 'var(--text-strong)',
          }}
        >
          <span aria-hidden style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {open ? '▼' : '▶'}
          </span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0 }}>
            <span style={{ fontSize: '0.9375rem', fontWeight: 700 }}>{heading}</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, padding: '0 0.45rem', borderRadius: 999, background: 'var(--bg-muted)', color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
            {flags}
          </span>
          {open ? <span style={{ gridColumn: 2, fontSize: '0.8125rem', fontWeight: 400, color: 'var(--text-muted)' }}>{gloss}</span> : null}
        </button>
      </h3>
    )
  }
  const bidList: CSSProperties = { listStyle: 'none', margin: 0, padding: '0 0 0.6rem', display: 'grid', gap: '0.5rem' }
  const groupLine = (first: boolean): CSSProperties => ({ borderTop: first ? 'none' : '1px solid var(--border)' })

  return (
    <>
      {(role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'estimator' || role === 'primary') && hasVisibleContent && (
        // Card frame (v2.2222): the primary's dashboard showed My Bids as a bare
        // heading between the Recent Reports and Assigned Jobs cards — same
        // frame as those two now (owner call).
        <div
          id="dash-bids"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--surface)',
            padding: myBidsSectionExpanded ? '0.85rem 1rem 0.5rem' : '0.85rem 1rem',
            marginBottom: '1rem',
            scrollMarginTop: 8,
          }}
        >
          {/* One heading at every width. A phone had no fold at all until the owner's
              ask of 2026-11-19, so a primary's 24 bids stood open there; New Bid
              stays beside the heading while the list is folded. */}
          <DashboardCardHead closed={!myBidsSectionExpanded} below="0.25rem" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
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
                minHeight: 44,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span aria-hidden>{myBidsSectionExpanded ? '▼' : '▶'}</span>
              <DashboardCardTitle>{myBidsLoading ? 'My Bids' : `My Bids (${myBidsVisibleCount})`}</DashboardCardTitle>
            </button>
            <Link
              to="/bids?new=true"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 44,
                padding: '0 0.85rem',
                background: '#2563eb',
                color: 'white',
                borderRadius: 6,
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              New Bid
            </Link>
          </DashboardCardHead>
          {myBidsSectionExpanded && (myBidsLoading ? (
            <MyBidsSectionSkeleton />
          ) : (
            <>
              {card.groups.map((g, i) => {
                const open = openGroups.has(g.state)
                // A folded group still draws a bid with unread updates: a note on a sent bid was never seen behind its link.
                const drawn = open ? g.bids : g.unread
                return (
                  <div key={g.state} style={groupLine(i === 0)}>
                    {groupHead(
                      g.state,
                      g.heading,
                      g.bids.length,
                      myBidGroupLabel(g),
                      g.gloss,
                      <>
                        {g.pastDue > 0 ? <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-red-700)' }}>{g.pastDue} past due</span> : null}
                        {g.unread.length > 0 ? <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-amber-800)' }}>{g.unread.length} unread</span> : null}
                      </>,
                    )}
                    {open && g.bids.length === 0 ? <EmptyState compact {...(card.shown > 0 ? MY_BIDS_UNSENT_EMPTY : MY_BIDS_ONLY_HIDDEN_EMPTY)} /> : null}
                    {drawn.length > 0 ? <ul style={bidList}>{drawn.map((b) => bidBox(b, 'shown'))}</ul> : null}
                  </div>
                )
              })}
              {card.hidden.length > 0 ? (
                <div style={groupLine(false)}>
                  {groupHead('hidden', MY_BIDS_HIDDEN_HEADING, card.hidden.length, `${MY_BIDS_HIDDEN_HEADING}, ${card.hidden.length} ${card.hidden.length === 1 ? 'bid' : 'bids'}`, MY_BIDS_HIDDEN_GLOSS, null)}
                  {openGroups.has('hidden') ? <ul style={bidList}>{card.hidden.map((b) => bidBox(b, 'hidden'))}</ul> : null}
                </div>
              ) : null}
              <div style={{ ...groupLine(false), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', minHeight: 44 }}>
                {readCut ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{MY_BIDS_CUT_WORDS}</span> : null}
                <Link
                  to="/bids?tab=bid-board"
                  style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  Bid Board ›
                </Link>
              </div>
            </>
          ))}
        </div>
      )}
    </>
  )
}
