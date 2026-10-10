import { useEffect, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { fetchGcCardBillOn, setGcCardBillOn } from '../../lib/gc/cardBillSetting'

/**
 * Settings → Jobs & billing → "Let GC customers pay a certified bill by card" (GC mode, Owner Billing's O8c). Off on
 * day one; the owner turns it on once the live walk is done. Dev and the owner. Self-contained like
 * OwnerAutoConfirmSettingsBlock: loads its own value, saves on toggle.
 */
export default function GcCardBillSettingsBlock() {
  const { showToast } = useToastContext()
  const [on, setOn] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      setOn(await fetchGcCardBillOn())
      setLoaded(true)
    })()
  }, [])

  const toggle = async (next: boolean) => {
    setSaving(true)
    const prev = on
    setOn(next)
    try {
      await setGcCardBillOn(next)
      showToast(next ? 'On. A certified GC bill shows Pay by card in the customer’s portal.' : 'Off. GC customers pay by check.', 'success')
    } catch (e) {
      setOn(prev)
      showToast(`Could not save: ${e instanceof Error ? e.message : 'write failed'}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }} data-testid="gc-card-bill-block">
      <h3 style={{ margin: '0 0 0.6rem', fontSize: '1rem' }}>GC jobs · pay by card</h3>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: loaded ? 'pointer' : 'default' }}>
        <input type="checkbox" checked={on} disabled={!loaded || saving} onChange={(e) => void toggle(e.target.checked)} style={{ marginTop: 3 }} aria-label="Let GC customers pay a certified bill by card" />
        <span>
          <span style={{ display: 'block', fontWeight: 600, fontSize: '1rem' }}>Let GC customers pay a certified bill by card</span>
          <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            A certified bill on a GC job shows Pay by card in the customer’s portal. The card adds a 3% fee, and the bill then takes cards only. Our emails offer it too. Only the customer turns a bill to card.
          </span>
        </span>
      </label>
    </div>
  )
}
