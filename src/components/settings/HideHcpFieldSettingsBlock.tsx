import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { refreshHideHcpFieldCache, saveHideHcpFieldSetting } from '../../lib/hideHcpFieldSetting'

/**
 * Settings → Jobs & dispatch (dev): hide the legacy HCP entry field on the
 * New/Edit Job modal (v2.1533). Self-contained like TripChargeAmountsSettingsBlock —
 * loads its own value, saves on toggle. Jobs that already carry an HCP number
 * keep their field regardless, so no data is lost or hidden.
 */
export default function HideHcpFieldSettingsBlock() {
  const { showToast } = useToastContext()
  const [on, setOn] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const fresh = await refreshHideHcpFieldCache(supabase)
      setOn(fresh)
      setLoaded(true)
    })()
  }, [])

  const toggle = async (next: boolean) => {
    setSaving(true)
    const prev = on
    setOn(next)
    const { error } = await saveHideHcpFieldSetting(supabase, next)
    setSaving(false)
    if (error) {
      setOn(prev)
      showToast(`Could not save: ${error}`, 'error')
      return
    }
    showToast(next ? 'HCP field hidden on New/Edit Job.' : 'HCP field shown again.', 'success')
  }

  return (
    <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: loaded ? 'pointer' : 'default' }}>
        <input
          type="checkbox"
          checked={on}
          disabled={!loaded || saving}
          onChange={(e) => void toggle(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span>
          <span style={{ display: 'block', fontWeight: 600, fontSize: '1rem' }}>
            Hide the HCP field on New/Edit Job
          </span>
          <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            HCP numbers are no longer issued. Jobs that already have one keep showing (and can edit)
            their HCP field — only the empty entry field disappears. Nothing is deleted.
          </span>
        </span>
      </label>
    </div>
  )
}
