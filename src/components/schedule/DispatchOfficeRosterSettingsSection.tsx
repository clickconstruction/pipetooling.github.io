import { useCallback, useEffect, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import {
  addToDispatchOfficeRoster,
  fetchDispatchOfficeRoster,
  isOfficeRosterEligibleRole,
  officeRosterTimeLabel,
  removeFromDispatchOfficeRoster,
  updateDispatchOfficeRosterWindow,
  type OfficeRosterEntry,
} from '../../lib/dispatchOfficeRoster'

const smallBtn = {
  padding: '0.2rem 0.5rem',
  fontSize: '0.75rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  background: 'var(--surface)',
  cursor: 'pointer',
} as const

type EligibleUser = { id: string; name: string | null; role: string }

/**
 * Dispatch Settings → "Standing office schedule" (v2.1812). Self-contained
 * like the swim-lanes section: loads the roster + eligible people on mount,
 * every mutation writes immediately. `onChanged` lets the page re-run the
 * ensure pass so new roster members appear on the visible week right away.
 */
export function DispatchOfficeRosterSettingsSection({ onChanged }: { onChanged?: () => void }) {
  const { showToast } = useToastContext()
  const [roster, setRoster] = useState<OfficeRosterEntry[] | null>(null)
  const [eligible, setEligible] = useState<EligibleUser[]>([])
  const [busy, setBusy] = useState(false)
  const [sectionOpen, setSectionOpen] = useState(false)
  const [addUserId, setAddUserId] = useState('')

  const reload = useCallback(async () => {
    const { data, error } = await fetchDispatchOfficeRoster()
    if (error) showToast(error, 'error')
    setRoster(data)
  }, [showToast])

  useEffect(() => {
    void reload()
    ;(async () => {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            await supabase.from('users').select('id, name, role').is('archived_at', null),
          'office roster eligible users',
        )
        setEligible(
          ((rows ?? []) as EligibleUser[])
            .filter((u) => isOfficeRosterEligibleRole(u.role))
            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
        )
      } catch {
        /* section still works read-only without the picker */
      }
    })()
  }, [reload])

  const run = useCallback(
    async (op: () => Promise<{ error: string | null }>) => {
      if (busy) return
      setBusy(true)
      try {
        const { error } = await op()
        if (error) {
          showToast(error, 'error')
          return
        }
        await reload()
        onChanged?.()
      } finally {
        setBusy(false)
      }
    },
    [busy, reload, onChanged, showToast],
  )

  const nameOf = (id: string) => eligible.find((u) => u.id === id)?.name ?? 'Unknown user'
  const roleOf = (id: string) => eligible.find((u) => u.id === id)?.role ?? ''
  const memberIds = new Set((roster ?? []).map((r) => r.user_id))
  const addable = eligible.filter((u) => !memberIds.has(u.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
      <button
        type="button"
        aria-expanded={sectionOpen}
        aria-controls="dispatch-settings-office-roster"
        onClick={() => setSectionOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 0,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--text-strong)',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: '0.7rem' }}>
          {sectionOpen ? '▼' : '▶'}
        </span>
        Standing office schedule
        {!sectionOpen && roster != null ? (
          <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {roster.length} {roster.length === 1 ? 'person' : 'people'}
          </span>
        ) : null}
      </button>
      {sectionOpen ? (
        <div id="dispatch-settings-office-roster" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Weekdays, these people get an Office block automatically — no morning ritual. Days off and field
            dispatches always win, and a block you delete stays deleted. Changes write immediately.
          </p>
          {(roster ?? []).map((r) => (
            <div key={r.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nameOf(r.user_id)}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> · {roleOf(r.user_id) || '—'}</span>
              </span>
              <input
                type="time"
                aria-label={`Office start time for ${nameOf(r.user_id)}`}
                defaultValue={r.time_start.slice(0, 5)}
                onBlur={(e) => {
                  const v = e.target.value
                  if (v && v !== r.time_start.slice(0, 5)) void run(() => updateDispatchOfficeRosterWindow(r.user_id, v, r.time_end.slice(0, 5)))
                }}
                style={{ fontSize: '0.75rem', padding: '0.15rem 0.3rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              />
              <span aria-hidden style={{ color: 'var(--text-muted)' }}>–</span>
              <input
                type="time"
                aria-label={`Office end time for ${nameOf(r.user_id)}`}
                defaultValue={r.time_end.slice(0, 5)}
                onBlur={(e) => {
                  const v = e.target.value
                  if (v && v !== r.time_end.slice(0, 5)) void run(() => updateDispatchOfficeRosterWindow(r.user_id, r.time_start.slice(0, 5), v))
                }}
                style={{ fontSize: '0.75rem', padding: '0.15rem 0.3rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => removeFromDispatchOfficeRoster(r.user_id))}
                aria-label={`Remove ${nameOf(r.user_id)} from the standing office schedule`}
                title={`Remove ${nameOf(r.user_id)} — future days stop filling; existing blocks stay`}
                style={smallBtn}
              >
                ×
              </button>
            </div>
          ))}
          {roster != null && roster.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nobody yet — add the office crew below.</p>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              aria-label="Add a person to the standing office schedule"
              style={{ fontSize: '0.8125rem', padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, maxWidth: 220 }}
            >
              <option value="">Add person…</option>
              {addable.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? 'Unknown'} ({u.role})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !addUserId}
              onClick={() => {
                const id = addUserId
                setAddUserId('')
                void run(() => addToDispatchOfficeRoster(id))
              }}
              style={smallBtn}
            >
              Add ({officeRosterTimeLabel('08:00')}–{officeRosterTimeLabel('16:00')})
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
