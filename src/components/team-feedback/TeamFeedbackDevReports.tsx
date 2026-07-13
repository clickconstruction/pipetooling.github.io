import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import {
  DEFAULT_MANAGER_LIKERT_PROMPTS,
  DEFAULT_MANAGER_OVERALL_PROMPT,
  DEFAULT_MANAGER_STEP_HEADING,
  DEFAULT_PEER_LIKERT_PROMPTS,
  DEFAULT_PEER_STEP_HEADING,
  normalizeLikertPrompts,
} from '../../lib/teamFeedbackCopy'
import { fetchTeamFeedbackSettings, type TeamFeedbackSettingsRow } from '../../lib/teamFeedback'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { PayStubDeleteIcon } from '../pay/PayStubDeleteIcon'

type SubmissionRow = Database['public']['Tables']['team_feedback_submissions']['Row']

type UserNameEmail = Pick<Database['public']['Tables']['users']['Row'], 'name' | 'email'>

type SubmissionRowWithUsers = SubmissionRow & {
  reviewer: UserNameEmail | null
  manager: UserNameEmail | null
}

const TEAM_FEEDBACK_SUBMISSIONS_WITH_USERS = `
  *,
  reviewer:users!team_feedback_submissions_reviewer_user_id_fkey(name, email),
  manager:users!team_feedback_submissions_manager_user_id_fkey(name, email)
`

const TEAM_FEEDBACK_PEER_RATINGS_WITH_NAMES = `
  *,
  peer_person:people!team_feedback_peer_ratings_peer_person_id_fkey(name),
  peer_user:users!team_feedback_peer_ratings_peer_user_id_fkey(name, email)
`

type PeerRatingRowWithJoin = Database['public']['Tables']['team_feedback_peer_ratings']['Row'] & {
  peer_person: { name: string | null } | null
  peer_user: { name: string | null; email: string | null } | null
}

const OPEN_COMMENT_LABELS: [string, keyof SubmissionRow][] = [
  ['What should we fix or improve?', 'open_fix_improve'],
  ['Safety, tools, or equipment', 'open_safety_tools'],
  ['Training you wish you had', 'open_training'],
]

function peerDisplayLabel(p: PeerRatingRowWithJoin): string {
  const pn = p.peer_person?.name?.trim()
  if (pn) return pn
  const un = p.peer_user?.name?.trim()
  if (un) return un
  const em = p.peer_user?.email?.trim()
  if (em) return em
  if (p.peer_person_id) return `Person ${p.peer_person_id.slice(0, 8)}…`
  if (p.peer_user_id) return `User ${p.peer_user_id.slice(0, 8)}…`
  return 'Peer'
}

function QaLine({ question, answer }: { question: string; answer: ReactNode }) {
  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '0.25rem', lineHeight: 1.4 }}>
        {question}
      </div>
      <div style={{ fontSize: '0.875rem', color: 'var(--text-strong)', lineHeight: 1.45 }}>{answer}</div>
    </div>
  )
}

function LongFormAnswer({ value }: { value: string | null | undefined }) {
  const t = value?.trim()
  if (!t) return <span style={{ color: 'var(--text-faint)' }}>—</span>
  return <span style={{ whiteSpace: 'pre-wrap' }}>{t}</span>
}

function userDisplayLabel(u: UserNameEmail | null | undefined, idFallback: string): string {
  const n = u?.name?.trim()
  if (n) return n
  const e = u?.email?.trim()
  if (e) return e
  return `${idFallback.slice(0, 8)}…`
}

