import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import {
  paidEmailVariantForRole,
  parsePaidJobEmailRecipients,
  serializePaidJobEmailRecipients,
} from '../../lib/paidJobEmail'
import { APP_SETTINGS_KEY_PAID_JOB_EMAIL_RECIPIENTS } from '../../lib/appSettingsKeys'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

/**
 * ⚙ across from the "Paid in Full" section header (Jobs → Stages): configure
 * who gets the "Customer paid" email when a job hits Paid in Full, and preview
 * or test the email itself. Self-contained (loads and saves its own rows).
 *
 * - Gear opens for devs + masters; the recipients editor saves for DEV only
 *   (app_settings RLS is dev-write) — masters see it read-only with a note.
 * - Devs/masters get the DETAILED financial review; everyone else the
 *   sterilized summary (badges via paidEmailVariantForRole).
 * - "Preview & test" (dev AND master): pick a job (search_jobs_ledger, same
 *   idiom as Dispatch Mode PO), then Preview detailed / Preview summary
 *   (opens the rendered HTML in a new tab) or Email me a test (detailed
 *   variant, caller's own address only).
 */

type RecipientUser = {
  id: string
  name: string
  role: string | null
  email: string | null
}

type JobPick = {
  id: string
  label: string
  address: string
}

/** Office-capable roles offered as recipients (mirrors the AR-button office set on this board). */
function isOfficeCapableRole(role: string | null): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary'
}

