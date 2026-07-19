import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { SearchableMultiSelect } from '../SearchableMultiSelect'

/**
 * Add/remove the people assigned to a job (jobs_ledger_team_members). Opened from
 * the "people" button in the Job activity / notes panel. Inserting/deleting a row
 * fires the crew_added / crew_removed activity-feed events via DB trigger, so this
 * only mutates the table and asks the parent to refresh. Gated (by the caller) to
 * dev / master_technician / assistant — the roles the INSERT/DELETE RLS allows.
 */

const ASSIGNABLE_ROLES = [
  'assistant',
  'master_technician',
  'subcontractor',
  'helpers',
  'estimator',
  'primary',
  'superintendent',
  'controller',
] as const

const OVERLAY_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 70,
  padding: '1rem',
}

export function ManageJobPeopleModal({
  open,
  onClose,
  jobId,
  jobLabel,
  currentTeamUserIds,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  jobId: string | null
  jobLabel: string
  currentTeamUserIds: string[]
  onChanged: () => void
}) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const [rosterOptions, setRosterOptions] = useState<Array<{ value: string; label: string }>>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadRoster = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('users')
        .select('id, name, email, role')
        .in('role', ASSIGNABLE_ROLES)
        .is('archived_at', null)
        .order('name')
      let rows = (data ?? []) as Array<{ id: string; name: string; email: string | null }>
      if (role === 'dev') {
        const { data: devs } = await supabase
          .from('users')
          .select('id, name, email, role')
          .eq('role', 'dev')
          .is('archived_at', null)
          .order('name')
        rows = [...rows, ...((devs ?? []) as Array<{ id: string; name: string; email: string | null }>)]
      }
      setRosterOptions(
        rows.map((u) => ({ value: u.id, label: u.email ? `${u.name} (${u.email})` : u.name })),
      )
    } finally {
      setLoading(false)
    }
  }, [role])

  useEffect(() => {
    if (!open) return
    setSelected(currentTeamUserIds)
    void loadRoster()
  }, [open, currentTeamUserIds, loadRoster])

  const handleSave = useCallback(async () => {
    if (!jobId) return
    setSaving(true)
    try {
      // Re-read the real current set so concurrent edits diff correctly.
      const { data: existing, error: readErr } = await supabase
        .from('jobs_ledger_team_members')
        .select('user_id')
        .eq('job_id', jobId)
      if (readErr) throw readErr
      const existingIds = new Set((existing ?? []).map((t) => t.user_id))
      const toAdd = selected.filter((id) => !existingIds.has(id))
      const toRemove = [...existingIds].filter((id) => !selected.includes(id))

      for (const uid of toAdd) {
        const { error } = await supabase
          .from('jobs_ledger_team_members')
          .insert({ job_id: jobId, user_id: uid })
        if (error && !String(error.code).includes('23505')) throw error
      }
      for (const uid of toRemove) {
        const { error } = await supabase
          .from('jobs_ledger_team_members')
          .delete()
          .eq('job_id', jobId)
          .eq('user_id', uid)
        if (error) throw error
      }
      showToast('Job people updated.', 'success')
      onChanged()
      onClose()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not update people.', 'error')
    } finally {
      setSaving(false)
    }
  }, [jobId, selected, showToast, onChanged, onClose])

  if (!open) return null

  return (
    <div style={OVERLAY_STYLE} onClick={() => !saving && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Manage people on this job"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 10,
          padding: '1.25rem',
          width: 'min(460px, 100%)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>People on this job</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'none', fontSize: '1.5rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{jobLabel}</p>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
        ) : (
          <SearchableMultiSelect
            options={rosterOptions}
            value={selected}
            onChange={setSelected}
            listAriaLabel="Assignable people"
            searchPlaceholder="Search people…"
            pinSelectedToTop
          />
        )}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{ padding: '0.4rem 0.9rem', fontSize: '0.875rem', background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            style={{ padding: '0.4rem 0.9rem', fontSize: '0.875rem', fontWeight: 600, background: saving ? 'var(--bg-200)' : '#3b82f6', color: saving ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: 6, cursor: saving || loading ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