function csvEscape(s: string | null | undefined): string {
  if (s == null || s === '') return ''
  const t = String(s)
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

function TeamFeedbackSubmissionDetailModal({
  submission,
  loading,
  peers,
  settings,
  onClose,
}: {
  submission: SubmissionRowWithUsers
  loading: boolean
  peers: PeerRatingRowWithJoin[]
  settings: TeamFeedbackSettingsRow | null
  onClose: () => void
}) {
  if (typeof document === 'undefined') return null

  const s = submission
  const mgrPrompts = normalizeLikertPrompts(settings?.manager_likert_prompts, DEFAULT_MANAGER_LIKERT_PROMPTS)
  const mgrHeading = settings?.manager_step_heading?.trim() || DEFAULT_MANAGER_STEP_HEADING
  const mgrOverallQ = settings?.manager_overall_prompt?.trim() || DEFAULT_MANAGER_OVERALL_PROMPT
  const peerPrompts = normalizeLikertPrompts(settings?.peer_likert_prompts, DEFAULT_PEER_LIKERT_PROMPTS)
  const peerHeading = settings?.peer_step_heading?.trim() || DEFAULT_PEER_STEP_HEADING

  const mgrLikerts = [
    s.manager_likert_1,
    s.manager_likert_2,
    s.manager_likert_3,
    s.manager_likert_4,
    s.manager_likert_5,
  ] as const
  const hasManager = mgrLikerts.some((x) => x != null) || s.manager_overall_1_10 != null
  const peerLikert = (p: PeerRatingRowWithJoin) =>
    [p.peer_likert_1, p.peer_likert_2, p.peer_likert_3, p.peer_likert_4, p.peer_likert_5] as const

  return createPortal(
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-feedback-submission-detail-title"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: 'min(92vh, 880px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          borderRadius: 10,
          border: '1px solid var(--border)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
          }}
        >
          <h2 id="team-feedback-submission-detail-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-strong)' }}>
            Submission detail
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: 6,
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--text-700)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
        <div style={{ overflow: 'auto', padding: '1rem', flex: '1 1 auto', minHeight: 0 }}>
          {loading ? (
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading detail…</p>
          ) : (
            <>
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  borderRadius: 8,
                  background: 'var(--bg-subtle)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-700)',
                  lineHeight: 1.5,
                }}
              >
                <div>
                  <strong>When:</strong> {new Date(s.created_at).toLocaleString()}
                </div>
                <div>
                  <strong>Source:</strong> {s.source}
                </div>
                <div>
                  <strong>Cycle period start:</strong> {s.cycle_period_start ?? '—'}
                </div>
                <div>
                  <strong>Reviewer:</strong> {userDisplayLabel(s.reviewer, s.reviewer_user_id)}{' '}
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>({s.reviewer_user_id.slice(0, 8)}…)</span>
                </div>
                <div>
                  <strong>Manager (at submit):</strong>{' '}
                  {s.manager_user_id
                    ? `${userDisplayLabel(s.manager, s.manager_user_id)} (${s.manager_user_id.slice(0, 8)}…)`
                    : '—'}
                </div>
              </div>

              {hasManager && (
                <section style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 0.65rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)' }}>{mgrHeading}</h3>
                  {mgrPrompts.map((q, i) => (
                    <QaLine key={`mgr-${i}`} question={q} answer={mgrLikerts[i] != null ? String(mgrLikerts[i]) : '—'} />
                  ))}
                  <QaLine question={mgrOverallQ} answer={s.manager_overall_1_10 != null ? String(s.manager_overall_1_10) : '—'} />
                </section>
              )}

              {peers.length > 0 && (
                <section style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 0.65rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)' }}>{peerHeading}</h3>
                  {peers.map((p) => {
                    const vals = peerLikert(p)
                    return (
                      <div
                        key={p.id}
                        style={{
                          marginBottom: '1rem',
                          padding: '0.75rem',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-page)',
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-strong)' }}>{peerDisplayLabel(p)}</div>
                        {peerPrompts.map((q, i) => (
                          <QaLine key={`${p.id}-p-${i}`} question={q} answer={vals[i] != null ? String(vals[i]) : '—'} />
                        ))}
                        {p.peer_trust != null && p.peer_trust !== p.peer_likert_5 ? (
                          <QaLine question="Trust (stored)" answer={String(p.peer_trust)} />
                        ) : null}
                      </div>
                    )
                  })}
                </section>
              )}

              <section style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: '0 0 0.65rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)' }}>
                  {hasManager || peers.length > 0 ? 'Anything else?' : 'Your comments'}
                </h3>
                {OPEN_COMMENT_LABELS.map(([label, key]) => (
                  <QaLine key={key} question={label} answer={<LongFormAnswer value={s[key] as string | null} />} />
                ))}
              </section>

              <p style={{ margin: '1rem 0 0', fontSize: '0.75rem', color: 'var(--text-faint)', lineHeight: 1.4 }}>
                Likert questions use today’s team feedback settings (defaults if unset). Wording may have differed when this was submitted.
              </p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function TeamFeedbackDevReports() {
  const { showToast } = useToastContext()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<SubmissionRowWithUsers[]>([])
  const [includeReviewerInExport, setIncludeReviewerInExport] = useState(false)
  const [rawSubmissionsOpen, setRawSubmissionsOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [detailSubmission, setDetailSubmission] = useState<SubmissionRowWithUsers | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailPeers, setDetailPeers] = useState<PeerRatingRowWithJoin[]>([])
  const [detailSettings, setDetailSettings] = useState<TeamFeedbackSettingsRow | null>(null)
  const [aggRows, setAggRows] = useState<
    {
      cycle_period_start: string
      manager_user_id: string | null
      submission_count: number
      avg_likert_1: number | null
      avg_likert_2: number | null
      avg_likert_3: number | null
      avg_likert_4: number | null
      avg_likert_5: number | null
      avg_overall_1_10: number | null
    }[]
  >([])

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) setLoading(true)
      try {
        const [subRes, aggRes] = await Promise.all([
          withSupabaseRetry(
            async () =>
              supabase
                .from('team_feedback_submissions')
                .select(TEAM_FEEDBACK_SUBMISSIONS_WITH_USERS)
                .order('created_at', { ascending: false })
                .limit(500),
            'team_feedback_submissions list'
          ),
          withSupabaseRetry(
            () => supabase.rpc('team_feedback_aggregates_by_manager'),
            'team_feedback_aggregates_by_manager'
          ),
        ])
        setRows((subRes ?? []) as SubmissionRowWithUsers[])
        setAggRows((aggRes ?? []) as typeof aggRows)
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Failed to load reports', 'error')
      } finally {
        if (!opts?.quiet) setLoading(false)
      }
    },
    [showToast]
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!detailSubmission) {
      setDetailPeers([])
      setDetailSettings(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    void (async () => {
      try {
        const [settings, peerList] = await Promise.all([
          fetchTeamFeedbackSettings(),
          withSupabaseRetry(
            async () =>
              supabase
                .from('team_feedback_peer_ratings')
                .select(TEAM_FEEDBACK_PEER_RATINGS_WITH_NAMES)
                .eq('submission_id', detailSubmission.id)
                .order('created_at', { ascending: true }),
            'team_feedback_peer_ratings by submission'
          ),
        ])
        if (cancelled) return
        setDetailSettings(settings)
        setDetailPeers((peerList ?? []) as PeerRatingRowWithJoin[])
      } catch (e) {
        if (!cancelled) showToast(e instanceof Error ? e.message : 'Failed to load submission detail', 'error')
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [detailSubmission, showToast])

  useEffect(() => {
    if (!detailSubmission) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setDetailSubmission(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [detailSubmission])

  async function deleteSubmission(id: string) {
    if (
      !window.confirm(
        'Delete this team feedback submission permanently? Linked peer rating rows are removed automatically. This cannot be undone.'
      )
    ) {
      return
    }
    setDeletingId(id)
    try {
      await withSupabaseRetry(
        async () => supabase.from('team_feedback_submissions').delete().eq('id', id),
        'team_feedback_submissions delete'
      )
      showToast('Submission deleted', 'success')
      setDetailSubmission((d) => (d?.id === id ? null : d))
      await load({ quiet: true })
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Delete failed', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  function downloadCsv() {
    const headers = [
      'created_at',
      'source',
      'cycle_period_start',
      'reviewer_name',
      'manager_name',
      'manager_user_id',
      'l1',
      'l2',
      'l3',
      'l4',
      'l5',
      'overall_1_10',
      'open_fix_improve',
      'open_safety_tools',
      'open_training',
    ]
    if (includeReviewerInExport) headers.unshift('reviewer_user_id')
    const lines = [headers.join(',')]
    for (const r of rows) {
      const base = [
        csvEscape(r.created_at),
        csvEscape(r.source),
        csvEscape(r.cycle_period_start),
        csvEscape(userDisplayLabel(r.reviewer, r.reviewer_user_id)),
        csvEscape(r.manager_user_id ? userDisplayLabel(r.manager, r.manager_user_id) : ''),
        csvEscape(r.manager_user_id),
        r.manager_likert_1 ?? '',
        r.manager_likert_2 ?? '',
        r.manager_likert_3 ?? '',
        r.manager_likert_4 ?? '',
        r.manager_likert_5 ?? '',
        r.manager_overall_1_10 ?? '',
        csvEscape(r.open_fix_improve),
        csvEscape(r.open_safety_tools),
        csvEscape(r.open_training),
      ]
      if (includeReviewerInExport) base.unshift(csvEscape(r.reviewer_user_id))
      lines.push(base.join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `team_feedback_export_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (loading) {
    return <p style={{ color: 'var(--text-muted)' }}>Loading submissions…</p>
  }

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <button
        type="button"
        onClick={() => setRawSubmissionsOpen((v) => !v)}
        aria-expanded={rawSubmissionsOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          margin: 0,
          marginBottom: rawSubmissionsOpen ? '0.5rem' : 0,
          padding: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.125rem',
          fontWeight: 600,
          color: 'var(--text-strong)',
        }}
      >
        <span style={{ fontSize: '0.75rem' }}>{rawSubmissionsOpen ? '▼' : '▶'}</span>
        Raw submissions (dev)
      </button>
      {rawSubmissionsOpen && (
        <>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '0.75rem',
              marginBottom: '0.75rem',
            }}
          >
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0, flex: '1 1 12rem', minWidth: 0 }}>
              Exports for managers should omit reviewer id. Use the checkbox only for audit. Name columns are dev-only.
            </p>
            <button
              type="button"
              onClick={() => void load()}
              style={{
                flexShrink: 0,
                padding: '0.35rem 0.75rem',
                borderRadius: 6,
                border: '1px solid var(--border-strong)',
                background: 'var(--surface)',
                cursor: 'pointer',
              }}
            >
              Refresh
            </button>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 320, border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', textAlign: 'left' }}>
                  <th style={{ padding: '0.35rem 0.5rem' }}>When</th>
                  <th style={{ padding: '0.35rem 0.5rem' }}>Source</th>
                  <th style={{ padding: '0.35rem 0.5rem' }}>Reviewer</th>
                  <th style={{ padding: '0.35rem 0.5rem' }}>Manager</th>
                  <th style={{ padding: '0.35rem 0.5rem' }}>L1–L5</th>
                  <th style={{ padding: '0.35rem 0.5rem', width: '2.5rem' }} aria-label="Delete row" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    title="View questions and answers"
                    onClick={() => setDetailSubmission(r)}
                  >
                    <td style={{ padding: '0.35rem 0.5rem', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString()}</td>
                    <td style={{ padding: '0.35rem 0.5rem' }}>{r.source}</td>
                    <td
                      style={{ padding: '0.35rem 0.5rem', color: 'var(--text-strong)' }}
                      title={`${r.reviewer_user_id}${r.reviewer?.email ? ` · ${r.reviewer.email}` : ''}`}
                    >
                      {userDisplayLabel(r.reviewer, r.reviewer_user_id)}
                    </td>
                    <td
                      style={{ padding: '0.35rem 0.5rem', color: 'var(--text-strong)' }}
                      title={
                        r.manager_user_id
                          ? `${r.manager_user_id}${r.manager?.email ? ` · ${r.manager.email}` : ''}`
                          : undefined
                      }
                    >
                      {r.manager_user_id ? userDisplayLabel(r.manager, r.manager_user_id) : '—'}
                    </td>
                    <td style={{ padding: '0.35rem 0.5rem' }}>
                      {[r.manager_likert_1, r.manager_likert_2, r.manager_likert_3, r.manager_likert_4, r.manager_likert_5].every((x) => x == null)
                        ? '—'
                        : [r.manager_likert_1, r.manager_likert_2, r.manager_likert_3, r.manager_likert_4, r.manager_likert_5].join(',')}
                    </td>
                    <td style={{ padding: '0.35rem 0.5rem', verticalAlign: 'middle', textAlign: 'center' }}>
                      <button
                        type="button"
                        title="Delete submission"
                        aria-label="Delete submission"
                        disabled={deletingId != null}
                        onClick={(e) => {
                          e.stopPropagation()
                          void deleteSubmission(r.id)
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.2rem',
                          border: 'none',
                          background: 'none',
                          cursor: deletingId != null ? 'not-allowed' : 'pointer',
                          opacity: deletingId != null ? 0.5 : 1,
                        }}
                      >
                        {deletingId === r.id ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>…</span>
                        ) : (
                          <PayStubDeleteIcon color="#b91c1c" size={18} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p style={{ padding: '1rem', margin: 0, color: 'var(--text-faint)' }}>No submissions yet.</p>}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '0.75rem',
              marginTop: '0.75rem',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem' }}>
              <input type="checkbox" checked={includeReviewerInExport} onChange={(e) => setIncludeReviewerInExport(e.target.checked)} />
              Include reviewer_user_id in CSV
            </label>
            <button
              type="button"
              onClick={downloadCsv}
              style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer' }}
            >
              Download CSV
            </button>
          </div>
        </>
      )}

      <h3 style={{ marginTop: '1.5rem' }}>Aggregates by cycle (all managers)</h3>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', textAlign: 'left' }}>
              <th style={{ padding: '0.35rem 0.5rem' }}>Period</th>
              <th style={{ padding: '0.35rem 0.5rem' }}>Manager</th>
              <th style={{ padding: '0.35rem 0.5rem' }}>N</th>
              <th style={{ padding: '0.35rem 0.5rem' }}>Avg L1–L5</th>
              <th style={{ padding: '0.35rem 0.5rem' }}>Avg overall</th>
            </tr>
          </thead>
          <tbody>
            {aggRows.map((a, i) => (
              <tr key={`${a.cycle_period_start}-${a.manager_user_id ?? 'null'}-${i}`} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '0.35rem 0.5rem' }}>{a.cycle_period_start}</td>
                <td style={{ padding: '0.35rem 0.5rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {a.manager_user_id ? `${a.manager_user_id.slice(0, 8)}…` : '—'}
                </td>
                <td style={{ padding: '0.35rem 0.5rem' }}>{a.submission_count}</td>
                <td style={{ padding: '0.35rem 0.5rem' }}>
                  {[a.avg_likert_1, a.avg_likert_2, a.avg_likert_3, a.avg_likert_4, a.avg_likert_5].map((x) => (x == null ? '—' : Number(x).toFixed(2))).join(', ')}
                </td>
                <td style={{ padding: '0.35rem 0.5rem' }}>{a.avg_overall_1_10 == null ? '—' : Number(a.avg_overall_1_10).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {aggRows.length === 0 && <p style={{ padding: '1rem', margin: 0, color: 'var(--text-faint)' }}>No aggregate rows (need rated submissions with cycle).</p>}
      </div>

      {detailSubmission && (
        <TeamFeedbackSubmissionDetailModal
          submission={detailSubmission}
          loading={detailLoading}
          peers={detailPeers}
          settings={detailSettings}
          onClose={() => setDetailSubmission(null)}
        />
      )}
    </div>
  )
}
