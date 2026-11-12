import { useMemo, useState, type CSSProperties } from 'react'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'
import { PermitChip } from '../bids/PermitChip'
import { recordNameAnswer } from '../../lib/research/bidSiteIo'
import type { NameAnswer } from '../../lib/research/nameAnswers'
import { builderName, type BuilderRow } from '../../lib/research/permitBuilders'
import { TIE_PRESS, mayTie, notTiedWords, searchCustomers, sheetAsks, sheetTiePress, sheetTies } from '../../lib/research/builderAnswers'
import type { BuilderAnswersGround } from '../../lib/research/builderAnswersIo'

/**
 * The answer on a name, from the builder's side (punch list #307, PR 6's leftovers): on a
 * builder's sheet, which of our customers the name is tied to, with whose word it is and when,
 * and Take back beside each. Where a customer's name begins this one, or is begun by it, the
 * sheet asks once *Same company?*. **Tie to a customer** finds any other. Every press appends a
 * row to `builder_customer_answers`, the row the bid's window writes, so both sides read one
 * answer. Nothing is tied until a person presses.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.45 }
const primary: CSSProperties = { font: 'inherit', background: '#2563eb', color: '#fff', border: '1px solid #2563eb', borderRadius: 6, padding: '6px 12px', fontSize: '0.8125rem', fontWeight: 600, minHeight: 34, cursor: 'pointer', whiteSpace: 'nowrap' }
const ghost: CSSProperties = { font: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '6px 12px', fontSize: '0.8125rem', fontWeight: 600, minHeight: 34, cursor: 'pointer', whiteSpace: 'nowrap' }
const linkPress: CSSProperties = { background: 'none', border: 0, padding: 0, font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }

export function BuilderNameTies({ row, ground, onAnswered }: { row: BuilderRow; ground: BuilderAnswersGround; /** An answer was saved: the list reads the answers again. */ onAnswered: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [finding, setFinding] = useState(false)
  const [query, setQuery] = useState('')
  const name = builderName(row)
  const { book, me, people } = ground

  const ties = useMemo(() => sheetTies(row, book, me, (id) => people.get(id) ?? null), [row, book, me, people])
  const asks = useMemo(() => sheetAsks(row, book, me), [row, book, me])
  const found = useMemo(() => searchCustomers(query, row, book), [query, row, book])
  const none = notTiedWords(ties, row.kind)
  const tiePress = sheetTiePress(row)

  const answer = async (customerId: string, value: NameAnswer) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      // The same row the bid's window, the worklist and Find their names write.
      await recordNameAnswer({ builderKey: row.key, customerId, answer: value, scope: value === 'works_for' ? 'all' : null, permitId: null, name })
      setQuery('')
      setFinding(false)
      onAnswered()
    } catch (e) {
      setError(formatErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section data-testid="builder-name-ties">
      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>Our customer under this name</div>
      {ties.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          {ties.map((t) => (
            <div key={t.customerKey} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.875rem' }}>
              <strong>{t.customer}</strong>
              <PermitChip chip={{ words: t.how, tone: t.kind === 'tied' ? 'blue' : 'grey' }} />
              {t.customerId && (
                <button type="button" disabled={busy} aria-label={`Take back the answer on ${t.customer}`} onClick={() => void answer(t.customerId as string, 'taken_back')} style={linkPress}>
                  Take back
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {none && <EmptyState main={none.main} next={none.next ? { label: none.next, onPress: () => setFinding(true) } : undefined} tail={none.tail || undefined} compact />}

      {asks.map((a) => (
        <div key={a.customerKey} style={{ background: 'var(--bg-amber-tint)', borderRadius: 8, padding: '10px 12px', display: 'grid', gap: 8, marginTop: 8, fontSize: '0.8125rem', lineHeight: 1.45 }}>
          <div>
            <strong>{a.lead}</strong> {a.ask}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" disabled={busy} onClick={() => void answer(a.customerId, 'works_for')} style={primary}>
              Same company
            </button>
            <button type="button" disabled={busy} onClick={() => void answer(a.customerId, 'someone_else')} style={ghost}>
              Not them
            </button>
            <button type="button" disabled={busy} onClick={() => void answer(a.customerId, 'not_sure')} style={ghost}>
              Not sure
            </button>
          </div>
          <div style={{ ...muted, color: 'var(--text-amber-800)' }}>{a.why}</div>
        </div>
      ))}

      {mayTie(row.kind) && !none && !finding && (
        <button type="button" onClick={() => setFinding(true)} style={{ ...linkPress, marginTop: 8 }}>
          {TIE_PRESS}
        </button>
      )}
      {finding && (
        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          <input type="search" aria-label="Search our customers" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search our customers" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', font: 'inherit', fontSize: '0.875rem', minHeight: 38, background: 'var(--surface)', color: 'var(--text)' }} />
          {query.trim() !== '' && found.length === 0 && <EmptyState main="No customer begins with those words." tail="Try one word of the name." compact />}
          {found.map((g) => (
            <div key={g.key} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem' }}>
              <span style={{ flex: '1 1 180px', minWidth: 0 }}>{g.name}</span>
              <button type="button" disabled={busy} aria-label={`${tiePress}: ${g.name}`} onClick={() => void answer(g.ids[0] as string, 'works_for')} style={primary}>
                {tiePress}
              </button>
            </div>
          ))}
          <div style={muted}>A tie counts that customer’s bids as ours with {name}. Your name and today go on it.</div>
        </div>
      )}
      {error && <div style={{ ...muted, color: 'var(--text-red-700)', marginTop: 6 }}>{error}</div>}
    </section>
  )
}
