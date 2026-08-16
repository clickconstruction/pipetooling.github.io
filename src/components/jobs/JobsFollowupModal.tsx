import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useJobDetailOpenerBridge } from '../../contexts/JobDetailOpenerBridgeContext'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { fetchStreetViewImageBlob, fetchStreetViewMeta, googleStreetViewPanoUrl } from '../../lib/fetchStreetViewPreview'
import { postJobThreadNoteBody } from '../../lib/jobs/postJobThreadNote'
import {
  JOB_FOLLOWUP_STAGES,
  JOB_FOLLOWUP_STAGE_LABELS,
  computeJobFollowupQueue,
  jobFollowupStageCounts,
  type JobFollowupCandidate,
  type JobFollowupReview,
  type JobFollowupSettings,
  type JobFollowupStage,
} from '../../lib/jobs/jobFollowupQueue'
import {
  fetchJobFollowupCandidates,
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

const DECK_Z = 1040
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

const STAGE_CHIP: Record<JobFollowupStage, React.CSSProperties> = {
  waiting: chipStyle('var(--bg-slate-100)', 'var(--text-slate-500)'),
  working: chipStyle('#dbeafe', '#1d4ed8'),
  ready_to_bill: chipStyle('var(--bg-amber-100)', 'var(--text-amber-800)'),
  billed: chipStyle('#fee2e2', '#b91c1c'),
  collections: chipStyle('#fee2e2', '#b91c1c'),
}

function SettingsStepper({ label, desc, value, onChange }: { label: string; desc: string; value: number; onChange: (v: number) => void }) {
  const btn: React.CSSProperties = { border: 'none', background: 'var(--bg-slate-100)', color: 'var(--text-slate-600)', fontWeight: 800, width: 28, height: 28, cursor: 'pointer' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ minWidth: '11rem', fontWeight: 600, fontSize: '0.84rem' }}>{label}</span>
      <span style={{ flex: 1, color: 'var(--text-slate-500)', fontSize: '0.74rem' }}>{desc}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden' }}>
        <button type="button" aria-label={`Decrease ${label}`} style={btn} onClick={() => onChange(Math.max(1, value - 1))}>−</button>
        <span style={{ minWidth: '4.2rem', textAlign: 'center', fontWeight: 700, fontSize: '0.8rem' }}>{value} day{value === 1 ? '' : 's'}</span>
        <button type="button" aria-label={`Increase ${label}`} style={btn} onClick={() => onChange(Math.min(60, value + 1))}>+</button>
      </span>
    </div>
  )
}

