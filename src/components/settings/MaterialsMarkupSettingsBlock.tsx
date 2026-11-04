import { useCallback, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { MATERIALS_MARKUP_PCT_KEY } from '../../lib/charges/rateCard'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { chargedAtMarkup, marginOfMarkup } from '../../lib/charges/materialsCharged'
import { moneyWords } from '../../lib/charges/moneyParts'

/**
 * Settings → Jobs & billing → Markup on materials (punch list #254, PR 1): the company's markup over cost on materials
 * charged to a customer. Self-contained like the trip charge amounts. Blank means no markup is set, and a charges
 * paper then carries materials at cost and says so. The line under the field reads the number both ways, as a markup
 * over cost and as the margin it makes on the sale, so nobody argues about which one it is.
 */
export default function MaterialsMarkupSettingsBlock() {
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')

  const loadFromServer = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('app_settings').select('key, value_num').eq('key', MATERIALS_MARKUP_PCT_KEY).maybeSingle()
      if (error) throw error
      const n = data?.value_num
      const read = n != null && Number(n) >= 0 ? String(Number(n)) : ''
      setValue(read)
      setSaved(read)
    } catch (e) {
      showToast(formatErrorMessage(e, 'The markup could not be read.'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const raw = value.trim()
      const n = Number(raw)
      const valueNum = raw !== '' && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
      const { error } = await supabase.from('app_settings').upsert({ key: MATERIALS_MARKUP_PCT_KEY, value_num: valueNum }, { onConflict: 'key' })
      if (error) throw error
      setSaved(valueNum == null ? '' : String(valueNum))
      showToast(valueNum == null ? 'The markup is cleared. Materials are charged at cost.' : 'The markup is saved.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'The markup could not be saved.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const pct = Number(value.trim())
  // Unchanged means the same percent (or both blank), so the press is dead until there is something to save.
  const markupKey = (s: string): string => {
    const n = Number(s.trim())
    return s.trim() !== '' && Number.isFinite(n) && n >= 0 ? String(Math.round(n * 100) / 100) : ''
  }
  const dirty = markupKey(value) !== markupKey(saved)
  const dead = saving || !dirty
  const readsBothWays = value.trim() !== '' && Number.isFinite(pct) && pct >= 0

  return (
    <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }} data-testid="materials-markup-block">
      <button
        type="button"
        aria-expanded={open}
        data-testid="materials-markup-toggle"
        onClick={() => {
          setOpen((prev) => {
            const next = !prev
            if (next) void loadFromServer()
            return next
          })
        }}
        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', margin: 0, padding: '1rem', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 600, textAlign: 'left', color: 'var(--text-strong)' }}
      >
        <span style={{ fontSize: '0.75rem' }}>{open ? '▼' : '▶'}</span>
        Markup on materials
      </button>
      {open && (
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ margin: '0.75rem 0', color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.45 }}>
            The company’s markup over cost on materials charged to a customer: supply-house invoices shared to the job, parts bought on a card and tallied
            to it, and material charges typed on the job form. Never the cost the company paid. Blank means no markup, and a charges paper then carries
            materials at cost and says so. A job can carry its own markup.
          </p>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Reading…</p>
          ) : (
            <form onSubmit={handleSave} style={{ display: 'grid', gap: '0.75rem', maxWidth: 560 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'grid', gap: 4, fontSize: '0.875rem', fontWeight: 500 }}>
                  Percent over cost
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="not set"
                    aria-label="Markup on materials, percent over cost"
                    data-testid="materials-markup-input"
                    style={{ width: 140, padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)' }}
                  />
                </label>
                <button
                  type="submit"
                  disabled={dead}
                  data-testid="materials-markup-save"
                  style={{ padding: '0.5rem 1rem', background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : 'white', border: 'none', borderRadius: 4, cursor: dead ? 'default' : 'pointer', fontWeight: 500 }}
                >
                  {saving ? 'Saving…' : 'Save the markup'}
                </button>
                {!dirty && !saving ? (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', alignSelf: 'center' }} data-testid="materials-markup-nothing">
                    The markup is saved as shown.
                  </span>
                ) : null}
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-base)', padding: '0.6rem 0.75rem', borderRadius: 6, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }} data-testid="materials-markup-reads">
                {readsBothWays
                  ? `${pct}% over cost is a ${marginOfMarkup(pct)}% margin on the sale. ${moneyWords(1000)} of materials is charged at ${moneyWords(chargedAtMarkup(1000, pct))}.`
                  : 'No markup is set. Materials on a charges paper are at cost until one is.'}
              </p>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
