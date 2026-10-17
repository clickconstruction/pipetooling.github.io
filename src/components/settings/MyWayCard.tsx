/**
 * My way (v2.5597, punch list #115): under Settings → Your account, for the office team. Per moment, a booking's first
 * visit and an estimate, whether the Tell the customer sheet asks first or sends and shows the receipt. The row is the
 * person's own (`tell_customer_prefs`); a press saves at once. The rules and the words are `lib/tellCustomer/myWay.ts`.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth, type UserRole } from '../../hooks/useAuth'
import { GC_OFFICE_TEAM } from '../../lib/gc/access'
import { MY_WAY_DEFAULT, MY_WAY_MOMENTS, MY_WAY_WORDS, type MyWay, type MyWays } from '../../lib/tellCustomer/myWay'
import { supabaseMyWayIo, type MyWayIo } from '../../lib/tellCustomer/myWayIo'
import { formatErrorMessage } from '../../utils/errorHandling'

const card: CSSProperties = { marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }
const rowStyle: CSSProperties = { display: 'grid', gap: '0.35rem', margin: '0.75rem 0' }
const opt: CSSProperties = { display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.875rem' }

export function MyWayCard({ role, userId: userIdProp, io: ioProp }: { role: UserRole | null | undefined; userId?: string; io?: MyWayIo }) {
  const { showToast } = useToastContext()
  const { user } = useAuth()
  const userId = userIdProp ?? user?.id ?? null
  const io = useMemo(() => ioProp ?? supabaseMyWayIo(), [ioProp])
  const [ways, setWays] = useState<MyWays>(MY_WAY_DEFAULT)
  const [busy, setBusy] = useState<string | null>(null)
  const office = Boolean(role) && GC_OFFICE_TEAM.includes(role!)

  useEffect(() => {
    if (!office || !userId) return
    let live = true
    io.load(userId).then(
      (w) => live && setWays(w),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [io, office, userId])

  if (!office || !userId) return null

  const set = async (moment: (typeof MY_WAY_MOMENTS)[number], way: MyWay) => {
    setBusy(`${moment}:${way}`)
    try {
      setWays(await io.set(userId, moment, way))
      showToast(MY_WAY_WORDS.saved(moment, way), 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Your way was not saved.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={card} data-testid="my-way-card">
      <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>{MY_WAY_WORDS.title}</h2>
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{MY_WAY_WORDS.hint}</p>
      {MY_WAY_MOMENTS.map((moment) => (
        <fieldset key={moment} style={{ ...rowStyle, border: 'none', padding: 0, margin: '0.75rem 0' }} data-my-way={moment}>
          <legend style={{ fontWeight: 600, fontSize: '0.875rem', padding: 0 }}>{MY_WAY_WORDS.moment[moment]}</legend>
          {(['ask', 'send'] as const).map((way) => (
            <label key={way} style={opt}>
              <input type="radio" name={`my-way-${moment}`} value={way} checked={ways[moment] === way} disabled={busy !== null} onChange={() => void set(moment, way)} />
              {MY_WAY_WORDS.way[way]}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  )
}
