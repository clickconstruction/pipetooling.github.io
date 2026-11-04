import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { APP_SETTINGS_KEY_JOB_ADDRESS_EXTRA_LOCALITIES_V1 } from '../../lib/appSettingsKeys'
import { applyExtraJobAddressLocalitiesText } from '../../lib/jobAddressLocalitySettings'
import {
  parseExtraTxLocalitiesText,
  TX_JOB_ADDRESS_LOCALITY_KEYWORDS,
} from '../../lib/txLocalityAddressSplit'

/**
 * Self-contained (loads/saves its own app_settings row) like TripChargeAmountsSettingsBlock.
 * Org-added city names for the job-address two-line split — when an address contains one of
 * these cities, the "City ST" part starts a new line on Stages/Billing rows and prefills
 * (lien tooling, AIA) split street vs city correctly.
 */
export default function JobAddressCityListSettingsBlock() {
  const { showToast } = useToastContext()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadFromServer = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value_text')
        .eq('key', APP_SETTINGS_KEY_JOB_ADDRESS_EXTRA_LOCALITIES_V1)
        .maybeSingle()
      if (error) throw error
      setText(data?.value_text ?? '')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load the extra city list'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const cleaned = parseExtraTxLocalitiesText(text).join('\n')
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { key: APP_SETTINGS_KEY_JOB_ADDRESS_EXTRA_LOCALITIES_V1, value_text: cleaned },
          { onConflict: 'key' },
        )
      if (error) throw error
      setText(cleaned)
      // Apply to this session immediately — other sessions pick it up on next load.
      applyExtraJobAddressLocalitiesText(cleaned)
      showToast('Extra cities saved', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the extra city list'), 'error')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    void loadFromServer()
  }, [loadFromServer])

  return (
    <div>
      {(
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ margin: '1rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            When a job address contains one of these city names, the address wraps to a new line
            at the city on Jobs rows (and street/city split correctly in lien and AIA prefills).
            Add cities the built-in list is missing — e.g. Devine — one per line.
          </p>
          <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            Built-in: {TX_JOB_ADDRESS_LOCALITY_KEYWORDS.join(', ')}
          </p>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : (
            <form onSubmit={handleSave}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder={'Devine\nFloresville\nPleasanton'}
                aria-label="Extra city names, one per line"
                style={{
                  width: '100%',
                  maxWidth: 420,
                  padding: '0.5rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                  boxSizing: 'border-box',
                  display: 'block',
                  marginBottom: '0.75rem',
                }}
              />
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
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
