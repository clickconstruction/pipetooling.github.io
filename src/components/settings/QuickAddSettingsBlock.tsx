import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { fetchQuickAddSettings, saveQuickAddSettings } from '../../lib/clock/quickAddSettings'
import {
  QUICK_ADD_CEILING_MAX,
  QUICK_ADD_CEILING_MIN,
  QUICK_ADD_DEFAULT_DAILY_CEILING,
  QUICK_ADD_ROLE_CHOICES,
  QUICK_ADD_ROLES,
} from '../../lib/clock/quickTimeAdd'

/**
 * Settings → People & teams (dev): the two owner calls behind quick time add (v2.3677) — which
 * roles see "＋ quick call or email" under the clock, and the most minutes of quick adds one
 * person may add in a day. Self-contained (its own two app_settings rows, through
 * quickAddSettings.ts) like AssistantHoursWindowSettingsBlock. `add_quick_time()` reads the same
 * rows, so what this saves is what the database enforces.
 */
export default function QuickAddSettingsBlock() {
  const { showToast } = useToastContext()
  const [roles, setRoles] = useState<string[]>([...QUICK_ADD_ROLES])
  const [ceiling, setCeiling] = useState(String(QUICK_ADD_DEFAULT_DAILY_CEILING))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadFromServer = useCallback(async () => {
    setLoading(true)
    try {
      const s = await fetchQuickAddSettings()
      setRoles(s.roles)
      setCeiling(String(s.ceilingMinutes))
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load the quick time settings'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void loadFromServer()
  }, [loadFromServer])

  const toggleRole = (role: string) =>
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]))

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const n = Number(ceiling.trim())
    if (roles.length === 0) {
      showToast('Pick at least one role — or the door is on nobody\'s clock', 'error')
      return
    }
    if (!Number.isFinite(n) || n < QUICK_ADD_CEILING_MIN || n > QUICK_ADD_CEILING_MAX) {
      showToast(`The daily limit is ${QUICK_ADD_CEILING_MIN} to ${QUICK_ADD_CEILING_MAX} minutes`, 'error')
      return
    }
    setSaving(true)
    try {
      await saveQuickAddSettings({ roles, ceilingMinutes: Math.floor(n) })
      showToast('Quick time settings saved', 'success')
    } catch (err) {
      showToast(formatErrorMessage(err, 'Could not save the quick time settings'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSave}
      aria-labelledby="settings-quick-add-title"
      id="settings-quick-add"
      style={{ marginTop: '1.5rem', padding: '0.9rem 1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}
    >
      <div id="settings-quick-add-title" style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Quick time add</div>
      <p style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Who sees <strong>＋ quick call or email</strong> under the clock when they are not clocked in, and the most minutes of quick adds one
        person can add in a day. Salaried people and anyone in training mode never get the door, whatever is ticked here.
      </p>
      <fieldset disabled={loading || saving} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
        <legend style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Who gets the door</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 1rem', marginBottom: '0.75rem' }}>
          {QUICK_ADD_ROLE_CHOICES.map((c) => (
            <label key={c.role} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem' }}>
              <input type="checkbox" checked={roles.includes(c.role)} onChange={() => toggleRole(c.role)} />
              {c.label}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Most minutes of quick adds per person per day{' '}
            <input
              type="number"
              min={QUICK_ADD_CEILING_MIN}
              max={QUICK_ADD_CEILING_MAX}
              step={5}
              value={ceiling}
              onChange={(e) => setCeiling(e.target.value)}
              style={{ width: '5.5rem', padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)' }}
            />
          </label>
          <button
            type="submit"
            disabled={loading || saving}
            style={{ padding: '0.4rem 0.9rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.8125rem' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
            Out of the box: assistant, controller, estimator, dev · {QUICK_ADD_DEFAULT_DAILY_CEILING} minutes. Past the limit the sheet says to clock in instead.
          </span>
        </div>
      </fieldset>
    </form>
  )
}
