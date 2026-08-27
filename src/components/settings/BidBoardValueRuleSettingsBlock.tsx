/**
 * Settings → Templates & testing (dev): which number the Bid Board shows for a package of bids
 * (v2.2124). One app_settings row, key `bid_board_value_rule_v1`; absent = 'base_sum'.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { APP_SETTINGS_KEY_BID_BOARD_VALUE_RULE } from '../../lib/appSettingsKeys'
import { BOARD_VALUE_RULES, parseBoardValueRule, type BoardValueRule } from '../../lib/bids/versionSends'

export default function BidBoardValueRuleSettingsBlock() {
  const { showToast } = useToastContext()
  const [rule, setRule] = useState<BoardValueRule>('base_sum')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let cancelled = false
    void supabase.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_BID_BOARD_VALUE_RULE).maybeSingle().then(({ data }) => {
      if (!cancelled) setRule(parseBoardValueRule(data?.value_text ?? null))
    })
    return () => { cancelled = true }
  }, [])
  async function save(next: BoardValueRule) {
    setSaving(true)
    const prev = rule
    setRule(next)
    const { error } = await supabase.from('app_settings').upsert({ key: APP_SETTINGS_KEY_BID_BOARD_VALUE_RULE, value_text: next }, { onConflict: 'key' })
    setSaving(false)
    if (error) { setRule(prev); showToast('Could not save: ' + error.message, 'error'); return }
    showToast('Board value rule saved.', 'success')
  }
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.8rem 1rem', marginTop: '0.75rem', background: 'var(--surface)' }}>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.35rem' }}>Bid Board value for a package of bids</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
        When a bid has several versions in its cover letter, this is the number "Mark sent" writes to the bid — what the Board, Followup and hit rate see.
      </div>
      {BOARD_VALUE_RULES.map((r) => (
        <label key={r.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.3rem 0', fontSize: '0.85rem', cursor: 'pointer' }}>
          <input type="radio" name="bid-board-value-rule" checked={rule === r.id} disabled={saving} onChange={() => void save(r.id)} style={{ marginTop: '0.2rem' }} />
          <span><strong>{r.label}</strong><span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.help}</span></span>
        </label>
      ))}
    </div>
  )
}
