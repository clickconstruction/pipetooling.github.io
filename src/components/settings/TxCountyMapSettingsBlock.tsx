import { useCallback, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { APP_SETTINGS_KEY_TX_COUNTY_EXTRA_MAPPINGS_V1 } from '../../lib/appSettingsKeys'
import { applyExtraTxCountyMappingsText } from '../../lib/txCountySettings'
import { formatExtraTxCountyMappingsText, parseExtraTxCountyMappingsText } from '../../lib/txCountyLookup'

/**
 * Self-contained (loads/saves its own app_settings row) like
 * JobAddressCityListSettingsBlock beside it. Org-added "City = County" pairs
 * for the property-legal-panel county suggestion (v2.2638) — the county is
 * where a lien affidavit files, so the built-in Central-Texas map can be
 * extended (or corrected — extras override built-ins) without a deploy.
 */
export default function TxCountyMapSettingsBlock() {
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadFromServer = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value_text')
        .eq('key', APP_SETTINGS_KEY_TX_COUNTY_EXTRA_MAPPINGS_V1)
        .maybeSingle()
      if (error) throw error
      setText(data?.value_text ?? '')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load the county map'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const cleaned = formatExtraTxCountyMappingsText(parseExtraTxCountyMappingsText(text))
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { key: APP_SETTINGS_KEY_TX_COUNTY_EXTRA_MAPPINGS_V1, value_text: cleaned },
          { onConflict: 'key' },
        )
      if (error) throw error
      setText(cleaned)
      // Apply to this session immediately — other sessions pick it up on next load.
      applyExtraTxCountyMappingsText(cleaned)
      showToast('County map saved', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the county map'), 'error')
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
        Property county suggestions (dev)
      </button>
      {open && (
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ margin: '1rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            The property legal panel on customer addresses suggests the filing county from the
            city. Add pairs the built-in Central-Texas map is missing — one per line as
            City = County — or override a built-in by re-mapping its city.
          </p>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : (
            <form onSubmit={handleSave}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder={'Devine = Medina\nPoteet = Atascosa'}
                aria-label="Extra city = county pairs, one per line"
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
                  background: '#3b82f6',
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
