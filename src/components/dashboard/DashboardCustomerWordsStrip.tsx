import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { parseMyCustomerWords, stripWords, unseenWords, type MyCustomerWord } from '../../lib/ratings/ratingCredit'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * The customer's words, the day they land (punch list #255, v2.6584): a green strip at the top of the tech's home for
 * a four or five star answer on a job they clocked onto. The customer's first name, the stars, their words, the job
 * and the day. **Got it** keeps the strip's row for this tech (`rating_credit_seen`) and shows the next one, if any.
 * Reads `my_customer_words()`, which answers for the signed-in person alone. Renders nothing when nothing waits.
 */

const STRIP: CSSProperties = { border: '1px solid #16a34a', borderRadius: 10, background: 'var(--bg-green-tint)', padding: '0.7rem 0.9rem', marginBottom: '0.75rem', display: 'grid', gap: 6 }
const TITLE: CSSProperties = { margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-green-800)' }
const QUOTE: CSSProperties = { margin: 0, fontSize: '0.95rem', color: 'var(--text-strong)', borderLeft: '3px solid #16a34a', paddingLeft: 10 }
const PLACE: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-700)' }
const BUTTON: CSSProperties = { font: 'inherit', fontSize: '0.82rem', fontWeight: 600, padding: '0.35rem 0.9rem', minHeight: 34, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }
const STARS_ON = '#f59e0b'

type Rpc = { rpc: (fn: string) => PromiseLike<{ data: unknown; error: unknown }> }
type Writes = { from: (table: string) => { insert: (row: Record<string, unknown>) => PromiseLike<{ error: unknown }> } }

export function DashboardCustomerWordsStrip({ userId }: { userId: string | null | undefined }) {
  const [list, setList] = useState<MyCustomerWord[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let live = true
    void (supabase as unknown as Rpc).rpc('my_customer_words').then(
      ({ data, error }) => live && setList(error ? [] : parseMyCustomerWords(data)),
      () => live && setList([]),
    )
    return () => {
      live = false
    }
  }, [userId])

  const unseen = useMemo(() => (list ? unseenWords(list) : []), [list])
  const current = unseen[0]
  if (!userId || !current) return null
  const w = stripWords(current)

  async function gotIt() {
    if (!current || !userId) return
    setBusy(true)
    setProblem(null)
    try {
      const { error } = await (supabase as unknown as Writes).from('rating_credit_seen').insert({ rating_id: current.id, user_id: userId })
      if (error) throw error
      const at = new Date().toISOString()
      setList((prev) => (prev ?? []).map((x) => (x.id === current.id ? { ...x, seenAt: at } : x)))
    } catch (e) {
      setProblem(formatErrorMessage(e, 'Got it was not saved.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section style={STRIP} aria-label="A customer’s words" data-testid="customer-words-strip">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <h2 style={TITLE}>{w.title}</h2>
        <span aria-hidden style={{ color: STARS_ON, letterSpacing: 1 }}>
          {'★'.repeat(current.score)}
        </span>
        {unseen.length > 1 ? <span style={PLACE}>and {unseen.length - 1} more</span> : null}
      </div>
      {w.quote ? <p style={QUOTE}>“{w.quote}”</p> : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={PLACE}>{w.place}</span>
        <button type="button" style={{ ...BUTTON, marginLeft: 'auto', opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => void gotIt()}>
          {w.button}
        </button>
      </div>
      {problem ? (
        <div role="alert" style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>
          {problem}
        </div>
      ) : null}
    </section>
  )
}

export default DashboardCustomerWordsStrip
