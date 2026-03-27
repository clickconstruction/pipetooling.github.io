import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'

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

export default function TeamFeedbackDevReports() {
  const { showToast } = useToastContext()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<SubmissionRowWithUsers[]>([])
  const [includeReviewerInExport, setIncludeReviewerInExport] = useState(false)
  const [rawSubmissionsOpen, setRawSubmissionsOpen] = useState(false)
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

  const load = useCallback(async () => {
    setLoading(true)
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
          async () => supabase.rpc('team_feedback_aggregates_by_manager'),
          'team_feedback_aggregates_by_manager'
        ),
      ])
      setRows((subRes ?? []) as SubmissionRowWithUsers[])
      setAggRows((aggRes ?? []) as typeof aggRows)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load reports', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

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
    return <p style={{ color: '#6b7280' }}>Loading submissions…</p>
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
          color: '#111827',
        }}
      >
        <span style={{ fontSize: '0.75rem' }}>{rawSubmissionsOpen ? '▼' : '▶'}</span>
        Raw submissions (dev)
      </button>
      {rawSubmissionsOpen && (
        <>
          <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Exports for managers should omit reviewer id. Use the checkbox only for audit. Name columns are dev-only.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <input type="checkbox" checked={includeReviewerInExport} onChange={(e) => setIncludeReviewerInExport(e.target.checked)} />
              Include reviewer_user_id in CSV
            </label>
            <button
              type="button"
              onClick={downloadCsv}
              style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={() => void load()}
              style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}
            >
              Refresh
            </button>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 320, border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                  <th style={{ padding: '0.35rem 0.5rem' }}>When</th>
                  <th style={{ padding: '0.35rem 0.5rem' }}>Source</th>
                  <th style={{ padding: '0.35rem 0.5rem' }}>Reviewer</th>
                  <th style={{ padding: '0.35rem 0.5rem' }}>Manager</th>
                  <th style={{ padding: '0.35rem 0.5rem' }}>L1–L5</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.35rem 0.5rem', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString()}</td>
                    <td style={{ padding: '0.35rem 0.5rem' }}>{r.source}</td>
                    <td
                      style={{ padding: '0.35rem 0.5rem', color: '#111827' }}
                      title={`${r.reviewer_user_id}${r.reviewer?.email ? ` · ${r.reviewer.email}` : ''}`}
                    >
                      {userDisplayLabel(r.reviewer, r.reviewer_user_id)}
                    </td>
                    <td
                      style={{ padding: '0.35rem 0.5rem', color: '#111827' }}
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
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p style={{ padding: '1rem', margin: 0, color: '#9ca3af' }}>No submissions yet.</p>}
          </div>
        </>
      )}

      <h3 style={{ marginTop: '1.5rem' }}>Aggregates by cycle (all managers)</h3>
      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
              <th style={{ padding: '0.35rem 0.5rem' }}>Period</th>
              <th style={{ padding: '0.35rem 0.5rem' }}>Manager</th>
              <th style={{ padding: '0.35rem 0.5rem' }}>N</th>
              <th style={{ padding: '0.35rem 0.5rem' }}>Avg L1–L5</th>
              <th style={{ padding: '0.35rem 0.5rem' }}>Avg overall</th>
            </tr>
          </thead>
          <tbody>
            {aggRows.map((a, i) => (
              <tr key={`${a.cycle_period_start}-${a.manager_user_id ?? 'null'}-${i}`} style={{ borderTop: '1px solid #e5e7eb' }}>
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
        {aggRows.length === 0 && <p style={{ padding: '1rem', margin: 0, color: '#9ca3af' }}>No aggregate rows (need rated submissions with cycle).</p>}
      </div>
    </div>
  )
}
