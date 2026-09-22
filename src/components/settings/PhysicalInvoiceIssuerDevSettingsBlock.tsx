import { useCallback, useEffect, useRef, useState } from 'react'
import { scrollWhenVisible } from '../../lib/scrollWhenVisible'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  fetchPhysicalInvoiceIssuerFromAppSettings,
  getPhysicalInvoiceIssuerDraft,
  savePhysicalInvoiceIssuerDraft,
  type PhysicalInvoiceIssuer,
} from '../../lib/physicalInvoiceIssuer'

export default function PhysicalInvoiceIssuerDevSettingsBlock({ focusField = null }: { /** A field to open on and ring for a moment (v2.3697): 'companyName' | 'addressText' — the Lien desk's door. */ focusField?: string | null } = {}) {
  const { role: authRole } = useAuth()
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(Boolean(focusField))
  const [ring, setRing] = useState<string | null>(focusField)
  const ringRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!focusField) return
    setOpen(true)
    setRing(focusField)
    // The tab this block sits in shows only once Settings' groups load: scroll when the field is actually on screen, and ring from then.
    let calm: number | null = null
    const cancel = scrollWhenVisible(() => ringRef.current, { block: 'center' })
    const armCalm = window.setTimeout(() => {
      calm = window.setTimeout(() => setRing(null), 4000)
    }, 600)
    return () => {
      cancel()
      window.clearTimeout(armCalm)
      if (calm != null) window.clearTimeout(calm)
    }
  }, [focusField])
  const ringStyle = (key: string) => (ring === key ? { boxShadow: '0 0 0 2px var(--surface), 0 0 0 4px var(--text-link)', background: 'var(--bg-blue-tint)' } : {})
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<PhysicalInvoiceIssuer>(() => getPhysicalInvoiceIssuerDraft())

  const reload = useCallback(() => {
    setDraft(getPhysicalInvoiceIssuerDraft())
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      await fetchPhysicalInvoiceIssuerFromAppSettings({ authRole })
      if (cancelled) return
      reload()
    })()
    return () => {
      cancelled = true
    }
  }, [open, authRole, reload])

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '0.5rem',
    fontSize: '0.875rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
  }

  return (
    <div style={{ marginBottom: '1.5rem', border: '1px solid var(--border)', borderRadius: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          margin: 0,
          padding: '1rem',
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '0.75rem' }}>{open ? '▼' : '\u25b6'}</span>
        Physical invoice — company on PDF (customer-facing)
      </button>
      {open ? (
        <div style={{ padding: '0 1rem 1rem' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Shown on detailed physical invoices (header, address block, page 2 tagline / license). Applies{' '}
            <strong>organization-wide</strong> for all signed-in users.
          </p>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Company name</label>
          <input
            style={{ ...inputStyle, marginBottom: '0.75rem', ...ringStyle('companyName') }}
            ref={ring === 'companyName' ? (ringRef as React.RefObject<HTMLInputElement>) : undefined}
            data-settings-focus="issuer.companyName"
            value={draft.companyName}
            onChange={(e) => setDraft((d) => ({ ...d, companyName: e.target.value }))}
          />
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Address (multiline)</label>
          <textarea
            style={{ ...inputStyle, marginBottom: '0.75rem', minHeight: 72, ...ringStyle('addressText') }}
            ref={ring === 'addressText' ? (ringRef as React.RefObject<HTMLTextAreaElement>) : undefined}
            data-settings-focus="issuer.addressText"
            value={draft.addressText}
            onChange={(e) => setDraft((d) => ({ ...d, addressText: e.target.value }))}
          />
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Phone</label>
          <input
            style={{ ...inputStyle, marginBottom: '0.75rem' }}
            value={draft.phone}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
          />
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Email</label>
          <input
            style={{ ...inputStyle, marginBottom: '0.75rem' }}
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
          />
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Tagline (page 2 header)</label>
          <input
            style={{ ...inputStyle, marginBottom: '0.75rem' }}
            value={draft.tagline}
            onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))}
          />
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>License / regulatory line</label>
          <textarea
            style={{ ...inputStyle, marginBottom: '0.75rem', minHeight: 56 }}
            value={draft.licenseLine}
            onChange={(e) => setDraft((d) => ({ ...d, licenseLine: e.target.value }))}
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              void (async () => {
                setSaving(true)
                try {
                  await savePhysicalInvoiceIssuerDraft(draft)
                  reload()
                  showToast('Physical invoice company block saved for your organization.', 'success')
                } catch (e) {
                  showToast(formatErrorMessage(e, 'Save failed'), 'error')
                } finally {
                  setSaving(false)
                }
              })()
            }}
            style={{
              padding: '0.5rem 1rem',
              background: saving ? '#93c5fd' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: 500,
            }}
          >
            Save
          </button>
        </div>
      ) : null}
    </div>
  )
}
