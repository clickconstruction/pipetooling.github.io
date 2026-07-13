/**
 * Settings → Templates & testing (dev): org-editable bid cover letter text.
 * Three app_settings value_text rows; blank = fall back to the built-in
 * constants in src/lib/bidDocuments/coverLetter.ts. Self-contained (loads and
 * saves its own rows) like TripChargeAmountsSettingsBlock.
 */
import { useCallback, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  APP_SETTINGS_KEY_BID_COVER_LETTER_CLOSING,
  APP_SETTINGS_KEY_BID_COVER_LETTER_EXCLUSIONS_DEFAULT,
  APP_SETTINGS_KEY_BID_COVER_LETTER_TERMS_DEFAULT,
} from '../../lib/appSettingsKeys'
import {
  DEFAULT_COVER_LETTER_CLOSING,
  DEFAULT_EXCLUSIONS,
  DEFAULT_TERMS_AND_WARRANTY,
} from '../../lib/bidDocuments/coverLetter'

const FIELDS = [
  {
    key: APP_SETTINGS_KEY_BID_COVER_LETTER_TERMS_DEFAULT,
    label: 'Terms & warranty (default when a bid’s Terms box is empty)',
    placeholder: DEFAULT_TERMS_AND_WARRANTY,
    rows: 7,
  },
  {
    key: APP_SETTINGS_KEY_BID_COVER_LETTER_EXCLUSIONS_DEFAULT,
    label: 'Exclusions (one per line; default when a bid’s Exclusions box is empty)',
    placeholder: DEFAULT_EXCLUSIONS,
    rows: 5,
  },
  {
    key: APP_SETTINGS_KEY_BID_COVER_LETTER_CLOSING,
    label: 'Closing paragraph (one line per sentence, before “Respectfully submitted…”)',
    placeholder: DEFAULT_COVER_LETTER_CLOSING,
    rows: 3,
  },
] as const

export default function BidCoverLetterDefaultsSettingsBlock() {
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
        .select('key, value_text')
        .in('key', FIELDS.map((f) => f.key))
      if (error) throw error
      const next: Record<string, string> = {}
      for (const f of FIELDS) {
        next[f.key] = (data ?? []).find((r) => r.key === f.key)?.value_text ?? ''
      }
      setValues(next)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load cover letter defaults'), 'error')
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
        const { error } = await supabase
          .from('app_settings')
          .upsert({ key: f.key, value_text: raw || null }, { onConflict: 'key' })
        if (error) throw error
      }
      showToast('Cover letter defaults saved', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save cover letter defaults'), 'error')
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
        Bid Cover Letter Defaults (dev)
      </button>
      {open && (
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ margin: '0.75rem 0 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Org-wide text for every bid cover letter. Leave a box blank to use the built-in text
            (shown as the placeholder). Terms and Exclusions apply when the bid&rsquo;s own boxes are
            empty; the closing paragraph appears on every letter.
          </p>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : (
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {FIELDS.map((f) => (
                <label key={f.key} style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem' }}>
                  {f.label}
                  <textarea
                    value={values[f.key] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    rows={f.rows}
                    style={{ display: 'block', width: '100%', marginTop: 4, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', fontSize: '0.8125rem', fontFamily: 'inherit' }}
                  />
                </label>
              ))}
              <div>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500 }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