function openHtmlInNewTab(html: string) {
  const w = window.open('', '_blank')
  if (w) {
    w.document.write(html)
    w.document.close()
    return
  }
  // Popup-blocked fallback: Blob URL.
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export default function PaidInFullEmailSettingsModal({ onClose }: { onClose: () => void }) {
  const { role: authRole } = useAuth()
  const { showToast } = useToastContext()
  const canEditRecipients = authRole === 'dev'

  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<RecipientUser[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [saving, setSaving] = useState(false)

  const [jobSearch, setJobSearch] = useState('')
  const [jobSearching, setJobSearching] = useState(false)
  const [jobResults, setJobResults] = useState<JobPick[]>([])
  const [pickedJob, setPickedJob] = useState<JobPick | null>(null)
  const [previewBusy, setPreviewBusy] = useState<'detailed' | 'summary' | 'test' | null>(null)

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
            'paid email recipients users',
          ),
          withSupabaseRetry<{ value_text: string | null } | null>(
            () =>
              supabase
                .from('app_settings')
                .select('value_text')
                .eq('key', APP_SETTINGS_KEY_PAID_JOB_EMAIL_RECIPIENTS)
                .maybeSingle(),
            'paid email recipients setting',
          ),
        ])
        if (cancelled) return
        const rows = ((usersRes ?? []) as Array<RecipientUser & { archived_at: string | null }>).filter((u) =>
          isOfficeCapableRole(u.role),
        )
        setUsers(rows.map((u) => ({ id: u.id, name: (u.name ?? '').trim() || 'Unknown', role: u.role, email: u.email })))
        setSelectedIds(new Set(parsePaidJobEmailRecipients(settingRes?.value_text ?? null)))
      } catch (e) {
        if (!cancelled) showToast(formatErrorMessage(e, 'Could not load recipients'), 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showToast])

  // Job search (debounced) via the same RPC the Dispatch Mode PO picker uses.
  useEffect(() => {
    const q = jobSearch.trim()
    if (!q) {
      setJobResults([])
      setJobSearching(false)
      return
    }
    setJobSearching(true)
    const t = setTimeout(() => {
      void withSupabaseRetry(() => supabase.rpc('search_jobs_ledger', { search_text: q }), 'paid email job search')
        .then((rows) => {
          const jobs = (rows ?? []) as Array<{
            id: string
            hcp_number: string | null
            click_number: string | null
            job_name: string | null
            job_address: string | null
          }>
          setJobResults(
            jobs.slice(0, 8).map((j) => ({
              id: j.id,
              label: `${effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'} · ${(j.job_name ?? '').trim() || '—'}`,
              address: (j.job_address ?? '').trim(),
            })),
          )
        })
        .catch(() => setJobResults([]))
        .finally(() => setJobSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [jobSearch])

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
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { key: APP_SETTINGS_KEY_PAID_JOB_EMAIL_RECIPIENTS, value_text: serializePaidJobEmailRecipients(ids) },
          { onConflict: 'key' },
        )
      if (error) throw error
      showToast('Paid-email recipients saved.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save recipients'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const runPreview = async (variant: 'detailed' | 'summary') => {
    if (!pickedJob || previewBusy) return
    setPreviewBusy(variant)
    try {
      const { data, error } = await supabase.functions.invoke('paid-job-email', {
        body: { mode: 'preview', job_id: pickedJob.id, variant },
      })
      if (error) throw error
      const html = (data as { html?: string } | null)?.html
      if (!html) throw new Error((data as { error?: string } | null)?.error || 'No HTML returned')
      openHtmlInNewTab(html)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Preview failed'), 'error')
    } finally {
      setPreviewBusy(null)
    }
  }

  const runTestSend = async () => {
    if (!pickedJob || previewBusy) return
    setPreviewBusy('test')
    try {
      const { data, error } = await supabase.functions.invoke('paid-job-email', {
        body: { mode: 'test_send', job_id: pickedJob.id },
      })
      if (error) throw error
      if ((data as { success?: boolean } | null)?.success !== true) {
        throw new Error((data as { error?: string } | null)?.error || 'Send failed')
      }
      showToast('Test email sent to your address.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Test send failed'), 'error')
    } finally {
      setPreviewBusy(null)
    }
  }

  const badge = (role: string | null) => {
    const detailed = paidEmailVariantForRole(role) === 'detailed'
    return (
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          padding: '1px 8px',
          borderRadius: 9999,
          background: detailed ? 'var(--bg-amber-100)' : 'var(--bg-muted)',
          color: detailed ? 'var(--text-amber-800)' : 'var(--text-muted)',
          border: detailed ? '1px solid var(--border-amber)' : '1px solid var(--border)',
          whiteSpace: 'nowrap',
        }}
      >
        {detailed ? 'Detailed' : 'Summary'}
      </span>
    )
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
      aria-label="Paid in Full email settings"
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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Paid in Full emails</h2>
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
          When a job reaches Paid in Full, the people below get an email. Devs and masters receive the detailed
          financial review; everyone else receives a summary with no dollar amounts.
        </p>

        <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Recipients ({selectedCount})</h3>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: '0.75rem', maxHeight: 260, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem' }}>
            {users.map((u) => (
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
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.name}
                  {u.email ? <span style={{ color: 'var(--text-muted)' }}> · {u.email}</span> : null}
                </span>
                {badge(u.role)}
              </label>
            ))}
            {users.length === 0 && (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No eligible users found.</p>
            )}
          </div>
        )}
        {canEditRecipients && (
          <button
            type="button"
            onClick={() => void saveRecipients()}
            disabled={saving || loading}
            style={{
              height: 34,
              padding: '0 1rem',
              border: 'none',
              borderRadius: 4,
              background: saving || loading ? 'var(--bg-muted)' : '#2563eb',
              color: saving || loading ? 'var(--text-muted)' : '#fff',
              cursor: saving || loading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {saving ? 'Saving…' : 'Save recipients'}
          </button>
        )}

        <hr style={{ margin: '1.25rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />

        <h3 style={{ margin: '0 0 0.25rem', fontSize: '0.9375rem' }}>Preview &amp; test</h3>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Pick a job to see the email as recipients would, or send yourself a test.
        </p>
        <input
          type="search"
          value={jobSearch}
          onChange={(e) => {
            setJobSearch(e.target.value)
            setPickedJob(null)
          }}
          placeholder="Search jobs (number, name, address…)"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            height: 36,
            padding: '0 0.75rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            background: 'var(--surface)',
            color: 'inherit',
            fontSize: '0.875rem',
            marginBottom: '0.5rem',
          }}
        />
        {jobSearching && (
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }} role="status">
            Searching…
          </p>
        )}
        {!pickedJob && jobResults.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: '0.5rem', border: '1px solid var(--border)', borderRadius: 6, padding: '0.25rem', maxHeight: 180, overflow: 'auto' }}>
            {jobResults.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => setPickedJob(j)}
                style={{
                  textAlign: 'left',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: 4,
                  fontSize: '0.875rem',
                  color: 'inherit',
                }}
              >
                <div>{j.label}</div>
                {j.address && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{j.address}</div>}
              </button>
            ))}
          </div>
        )}
        {pickedJob && (
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem' }}>
            Selected: <strong>{pickedJob.label}</strong>
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void runPreview('detailed')}
            disabled={!pickedJob || previewBusy !== null}
            style={actionBtnStyle(!pickedJob || previewBusy !== null)}
          >
            {previewBusy === 'detailed' ? 'Building…' : 'Preview detailed'}
          </button>
          <button
            type="button"
            onClick={() => void runPreview('summary')}
            disabled={!pickedJob || previewBusy !== null}
            style={actionBtnStyle(!pickedJob || previewBusy !== null)}
          >
            {previewBusy === 'summary' ? 'Building…' : 'Preview summary'}
          </button>
          <button
            type="button"
            onClick={() => void runTestSend()}
            disabled={!pickedJob || previewBusy !== null}
            style={actionBtnStyle(!pickedJob || previewBusy !== null)}
          >
            {previewBusy === 'test' ? 'Sending…' : 'Email me a test'}
          </button>
        </div>
      </div>
    </div>
  )
}
