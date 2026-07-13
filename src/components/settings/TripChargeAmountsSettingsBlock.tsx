import { useCallback, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  APP_SETTINGS_KEY_TRIP_CHARGE_CLIENT_NOT_HOME,
  APP_SETTINGS_KEY_TRIP_CHARGE_SITE_NOT_READY,
} from '../../lib/appSettingsKeys'

const FIELDS = [
  { key: APP_SETTINGS_KEY_TRIP_CHARGE_CLIENT_NOT_HOME, label: 'Client not home ($)' },
  { key: APP_SETTINGS_KEY_TRIP_CHARGE_SITE_NOT_READY, label: 'Site not ready ($)' },
] as const

/** Self-contained (loads/saves its own app_settings rows) like MapDefaultViewSettingsBlock. */
export default function TripChargeAmountsSettingsBlock() {
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadFromServer = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value_num')
        .in('key', FIELDS.map((f) => f.key))
      if (error) throw error
      const next: Record<string, string> = {}
      for (const f of FIELDS) {
        const n = (data ?? []).find((r) => r.key === f.key)?.value_num
        next[f.key] = n != null && Number(n) > 0 ? String(n) : ''
      }
      setValues(next)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load trip charge amounts'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      for (const f of FIELDS) {
        const raw = (values[f.key] ?? '').trim()
        const n = Number(raw)
        const valueNum = raw !== '' && Number.isFinite(n) && n > 0 ? n : null
        const { error } = await supabase
          .from('app_settings')
          .upsert({ key: f.key, value_num: valueNum }, { onConflict: 'key' })
        if (error) throw error
      }
      showToast('Trip charge amounts saved', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save trip charge amounts'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
      <button
        type="button"
        aria-expanded={open}
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
        Turnaway Trip Charges (dev)
      </button>
      {open && (
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ marginBottom: '1rem', marginTop: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Default amounts pre-filled in the Dispatch inbox “Create trip charge” modal when a tech
            files a Turnaway. Leave blank for no default (the office types the amount each time).
          </p>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : (
            <form onSubmit={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {FIELDS.map((f) => (
                <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                  {f.label}
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={values[f.key] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder="e.g. 95"
                    style={{ width: 120, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                  />
                </label>
              ))}
              <button
                type="submit"
                disabled={saving}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500 }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
