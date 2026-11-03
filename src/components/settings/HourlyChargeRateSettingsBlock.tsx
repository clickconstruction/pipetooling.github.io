import { useCallback, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { APP_SETTINGS_KEY_HOURLY_CHARGE_RATE_V1, DEFAULT_HOURLY_CHARGE_RATE, parseHourlyChargeRate } from '../../lib/appSettingsKeys'

/**
 * Settings → Jobs & dispatch (dev): the rate the company charges for an hour of a worker's time (punch list #251,
 * v2.6431). The hours charged statement prices a worker's recorded hours at the job's own rate when it has one, else
 * this. Self-contained (loads and saves its own `app_settings` row) like TripChargeAmountsSettingsBlock; a missing row
 * reads as $285.00, the owner's number.
 */
export default function HourlyChargeRateSettingsBlock() {
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [rate, setRate] = useState(DEFAULT_HOURLY_CHARGE_RATE.toFixed(2))
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadFromServer = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('app_settings').select('value_num').eq('key', APP_SETTINGS_KEY_HOURLY_CHARGE_RATE_V1).maybeSingle()
      if (error) throw error
      setRate(parseHourlyChargeRate(data?.value_num).toFixed(2))
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load the rate charged for an hour'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const n = Number(rate.trim())
    if (!Number.isFinite(n) || n <= 0) {
      showToast('The rate must be more than zero dollars an hour', 'error')
      return
    }
    const value = Math.round(n * 100) / 100
    setSaving(true)
    try {
      const { error } = await supabase.from('app_settings').upsert({ key: APP_SETTINGS_KEY_HOURLY_CHARGE_RATE_V1, value_num: value }, { onConflict: 'key' })
      if (error) throw error
      setRate(value.toFixed(2))
      showToast(`The company now charges $${value.toFixed(2)} an hour on a charged statement`, 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the rate charged for an hour'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
      <button
        type="button"
        data-testid="hourly-charge-rate-toggle"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => {
            const next = !prev
            if (next) void loadFromServer()
            return next
          })
        }}
        style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
      >
        {open ? '▾' : '▸'} Rate charged for an hour
      </button>
      {open && (
        <form onSubmit={handleSave} style={{ padding: '0 1rem 1rem', display: 'grid', gap: '0.75rem' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            What the company charges the customer for one hour of a worker&apos;s time. The hours charged statement prices a worker&apos;s
            recorded hours at the job&apos;s own rate when the job has one, else at this. The wage the worker is paid is never this number.
          </p>
          <label style={{ display: 'grid', gap: 4, maxWidth: 260 }}>
            <span>Dollars an hour</span>
            <input
              type="number"
              inputMode="decimal"
              min={0.01}
              step={0.01}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              disabled={loading || saving}
              data-testid="hourly-charge-rate-input"
              style={{ padding: '0.4rem 0.5rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}
            />
          </label>
          <div>
            <button type="submit" disabled={loading || saving} data-testid="hourly-charge-rate-save" style={{ padding: '0.45rem 0.9rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>
              {saving ? 'Saving…' : 'Save the rate'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
