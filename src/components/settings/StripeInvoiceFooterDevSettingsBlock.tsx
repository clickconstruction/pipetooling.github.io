import { useCallback, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import {
  getStripeInvoiceFooterPresetElectrical,
  getStripeInvoiceFooterPresetPlumbing,
  resetStripeInvoiceFooterPresetsToBuiltins,
  saveStripeInvoiceFooterPresetsFromForm,
  STRIPE_INVOICE_FOOTER_MAX_CHARS,
  STRIPE_INVOICE_FOOTER_PRESET_ELECTRICAL,
  STRIPE_INVOICE_FOOTER_PRESET_PLUMBING,
} from '../../lib/stripeInvoiceFooter'

export default function StripeInvoiceFooterDevSettingsBlock() {
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [plumbingText, setPlumbingText] = useState(() => getStripeInvoiceFooterPresetPlumbing())
  const [electricalText, setElectricalText] = useState(() => getStripeInvoiceFooterPresetElectrical())

  const reloadFromStorage = useCallback(() => {
    setPlumbingText(getStripeInvoiceFooterPresetPlumbing())
    setElectricalText(getStripeInvoiceFooterPresetElectrical())
  }, [])

  return (
    <div style={{ marginBottom: '1.5rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => {
            const next = !prev
            if (next) reloadFromStorage()
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
        <span style={{ fontSize: '0.75rem' }}>{open ? '▼' : '▶'}</span>
        Stripe invoice footer presets
      </button>
      {open ? (
        <div
          style={{
            padding: '0 1rem 1rem 1rem',
            borderTop: '1px solid #e5e7eb',
            background: '#fafafa',
          }}
        >
          <p style={{ margin: '0 0 0.75rem', color: '#6b7280', fontSize: '0.875rem', lineHeight: 1.5 }}>
            Overrides apply to Bill Customer footer presets on this browser only. Shipped defaults remain in the repo;
            Reset restores those strings.
          </p>
          <label htmlFor="stripe-footer-preset-plumbing" style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
            Plumbing
            <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.75rem' }}>
              {' '}
              ({plumbingText.length} / {STRIPE_INVOICE_FOOTER_MAX_CHARS})
            </span>
          </label>
          <textarea
            id="stripe-footer-preset-plumbing"
            value={plumbingText}
            onChange={(e) => setPlumbingText(e.target.value.slice(0, STRIPE_INVOICE_FOOTER_MAX_CHARS))}
            rows={6}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginBottom: '0.75rem',
              padding: '0.5rem',
              fontSize: '0.875rem',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              resize: 'vertical',
              lineHeight: 1.4,
            }}
          />
          <label htmlFor="stripe-footer-preset-electrical" style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
            Electrical
            <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.75rem' }}>
              {' '}
              ({electricalText.length} / {STRIPE_INVOICE_FOOTER_MAX_CHARS})
            </span>
          </label>
          <textarea
            id="stripe-footer-preset-electrical"
            value={electricalText}
            onChange={(e) => setElectricalText(e.target.value.slice(0, STRIPE_INVOICE_FOOTER_MAX_CHARS))}
            rows={6}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginBottom: '0.75rem',
              padding: '0.5rem',
              fontSize: '0.875rem',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              resize: 'vertical',
              lineHeight: 1.4,
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => {
                saveStripeInvoiceFooterPresetsFromForm(plumbingText, electricalText)
                reloadFromStorage()
                showToast('Stripe footer presets saved for this browser.', 'success')
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                resetStripeInvoiceFooterPresetsToBuiltins()
                setPlumbingText(STRIPE_INVOICE_FOOTER_PRESET_PLUMBING)
                setElectricalText(STRIPE_INVOICE_FOOTER_PRESET_ELECTRICAL)
                showToast('Footer presets reset to shipped defaults.', 'success')
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                cursor: 'pointer',
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 4,
              }}
            >
              Reset to shipped defaults
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
