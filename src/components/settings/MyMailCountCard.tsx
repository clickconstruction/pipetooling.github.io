/**
 * Quickfill's Email station (punch list #159, v2.5824): Settings → Your account → **Mail Quickfill counts**, each listed
 * person's own card. It shows only once the owner or a dev has put the person on the list (`email_box_watch`): which of
 * their labels are counted (a × takes one off, a box adds one), what is kept and what is never read, who sees their
 * rows, how the last count went, and their own switch. A label or a switch saves at once. The words are
 * `emailIn/countCard.ts`; the reads and writes `countCardIo.ts`.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth, type UserRole } from '../../hooks/useAuth'
import { boxHealthWords, MY_MAIL_ADD_LABEL, MY_MAIL_KEEPS, MY_MAIL_OFF_WORDS, MY_MAIL_SAVED, MY_MAIL_TITLE, myMailWords, type WatchView } from '../../lib/emailIn/countCard'
import { supabaseMyMailIo, type MyMailIo } from '../../lib/emailIn/countCardIo'
import { cleanLabels } from '../../lib/emailIn/countedBoxes'
import { GC_OFFICE_TEAM } from '../../lib/gc/access'
import { formatErrorMessage } from '../../utils/errorHandling'
import { clauseButtonStyle, clauseInputStyle } from '../contracts/clauseStyles'

const card: CSSProperties = { marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }
const muted: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }
const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.15rem 0.6rem', borderRadius: 999, background: 'var(--bg-subtle)', border: '1px solid var(--border)', fontSize: '0.85rem', fontWeight: 600 }

type Loaded = { row: WatchView | null; limitDays: number; leadName: string | null; addedBy: string | null }

export function MyMailCountCard({ role, userId: userIdProp, io: ioProp, nowIso }: { role: UserRole | null | undefined; userId?: string; io?: MyMailIo; nowIso?: string }) {
  const { showToast } = useToastContext()
  const { user } = useAuth()
  const userId = userIdProp ?? user?.id ?? null
  const io = useMemo(() => ioProp ?? supabaseMyMailIo(), [ioProp])
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [adding, setAdding] = useState('')
  const office = Boolean(role) && GC_OFFICE_TEAM.includes(role!)

  useEffect(() => {
    if (!office || !userId) return
    let live = true
    io.load(userId).then(
      (r) => live && setLoaded(r),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [io, office, userId])

  // Nothing to show until the owner puts the person on the list.
  if (!office || !userId || !loaded?.row) return null
  const row = loaded.row
  const labels = cleanLabels(row.labels)
  const words = myMailWords({ addedBy: loaded.addedBy, addedOn: row.created_at, limitDays: loaded.limitDays, leadName: loaded.leadName })

  const save = async (write: () => Promise<void>, next: Partial<WatchView>, toast?: string) => {
    setBusy(true)
    setProblem(null)
    try {
      await write()
      setLoaded((l) => (l && l.row ? { ...l, row: { ...l.row, ...next } } : l))
      if (toast) showToast(toast, 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const setLabels = (next: string[]) => void save(() => io.setLabels(row.id, next), { labels: cleanLabels(next) }, MY_MAIL_SAVED)
  const add = () => {
    const t = adding.trim()
    if (!t) return
    setAdding('')
    setLabels([...labels, t])
  }

  return (
    <div style={card} data-testid="my-mail-count-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>{MY_MAIL_TITLE}</h2>
        <button
          type="button"
          role="switch"
          aria-checked={row.is_on}
          aria-label={MY_MAIL_TITLE}
          disabled={busy}
          onClick={() => void save(() => io.setOn(row.id, !row.is_on), { is_on: !row.is_on })}
          style={{ marginLeft: 'auto', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0.15rem 0.7rem', fontSize: '0.85rem', fontWeight: 600, cursor: busy ? 'default' : 'pointer', background: row.is_on ? '#16a34a' : 'var(--surface)', color: row.is_on ? 'white' : 'var(--text-base)' }}
        >
          {row.is_on ? 'On' : 'Off'}
        </button>
      </div>
      {row.is_on ? (
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{words.intro}</p>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }} data-my-mail-labels>
            {labels.map((l) => (
              <span key={l} style={chip}>
                {l}
                {labels.length > 1 && (
                  <button type="button" aria-label={`Stop counting ${l}`} disabled={busy} onClick={() => setLabels(labels.filter((x) => x !== l))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, fontSize: '0.9rem', lineHeight: 1 }}>
                    ×
                  </button>
                )}
              </span>
            ))}
            <input aria-label="Add a label" placeholder={MY_MAIL_ADD_LABEL} value={adding} disabled={busy} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} style={{ ...clauseInputStyle, width: '9rem' }} />
            {adding.trim() && (
              <button type="button" disabled={busy} onClick={add} style={clauseButtonStyle}>
                Add
              </button>
            )}
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{MY_MAIL_KEEPS}</p>
          <p style={{ margin: 0, fontSize: '0.9rem' }} data-my-mail-sees>
            {words.sees}
          </p>
          <p style={muted} data-my-mail-health>
            {boxHealthWords(row, nowIso ?? new Date().toISOString())}
          </p>
        </div>
      ) : (
        <p style={muted}>{MY_MAIL_OFF_WORDS}</p>
      )}
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
          {problem}
        </div>
      )}
    </div>
  )
}
