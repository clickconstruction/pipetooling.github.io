import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { MATERIALS_MARKUP_PCT_KEY } from '../../lib/charges/rateCard'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { chargedAtMarkup } from '../../lib/charges/materialsCharged'
import { markupMarginWords, pairFromMarkup, type MarkupPairState } from '../../lib/charges/markupMargin'
import { moneyWords } from '../../lib/charges/moneyParts'
import { MaterialsMarkupPair } from '../charges/MaterialsMarkupPair'

/**
 * Settings → Jobs & billing → Markup on materials (punch list #254, PR 1): the company's markup over cost on materials
 * charged to a customer. Self-contained like the trip charge amounts. Blank means no markup is set, and a charges
 * paper then carries materials at cost and says so. Since v2.6538 the markup and the margin it makes on the sale sit
 * side by side, either one typed and the other following, so nobody argues about which one it is; the markup is
 * what is stored.
 */
export default function MaterialsMarkupSettingsBlock() {
  const { showToast } = useToastContext()
  const [typed, setTyped] = useState<MarkupPairState>(() => pairFromMarkup(null))
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<number | null>(null)

  const loadFromServer = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('app_settings').select('key, value_num').eq('key', MATERIALS_MARKUP_PCT_KEY).maybeSingle()
      if (error) throw error
      const n = data?.value_num
      const read = n != null && Number(n) >= 0 ? Number(n) : null
      setSaved(read)
      setTyped(pairFromMarkup(read))
    } catch (e) {
      showToast(formatErrorMessage(e, 'The markup could not be read.'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (typed.refusal) return
    setSaving(true)
    try {
      const valueNum = typed.markupPct
      const { error } = await supabase.from('app_settings').upsert({ key: MATERIALS_MARKUP_PCT_KEY, value_num: valueNum }, { onConflict: 'key' })
      if (error) throw error
      setSaved(valueNum)
      showToast(valueNum == null ? 'The markup is cleared. Materials are charged at cost.' : 'The markup is saved.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'The markup could not be saved.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  // Unchanged means the same markup (or both blank), so the press is dead until there is something to save.
  const dirty = typed.refusal == null && typed.markupPct !== saved
  const dead = saving || !dirty
  const pct = typed.markupPct

  useEffect(() => {
    void loadFromServer()
  }, [loadFromServer])

  return (
    <div data-testid="materials-markup-block">
      {(
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ margin: '0.75rem 0', color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.45 }}>
            The company’s markup over cost on materials charged to a customer: supply-house invoices shared to the job, parts bought on a card and tallied
            to it, and material charges typed on the job form. Never the cost the company paid. Type it as a markup over cost or as a margin on the sale,
            and the other box follows. Blank means no markup, and a charges paper then carries materials at cost and says so. A job can carry its own markup.
          </p>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Reading…</p>
          ) : (
            <form onSubmit={handleSave} style={{ display: 'grid', gap: '0.75rem', maxWidth: 640 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                <MaterialsMarkupPair markupPct={saved} testId="materials-markup-input" onTyped={setTyped} />
                <button
                  type="submit"
                  disabled={dead}
                  data-testid="materials-markup-save"
                  style={{ padding: '0.5rem 1rem', background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : 'white', border: 'none', borderRadius: 4, cursor: dead ? 'default' : 'pointer', fontWeight: 500 }}
                >
                  {saving ? 'Saving…' : 'Save the markup'}
                </button>
                {!dirty && !saving && !typed.refusal ? (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', alignSelf: 'center' }} data-testid="materials-markup-nothing">
                    The markup is saved as shown.
                  </span>
                ) : null}
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-base)', padding: '0.6rem 0.75rem', borderRadius: 6, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }} data-testid="materials-markup-reads">
                {pct != null
                  ? `${markupMarginWords(pct)}. ${moneyWords(1000)} of materials is charged at ${moneyWords(chargedAtMarkup(1000, pct))}.`
                  : 'No markup is set. Materials on a charges paper are at cost until one is.'}
              </p>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
