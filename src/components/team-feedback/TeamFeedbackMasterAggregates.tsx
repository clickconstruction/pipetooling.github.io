import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'

type AggRow = {
  cycle_period_start: string
  manager_user_id: string | null
  submission_count: number
  avg_likert_1: number | null
  avg_likert_2: number | null
  avg_likert_3: number | null
  avg_likert_4: number | null
  avg_likert_5: number | null
  avg_overall_1_10: number | null
}

/** Pay-approved masters: trend view only (your row); no reviewer identity. */
export default function TeamFeedbackMasterAggregates() {
  const { showToast } = useToastContext()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<AggRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await withSupabaseRetry(
        () => supabase.rpc('team_feedback_aggregates_by_manager'),
        'team_feedback_aggregates_by_manager master'
      )
      setRows((data ?? []) as AggRow[])
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load aggregates', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return <p style={{ color: '#6b7280' }}>Loading team feedback trends…</p>
  }

  return (
    <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa' }}>
      <h3 style={{ marginTop: 0 }}>Team feedback trends (your leadership)</h3>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
        Anonymous aggregated scores for feedback about your lead role. Individual responses are not shown.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '0.5rem' }}>Cycle start</th>
              <th style={{ padding: '0.5rem' }}>Responses</th>
              <th style={{ padding: '0.5rem' }}>Avg L1–L5</th>
              <th style={{ padding: '0.5rem' }}>Avg overall</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.cycle_period_start} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '0.5rem' }}>{a.cycle_period_start}</td>
                <td style={{ padding: '0.5rem' }}>{a.submission_count}</td>
                <td style={{ padding: '0.5rem' }}>
                  {[a.avg_likert_1, a.avg_likert_2, a.avg_likert_3, a.avg_likert_4, a.avg_likert_5].map((x) => (x == null ? '—' : Number(x).toFixed(2))).join(', ')}
                </td>
                <td style={{ padding: '0.5rem' }}>{a.avg_overall_1_10 == null ? '—' : Number(a.avg_overall_1_10).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p style={{ color: '#9ca3af', marginBottom: 0 }}>No aggregate data yet.</p>}
    </div>
  )
}
