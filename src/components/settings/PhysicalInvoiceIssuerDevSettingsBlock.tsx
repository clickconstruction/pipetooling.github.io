import { useCallback, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import {
  getPhysicalInvoiceIssuerDraft,
  savePhysicalInvoiceIssuerDraft,
  type PhysicalInvoiceIssuer,
} from '../../lib/physicalInvoiceIssuer'

export default function PhysicalInvoiceIssuerDevSettingsBlock() {
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<PhysicalInvoiceIssuer>(() => getPhysicalInvoiceIssuerDraft())

  const reload = useCallback(() => {
    setDraft(getPhysicalInvoiceIssuerDraft())
  }, [])

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '0.5rem',
    fontSize: '0.875rem',
    border: '1px solid #d1d5db',
    borderRadius: 4,
  }

  return (
    <div style={{ marginBottom: '1.5rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => {
            const next = !prev
            if (next) reload()
            return next
          })
        }}
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
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
            Shown on detailed physical invoices (header, address block, page 2 tagline / license). Stored in this
            browser only.
          </p>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Company name</label>
          <input
            style={{ ...inputStyle, marginBottom: '0.75rem' }}
            value={draft.companyName}
            onChange={(e) => setDraft((d) => ({ ...d, companyName: e.target.value }))}
          />
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Address (multiline)</label>
          <textarea
            style={{ ...inputStyle, marginBottom: '0.75rem', minHeight: 72 }}
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
            onClick={() => {
              savePhysicalInvoiceIssuerDraft(draft)
              showToast('Company invoice block saved.', 'success')
            }}
            style={{
              padding: '0.5rem 1rem',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
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
