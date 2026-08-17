import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'
import { useToastContext } from '../../contexts/ToastContext'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { useJobDetailOpenerBridge } from '../../contexts/JobDetailOpenerBridgeContext'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { fetchStreetViewImageBlob, fetchStreetViewMeta, googleStreetViewPanoUrl } from '../../lib/fetchStreetViewPreview'
import { postJobThreadNoteBody } from '../../lib/jobs/postJobThreadNote'
import {
  JOB_FOLLOWUP_STAGES,
  JOB_FOLLOWUP_STAGE_LABELS,
  computeJobFollowupQueue,
  dropDeletedFollowupCandidates,
  jobFollowupQuietSeverity,
  jobFollowupReviewActionLabel,
  jobFollowupStageCounts,
  type JobFollowupCandidate,
  type JobFollowupReview,
  type JobFollowupSettings,
  type JobFollowupStage,
} from '../../lib/jobs/jobFollowupQueue'
import {
  fetchJobFollowupCandidates,
  fetchJobFollowupJobLabels,
  fetchJobFollowupReviewerNames,
  fetchJobFollowupReviews,
  fetchJobFollowupSettings,
  recordJobFollowupReview,
  saveJobFollowupSettings,
} from '../../lib/jobs/jobFollowupStore'

/**
 * Job Follow-Up Mode (v2.1718): the office reviews quiet jobs one card at a
 * time — leave a note (Enter posts to the job's real activity thread and
 * advances), stamp "Looks fine", or snooze. The queue is computed by the
 * pure kernel in jobFollowupQueue.ts; review periods are org-wide settings
 * edited from the ⚙ in the header (RLS lets Master/dev write them).
 */

/**
 * Above the nav chrome (50), BELOW the page's modal band (confirm modals 60,
 * popovers 120, Job window 1010, …) — the deck is a page-level takeover, and
 * every modal an embedded Pipeline row action opens must float over it
 * (v2.1739; at the old 1040 the Job window opened invisibly underneath).
 */
const DECK_Z = 58
const DAY_MS = 86400000

type ThreadNoteTail = { id: string; body: string; created_at: string; author: { name: string | null } | null }

function fmtAgo(iso: string, todayYmd: string): string {
  const days = Math.max(0, Math.floor((Date.parse(`${todayYmd}T00:00:00Z`) - new Date(iso).getTime()) / DAY_MS))
  return days === 0 ? 'today' : `${days}d ago`
}

function usd(v: number): string {
  return `$${Math.round(v).toLocaleString()}`
}

function chipStyle(bg: string, fg: string): React.CSSProperties {
  return { fontSize: '0.72rem', fontWeight: 700, borderRadius: 999, padding: '0.16rem 0.6rem', background: bg, color: fg, whiteSpace: 'nowrap' }
}

/** Board section names for the Pipeline-row chip (v2.1740) — 'Billed Awaiting Payment' is the canonical section title. */
const BOARD_STAGE_LABELS: Record<JobFollowupStage, string> = {
  waiting: 'Waiting',
  working: 'Working',
  ready_to_bill: 'Ready to Bill',
  billed: 'Billed Awaiting Payment',
  collections: 'Collections',
}

/** One Bill-tab line item, precomputed by JobsStagesTab from the job's fixtures (v2.1744). */
export type JobsFollowupLineItem = { name: string; count: number; unitPrice: number | null }

/** What JobsStagesTab's renderStageRow hands back: the row, which board section it drew, and the bill detail. */
export type JobsFollowupStageRowResult = {
  node: React.ReactNode
  stage: JobFollowupStage
  /** Named Bill-tab rows in sequence order; totals follow revenueDollarsFromFixtures. */
  lineItems: JobsFollowupLineItem[]
  jobTotalDollars: number
  bidDollars: number
}

const STAGE_CHIP: Record<JobFollowupStage, React.CSSProperties> = {
  waiting: chipStyle('var(--bg-slate-100)', 'var(--text-slate-500)'),
  working: chipStyle('#dbeafe', '#1d4ed8'),
  ready_to_bill: chipStyle('var(--bg-amber-100)', 'var(--text-amber-800)'),
  billed: chipStyle('#fee2e2', '#b91c1c'),
  collections: chipStyle('#fee2e2', '#b91c1c'),
}

/** Whole dollars like the rest of the card, cents only when the value has them. */
function lineMoney(v: number): string {
  return v % 1 !== 0
    ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : usd(v)
}

