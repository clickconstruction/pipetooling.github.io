/**
 * People → Feedback → Open words (dev, v2.2824): the free-text cards from the clock-out deck,
 * newest first, each under the heading it was written for. Dev sees the writer's name.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { parseOpenPrompts } from '../../lib/people/crewReview'
import type { TeamFeedbackSettingsRow } from '../../lib/teamFeedback'

type SubmissionLite = {
  id: string
  created_at: string
  reviewer_user_id: string
  open_fix_improve: string | null
  open_safety_tools: string | null
  open_training: string | null
  open_anything: string | null
}

export default function OpenWordsPanel({ settings }: { settings: TeamFeedbackSettingsRow | null }) {
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<SubmissionLite[]>([])
  const [names, setNames] = useState<Map<string, string>>(() => new Map())
  const [loading, setLoading] = useState(true)
  const prompts = useMemo(() => parseOpenPrompts(settings?.open_prompts), [settings])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [subs, users] = await Promise.all([
          withSupabaseRetry(
            async () =>
              supabase
                .from('team_feedback_submissions')
                .select('id, created_at, reviewer_user_id, open_fix_improve, open_safety_tools, open_training, open_anything')
                .or('open_fix_improve.not.is.null,open_safety_tools.not.is.null,open_training.not.is.null,open_anything.not.is.null')
                .order('created_at', { ascending: false })
                .limit(200),
            'fetch open words',
          ),
          withSupabaseRetry(async () => supabase.from('users').select('id, name'), 'fetch users for open words'),
        ])
        if (cancelled) return
        setRows((subs ?? []) as SubmissionLite[])
        setNames(new Map(((users ?? []) as { id: string; name: string | null }[]).map((u) => [u.id, (u.name ?? '').trim() || 'Former teammate'])))
      } catch (e) {
        if (!cancelled) showToast(e instanceof Error ? e.message : 'Could not load open words', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showToast])

  if (loading) return <p style={{ color: 'var(--text-muted)', margin: '0.75rem 0' }}>Loading…</p>
  if (rows.length === 0) return <p style={{ color: 'var(--text-muted)', margin: '0.75rem 0', fontSize: '0.9rem' }}>Nothing written yet.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem' }}>
      {rows.map((r) => {
        const entries: Array<{ heading: string; text: string }> = [
          { heading: prompts[0], text: r.open_fix_improve ?? '' },
          { heading: prompts[1], text: r.open_safety_tools ?? '' },
          { heading: prompts[2], text: r.open_training ?? '' },
          { heading: prompts[3], text: r.open_anything ?? '' },
        ].filter((e) => e.text.trim() !== '')
        return (
          <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.65rem 0.9rem', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{names.get(r.reviewer_user_id) ?? 'Former teammate'}</span>
              <span>{new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-faint)' }}>name visible to dev only</span>
            </div>
            {entries.map(({ heading, text }) => (
              <div key={heading} style={{ marginTop: '0.4rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{heading}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-700)', whiteSpace: 'pre-wrap' }}>{text}</div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
