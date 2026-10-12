import { useEffect, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { loadBillDayCutoff, setBillDayCutoff } from '../../lib/gc/billDay/billDayIo'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * Settings → Jobs & billing → the trades' cut-off for GC bill day (Messages cut 9): how many days before bill day the
 * trades' pay applications are due, one setting for every job, 2 to 20 (`app_settings.gc_bill_day_cutoff_days`, 6).
 * The money team sets it (dev, the owner and the controller, the policy's audience). Self-contained like
 * GcCardBillSettingsBlock: loads its own value, saves on Save.
 */
export default function GcBillDayCutoffSettingsBlock() {
  const { showToast } = useToastContext()
  const [days, setDays] = useState<number | null>(null)
  const [typed, setTyped] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void loadBillDayCutoff().then((d) => {
      setDays(d)
      setTyped(String(d))
    })
  }, [])

  const wanted = Number(typed)
  const valid = Number.isInteger(wanted) && wanted >= 2 && wanted <= 20
  const save = async () => {
    if (!valid) return
    setSaving(true)
    try {
      const set = await setBillDayCutoff(wanted)
      setDays(set)
      showToast(`Saved. The trades’ pay applications are due ${set} days before bill day on every job.`, 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'The cut-off did not change.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }} data-testid="gc-bill-day-cutoff-block">
      <h3 style={{ margin: '0 0 0.6rem', fontSize: '1rem' }}>GC jobs · the trades’ cut-off</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}
      >
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontWeight: 600 }}>
          Days before bill day
          <input
            type="number"
            min={2}
            max={20}
            step={1}
            value={typed}
            disabled={days === null || saving}
            onChange={(e) => setTyped(e.target.value)}
            style={{ width: '4.5rem', padding: '0.3rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)' }}
          />
        </label>
        <button type="submit" disabled={days === null || saving || !valid || wanted === days} style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer' }}>
          Save
        </button>
      </form>
      <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 6 }}>
        The trades’ pay applications are due this many days before bill day, on every GC job. The superintendent walks the claims from then until two days before bill day. Pick 2 to 20.
      </span>
    </div>
  )
}
