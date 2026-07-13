import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  BILL_CUSTOMER_MEMO_CUSTOM_PRESET_MAX,
  BILL_CUSTOMER_MEMO_LABEL_MAX_CHARS,
  BILL_CUSTOMER_MEMO_MAX_CHARS,
  BILL_CUSTOMER_MEMO_SHIPPED_LABEL_ALTERNATE,
  BILL_CUSTOMER_MEMO_SHIPPED_LABEL_STANDARD,
  fetchBillCustomerMemoPresetsFromAppSettings,
  getBillCustomerMemoSettingsDraft,
  saveBillCustomerMemoPresetsState,
  type BillCustomerMemoCustomPreset,
} from '../../lib/billCustomerMemoPresets'

export default function BillCustomerMemoDevSettingsBlock() {
  const { role: authRole } = useAuth()
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [standardText, setStandardText] = useState(() => getBillCustomerMemoSettingsDraft().standardBody)
  const [alternateText, setAlternateText] = useState(() => getBillCustomerMemoSettingsDraft().alternateBody)
  const [standardLabel, setStandardLabel] = useState(() => getBillCustomerMemoSettingsDraft().standardLabel)
  const [alternateLabel, setAlternateLabel] = useState(() => getBillCustomerMemoSettingsDraft().alternateLabel)
  const [defaultPresetId, setDefaultPresetId] = useState(() => getBillCustomerMemoSettingsDraft().defaultPresetId)
  const [customRows, setCustomRows] = useState<BillCustomerMemoCustomPreset[]>(
    () => getBillCustomerMemoSettingsDraft().customPresets,
  )

  const defaultPresetSelectOptions = useMemo(() => {
    const stdL = standardLabel.trim() || BILL_CUSTOMER_MEMO_SHIPPED_LABEL_STANDARD
    const altL = alternateLabel.trim() || BILL_CUSTOMER_MEMO_SHIPPED_LABEL_ALTERNATE
    return [
      { id: 'standard' as const, label: stdL },
      { id: 'alternate' as const, label: altL },
      ...customRows
        .filter((r) => r.label.trim().length > 0 && r.body.trim().length > 0)
        .map((r) => ({ id: r.id, label: r.label.trim() || 'Untitled' })),
    ]
  }, [standardLabel, alternateLabel, customRows])

  const defaultSelectValue = defaultPresetSelectOptions.some((o) => o.id === defaultPresetId)
    ? defaultPresetId
    : 'standard'

  const reloadFromStorage = useCallback(() => {
    const d = getBillCustomerMemoSettingsDraft()
    setStandardText(d.standardBody)
    setAlternateText(d.alternateBody)
    setStandardLabel(d.standardLabel)
    setAlternateLabel(d.alternateLabel)
    setDefaultPresetId(d.defaultPresetId)
    setCustomRows(d.customPresets)
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      await fetchBillCustomerMemoPresetsFromAppSettings({ authRole })
      if (cancelled) return
      reloadFromStorage()
    })()
    return () => {
      cancelled = true
    }
  }, [open, authRole, reloadFromStorage])

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
        Bill Customer memo presets
      </button>
      {open ? (
        <div
          style={{
            padding: '0 1rem 1rem 1rem',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-page)',
          }}
        >
          <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5 }}>
            These presets apply <strong>organization-wide</strong> for Bill Customer <strong>Memo</strong> on Stripe,
            HouseCall Pro, and Physical tabs (all signed-in users). Shipped defaults stay empty until you save overrides
            here.
          </p>
          <p style={{ margin: '0 0 0.65rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>
            Builtin: standard
          </p>
          <label
            htmlFor="bill-customer-memo-preset-standard-label"
            style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}
          >
            Display name
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              {' '}
              ({standardLabel.length} / {BILL_CUSTOMER_MEMO_LABEL_MAX_CHARS})
            </span>
          </label>
          <input
            id="bill-customer-memo-preset-standard-label"
            type="text"
            value={standardLabel}
            onChange={(e) => setStandardLabel(e.target.value.slice(0, BILL_CUSTOMER_MEMO_LABEL_MAX_CHARS))}
            style={{ ...inputStyle, marginBottom: '0.5rem' }}
          />
          <label htmlFor="bill-customer-memo-preset-standard" style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
            Body
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              {' '}
              ({standardText.length} / {BILL_CUSTOMER_MEMO_MAX_CHARS})
            </span>
          </label>
          <textarea
            id="bill-customer-memo-preset-standard"
            value={standardText}
            onChange={(e) => setStandardText(e.target.value.slice(0, BILL_CUSTOMER_MEMO_MAX_CHARS))}
            rows={4}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginBottom: '0.75rem',
              padding: '0.5rem',
              fontSize: '0.875rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              resize: 'vertical',
              lineHeight: 1.4,
            }}
          />
          <p style={{ margin: '0 0 0.65rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>
            Builtin: alternate
          </p>
          <label
            htmlFor="bill-customer-memo-preset-alternate-label"
            style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}
          >
            Display name
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              {' '}
              ({alternateLabel.length} / {BILL_CUSTOMER_MEMO_LABEL_MAX_CHARS})
            </span>
          </label>
          <input
            id="bill-customer-memo-preset-alternate-label"
            type="text"
            value={alternateLabel}
            onChange={(e) => setAlternateLabel(e.target.value.slice(0, BILL_CUSTOMER_MEMO_LABEL_MAX_CHARS))}
            style={{ ...inputStyle, marginBottom: '0.5rem' }}
          />
          <label htmlFor="bill-customer-memo-preset-alternate" style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
            Body
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              {' '}
              ({alternateText.length} / {BILL_CUSTOMER_MEMO_MAX_CHARS})
            </span>
          </label>
          <textarea
            id="bill-customer-memo-preset-alternate"
            value={alternateText}
            onChange={(e) => setAlternateText(e.target.value.slice(0, BILL_CUSTOMER_MEMO_MAX_CHARS))}
            rows={4}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginBottom: '0.75rem',
              padding: '0.5rem',
              fontSize: '0.875rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              resize: 'vertical',
              lineHeight: 1.4,
            }}
          />
          <label htmlFor="bill-customer-memo-default-preset" style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 6 }}>
            Default when opening Bill Customer
          </label>
          <select
            id="bill-customer-memo-default-preset"
            value={defaultSelectValue}
            onChange={(e) => setDefaultPresetId(e.target.value)}
            style={{
              ...inputStyle,
              marginBottom: '1rem',
              maxWidth: '22rem',
              cursor: 'pointer',
            }}
          >
            {defaultPresetSelectOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-700)' }}>
            Additional presets
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              {' '}
              (max {BILL_CUSTOMER_MEMO_CUSTOM_PRESET_MAX})
            </span>
          </h4>
          <p style={{ margin: '0 0 0.65rem', color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.45 }}>
            Rows with empty label or body are skipped when you Save.
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {customRows.map((row, idx) => (
              <li
                key={row.id}
                style={{
                  marginBottom: '0.85rem',
                  paddingBottom: '0.85rem',
                  borderBottom: idx < customRows.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-end',
                    gap: '0.5rem',
                    marginBottom: 6,
                  }}
                >
                  <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                    <label
                      htmlFor={`bill-customer-memo-custom-${row.id}-label`}
                      style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}
                    >
                      Label
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {' '}
                        ({row.label.length} / {BILL_CUSTOMER_MEMO_LABEL_MAX_CHARS})
                      </span>
                    </label>
                    <input
                      id={`bill-customer-memo-custom-${row.id}-label`}
                      type="text"
                      value={row.label}
                      onChange={(e) => {
                        const v = e.target.value.slice(0, BILL_CUSTOMER_MEMO_LABEL_MAX_CHARS)
                        setCustomRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, label: v } : r)))
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '0.35rem 0.5rem',
                        fontSize: '0.875rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomRows((prev) => prev.filter((r) => r.id !== row.id))}
                    style={{
                      padding: '0.3rem 0.55rem',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      background: 'var(--surface)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      color: 'var(--text-red-700)',
                      flexShrink: 0,
                    }}
                  >
                    Remove
                  </button>
                </div>
                <label
                  htmlFor={`bill-customer-memo-custom-${row.id}-body`}
                  style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}
                >
                  Body
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {' '}
                    ({row.body.length} / {BILL_CUSTOMER_MEMO_MAX_CHARS})
                  </span>
                </label>
                <textarea
                  id={`bill-customer-memo-custom-${row.id}-body`}
                  value={row.body}
                  onChange={(e) => {
                    const v = e.target.value.slice(0, BILL_CUSTOMER_MEMO_MAX_CHARS)
                    setCustomRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, body: v } : r)))
                  }}
                  rows={3}
                  style={{
                    display: 'block',
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    resize: 'vertical',
                    lineHeight: 1.4,
                  }}
                />
              </li>
            ))}
          </ul>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                disabled={customRows.length >= BILL_CUSTOMER_MEMO_CUSTOM_PRESET_MAX}
                onClick={() => {
                  setCustomRows((prev) => [...prev, { id: crypto.randomUUID(), label: '', body: '' }])
                }}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.875rem',
                  cursor: customRows.length >= BILL_CUSTOMER_MEMO_CUSTOM_PRESET_MAX ? 'not-allowed' : 'pointer',
                  opacity: customRows.length >= BILL_CUSTOMER_MEMO_CUSTOM_PRESET_MAX ? 0.55 : 1,
                }}
              >
                Add preset
              </button>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                void (async () => {
                  const resolvedDefault = defaultPresetSelectOptions.some((o) => o.id === defaultPresetId)
                    ? defaultPresetId
                    : 'standard'
                  setSaving(true)
                  try {
                    await saveBillCustomerMemoPresetsState({
                      standardBody: standardText,
                      alternateBody: alternateText,
                      standardLabel,
                      alternateLabel,
                      customPresets: customRows,
                      defaultPresetId: resolvedDefault,
                    })
                    reloadFromStorage()
                    showToast('Bill Customer memo presets saved for your organization.', 'success')
                  } catch (e) {
                    showToast(formatErrorMessage(e, 'Save failed'), 'error')
                  } finally {
                    setSaving(false)
                  }
                })()
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                opacity: saving ? 0.65 : 1,
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
