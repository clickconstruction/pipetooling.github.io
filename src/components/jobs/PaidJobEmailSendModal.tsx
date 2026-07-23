import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { paidEmailVariantForRole } from '../../lib/paidJobEmail'
import { fetchPaidJobEmailPreview, openHtmlInNewTab, sendPaidJobEmailTest, sendPaidJobEmailTo } from '../../lib/paidJobEmailClient'

type PickerUser = { id: string; name: string | null; role: string | null; email: string | null }

/**
 * Job Detail ✉ modal (v2.970): send the paid-in-full email for THIS job to a
 * chosen person (variant decided by the recipient's role — a sender can't mail
 * financials to a summary-tier role), preview either variant in a new tab, or
 * email yourself a [TEST]. Dev + master_technician only (enforced server-side
 * too). Warns — without blocking — when the job isn't actually paid yet.
 */
export default function PaidJobEmailSendModal({
  jobId,
  jobLabel,
  jobStatus,
  onClose,
}: {
  jobId: string
  jobLabel: string
  jobStatus: string | null
  onClose: () => void
}) {
  const { showToast } = useToastContext()
  const [users, setUsers] = useState<PickerUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, role, email')
        .is('archived_at', null)
        .order('name')
      if (cancelled) return
      if (error) {
        showToast(formatErrorMessage(error, 'Failed to load people'), 'error')
        setUsers([])
      } else {
        setUsers(((data ?? []) as PickerUser[]).filter((u) => (u.email ?? '').trim() !== ''))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [showToast])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => (u.name ?? '').toLowerCase().includes(q))
  }, [users, search])

  const selected = users.find((u) => u.id === selectedId) ?? null

  async function run(key: string, fn: () => Promise<void>) {
    if (busy) return
    setBusy(key)
    try {
      await fn()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const actionBtn = (bg: string): React.CSSProperties => ({
    padding: '0.45rem 0.9rem',
    background: bg,
    color: 'white',
    border: 'none',
    borderRadius: 4,
    cursor: busy ? 'not-allowed' : 'pointer',
    fontWeight: 600,
    fontSize: '0.8125rem',
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Send paid-in-full email"
      onClick={() => (busy ? null : onClose())}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1020, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 460, maxHeight: '85vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 8, padding: '1rem', boxSizing: 'border-box' }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontWeight: 700 }}>Send paid-in-full email</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '1.1rem', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
            ✕
          </button>
        </div>
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{jobLabel}</p>

        {jobStatus !== 'paid' && (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 6, padding: '0.5rem 0.7rem' }}>
            This job isn&rsquo;t Paid in Full — the email will still say it is.
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
          <button type="button" disabled={busy != null} onClick={() => void run('pd', async () => openHtmlInNewTab(await fetchPaidJobEmailPreview(jobId, 'detailed')))} style={actionBtn('#2563eb')}>
            {busy === 'pd' ? 'Loading…' : 'Preview detailed'}
          </button>
          <button type="button" disabled={busy != null} onClick={() => void run('ps', async () => openHtmlInNewTab(await fetchPaidJobEmailPreview(jobId, 'summary')))} style={actionBtn('#2563eb')}>
            {busy === 'ps' ? 'Loading…' : 'Preview summary'}
          </button>
          <button
            type="button"
            disabled={busy != null}
            onClick={() => void run('ts', async () => {
              await sendPaidJobEmailTest(jobId)
              showToast('Test email sent to you', 'success')
            })}
            style={actionBtn('#16a34a')}
          >
            {busy === 'ts' ? 'Sending…' : 'Email me a test'}
          </button>
        </div>

        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Send to someone</div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people…"
          aria-label="Search people"
          style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, marginBottom: '0.5rem', background: 'var(--surface)', color: 'var(--text-base)' }}
        />
        {loading ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading people…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '11rem', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: '0.35rem' }}>
            {visible.map((u) => {
              const variant = paidEmailVariantForRole(u.role)
              const isSel = selectedId === u.id
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedId(isSel ? null : u.id)}
                  aria-pressed={isSel}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem', border: isSel ? '2px solid #f97316' : '1px solid var(--border)', borderRadius: 6, background: isSel ? 'var(--bg-subtle)' : 'var(--surface)', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{(u.name ?? '').trim() || 'Unnamed'}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700, color: variant === 'detailed' ? 'var(--text-green-600)' : 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0 0.45rem' }}>
                    {variant === 'detailed' ? 'Detailed' : 'Summary'}
                  </span>
                </button>
              )
            })}
            {visible.length === 0 && <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-faint)', padding: '0.25rem' }}>No matches.</p>}
          </div>
        )}
        <button
          type="button"
          disabled={busy != null || !selected}
          onClick={() =>
            selected &&
            void run('send', async () => {
              const variant = await sendPaidJobEmailTo(jobId, selected.id)
              showToast(`Sent ${variant} email to ${(selected.name ?? '').trim() || 'them'}`, 'success')
              onClose()
            })
          }
          style={{ ...actionBtn(!selected ? '#9ca3af' : '#16a34a'), width: '100%', marginTop: '0.6rem', padding: '0.6rem', cursor: busy != null || !selected ? 'not-allowed' : 'pointer' }}
        >
          {busy === 'send' ? 'Sending…' : selected ? `Send to ${(selected.name ?? '').trim() || 'selected person'}` : 'Pick someone to send to'}
        </button>
      </div>
    </div>
  )
}
