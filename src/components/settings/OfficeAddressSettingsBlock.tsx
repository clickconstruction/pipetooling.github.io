import { useCallback, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  deleteOfficeAddressSetting,
  fetchOfficeAddressFromAppSettings,
  saveOfficeAddressFromAddress,
} from '../../lib/officeAddressSettings'

/** Self-contained (loads/saves its own app_settings row) like MapDefaultViewSettingsBlock. */
export default function OfficeAddressSettingsBlock() {
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)

  const loadFromServer = useCallback(async () => {
    setLoading(true)
    try {
      const v = await fetchOfficeAddressFromAppSettings()
      setAddress(v?.address ?? '')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load office address'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  return (
    <div style={{ marginBottom: '1.5rem', border: '1px solid var(--border)', borderRadius: 8 }}>
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => {
            const next = !prev
            if (next) void loadFromServer()
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
        Office address (bid distance anchor)
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
            The office's street address — the anchor for the bid form's <strong>Distance to Office</strong>{' '}
            auto-fill. Saving geocodes the address once and stores coordinates in <code>app_settings</code>. When
            unset, the auto-fill falls back to the <strong>Map default view</strong> address below. Dev-only write;
            all roles can read.
          </p>
          {loading ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : (
            <>
              <label htmlFor="office-address-input" style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
                Address
              </label>
              <input
                id="office-address-input"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, city, state ZIP"
                autoComplete="street-address"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  marginBottom: '0.75rem',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    void (async () => {
                      setSaving(true)
                      try {
                        const r = await saveOfficeAddressFromAddress(address)
                        if (r.ok) {
                          showToast('Office address saved.', 'success')
                        } else {
                          showToast(r.message, 'error')
                        }
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
                    cursor: saving ? 'wait' : 'pointer',
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                  }}
                >
                  {saving ? 'Geocoding & saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  disabled={clearing}
                  onClick={() => {
                    void (async () => {
                      setClearing(true)
                      try {
                        await deleteOfficeAddressSetting()
                        setAddress('')
                        showToast('Office address cleared. Distance auto-fill falls back to the Map default view.', 'success')
                      } catch (e) {
                        showToast(formatErrorMessage(e, 'Clear failed'), 'error')
                      } finally {
                        setClearing(false)
                      }
                    })()
                  }}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.875rem',
                    cursor: clearing ? 'wait' : 'pointer',
                    background: 'var(--surface)',
                    color: 'var(--text-700)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                  }}
                >
                  {clearing ? 'Clearing…' : 'Clear'}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
