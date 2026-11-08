import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { APP_SETTINGS_KEY_SUPERINTENDENT_BONUS_V1, parseSuperintendentBonusShare } from '../../lib/appSettingsKeys'

/**
 * Settings → People → Superintendent bonus (punch list #234, PR 4): the one number the owner sets,
 * the share of the labor kept a superintendent is paid, on the owner's calls of 2026-11-07 — paid at
 * the office's sign-off, on hours saved, a sub-performed stage counting on its sheet hours. The
 * rule's other words are fixed and read on the scoreboard. Owns its `app_settings` row (an UPDATE on
 * the key the migration seeded, under the owner's policy).
 */
export default function SuperintendentBonusSettingsBlock() {
  const { showToast } = useToastContext()
  const [share, setShare] = useState('')
  const [saved, setSaved] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_SUPERINTENDENT_BONUS_V1).maybeSingle()
      const n = parseSuperintendentBonusShare((data as { value_text?: string | null } | null)?.value_text)
      setShare(String(n))
      setSaved(n)
    })()
  }, [])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const n = Number(share)
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      showToast('The share is a percent from 0 to 100.', 'error')
      return
    }
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .update({ value_text: JSON.stringify({ sharePct: Math.round(n * 10) / 10, period: 'month', paidAt: 'office_signoff' }) })
        .eq('key', APP_SETTINGS_KEY_SUPERINTENDENT_BONUS_V1)
        .select('key')
      if (error) throw error
      if (!Array.isArray(data) || data.length === 0) throw new Error('the setting row is missing — apply the v2.6666 migration')
      setSaved(n)
      showToast(`Saved. Superintendents are paid ${n}% of the labor kept at the office's sign-off.`, 'success')
    } catch (err) {
      showToast(`Could not save the share: ${formatErrorMessage(err)}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} id="settings-people-superintendent-bonus" style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 10, display: 'grid', gap: '0.6rem' }} data-testid="superintendent-bonus-settings">
      <div>
        <div style={{ fontWeight: 600, fontSize: '1rem' }}>Superintendent bonus</div>
        <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: 2 }}>
          A share of the labor kept on each project, paid at the office's sign-off on the percent, read by the month. Hours saved against the baseline frozen at award; a stage a sub performs counts on the sub's sheet hours. A project over its baseline pays nothing and owes nothing back.
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
        Share of the labor kept
        <input type="number" min={0} max={100} step={0.5} value={share} onChange={(e) => setShare(e.target.value)} aria-label="Share of the labor kept, percent" style={{ width: 80, border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0.3rem 0.5rem', font: 'inherit', background: 'var(--surface)', color: 'inherit' }} />
        %
      </label>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button type="submit" disabled={saving || share === '' || Number(share) === saved} style={{ padding: '0.4rem 0.9rem', fontSize: '0.86rem', fontWeight: 600, borderRadius: 6, border: '1px solid #2563eb', background: saving || share === '' || Number(share) === saved ? 'var(--surface)' : '#2563eb', color: saving || share === '' || Number(share) === saved ? 'var(--text-muted)' : '#fff', cursor: saving || share === '' || Number(share) === saved ? 'default' : 'pointer' }}>
          Save the share
        </button>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{saved != null ? `Today: ${saved}% of the labor kept.` : 'Reading…'}</span>
      </div>
    </form>
  )
}