export function JobsFollowupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const bridge = useJobDetailOpenerBridge()

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

  const fullQueue = useMemo(
    () => (settings ? computeJobFollowupQueue(candidates, reviews, settings, todayYmd) : []),
    [candidates, reviews, settings, todayYmd],
  )
  const counts = useMemo(() => jobFollowupStageCounts(fullQueue), [fullQueue])
  const queue = useMemo(
    () => (stageFilter === 'all' ? fullQueue : fullQueue.filter((e) => e.job.stage === stageFilter)),
    [fullQueue, stageFilter],
  )
  const current = queue[0] ?? null

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
      if (e.key === 'Escape' && !settingsOpen) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, settingsOpen])

  const advanceWithReview = useCallback(
    async (snoozedUntil: string | null) => {
      if (!current || busy) return
      setBusy(true)
      try {
        await recordJobFollowupReview(current.job.id, user?.id ?? null, snoozedUntil)
        setReviews((prev) => [...prev, { jobId: current.job.id, reviewedAt: new Date().toISOString(), snoozedUntil }])
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
      style={{ position: 'fixed', inset: 0, zIndex: DECK_Z, background: 'var(--bg-slate-tint)', overflowY: 'auto', padding: '1.2rem 1rem 2rem' }}
    >
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
          <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>
            {loading ? 'Loading follow-ups…' : queue.length > 0 ? `${queue.length} to review` : 'Follow-ups'}
          </span>
          {filterChip('all', `All (${fullQueue.length})`)}
          {JOB_FOLLOWUP_STAGES.filter((s) => counts[s] > 0).map((s) => filterChip(s, `${JOB_FOLLOWUP_STAGE_LABELS[s]} (${counts[s]})`))}
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
            style={{ marginLeft: 'auto', fontSize: '0.74rem', padding: '0.24rem 0.65rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-slate-600)', cursor: 'pointer' }}
          >
            ⚙ Review periods
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-slate-600)', cursor: 'pointer' }}
          >
            Esc · Close
          </button>
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

        {!loading && current ? (
          <div style={{ position: 'relative' }}>
            {queue.length > 2 ? (
              <div style={{ position: 'absolute', inset: '20px -14px auto -14px', height: '96%', background: 'var(--surface)', opacity: 0.35, borderRadius: 14, border: '1px solid var(--border)', transform: 'rotate(-0.8deg)' }} />
            ) : null}
            {queue.length > 1 ? (
              <div style={{ position: 'absolute', inset: '10px -8px auto -8px', height: '96%', background: 'var(--surface)', opacity: 0.55, borderRadius: 14, border: '1px solid var(--border)', transform: 'rotate(0.6deg)' }} />
            ) : null}

            <div style={{ position: 'relative', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 12px 32px rgba(15,18,24,0.12)', padding: '1rem 1.2rem 1.1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                <span style={{ background: '#f59e0b', color: '#fff', fontWeight: 800, fontSize: '0.72rem', borderRadius: 6, padding: '0.2rem 0.5rem' }}>{current.job.hcpNumber}</span>
                <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>{current.job.jobName}</span>
                <span style={STAGE_CHIP[current.job.stage]}>{JOB_FOLLOWUP_STAGE_LABELS[current.job.stage]}</span>
                <span style={{ ...chipStyle('var(--bg-amber-100)', 'var(--text-amber-800)'), marginLeft: 'auto' }}>
                  quiet {current.quietDays} day{current.quietDays === 1 ? '' : 's'}
                </span>
              </div>

              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', margin: '0.6rem 0 0.65rem', border: '1px solid var(--border)', minHeight: svUrl ? undefined : 0 }}>
                {svUrl ? (
                  <a href={svPano ?? undefined} target="_blank" rel="noreferrer" style={{ display: 'block', cursor: svPano ? 'pointer' : 'default' }}>
                    <img src={svUrl} alt={`Street View near ${current.job.address}`} style={{ width: '100%', maxHeight: 190, objectFit: 'cover', display: 'block' }} />
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
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.5rem 0.7rem', marginBottom: '0.7rem', background: 'var(--bg-slate-tint)' }}>
                  <div style={{ fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-slate-500)', marginBottom: '0.3rem' }}>Latest activity</div>
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
                  style={{ borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', padding: '0.5rem 0.9rem', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', opacity: busy || noteDraft.trim() === '' ? 0.6 : 1 }}
                >
                  Post & next ⏎
                </button>
                <button
                  type="button"
                  onClick={() => void advanceWithReview(null)}
                  disabled={busy}
                  style={{ borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', padding: '0.5rem 0.9rem', border: '1px solid var(--border-green)', background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', cursor: 'pointer' }}
                >
                  ✓ Looks fine
                </button>
                <span style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setSnoozeOpen((v) => !v)}
                    disabled={busy}
                    aria-expanded={snoozeOpen}
                    style={{ borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', padding: '0.5rem 0.9rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-slate-600)', cursor: 'pointer' }}
                  >
                    Snooze ▾
                  </button>
                  {snoozeOpen ? (
                    <span style={{ position: 'absolute', top: '110%', left: 0, zIndex: 5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 20px rgba(15,18,24,0.15)', display: 'flex', flexDirection: 'column', minWidth: '7rem' }}>
                      <button type="button" onClick={() => snoozeTo(3)} style={{ border: 'none', background: 'none', color: 'inherit', padding: '0.45rem 0.8rem', textAlign: 'left', fontSize: '0.8rem', cursor: 'pointer' }}>3 days</button>
                      <button type="button" onClick={() => snoozeTo(7)} style={{ border: 'none', background: 'none', color: 'inherit', padding: '0.45rem 0.8rem', textAlign: 'left', fontSize: '0.8rem', cursor: 'pointer' }}>1 week</button>
                      <button type="button" onClick={() => snoozeTo(14)} style={{ border: 'none', background: 'none', color: 'inherit', padding: '0.45rem 0.8rem', textAlign: 'left', fontSize: '0.8rem', cursor: 'pointer' }}>2 weeks</button>
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (current && bridge && !bridge.requestOpenJobDetail(current.job.id)) {
                      showToast('Open the Jobs page to view the full job window.', 'error')
                    }
                  }}
                  style={{ marginLeft: 'auto', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', padding: '0.5rem 0.9rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer' }}
                >
                  Open job ↗
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && !current ? (
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
