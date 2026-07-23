import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { APP_SETTINGS_KEY_TEAM_REVIEW_CADENCE_DAYS } from '../../lib/appSettingsKeys'
import { DEFAULT_TEAM_REVIEW_CADENCE_DAYS } from '../../lib/prospects/teamReviewDue'

/**
 * Settings → Dashboard & alerts (dev): days between team-member reviews before
 * the "Team reviews due" Dashboard/Dispatch Inbox banner fires (v2.960).
 * Self-contained (owns its app_settings row) like BulkDeleteAlertSettingsBlock.
 * Blank stores NULL so the built-in default (30) applies.
 */
export default function TeamReviewCadenceSettingsBlock() {
  const { showToast } = useToastContext()
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  const loadFromServer = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value_num')
      .eq('key', APP_SETTINGS_KEY_TEAM_REVIEW_CADENCE_DAYS)
      .maybeSingle()
    const n = data?.value_num
    setValue(n != null && Number(n) >= 1 ? String(Math.floor(Number(n))) : '')
  }, [])

  useEffect(() => {
    void loadFromServer()
  }, [loadFromServer])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const raw = value.trim()
      const n = Number(raw)
      // Blank/invalid stores NULL so the built-in default applies — never 0, which would nag daily.
      const valueNum = raw !== '' && Number.isFinite(n) && n >= 1 ? Math.floor(n) : null
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: APP_SETTINGS_KEY_TEAM_REVIEW_CADENCE_DAYS, value_num: valueNum }, { onConflict: 'key' })
      if (error) throw error
      showToast('Team review cadence saved', 'success')
      if (valueNum == null) setValue('')
    } catch (err) {
      showToast(formatErrorMessage(err, 'Could not save team review cadence'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} style={{ marginTop: '1.5rem', padding: '0.9rem 1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Team review cadence</div>
      <p style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Everyone with Prospects → Team access gets a &ldquo;Team reviews due&rdquo; reminder on their Dashboard and Dispatch Inbox for each
        teammate they haven&rsquo;t reviewed in this many days.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Days between reviews{' '}
          <input
            type="number"
            min={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={String(DEFAULT_TEAM_REVIEW_CADENCE_DAYS)}
            style={{ width: '5rem', padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)' }}
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          style={{ padding: '0.4rem 0.9rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.8125rem' }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Blank = default ({DEFAULT_TEAM_REVIEW_CADENCE_DAYS} days)</span>
      </div>
    </form>
  )
}
