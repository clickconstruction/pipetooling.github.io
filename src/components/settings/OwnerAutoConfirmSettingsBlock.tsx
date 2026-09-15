import { useEffect, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { fetchOwnerAutoConfirmFromRoll, setOwnerAutoConfirmFromRoll } from '../../lib/ownerAutoConfirmSetting'

/**
 * Settings → Jobs & billing → "Save owners from the appraisal roll
 * automatically" (owner of record, decision 5 — v2.3450). Off on day one;
 * the owner turns it on after the first sitting shows the roll is right.
 * Master + dev. Self-contained like HideHcpFieldSettingsBlock: loads its own
 * value, saves on toggle.
 */
export default function OwnerAutoConfirmSettingsBlock() {
  const { showToast } = useToastContext()
  const [on, setOn] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      setOn(await fetchOwnerAutoConfirmFromRoll())
      setLoaded(true)
    })()
  }, [])

  const toggle = async (next: boolean) => {
    setSaving(true)
    const prev = on
    setOn(next)
    try {
      await setOwnerAutoConfirmFromRoll(next)
      showToast(next ? 'On — tonight the roll’s owners are saved as unconfirmed; the Lien desk asks you to confirm each before the run.' : 'Off — owners are saved only when someone presses Use.', 'success')
    } catch (e) {
      setOn(prev)
      showToast(`Could not save: ${e instanceof Error ? e.message : 'write failed'}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }} data-testid="owner-auto-confirm-block">
      <h3 style={{ margin: '0 0 0.6rem', fontSize: '1rem' }}>Liens · owner of record</h3>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: loaded ? 'pointer' : 'default' }}>
        <input type="checkbox" checked={on} disabled={!loaded || saving} onChange={(e) => void toggle(e.target.checked)} style={{ marginTop: 3 }} aria-label="Save owners from the appraisal roll automatically" />
        <span>
          <span style={{ display: 'block', fontWeight: 600, fontSize: '1rem' }}>Save owners from the appraisal roll automatically</span>
          <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Every night, GC jobs with approved hours and no owner get the roll’s answer saved as <em>from the roll · unconfirmed</em>. The Lien desk drafts on it and shows the provenance; a person confirms before <em>Record the run</em>.
          </span>
        </span>
      </label>
    </div>
  )
}
