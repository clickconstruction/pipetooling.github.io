/**
 * Settings → Bids & materials (dev): org-editable bid cover letter text.
 * Three app_settings value_text rows; blank = fall back to the built-in
 * constants in src/lib/bidDocuments/coverLetter.ts. Self-contained (loads and
 * saves its own rows) like TripChargeAmountsSettingsBlock. `openSignal` opens
 * the block from outside: Contracts & terms raises it when its Edit door is used.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  APP_SETTINGS_KEY_BID_COVER_LETTER_CLOSING,
  APP_SETTINGS_KEY_BID_COVER_LETTER_EXCLUSIONS_DEFAULT,
  APP_SETTINGS_KEY_BID_COVER_LETTER_TERMS_DEFAULT,
  APP_SETTINGS_KEY_BID_SOV_LABOR_SHARE_PCT_V1,
  APP_SETTINGS_KEY_BID_SOV_MATERIAL_FACTOR_V1,
} from '../../lib/appSettingsKeys'
import { DEFAULT_SOV_MATERIAL_FACTOR, parseSovMaterialFactor } from '../../lib/bids/materialsByStage'
import { DEFAULT_SOV_LABOR_SHARE_PCT, parseSovLaborSharePct } from '../../lib/bidDocuments/sovLaborMaterial'
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

export default function BidCoverLetterDefaultsSettingsBlock({ openSignal = 0 }: { openSignal?: number }) {
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [factor, setFactor] = useState<string>('')
  const [laborShare, setLaborShare] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadFromServer = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value_text, value_num')
        .in('key', [...FIELDS.map((f) => f.key), APP_SETTINGS_KEY_BID_SOV_MATERIAL_FACTOR_V1, APP_SETTINGS_KEY_BID_SOV_LABOR_SHARE_PCT_V1])
      if (error) throw error
      const next: Record<string, string> = {}
      for (const f of FIELDS) {
        next[f.key] = (data ?? []).find((r) => r.key === f.key)?.value_text ?? ''
      }
      setValues(next)
      const factorRow = (data ?? []).find((r) => r.key === APP_SETTINGS_KEY_BID_SOV_MATERIAL_FACTOR_V1)
      setFactor(String(parseSovMaterialFactor(factorRow?.value_num ?? null)))
      const shareRow = (data ?? []).find((r) => r.key === APP_SETTINGS_KEY_BID_SOV_LABOR_SHARE_PCT_V1)
      setLaborShare(String(parseSovLaborSharePct(shareRow?.value_num ?? null)))
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load cover letter defaults'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (openSignal <= 0) return
    setOpen(true)
    void loadFromServer()
  }, [openSignal, loadFromServer])

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
      const factorNum = Number(factor.replace(/,/g, '').trim())
      if (!Number.isFinite(factorNum) || factorNum < 1 || factorNum > 5) {
        throw new Error('The schedule of values factor must be a number from 1 to 5 (1.5 = raw material × 1.5).')
      }
      const { error: factorErr } = await supabase
        .from('app_settings')
        .upsert({ key: APP_SETTINGS_KEY_BID_SOV_MATERIAL_FACTOR_V1, value_num: factorNum }, { onConflict: 'key' })
      if (factorErr) throw factorErr
      const shareNum = Number(laborShare.replace(/,/g, '').trim())
      if (!Number.isFinite(shareNum) || shareNum < 0 || shareNum > 100) {
        throw new Error('The labor share must be a number from 0 to 100 (45 = 45% labor, 55% material).')
      }
      const { error: shareErr } = await supabase
        .from('app_settings')
        .upsert({ key: APP_SETTINGS_KEY_BID_SOV_LABOR_SHARE_PCT_V1, value_num: shareNum }, { onConflict: 'key' })
      if (shareErr) throw shareErr
      showToast('Cover letter defaults saved', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save cover letter defaults'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div id="settings-bid-cover-letter-defaults" style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, scrollMarginTop: '0.75rem' }}>
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
              <label style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem' }}>
                Schedule of values factor (raw takeoff material by stage × this number; company default, a bid can use its own)
                <input
                  id="bid-sov-material-factor"
                  value={factor}
                  onChange={(e) => setFactor(e.target.value)}
                  inputMode="decimal"
                  placeholder={String(DEFAULT_SOV_MATERIAL_FACTOR)}
                  style={{ display: 'block', width: 120, marginTop: 4, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}
                />
              </label>
              <label style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem' }}>
                Schedule of values labor share, % (when the letter splits labor and material and a stage has no labor hours; the rest is material)
                <input
                  id="bid-sov-labor-share-pct"
                  value={laborShare}
                  onChange={(e) => setLaborShare(e.target.value)}
                  inputMode="decimal"
                  placeholder={String(DEFAULT_SOV_LABOR_SHARE_PCT)}
                  style={{ display: 'block', width: 120, marginTop: 4, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}
                />
              </label>
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
