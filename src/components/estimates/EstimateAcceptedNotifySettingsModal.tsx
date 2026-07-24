import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import {
  parseEstimateAcceptedNotifyRecipients,
  serializeEstimateAcceptedNotifyRecipients,
} from '../../lib/estimateAcceptedNotify'
import { APP_SETTINGS_KEY_ESTIMATE_ACCEPTED_NOTIFY_RECIPIENTS } from '../../lib/appSettingsKeys'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

/**
 * ⚙ next to "New estimate" (Estimates): configure who is emailed on EVERY
 * estimate acceptance. Self-contained (loads and saves its own rows), and
 * deliberately shaped like `PaidInFullEmailSettingsModal` so the two org-wide
 * notification editors read the same.
 *
 * - Gear opens for devs + masters; the list saves for DEV only (app_settings
 *   RLS is dev-write) — masters see it read-only with a note.
 * - This list is unioned with each estimate's own "Email when customer accepts"
 *   picker, so per-estimate extras keep working (`mergeEstimateAcceptNotifyRecipients`).
 * - Whoever ends up in the union is still filtered server-side by
 *   `estimate_accept_notify_filter_eligible_user_ids` (archived, no email, or no
 *   relationship to the estimate's owning master ⇒ skipped).
 */

type RecipientUser = {
  id: string
  name: string
  role: string | null
  email: string | null
}

/** Office-capable roles — the set the acceptance eligibility RPC reliably admits. */
function isOfficeCapableRole(role: string | null): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary'
}

export default function EstimateAcceptedNotifySettingsModal({ onClose }: { onClose: () => void }) {
  const { role: authRole } = useAuth()
  const { showToast } = useToastContext()
  const canEditRecipients = authRole === 'dev'

  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<RecipientUser[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [usersRes, settingRes] = await Promise.all([
          withSupabaseRetry(
            () =>
              supabase
                .from('users')
                .select('id, name, role, email, archived_at')
                .is('archived_at', null)
                .order('name'),
            'estimate accepted notify users',
          ),
          withSupabaseRetry<{ value_text: string | null } | null>(
            () =>
              supabase
                .from('app_settings')
                .select('value_text')
                .eq('key', APP_SETTINGS_KEY_ESTIMATE_ACCEPTED_NOTIFY_RECIPIENTS)
                .maybeSingle(),
            'estimate accepted notify setting',
          ),
        ])
        if (cancelled) return
        const rows = (usersRes as RecipientUser[] | null) ?? []
        setUsers(rows.filter((u) => isOfficeCapableRole(u.role)))
        const valueText = (settingRes as { value_text: string | null } | null)?.value_text ?? null
        setSelectedIds(new Set(parseEstimateAcceptedNotifyRecipients(valueText)))
      } catch (e) {
        if (!cancelled) showToast(formatErrorMessage(e, 'Could not load notification settings'), 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showToast])

  const toggleRecipient = (id: string) => {
    if (!canEditRecipients) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const saveRecipients = async () => {
    if (!canEditRecipients || saving) return
    setSaving(true)
    try {
      const ids = users.filter((u) => selectedIds.has(u.id)).map((u) => u.id)
      const { error } = await supabase.from('app_settings').upsert(
        {
          key: APP_SETTINGS_KEY_ESTIMATE_ACCEPTED_NOTIFY_RECIPIENTS,
          value_text: serializeEstimateAcceptedNotifyRecipients(ids),
        },
        { onConflict: 'key' },
      )
      if (error) throw error
      showToast('Estimate-accepted recipients saved.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save recipients'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const actionBtnStyle = (disabled: boolean): CSSProperties => ({
    height: 32,
    padding: '0 0.75rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    background: disabled ? 'var(--bg-muted)' : 'var(--surface)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: 'var(--text-700)',
    fontSize: '0.8125rem',
    fontWeight: 500,
  })

  const selectedCount = useMemo(() => users.filter((u) => selectedIds.has(u.id)).length, [users, selectedIds])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Estimate accepted notification settings"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          padding: '1.5rem',
          borderRadius: 8,
          width: 'min(560px, calc(100vw - 2rem))',
          maxHeight: '85vh',
          overflow: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Estimate accepted emails</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: 4 }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Whenever a customer accepts an estimate, the people below get an email — on every estimate, including ones
          already out with customers. Each estimate can still add extra people of its own under{' '}
          <strong>Email when customer accepts</strong>; those are sent as well as these.
        </p>

        <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Always notify ({selectedCount})</h3>
        {!canEditRecipients && (
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Read-only — only devs can change the recipient list.
          </p>
        )}
        {loading ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }} role="status">
            Loading…
          </p>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                marginBottom: '0.75rem',
                maxHeight: 260,
                overflow: 'auto',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '0.5rem',
              }}
            >
              {users.length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No eligible users found.</p>
              ) : (
                users.map((u) => (
                  <label
                    key={u.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.875rem',
                      padding: '3px 4px',
                      cursor: canEditRecipients ? 'pointer' : 'default',
                      opacity: canEditRecipients ? 1 : 0.8,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(u.id)}
                      disabled={!canEditRecipients}
                      onChange={() => toggleRecipient(u.id)}
                    />
                    <span style={{ fontWeight: 500 }}>{u.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{u.email?.trim() || '—'}</span>
                  </label>
                ))
              )}
            </div>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Anyone without an email address, or with no access to the estimate&apos;s owner, is skipped
              automatically.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => void saveRecipients()}
                disabled={!canEditRecipients || saving}
                style={actionBtnStyle(!canEditRecipients || saving)}
              >
                {saving ? 'Saving…' : 'Save recipients'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
