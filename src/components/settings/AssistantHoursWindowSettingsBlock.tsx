import { useCallback, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  APP_SETTINGS_KEY_ASSISTANT_HOURS_WINDOW_WEEKS,
  DEFAULT_ASSISTANT_HOURS_WINDOW_WEEKS,
  parseAssistantHoursWindowWeeks,
} from '../../lib/appSettingsKeys'

/**
 * Settings → People & accounts (dev): how many weeks of People → Hours history
 * assistants can view. Self-contained (loads/saves its own app_settings row)
 * like TripChargeAmountsSettingsBlock. Missing row = 3 weeks; unlimited saves 0.
 */
export default function AssistantHoursWindowSettingsBlock() {
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [weeks, setWeeks] = useState(String(DEFAULT_ASSISTANT_HOURS_WINDOW_WEEKS))
  const [unlimited, setUnlimited] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadFromServer = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value_num')
        .eq('key', APP_SETTINGS_KEY_ASSISTANT_HOURS_WINDOW_WEEKS)
        .maybeSingle()
      if (error) throw error
      const parsed = parseAssistantHoursWindowWeeks(data?.value_num)
      setUnlimited(parsed === 0)
      setWeeks(String(parsed === 0 ? DEFAULT_ASSISTANT_HOURS_WINDOW_WEEKS : parsed))
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load the assistant hours window'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const n = Number(weeks.trim())
    if (!unlimited && (!Number.isFinite(n) || n < 1)) {
      showToast('Weeks must be 1 or more (or check No limit)', 'error')
      return
    }
    setSaving(true)
    try {
      const valueNum = unlimited ? 0 : Math.floor(n)
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: APP_SETTINGS_KEY_ASSISTANT_HOURS_WINDOW_WEEKS, value_num: valueNum }, { onConflict: 'key' })
      if (error) throw error
      showToast(
        unlimited
          ? 'Assistants can now view all hours history'
          : `Assistants now see the current week plus ${Math.floor(n) - 1} previous`,
        'success'
      )
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the assistant hours window'), 'error')
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
        Assistant hours visibility (dev)
      </button>
      {open && (
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ marginBottom: '1rem', marginTop: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            How far back assistants can browse on People → Hours. The window counts whole
            Sun–Sat weeks including the current one — 3 means the current week plus two
            previous. Devs, controllers, and pay-approved masters are never limited.
          </p>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : (
            <form onSubmit={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, opacity: unlimited ? 0.5 : 1 }}>
                Weeks visible
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={weeks}
                  disabled={unlimited}
                  onChange={(e) => setWeeks(e.target.value)}
                  style={{ width: 90, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500 }}>
                <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} />
                No limit
              </label>
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
