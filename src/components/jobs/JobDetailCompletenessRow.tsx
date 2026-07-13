import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { clampCompletenessPct, completenessMarkedLine } from '../../lib/jobs/jobCompleteness'

type Props = {
  jobId: string
  /** Current stored value (null = never marked). */
  pct: number | null
  markedByUserId: string | null
  markedAtIso: string | null
  canEdit: boolean
  /** Refresh the job row + activity feed after a successful mark. */
  onMarked: () => void
  showToast: (msg: string, kind: 'success' | 'error') => void
}

/**
 * Job Detail "Completeness" row: current 0–100% with who/when, plus a slider
 * to (re)mark it. Every change is logged to job_activity_events by a DB
 * trigger, so the activity panel shows the attribution trail.
 */
export function JobDetailCompletenessRow({
  jobId,
  pct,
  markedByUserId,
  markedAtIso,
  canEdit,
  onMarked,
  showToast,
}: Props) {
  const [draftPct, setDraftPct] = useState<number>(pct ?? 0)
  const [saving, setSaving] = useState(false)
  const [markedByName, setMarkedByName] = useState<string | null>(null)

  // Reseed the slider when the stored value changes (refetch or another marker).
  useEffect(() => {
    setDraftPct(pct ?? 0)
  }, [pct, jobId])

  useEffect(() => {
    let cancelled = false
    setMarkedByName(null)
    if (!markedByUserId) return
    void (async () => {
      try {
        const data = await withSupabaseRetry<{ name: string | null } | null>(
          async () => supabase.from('users').select('name').eq('id', markedByUserId).maybeSingle(),
          'completeness marked-by name',
        )
        if (!cancelled) setMarkedByName(data?.name ?? null)
      } catch {
        /* sub-line stays date-only */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [markedByUserId])

  const dirty = clampCompletenessPct(draftPct) !== (pct ?? null)
  const markedLine = completenessMarkedLine(markedByName, markedAtIso)

  async function save() {
    const next = clampCompletenessPct(draftPct)
    if (next == null || saving) return
    setSaving(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth.user?.id ?? null
      await withSupabaseRetry(
        async () =>
          supabase
            .from('jobs_ledger')
            .update({
              completeness_pct: next,
              completeness_marked_by: uid,
              completeness_marked_at: new Date().toISOString(),
            })
            .eq('id', jobId)
            .select('id')
            .single(),
        'mark job completeness',
      )
      showToast(`Completeness marked ${next}%.`, 'success')
      onMarked()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not mark completeness'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.3rem',
        padding: '0.5rem 0.75rem',
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--bg-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
        <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Completeness</span>
        <span style={{ fontWeight: 700, fontSize: '1rem', fontVariantNumeric: 'tabular-nums' }}>
          {pct == null && !dirty ? 'Not marked' : `${dirty ? draftPct : pct}%`}
        </span>
      </div>
      {canEdit ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={draftPct}
            disabled={saving}
            onChange={(e) => setDraftPct(clampCompletenessPct(e.target.value) ?? 0)}
            aria-label="Job completeness percent"
            style={{ flex: 1, minWidth: 0, accentColor: '#0f766e' }}
          />
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            style={{
              padding: '0.3rem 0.75rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              background: !dirty || saving ? 'var(--bg-200)' : '#0f766e',
              color: !dirty || saving ? 'var(--text-muted)' : '#ffffff',
              border: 'none',
              borderRadius: 6,
              cursor: !dirty || saving ? 'default' : 'pointer',
              flexShrink: 0,
            }}
          >
            {saving ? 'Saving…' : 'Mark'}
          </button>
        </div>
      ) : null}
      {/* Track bar for at-a-glance state (shown for everyone, including read-only). */}
      <div aria-hidden style={{ height: 6, borderRadius: 999, background: 'var(--bg-200)', overflow: 'hidden' }}>
        <div
          style={{
            width: `${dirty ? draftPct : (pct ?? 0)}%`,
            height: '100%',
            borderRadius: 999,
            background: '#0f766e',
            transition: 'width 120ms ease',
          }}
        />
      </div>
      {markedLine ? (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{markedLine}</span>
      ) : pct == null ? (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>No one has marked this job yet.</span>
      ) : null}
    </div>
  )
}
