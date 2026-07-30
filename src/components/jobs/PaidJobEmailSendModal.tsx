import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { paidEmailVariantForRole } from '../../lib/paidJobEmail'
import {
  fetchPaidJobEmailPreview,
  openHtmlInNewTab,
  sendPaidJobEmailTest,
  sendPaidJobEmailTo,
} from '../../lib/paidJobEmailClient'

type PickerUser = {
  id: string
  name: string | null
  role: string | null
  email: string | null
}

type EmailVariant = 'detailed' | 'summary'

/**
 * Job Detail ✉ modal, preview-first (v2.1099; original send-only layout v2.970):
 * opens straight into the rendered detailed email inline (sandboxed iframe — the
 * email keeps its own light styling), with the send actions in the header:
 * "Send to me" ([TEST]-prefixed, same as the old "Email me a test") and
 * "Send to someone…" (the role-aware picker; the recipient's role picks the
 * variant server-side, and selecting someone flips the preview to their variant).
 * Dev + master_technician only (enforced server-side too). Notes — without
 * blocking — when the job isn't actually paid yet; since v2.1103 the email
 * itself is status-aware (progress banner + line items), so partial sends are
 * a feature, not a mistake.
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
  const [variant, setVariant] = useState<EmailVariant>('detailed')
  const [htmlByVariant, setHtmlByVariant] = useState<
    Partial<Record<EmailVariant, string>>
  >({})
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [users, setUsers] = useState<PickerUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const html = htmlByVariant[variant]

  // v2.1104: Esc closes this modal (preventDefault so a parent Esc listener —
  // Job Detail's — never also fires on the same press).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  useEffect(() => {
    if (htmlByVariant[variant]) return
    let cancelled = false
    setPreviewError(null)
    void (async () => {
      try {
        const rendered = await fetchPaidJobEmailPreview(jobId, variant)
        if (!cancelled)
          setHtmlByVariant((prev) => ({ ...prev, [variant]: rendered }))
      } catch (e) {
        if (!cancelled) setPreviewError(formatErrorMessage(e, 'Preview failed'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [jobId, variant, htmlByVariant])

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
        setUsers(
          ((data ?? []) as PickerUser[]).filter(
            (u) => (u.email ?? '').trim() !== '',
          ),
        )
      }
      setLoadingUsers(false)
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

  function selectPerson(u: PickerUser) {
    const isSel = selectedId === u.id
    setSelectedId(isSel ? null : u.id)
    // Show the sender exactly what this recipient will get.
    if (!isSel) setVariant(paidEmailVariantForRole(u.role))
  }

  const headerBtn = (bg: string): React.CSSProperties => ({
    padding: '0.35rem 0.75rem',
    background: bg,
    color: 'white',
    border: 'none',
    borderRadius: 4,
    cursor: busy ? 'not-allowed' : 'pointer',
    fontWeight: 600,
    fontSize: '0.8125rem',
  })

  const toggleBtn = (active: boolean): React.CSSProperties => ({
    padding: '0.2rem 0.7rem',
    fontSize: '0.8125rem',
    border: 'none',
    background: active ? 'var(--bg-blue-tint)' : 'transparent',
    color: active ? 'var(--text-link)' : 'var(--text-muted)',
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Paid-in-full email"
      onClick={() => (busy ? null : onClose())}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1020,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 760,
          // Real height (not just a cap) so the flex-1 preview frame fills it —
          // the email is the point of this modal.
          height: '90vh',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1rem',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            marginBottom: '0.25rem',
          }}
        >
          <span style={{ fontWeight: 700 }}>Paid-in-full email</span>
          <span
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              overflowWrap: 'anywhere',
            }}
          >
            {jobLabel}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              disabled={busy != null}
              onClick={() =>
                void run('me', async () => {
                  await sendPaidJobEmailTest(jobId)
                  showToast('Sent to you ([TEST] in the subject)', 'success')
                })
              }
              style={headerBtn('#16a34a')}
            >
              {busy === 'me' ? 'Sending…' : 'Send to me'}
            </button>
            <button
              type="button"
              disabled={busy != null}
              onClick={() => setPickerOpen((o) => !o)}
              aria-expanded={pickerOpen}
              style={headerBtn('#2563eb')}
            >
              Send to someone…
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.1rem',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0 0.2rem',
              }}
            >
              ✕
            </button>
          </span>
        </div>

        {jobStatus !== 'paid' && (
          <p
            style={{
              margin: '0.35rem 0 0',
              fontSize: '0.8125rem',
              color: 'var(--text-amber-800)',
              background: 'var(--bg-amber-tint)',
              border: '1px solid var(--border-amber)',
              borderRadius: 6,
              padding: '0.5rem 0.7rem',
            }}
          >
            This job isn&rsquo;t Paid in Full — the email shows its payment progress instead of the
            green paid banner.
          </p>
        )}

        {pickerOpen && (
          <div
            style={{
              margin: '0.6rem 0 0',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.6rem',
            }}
          >
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people…"
              aria-label="Search people"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.45rem 0.6rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                marginBottom: '0.5rem',
                background: 'var(--surface)',
                color: 'var(--text-base)',
              }}
            />
            {loadingUsers ? (
              <p
                style={{
                  margin: 0,
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)',
                }}
              >
                Loading people…
              </p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  maxHeight: '9rem',
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '0.35rem',
                }}
              >
                {visible.map((u) => {
                  const uVariant = paidEmailVariantForRole(u.role)
                  const isSel = selectedId === u.id
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => selectPerson(u)}
                      aria-pressed={isSel}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.35rem 0.5rem',
                        border: isSel
                          ? '2px solid #f97316'
                          : '1px solid var(--border)',
                        borderRadius: 6,
                        background: isSel
                          ? 'var(--bg-subtle)'
                          : 'var(--surface)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        font: 'inherit',
                        color: 'inherit',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                        {(u.name ?? '').trim() || 'Unnamed'}
                      </span>
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color:
                            uVariant === 'detailed'
                              ? 'var(--text-green-600)'
                              : 'var(--text-muted)',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 999,
                          padding: '0 0.45rem',
                        }}
                      >
                        {uVariant === 'detailed' ? 'Detailed' : 'Summary'}
                      </span>
                    </button>
                  )
                })}
                {visible.length === 0 && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.8125rem',
                      color: 'var(--text-faint)',
                      padding: '0.25rem',
                    }}
                  >
                    No matches.
                  </p>
                )}
              </div>
            )}
            <button
              type="button"
              disabled={busy != null || !selected}
              onClick={() =>
                selected &&
                void run('send', async () => {
                  const sentVariant = await sendPaidJobEmailTo(
                    jobId,
                    selected.id,
                  )
                  showToast(
                    `Sent ${sentVariant} email to ${(selected.name ?? '').trim() || 'them'}`,
                    'success',
                  )
                  onClose()
                })
              }
              style={{
                ...headerBtn(!selected ? '#9ca3af' : '#16a34a'),
                width: '100%',
                marginTop: '0.5rem',
                padding: '0.55rem',
                cursor: busy != null || !selected ? 'not-allowed' : 'pointer',
              }}
            >
              {busy === 'send'
                ? 'Sending…'
                : selected
                  ? `Send to ${(selected.name ?? '').trim() || 'selected person'}`
                  : 'Pick someone to send to'}
            </button>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            margin: '0.6rem 0 0.4rem',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setVariant('detailed')}
              aria-pressed={variant === 'detailed'}
              style={toggleBtn(variant === 'detailed')}
            >
              Detailed
            </button>
            <button
              type="button"
              onClick={() => setVariant('summary')}
              aria-pressed={variant === 'summary'}
              style={toggleBtn(variant === 'summary')}
            >
              Summary
            </button>
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Summary is what non-financial roles receive.
          </span>
          <button
            type="button"
            disabled={!html}
            onClick={() => html && openHtmlInNewTab(html)}
            title="Open preview in a new tab"
            aria-label="Open preview in a new tab"
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: html ? 'pointer' : 'default',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
              padding: '0 0.2rem',
            }}
          >
            ⧉
          </button>
        </div>

        <div
          data-theme="light"
          style={{
            flex: 1,
            minHeight: '16rem',
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflow: 'hidden',
            background: 'var(--surface)',
          }}
        >
          {previewError ? (
            <p
              style={{
                margin: 0,
                padding: '1rem',
                fontSize: '0.8125rem',
                color: 'var(--text-red-700)',
              }}
            >
              {previewError}
            </p>
          ) : html ? (
            <iframe
              title="Paid-in-full email preview"
              sandbox=""
              srcDoc={html}
              style={{
                width: '100%',
                height: '100%',
                minHeight: '16rem',
                border: 'none',
                display: 'block',
                background: 'var(--surface)',
              }}
            />
          ) : (
            <p
              style={{
                margin: 0,
                padding: '1rem',
                fontSize: '0.8125rem',
                color: 'var(--text-muted)',
              }}
            >
              Building the email preview…
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
