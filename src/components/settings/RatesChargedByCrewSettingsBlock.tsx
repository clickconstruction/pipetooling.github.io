import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { CREW_SHAPES, CREW_SHAPE_WORDS, RATE_CARD_EXTRA_PERSON_KEY, RATE_CARD_KEYS, RATE_CARD_SETTING_KEYS, MATERIALS_MARKUP_PCT_KEY } from '../../lib/charges/rateCard'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { WhoCountsAsWhatList } from './WhoCountsAsWhatList'

/** The card's rows: a shape's key and its words, then the row for each person beyond two. */
const ROWS = [
  ...CREW_SHAPES.map((shape) => ({ key: RATE_CARD_KEYS[shape], label: CREW_SHAPE_WORDS[shape], hint: '' })),
  { key: RATE_CARD_EXTRA_PERSON_KEY, label: 'Each person beyond two', hint: 'added to the two highest standings’ rate' },
] as const

const RATE_KEYS = ROWS.map((r) => r.key)

/** A rate as the card compares it: two decimals, or blank for a row not set. */
function rateKey(raw: string | undefined): string {
  const s = (raw ?? '').trim()
  const n = Number(s)
  return s !== '' && Number.isFinite(n) && n > 0 ? (Math.round(n * 100) / 100).toFixed(2) : ''
}

/** True when any row differs from what the card last read or saved. */
function ratesDirty(values: Record<string, string>, saved: Record<string, string>): boolean {
  return RATE_KEYS.some((k) => rateKey(values[k]) !== rateKey(saved[k]))
}

/**
 * Settings → Jobs, bills and liens → Rates charged by crew (punch list #254, PR 1): what the customer is charged for one
 * hour of a crew's time, by who was out that day. Self-contained (loads and saves its own app_settings rows) like the
 * trip charge amounts. The master-with-a-helper row is the v2.6431 rate's own key. A blank row is a rate the owner
 * has not set; the kernels name it instead of pricing. Never the wage anyone is paid.
 */
export default function RatesChargedByCrewSettingsBlock() {
  const { showToast } = useToastContext()
  const [values, setValues] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadFromServer = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value_num')
        .in('key', RATE_CARD_SETTING_KEYS.filter((k) => k !== MATERIALS_MARKUP_PCT_KEY))
      if (error) throw error
      const next: Record<string, string> = {}
      for (const k of RATE_KEYS) {
        const n = (data ?? []).find((r) => r.key === k)?.value_num
        next[k] = n != null && Number(n) > 0 ? Number(n).toFixed(2) : ''
      }
      setValues(next)
      setSaved(next)
    } catch (e) {
      showToast(formatErrorMessage(e, 'The rate card could not be read.'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      for (const k of RATE_KEYS) {
        const raw = (values[k] ?? '').trim()
        const n = Number(raw)
        const valueNum = raw !== '' && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
        const { error } = await supabase.from('app_settings').upsert({ key: k, value_num: valueNum }, { onConflict: 'key' })
        if (error) throw error
      }
      setSaved({ ...values })
      showToast('The rates are saved.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'The rates could not be saved.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  // A link to #who-counts-as-what (the Charges window's callout) opens the card on the list.
  useEffect(() => {
    if (typeof window === 'undefined' || window.location.hash !== '#who-counts-as-what') return
    const t = window.setTimeout(() => document.getElementById('who-counts-as-what')?.scrollIntoView({ block: 'start' }), 400)
    return () => window.clearTimeout(t)
  }, [loadFromServer])

  const dirty = ratesDirty(values, saved)
  const dead = saving || !dirty

  useEffect(() => {
    void loadFromServer()
  }, [loadFromServer])

  return (
    <div data-testid="rates-by-crew-block">
      {(
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ margin: '0.75rem 0', color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.45 }}>
            What the customer is charged for one hour of a crew’s time, by who was out that day. A person’s standing, set in Who counts as what below or on their desk, says whether
            they count as a master, a tech or a helper. A master with anyone is a master with a helper; a tech with anyone below a master is two techs. Leave a
            row blank and the app names the missing rate instead of pricing. Never what anyone is paid.
          </p>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Reading…</p>
          ) : (
            <form onSubmit={handleSave} style={{ display: 'grid', gap: '0.75rem', maxWidth: 560 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'left' }}>
                    <th style={{ padding: '0.25rem 0.4rem', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>The crew that day</th>
                    <th style={{ padding: '0.25rem 0.4rem', borderBottom: '1px solid var(--border)', fontWeight: 600, textAlign: 'right' }}>Dollars for the crew’s hour</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => (
                    <tr key={r.key}>
                      <td style={{ padding: '0.3rem 0.4rem', borderBottom: '1px solid var(--border)' }}>
                        {r.label}
                        {r.hint ? <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.hint}</span> : null}
                      </td>
                      <td style={{ padding: '0.3rem 0.4rem', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={values[r.key] ?? ''}
                          onChange={(e) => setValues((prev) => ({ ...prev, [r.key]: e.target.value }))}
                          placeholder="not set"
                          aria-label={`${r.label}, dollars an hour`}
                          data-testid={`rate-${r.key}`}
                          style={{ width: 120, padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', textAlign: 'right' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="submit"
                  disabled={dead}
                  data-testid="rates-by-crew-save"
                  style={{ padding: '0.5rem 1rem', background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : 'white', border: 'none', borderRadius: 4, cursor: dead ? 'default' : 'pointer', fontWeight: 500 }}
                >
                  {saving ? 'Saving…' : 'Save the rates'}
                </button>
                {!dirty && !saving ? (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-testid="rates-by-crew-nothing">
                    Every rate is saved as shown.
                  </span>
                ) : null}
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>A job can be charged as the crew on each day, as one shape throughout, or at a flat rate, on the job.</span>
              </div>
            </form>
          )}
          <WhoCountsAsWhatList />
        </div>
      )}
    </div>
  )
}
