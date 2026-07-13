import { useCallback, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  DEFAULT_MAP_FALLBACK_ZOOM,
  deleteMapDefaultViewSetting,
  fetchMapDefaultViewFromAppSettings,
  saveMapDefaultViewFromAddress,
} from '../../lib/mapDefaultViewSettings'

export default function MapDefaultViewSettingsBlock() {
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [address, setAddress] = useState('')
  const [zoom, setZoom] = useState(DEFAULT_MAP_FALLBACK_ZOOM)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)

  const loadFromServer = useCallback(async () => {
    setLoading(true)
    try {
      const v = await fetchMapDefaultViewFromAppSettings()
      if (v) {
        setAddress(v.addressLabel)
        setZoom(v.zoom)
      } else {
        setAddress('')
        setZoom(DEFAULT_MAP_FALLBACK_ZOOM)
      }
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load map default'), 'error')
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
        Map default view (address)
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
            Org-wide default center and zoom for the <strong>Map</strong> page when there are no pins to fit. Saving
            geocodes the address once and stores coordinates in <code>app_settings</code>. Clear removes the custom
            default (map falls back to Chicago). Dev-only write; all roles can read.
          </p>
          {loading ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : (
            <>
              <label htmlFor="map-default-address" style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
                Address
              </label>
              <input
                id="map-default-address"
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
              <label htmlFor="map-default-zoom" style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
                Zoom ({4}–{18})
              </label>
              <input
                id="map-default-zoom"
                type="number"
                min={4}
                max={18}
                step={1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                style={{
                  width: 100,
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
                        const r = await saveMapDefaultViewFromAddress(address, Math.round(zoom))
                        if (r.ok) {
                          showToast('Map default saved.', 'success')
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
                        await deleteMapDefaultViewSetting()
                        setAddress('')
                        setZoom(DEFAULT_MAP_FALLBACK_ZOOM)
                        showToast('Map default cleared. Map will use the built-in Chicago fallback until you save again.', 'success')
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
                  {clearing ? 'Clearing…' : 'Clear custom default'}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
