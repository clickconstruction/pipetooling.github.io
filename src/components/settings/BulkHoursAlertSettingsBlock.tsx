import { useCallback, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  APP_SETTINGS_KEY_BULK_HOURS_ALERT_DAYS,
  APP_SETTINGS_KEY_BULK_HOURS_ALERT_ENABLED,
  APP_SETTINGS_KEY_BULK_HOURS_ALERT_LOOKBACK_DAYS,
  APP_SETTINGS_KEY_BULK_HOURS_ALERT_WINDOW_MINUTES,
  BULK_HOURS_ALERT_DEFAULTS,
  parseBulkDeleteAlertEnabled,
} from '../../lib/appSettingsKeys'

/** Numeric thresholds. Placeholder = the built-in default, so blank means "use the default". */
const FIELDS = [
  {
    key: APP_SETTINGS_KEY_BULK_HOURS_ALERT_DAYS,
    label: 'Alert at this many days typed',
    fallback: BULK_HOURS_ALERT_DEFAULTS.days,
    hint: 'Counts days, not sessions — fixing one person’s missed Friday is one day however many sessions it took. 2 means any second day in one burst.',
  },
  {
    key: APP_SETTINGS_KEY_BULK_HOURS_ALERT_WINDOW_MINUTES,
    label: 'Within this many minutes',
    fallback: BULK_HOURS_ALERT_DEFAULTS.windowMinutes,
    hint: 'How tightly the typing must be clustered to count as one burst.',
  },
  {
    key: APP_SETTINGS_KEY_BULK_HOURS_ALERT_LOOKBACK_DAYS,
    label: 'Show bursts from the last N days',
    fallback: BULK_HOURS_ALERT_DEFAULTS.lookbackDays,
    hint: 'How far back the Needs You card looks.',
  },
] as const

/**
 * Settings → People & teams (dev): thresholds for the "Hours added in bulk" Needs You item
 * (v2.4281). Self-contained (loads/saves its own app_settings rows) like BulkDeleteAlertSettingsBlock,
 * whose shape it copies. The same keys are read server-side by list_bulk_hours_alerts(), so the card
 * and these numbers can never disagree. Blank = the built-in default (the RPC COALESCEs to the same).
 */
export default function BulkHoursAlertSettingsBlock() {
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadFromServer = useCallback(async () => {
    setLoading(true)
    try {
      const keys: string[] = [...FIELDS.map((f) => f.key), APP_SETTINGS_KEY_BULK_HOURS_ALERT_ENABLED]
      const { data, error } = await supabase.from('app_settings').select('key, value_num, value_text').in('key', keys)
      if (error) throw error
      const next: Record<string, string> = {}
      for (const f of FIELDS) {
        const n = (data ?? []).find((r) => r.key === f.key)?.value_num
        next[f.key] = n != null && Number(n) > 0 ? String(Number(n)) : ''
      }
      setValues(next)
      const flag = (data ?? []).find((r) => r.key === APP_SETTINGS_KEY_BULK_HOURS_ALERT_ENABLED)?.value_text
      setEnabled(parseBulkDeleteAlertEnabled(flag))
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load the bulk hours alert settings'), 'error')
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
        // Blank/invalid stores NULL so the RPC's COALESCE default applies — never a 0, which would
        // make the alarm fire on every single typed day.
        const valueNum = raw !== '' && Number.isFinite(n) && n > 0 ? Math.floor(n) : null
        const { error } = await supabase.from('app_settings').upsert({ key: f.key, value_num: valueNum }, { onConflict: 'key' })
        if (error) throw error
      }
      const { error: flagErr } = await supabase
        .from('app_settings')
        .upsert({ key: APP_SETTINGS_KEY_BULK_HOURS_ALERT_ENABLED, value_text: enabled ? 'true' : 'false' }, { onConflict: 'key' })
      if (flagErr) throw flagErr
      showToast('Bulk hours alert settings saved', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the bulk hours alert settings'), 'error')
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
        Bulk hours alert (dev)
      </button>
      {open && (
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ margin: '0.75rem 0 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Tells the people who approve hours when one person types hours onto several days in a short time —
            a red item on the Dashboard’s Needs you. Counts days, not sessions. Whoever typed never sees their
            own burst; everyone else who approves hours does. Nothing is blocked by it. Blank fields use the
            default shown.
          </p>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : (
            <form onSubmit={handleSave}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Tell approvers about bulk typed hours</span>
              </label>
              {FIELDS.map((f) => (
                <div key={f.key} style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>{f.label}</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={values[f.key] ?? ''}
                    placeholder={String(f.fallback)}
                    disabled={!enabled}
                    onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    style={{
                      padding: '0.35rem 0.5rem',
                      width: 140,
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      background: 'var(--surface)',
                      color: 'inherit',
                    }}
                  />
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{f.hint}</p>
                </div>
              ))}
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
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