/** Option C (v2.1744): the Bill tab's line items + Job total as a footer inside the Pipeline row block. */
function DeckLineItemsPanel({ lineItems, jobTotalDollars, bidDollars, onOpenBill }: {
  lineItems: JobsFollowupLineItem[]
  jobTotalDollars: number
  bidDollars: number
  onOpenBill: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const CAP = 6
  const shown = expanded ? lineItems : lineItems.slice(0, CAP)
  const hidden = lineItems.length - shown.length
  const delta = Math.round((bidDollars - jobTotalDollars) * 100) / 100
  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.16rem 0', fontSize: '0.84rem' }
  return (
    <div style={{ marginTop: '0.55rem', border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.85rem 0.7rem', background: 'var(--bg-subtle)' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-slate-500)', marginBottom: '0.3rem' }}>Line items</div>
      {lineItems.length === 0 ? (
        <div style={{ fontSize: '0.84rem', color: 'var(--text-slate-500)' }}>
          None yet — the Bill tab is empty.{' '}
          <button type="button" onClick={onOpenBill} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit' }}>
            Add line items ↗
          </button>
        </div>
      ) : (
        <>
          {shown.map((li, i) => {
            // Same qty rule as revenueDollarsFromFixtures: a 0/blank count bills as 1.
            const qty = Number.isFinite(li.count) && li.count > 0 ? li.count : 1
            return (
              <div key={i} style={rowStyle}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {li.name}{' '}
                  <span style={{ color: 'var(--text-slate-500)' }}>· {qty} × {li.unitPrice != null ? lineMoney(li.unitPrice) : '—'}</span>
                </span>
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{li.unitPrice != null ? lineMoney(qty * li.unitPrice) : '—'}</span>
              </div>
            )
          })}
          {hidden > 0 ? (
            <button type="button" onClick={() => setExpanded(true)} style={{ border: 'none', background: 'none', padding: '0.16rem 0', color: 'var(--text-link)', cursor: 'pointer', fontSize: '0.8rem' }}>
              +{hidden} more…
            </button>
          ) : null}
          <div style={{ ...rowStyle, borderTop: '1px solid var(--border)', marginTop: '0.28rem', paddingTop: '0.4rem', fontWeight: 800 }}>
            <span>Job total</span>
            <span>{lineMoney(jobTotalDollars)}</span>
          </div>
          {bidDollars > 0 && Math.abs(delta) >= 1 ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-amber-800)', textAlign: 'right', marginTop: '0.12rem' }}>
              {delta > 0 ? `Bid is ${usd(bidDollars)} — ${usd(delta)} not itemized` : `Line items exceed the bid by ${usd(-delta)}`}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function SettingsStepper({ label, desc, value, onChange }: { label: string; desc: string; value: number; onChange: (v: number) => void }) {
  const isNarrow = useIsNarrowScreen()
  const btn: React.CSSProperties = { border: 'none', background: 'var(--bg-slate-100)', color: 'var(--text-slate-600)', fontWeight: 800, width: isNarrow ? 34 : 28, height: isNarrow ? 34 : 28, cursor: 'pointer' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ minWidth: isNarrow ? 0 : '11rem', flex: isNarrow ? 1 : '0 0 auto', fontWeight: 600, fontSize: '0.84rem' }}>{label}</span>
      {isNarrow ? null : <span style={{ flex: 1, color: 'var(--text-slate-500)', fontSize: '0.74rem' }}>{desc}</span>}
      <span style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden' }}>
        <button type="button" aria-label={`Decrease ${label}`} style={btn} onClick={() => onChange(Math.max(1, value - 1))}>−</button>
        <span style={{ minWidth: '4.2rem', textAlign: 'center', fontWeight: 700, fontSize: '0.8rem' }}>{value} day{value === 1 ? '' : 's'}</span>
        <button type="button" aria-label={`Increase ${label}`} style={btn} onClick={() => onChange(Math.min(60, value + 1))}>+</button>
      </span>
    </div>
  )
}

export function JobsFollowupModal({ open, onClose, renderStageRow, onOpenBoardRow, onOpenActivity, activityExpandOpen, liveJobIds }: {
  open: boolean
  onClose: () => void
  /** Renders the job's full Pipeline row (v2.1739) — provided by JobsStagesTab, which owns the section renderers. */
  renderStageRow?: (jobId: string) => JobsFollowupStageRowResult | null
  /** Clicking the row's label closes the deck and scrolls to + flashes the row on the Pipeline board (v2.1742). */
  onOpenBoardRow?: (jobId: string, stage: JobFollowupStage) => void
  /** Clicking the Latest-activity box opens the full-screen Job activity modal above the deck (v2.1753). */
  onOpenActivity?: (jobId: string) => void
  /** True while that activity modal is on top — Esc belongs to it, not the deck. */
  activityExpandOpen?: boolean
  /** The tab's live jobs_ledger ids — a card whose job vanishes (deleted) drops from the deck (v2.1756). */
  liveJobIds?: ReadonlySet<string>
}) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  // The Job window renders at z 1010, below the deck (z 1040) — so while it's
  // open the deck hides itself (state intact) instead of burying the window.
  const jobDetailModal = useJobDetailModal()
  const jobWindowOpen = jobDetailModal?.isOpen ?? false
  /** For "Add line items ↗" — opens the Job window straight on its Bill tab (v2.1744). */
  const jobWindowBridge = useJobDetailOpenerBridge()
  /** Mobile polish (v2.1730): safe-area padding, one-row chip rail, stacked actions. */
  const isNarrow = useIsNarrowScreen()

  const [loading, setLoading] = useState(true)
  const [candidates, setCandidates] = useState<JobFollowupCandidate[]>([])
  const [reviews, setReviews] = useState<JobFollowupReview[]>([])
  const [settings, setSettings] = useState<JobFollowupSettings | null>(null)
  const [stageFilter, setStageFilter] = useState<JobFollowupStage | 'all'>('all')
  const [noteDraft, setNoteDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [snoozeOpen, setSnoozeOpen] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement | null>(null)

  const todayYmd = useMemo(() => calendarYmdInAppTzFromIso(new Date().toISOString()), [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setReviewedCount(0)
    void (async () => {
      try {
        const [cands, revs, sets] = await Promise.all([
          fetchJobFollowupCandidates(todayYmd),
          fetchJobFollowupReviews(),
          fetchJobFollowupSettings(),
        ])
        if (cancelled) return
        setCandidates(cands)
        setReviews(revs)
        setSettings(sets)
      } catch (e) {
        if (!cancelled) showToast(e instanceof Error ? e.message : 'Failed to load follow-ups', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, todayYmd, showToast])

  // A job deleted while the deck is open (Job window Edit tab, migrate-to-bid,
  // even another user) leaves the tab's jobs list — drop its card instead of
  // stranding a stale card whose every action errors "Job not found" (v2.1756).
  useEffect(() => {
    if (!liveJobIds) return
    setCandidates((prev) => dropDeletedFollowupCandidates(prev, liveJobIds))
  }, [liveJobIds])

  const fullQueue = useMemo(
    () => (settings ? computeJobFollowupQueue(candidates, reviews, settings, todayYmd) : []),
    [candidates, reviews, settings, todayYmd],
  )
  const counts = useMemo(() => jobFollowupStageCounts(fullQueue), [fullQueue])
  const queue = useMemo(
    () => (stageFilter === 'all' ? fullQueue : fullQueue.filter((e) => e.job.stage === stageFilter)),
    [fullQueue, stageFilter],
  )
  // Queue list view (v2.1721): a row's "Review →" pins its job so the deck
  // deals from there; once the job leaves the queue, the pin clears and the
  // deck resumes stalest-first.
  const [viewMode, setViewMode] = useState<'deck' | 'list' | 'history'>('deck')
  // History view (v2.1722): reviewer display names + labels for reviewed jobs
  // that have since left the open stages. Loaded when History first opens.
  const [reviewerNames, setReviewerNames] = useState<Record<string, string>>({})
  const [closedJobLabels, setClosedJobLabels] = useState<Record<string, string>>({})
  useEffect(() => {
    if (viewMode !== 'history' || reviews.length === 0) return
    let cancelled = false
    const reviewerIds = [...new Set(reviews.map((r) => r.reviewedBy).filter((v): v is string => v != null))]
    const candidateIds = new Set(candidates.map((c) => c.id))
    const missingJobIds = [...new Set(reviews.map((r) => r.jobId).filter((id) => !candidateIds.has(id)))]
    void (async () => {
      const [names, labels] = await Promise.all([
        fetchJobFollowupReviewerNames(reviewerIds),
        fetchJobFollowupJobLabels(missingJobIds),
      ])
      if (cancelled) return
      setReviewerNames(names)
      setClosedJobLabels(labels)
    })()
    return () => {
      cancelled = true
    }
  }, [viewMode, reviews, candidates])
  const [pinnedJobId, setPinnedJobId] = useState<string | null>(null)
  const pinnedEntry = pinnedJobId ? queue.find((e) => e.job.id === pinnedJobId) ?? null : null
  useEffect(() => {
    if (pinnedJobId && !pinnedEntry) setPinnedJobId(null)
  }, [pinnedJobId, pinnedEntry])
  const current = pinnedEntry ?? queue[0] ?? null

  // Street view + activity tail for the top card.
  const [svUrl, setSvUrl] = useState<string | null>(null)
  const [svPano, setSvPano] = useState<string | null>(null)
  const [tail, setTail] = useState<ThreadNoteTail[]>([])
  useEffect(() => {
    setSvUrl(null)
    setSvPano(null)
    setTail([])
    setNoteDraft('')
    setSnoozeOpen(false)
    if (!current) return
    let cancelled = false
    let objectUrl: string | null = null
    void (async () => {
      try {
        // Meta first (v2.1719): null means Google has no imagery for the
        // address — fetching the image anyway returns a gray "location could
        // not be found" tile, so skip the banner and keep the address line.
        const meta = await fetchStreetViewMeta(current.job.address)
        if (cancelled || !meta) return
        setSvPano(googleStreetViewPanoUrl(meta.lat, meta.lng))
        const blob = await fetchStreetViewImageBlob(current.job.address)
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSvUrl(objectUrl)
      } catch {
        /* no imagery — the address line still shows */
      }
    })()
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('jobs_ledger_thread_notes')
              .select('id, body, created_at, author:users!jobs_ledger_thread_notes_author_user_id_fkey(name)')
              .eq('job_id', current.job.id)
              .order('created_at', { ascending: false })
              .limit(3),
          'followup note tail',
        )
        if (!cancelled) setTail((data ?? []) as unknown as ThreadNoteTail[])
      } catch {
        /* tail is optional */
      }
    })()
    noteRef.current?.focus()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [current?.job.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      // While the Job window or the activity modal is on top, Esc belongs to it — not the deck.
      if (e.key === 'Escape' && !settingsOpen && !jobWindowOpen && !activityExpandOpen) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, settingsOpen, jobWindowOpen, activityExpandOpen])

  const advanceWithReview = useCallback(
    async (snoozedUntil: string | null) => {
      if (!current || busy) return
      setBusy(true)
      try {
        await recordJobFollowupReview(current.job.id, user?.id ?? null, snoozedUntil)
        setReviews((prev) => [
          ...prev,
          { jobId: current.job.id, reviewedAt: new Date().toISOString(), snoozedUntil, reviewedBy: user?.id ?? null },
        ])
        setReviewedCount((n) => n + 1)
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Failed to save review', 'error')
      } finally {
        setBusy(false)
      }
    },
    [current, busy, user, showToast],
  )

  const postAndNext = useCallback(async () => {
    if (!current || busy) return
    const body = noteDraft.trim()
    if (!body || !user?.id) return
    setBusy(true)
    const ok = await postJobThreadNoteBody(current.job.id, user.id, body)
    setBusy(false)
    if (!ok) {
      showToast('Failed to post the note', 'error')
      return
    }
    // The note IS the activity — patch it locally so the job leaves the queue.
    const nowIso = new Date().toISOString()
    setCandidates((prev) => prev.map((c) => (c.id === current.job.id ? { ...c, latestActivityAt: nowIso } : c)))
    setReviewedCount((n) => n + 1)
  }, [current, busy, noteDraft, user, showToast])

  const snoozeTo = useCallback(
    (days: number) => {
      const until = new Date(Date.parse(`${todayYmd}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
      void advanceWithReview(until)
    },
    [advanceWithReview, todayYmd],
  )

  const updateSetting = useCallback(
    (patch: Partial<JobFollowupSettings>) => {
      setSettings((prev) => {
        if (!prev) return prev
        const next = { ...prev, ...patch }
        void saveJobFollowupSettings(next, user?.id ?? null).catch(() =>
          showToast('Could not save — only Master and dev can change review periods.', 'error'),
        )
        return next
      })
    },
    [user, showToast],
  )

  if (!open) return null

  const filterChip = (key: JobFollowupStage | 'all', label: string): React.ReactNode => (
    <button
      key={key}
      type="button"
      aria-pressed={stageFilter === key}
      onClick={() => setStageFilter(key)}
      style={{
        fontSize: '0.74rem',
        fontWeight: stageFilter === key ? 700 : 500,
        padding: '0.24rem 0.65rem',
        borderRadius: 999,
        border: `1px solid ${stageFilter === key ? '#2563eb' : 'var(--border-strong)'}`,
        background: stageFilter === key ? '#2563eb' : 'var(--surface)',
        color: stageFilter === key ? '#fff' : 'var(--text-slate-600)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Job follow-ups"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: DECK_Z,
        display: jobWindowOpen ? 'none' : undefined,
        background: 'var(--bg-slate-tint)',
        overflowY: 'auto',
        // Safe-area padding keeps the header out from under the phone's status bar;
        // the extra bottom clears the Dispatch Mode tab bar (z 1000, above the deck since v2.1739).
        padding: `calc(${isNarrow ? '0.5rem' : '1.2rem'} + env(safe-area-inset-top, 0px)) ${isNarrow ? '0.6rem' : '1rem'} calc(6rem + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      {/* Deck cards widen when the Pipeline row rides along (its table wants ~760px). */}
      <div style={{ maxWidth: renderStageRow && !isNarrow && viewMode === 'deck' ? 920 : 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.45rem' }}>
          <span style={{ fontWeight: 800, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
            {loading ? 'Loading follow-ups…' : queue.length > 0 ? `${queue.length} to review` : 'Follow-ups'}
          </span>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
            aria-label="Review periods"
            style={{ marginLeft: 'auto', fontSize: '0.74rem', padding: '0.24rem 0.65rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-slate-600)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {isNarrow ? '⚙' : '⚙ Review periods'}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close follow-ups"
            style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-slate-600)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {isNarrow ? '✕' : 'Esc · Close'}
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            marginBottom: '0.7rem',
            // One scrollable rail on phones instead of a three-row chip pile.
            flexWrap: isNarrow ? 'nowrap' : 'wrap',
            overflowX: isNarrow ? 'auto' : 'visible',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: isNarrow ? '0.2rem' : 0,
          }}
        >
          {filterChip('all', `All (${fullQueue.length})`)}
          {JOB_FOLLOWUP_STAGES.filter((s) => counts[s] > 0).map((s) => filterChip(s, `${JOB_FOLLOWUP_STAGE_LABELS[s]} (${counts[s]})`))}
          <span role="group" aria-label="Follow-ups view" style={{ display: 'inline-flex', flexShrink: 0, borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border-strong)', marginLeft: '0.2rem' }}>
            {(['deck', 'list', 'history'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={viewMode === m}
                onClick={() => setViewMode(m)}
                style={{
                  fontSize: '0.74rem',
                  fontWeight: viewMode === m ? 700 : 500,
                  padding: '0.24rem 0.65rem',
                  border: 'none',
                  background: viewMode === m ? 'var(--text-slate-600)' : 'var(--surface)',
                  color: viewMode === m ? 'var(--surface)' : 'var(--text-slate-600)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {m === 'deck' ? 'Deck' : m === 'list' ? 'List' : 'History'}
              </button>
            ))}
          </span>
        </div>

        {settingsOpen && settings ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.8rem 1rem', marginBottom: '0.8rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.3rem' }}>Review periods</div>
            <SettingsStepper label="Working" desc="quiet longer than…" value={settings.workingDays} onChange={(v) => updateSetting({ workingDays: v })} />
            <SettingsStepper label="Waiting" desc="nothing scheduled for…" value={settings.waitingDays} onChange={(v) => updateSetting({ waitingDays: v })} />
            <SettingsStepper label="Ready to Bill" desc="invoice not sent for…" value={settings.readyToBillDays} onChange={(v) => updateSetting({ readyToBillDays: v })} />
            <SettingsStepper label="Billed Awaiting Payment" desc="no nudge for…" value={settings.billedDays} onChange={(v) => updateSetting({ billedDays: v })} />
            <SettingsStepper label="Collections" desc="no activity for…" value={settings.collectionsDays} onChange={(v) => updateSetting({ collectionsDays: v })} />
            <SettingsStepper label={'"Looks fine" rests a job for'} desc="" value={settings.restDays} onChange={(v) => updateSetting({ restDays: v })} />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-slate-400)', paddingTop: '0.5rem' }}>
              Org-wide · editable by Master & dev · takes effect immediately
            </div>
          </div>
        ) : null}

        {!loading && viewMode === 'list' && queue.length > 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.6rem 1rem 0.8rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', padding: '0.3rem 0 0.4rem' }}>
              {queue.length} job{queue.length === 1 ? '' : 's'} · quietest first
            </div>
            {queue.map((e) => {
              const severity = jobFollowupQuietSeverity(e.quietDays)
              const badge =
                severity === 'red'
                  ? { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' }
                  : severity === 'amber'
                    ? { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
                    : { background: 'var(--bg-slate-100)', color: 'var(--text-slate-600)' }
              return (
                <div
                  key={e.job.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.45rem 0.1rem', borderTop: '1px solid var(--border)', fontSize: '0.84rem' }}
                >
                  <span style={{ ...badge, minWidth: '3rem', textAlign: 'center', fontWeight: 800, fontSize: '0.72rem', borderRadius: 999, padding: '0.16rem 0', flexShrink: 0 }}>
                    {e.quietDays}d
                  </span>
                  <span style={{ minWidth: 0, flex: '1 1 240px' }}>
                    <span style={{ fontWeight: 700 }}>
                      {e.job.hcpNumber ? `${e.job.hcpNumber} · ` : ''}
                      {e.job.jobName}
                    </span>
                    <span style={{ display: 'block', color: 'var(--text-slate-500)', fontSize: '0.76rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.job.address ? `${e.job.address} · ` : ''}
                      {e.reason}
                    </span>
                  </span>
                  <span style={{ ...STAGE_CHIP[e.job.stage], flexShrink: 0 }}>{JOB_FOLLOWUP_STAGE_LABELS[e.job.stage]}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPinnedJobId(e.job.id)
                      setViewMode('deck')
                    }}
                    style={{ flexShrink: 0, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-slate-600)', borderRadius: 7, fontSize: '0.74rem', fontWeight: 700, padding: '0.3rem 0.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Review →
                  </button>
                </div>
              )
            })}
          </div>
        ) : null}

        {!loading && viewMode === 'deck' && current ? (
          <div style={{ position: 'relative' }}>
            {queue.length > 2 ? (
              <div style={{ position: 'absolute', inset: '20px -14px auto -14px', height: '96%', background: 'var(--surface)', opacity: 0.35, borderRadius: 14, border: '1px solid var(--border)', transform: 'rotate(-0.8deg)' }} />
            ) : null}
            {queue.length > 1 ? (
              <div style={{ position: 'absolute', inset: '10px -8px auto -8px', height: '96%', background: 'var(--surface)', opacity: 0.55, borderRadius: 14, border: '1px solid var(--border)', transform: 'rotate(0.6deg)' }} />
            ) : null}

            <div style={{ position: 'relative', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 12px 32px rgba(15,18,24,0.12)', padding: isNarrow ? '0.8rem 0.85rem 0.9rem' : '1rem 1.2rem 1.1rem' }}>
              {isNarrow ? (
                <>
                  {/* Phones: chips share the badge row so the wrapping title can't push them down. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <span style={{ background: '#f59e0b', color: '#fff', fontWeight: 800, fontSize: '0.72rem', borderRadius: 6, padding: '0.2rem 0.5rem' }}>{current.job.hcpNumber}</span>
                    <span style={STAGE_CHIP[current.job.stage]}>{JOB_FOLLOWUP_STAGE_LABELS[current.job.stage]}</span>
                    <span style={{ ...chipStyle('var(--bg-amber-100)', 'var(--text-amber-800)'), marginLeft: 'auto' }}>
                      quiet {current.quietDays} day{current.quietDays === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: '0.4rem' }}>{current.job.jobName}</div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                  <span style={{ background: '#f59e0b', color: '#fff', fontWeight: 800, fontSize: '0.72rem', borderRadius: 6, padding: '0.2rem 0.5rem' }}>{current.job.hcpNumber}</span>
                  <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>{current.job.jobName}</span>
                  <span style={STAGE_CHIP[current.job.stage]}>{JOB_FOLLOWUP_STAGE_LABELS[current.job.stage]}</span>
                  <span style={{ ...chipStyle('var(--bg-amber-100)', 'var(--text-amber-800)'), marginLeft: 'auto' }}>
                    quiet {current.quietDays} day{current.quietDays === 1 ? '' : 's'}
                  </span>
                </div>
              )}

              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', margin: '0.6rem 0 0.65rem', border: '1px solid var(--border)', minHeight: svUrl ? undefined : 0 }}>
                {svUrl ? (
                  <a href={svPano ?? undefined} target="_blank" rel="noreferrer" style={{ display: 'block', cursor: svPano ? 'pointer' : 'default' }}>
                    <img src={svUrl} alt={`Street View near ${current.job.address}`} style={{ width: '100%', maxHeight: isNarrow ? 145 : 190, objectFit: 'cover', display: 'block' }} />
                    <span style={{ position: 'absolute', left: 10, bottom: 10, background: 'rgba(17,24,39,0.74)', color: '#fff', fontSize: '0.76rem', fontWeight: 600, padding: '0.28rem 0.65rem', borderRadius: 7 }}>
                      📍 {current.job.address}
                    </span>
                  </a>
                ) : (
                  <div style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-slate-600)' }}>📍 {current.job.address}</div>
                )}
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber-soft)', borderRadius: 8, padding: '0.35rem 0.6rem', marginBottom: '0.6rem' }}>
                Why it's here: {current.reason}
              </div>

              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.7rem', alignItems: 'center' }}>
                {current.job.customerName ? <span style={{ fontSize: '0.8rem', color: 'var(--text-slate-600)' }}>Customer <b>{current.job.customerName}</b></span> : null}
                {current.job.paymentsMade != null && current.job.paymentsMade > 0 ? <span style={chipStyle('#dcfce7', '#166534')}>Paid {usd(current.job.paymentsMade)}</span> : null}
                {current.job.revenue != null && current.job.revenue > 0 ? (
                  <span style={chipStyle('var(--bg-slate-100)', 'var(--text-slate-600)')}>Bid {usd(current.job.revenue)}</span>
                ) : (
                  <span style={chipStyle('#fee2e2', '#b91c1c')}>no bid value</span>
                )}
                {current.job.pctComplete != null ? <span style={chipStyle('#dbeafe', '#1d4ed8')}>{current.job.pctComplete}% done</span> : null}
              </div>

              {tail.length > 0 ? (
                <div
                  role={onOpenActivity ? 'button' : undefined}
                  tabIndex={onOpenActivity ? 0 : undefined}
                  aria-label={onOpenActivity ? 'Open full job activity' : undefined}
                  onClick={onOpenActivity ? () => onOpenActivity(current.job.id) : undefined}
                  onKeyDown={
                    onOpenActivity
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onOpenActivity(current.job.id)
                          }
                        }
                      : undefined
                  }
                  style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.5rem 0.7rem', marginBottom: '0.7rem', background: 'var(--bg-slate-tint)', cursor: onOpenActivity ? 'pointer' : undefined }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-slate-500)' }}>Latest activity</span>
                    {onOpenActivity ? <span aria-hidden="true" style={{ color: 'var(--text-slate-500)', fontSize: '0.78rem', lineHeight: 1 }}>↗</span> : null}
                  </div>
                  {tail.map((n) => (
                    <div key={n.id} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.78rem', padding: '0.14rem 0' }}>
                      <span style={{ color: 'var(--text-slate-500)', whiteSpace: 'nowrap' }}>
                        {fmtAgo(n.created_at, todayYmd)} {n.author?.name ?? ''}
                      </span>
                      <span style={{ minWidth: 0 }}>{n.body}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <textarea
                ref={noteRef}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void postAndNext()
                  }
                }}
                placeholder="Leave a note for this job — Enter posts it and moves on…"
                rows={2}
                style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', border: '2px solid #93c5fd', borderRadius: 10, padding: '0.55rem 0.8rem', fontSize: '0.86rem', fontFamily: 'inherit', background: 'var(--surface)', color: 'inherit', marginBottom: '0.7rem' }}
              />

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => void postAndNext()}
                  disabled={busy || noteDraft.trim() === ''}
                  style={{
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    padding: '0.6rem 0.9rem',
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    cursor: 'pointer',
                    opacity: busy || noteDraft.trim() === '' ? 0.6 : 1,
                    // Phones: the primary action gets the whole first row (thumb-sized).
                    flex: isNarrow ? '1 1 100%' : '0 0 auto',
                  }}
                >
                  Post & next ⏎
                </button>
                <button
                  type="button"
                  onClick={() => void advanceWithReview(null)}
                  disabled={busy}
                  style={{ borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', padding: '0.6rem 0.9rem', border: '1px solid var(--border-green)', background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', cursor: 'pointer', flex: isNarrow ? 1 : '0 0 auto', whiteSpace: 'nowrap' }}
                >
                  ✓ Looks fine
                </button>
                <span style={{ position: 'relative', flex: isNarrow ? 1 : '0 0 auto', display: 'flex' }}>
                  <button
                    type="button"
                    onClick={() => setSnoozeOpen((v) => !v)}
                    disabled={busy}
                    aria-expanded={snoozeOpen}
                    style={{ borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', padding: '0.6rem 0.9rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-slate-600)', cursor: 'pointer', flex: 1, whiteSpace: 'nowrap' }}
                  >
                    Snooze ▾
                  </button>
                  {snoozeOpen ? (
                    <span style={{ position: 'absolute', bottom: '110%', left: 0, zIndex: 5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 20px rgba(15,18,24,0.15)', display: 'flex', flexDirection: 'column', minWidth: '7rem' }}>
                      <button type="button" onClick={() => snoozeTo(3)} style={{ border: 'none', background: 'none', color: 'inherit', padding: '0.55rem 0.8rem', textAlign: 'left', fontSize: '0.8rem', cursor: 'pointer' }}>3 days</button>
                      <button type="button" onClick={() => snoozeTo(7)} style={{ border: 'none', background: 'none', color: 'inherit', padding: '0.55rem 0.8rem', textAlign: 'left', fontSize: '0.8rem', cursor: 'pointer' }}>1 week</button>
                      <button type="button" onClick={() => snoozeTo(14)} style={{ border: 'none', background: 'none', color: 'inherit', padding: '0.55rem 0.8rem', textAlign: 'left', fontSize: '0.8rem', cursor: 'pointer' }}>2 weeks</button>
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (!current) return
                    if (jobDetailModal) jobDetailModal.openJobDetail({ jobId: current.job.id })
                    else showToast('Open the Jobs page to view the full job window.', 'error')
                  }}
                  style={{ marginLeft: isNarrow ? 0 : 'auto', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', padding: '0.6rem 0.9rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer', flex: isNarrow ? 1 : '0 0 auto', whiteSpace: 'nowrap' }}
                >
                  Open job ↗
                </button>
              </div>
              {renderStageRow ? (() => {
                const row = renderStageRow(current.job.id)
                return row ? (
                  <div style={{ marginTop: '0.85rem', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
                    <button
                      type="button"
                      onClick={onOpenBoardRow ? () => onOpenBoardRow(current.job.id, row.stage) : undefined}
                      disabled={!onOpenBoardRow}
                      title="Show this row on the Pipeline board"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', border: 'none', background: 'none', cursor: onOpenBoardRow ? 'pointer' : 'default', padding: 0, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-slate-500)', marginBottom: '0.35rem' }}
                    >
                      Pipeline row
                      {/* The board's truth, not the card chip's — a Collections job says 'Billed' up top but Collections here. */}
                      <span style={{ ...STAGE_CHIP[row.stage], textTransform: 'none', letterSpacing: 0 }}>{BOARD_STAGE_LABELS[row.stage]}</span>
                      {onOpenBoardRow ? <span aria-hidden style={{ textTransform: 'none', letterSpacing: 0 }}>↗</span> : null}
                    </button>
                    <div style={{ overflowX: 'auto' }}>{row.node}</div>
                    <DeckLineItemsPanel
                      key={current.job.id}
                      lineItems={row.lineItems}
                      jobTotalDollars={row.jobTotalDollars}
                      bidDollars={row.bidDollars}
                      onOpenBill={() => {
                        if (!jobWindowBridge?.requestOpenJobWindowEdit(current.job.id, { initialTab: 'bill' })) {
                          jobDetailModal?.openJobDetail({ jobId: current.job.id })
                        }
                      }}
                    />
                  </div>
                ) : null
              })() : null}
            </div>
          </div>
        ) : null}

        {!loading && viewMode === 'history' ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: isNarrow ? '0.8rem 0.85rem 0.9rem' : '0.9rem 1.2rem 1.1rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.4rem' }}>
              Review history · {reviews.length.toLocaleString()} review{reviews.length === 1 ? '' : 's'}
            </div>
            {reviews.length === 0 ? (
              <div style={{ fontSize: '0.84rem', color: 'var(--text-slate-500)' }}>
                No reviews yet — they'll appear here as the office works the deck. (Notes posted from cards live on
                each job's activity thread.)
              </div>
            ) : (
              <>
                {[...reviews]
                  .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
                  .slice(0, 200)
                  .map((r, i) => {
                    const cand = candidates.find((c) => c.id === r.jobId)
                    const jobLabel = cand ? `${cand.hcpNumber} · ${cand.jobName}` : closedJobLabels[r.jobId] ?? 'Job'
                    const who = (r.reviewedBy && reviewerNames[r.reviewedBy]) || '—'
                    const action = jobFollowupReviewActionLabel(r.snoozedUntil)
                    const isFine = r.snoozedUntil == null
                    return (
                      <div
                        key={`${r.jobId}-${r.reviewedAt}-${i}`}
                        // Phones: time · name · chip on line one, the job on its own line.
                        style={{ display: 'flex', flexWrap: isNarrow ? 'wrap' : 'nowrap', alignItems: 'baseline', gap: isNarrow ? '0.2rem 0.7rem' : '0.7rem', fontSize: '0.82rem', padding: '0.3rem 0', borderBottom: '1px solid var(--border)' }}
                      >
                        <span style={{ minWidth: isNarrow ? '5.8rem' : '9.5rem', color: 'var(--text-slate-500)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {new Date(r.reviewedAt).toLocaleString('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </span>
                        <span style={{ minWidth: isNarrow ? '3.5rem' : '7rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{who}</span>
                        <span style={{ flex: isNarrow ? '1 1 100%' : 1, order: isNarrow ? 5 : undefined, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isNarrow ? 'var(--text-slate-600)' : undefined }}>
                          {jobLabel}
                        </span>
                        <span style={{ ...(isFine ? chipStyle('var(--bg-green-tint)', 'var(--text-green-800)') : chipStyle('var(--bg-slate-100)', 'var(--text-slate-600)')), marginLeft: isNarrow ? 'auto' : undefined }}>
                          {action}
                        </span>
                      </div>
                    )
                  })}
                {reviews.length > 200 ? (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-slate-400)', paddingTop: '0.5rem' }}>
                    Showing the 200 most recent.
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {!loading && viewMode !== 'history' && queue.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '2rem 1.2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', marginBottom: '0.3rem' }}>🎉</div>
            <div style={{ fontWeight: 800 }}>All caught up</div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-slate-500)', marginTop: '0.3rem' }}>
              {reviewedCount > 0
                ? `${reviewedCount} job${reviewedCount === 1 ? '' : 's'} handled this session. Nothing else is past its review period.`
                : stageFilter === 'all'
                  ? 'No job is past its review period right now.'
                  : 'Nothing in this stage needs a follow-up.'}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
