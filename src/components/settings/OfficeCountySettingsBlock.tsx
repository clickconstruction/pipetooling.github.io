import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { APP_SETTINGS_KEY_OFFICE_COUNTY } from '../../lib/appSettingsKeys'
import { OFFICE_COUNTY_DEFAULT } from '../../lib/legal/affidavitPaper'

/**
 * Settings → Jobs & billing: the office's county for the venue line of a sworn statement made on the Legal desk
 * (punch list #220, v2.6210). One row, `app_settings.office_county`, seeded *Guadalupe* by the migration; the office
 * roles may change it (a key-scoped policy), and a refusal reads its reason.
 */
export default function OfficeCountySettingsBlock() {
  const { showToast } = useToastContext()
  const [county, setCounty] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_OFFICE_COUNTY).maybeSingle()
      setCounty((data?.value_text ?? '').trim() || OFFICE_COUNTY_DEFAULT)
      setLoaded(true)
    })()
  }, [])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const next = county.trim().replace(/\s+county$/i, '')
    if (!next) {
      showToast('Type the county’s name.', 'error')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('app_settings').update({ value_text: next }).eq('key', APP_SETTINGS_KEY_OFFICE_COUNTY)
      if (error) throw error
      setCounty(next)
      showToast(`Saved — a statement’s venue line now starts on ${next} County.`, 'success')
    } catch (err) {
      showToast(formatErrorMessage(err, 'Could not save the office’s county.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form data-office-county-settings onSubmit={(e) => void save(e)} style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', display: 'grid', gap: 8 }}>
      <span style={{ display: 'block', fontWeight: 600, fontSize: '1rem' }}>The office’s county for sworn statements</span>
      <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        The Legal desk’s Swear a statement window starts its venue line on this county. It is where the notary watches the signing, not where the job is. The window still offers the property’s county and a blank for the notary.
      </span>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem' }}>
        County
        <input aria-label="The office’s county" value={county} disabled={!loaded || saving} onChange={(e) => setCounty(e.target.value)} placeholder={OFFICE_COUNTY_DEFAULT} style={{ font: 'inherit', padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', width: 220 }} />
        <button type="submit" disabled={!loaded || saving} style={{ font: 'inherit', fontSize: '0.84rem', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--text-700)', background: 'var(--text-700)', color: 'var(--surface)', cursor: 'pointer', opacity: !loaded || saving ? 0.6 : 1 }}>Save the county</button>
      </label>
    </form>
  )
}
