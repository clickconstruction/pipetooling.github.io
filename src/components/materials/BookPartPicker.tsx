/**
 * The parts book's picker (punch list #330, PR 4), drawn under an open row of a site's materials
 * and inside the pricing window (#342): every word typed must be in the part's name. A pick ties
 * the name to that part. It opens on the name's folded words (`bookSearchFolded`), so a crew's
 * `tees` finds the book's `TEE`.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { formatErrorMessage } from '../../utils/errorHandling'
import type { BookPartHit } from '../../lib/materials/bookSearchIo'
import { bookSearchFolded } from '../../lib/materials/priceOffers'

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
const btn: CSSProperties = { minHeight: 36, padding: '0 0.75rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }

export function BookPartPicker({ name, busy, search, onPick, onCancel }: { /** The typed name being tied. */ name: string; busy: boolean; search: (term: string) => Promise<BookPartHit[]>; onPick: (part: BookPartHit) => void; onCancel: () => void }) {
  const [term, setTerm] = useState(() => bookSearchFolded(name))
  const [hits, setHits] = useState<BookPartHit[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    if (!term.trim()) {
      setHits(null)
      return
    }
    let live = true
    const t = setTimeout(() => {
      search(term)
        .then((r) => {
          if (!live) return
          setHits(r)
          setFailed(null)
        })
        .catch((e) => {
          if (live) setFailed(formatErrorMessage(e, 'The parts book did not answer.'))
        })
    }, 250)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [term, search])
  return (
    <div style={{ display: 'grid', gap: '0.35rem', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', borderRadius: 8, padding: '0.45rem 0.55rem', background: 'var(--surface)' }} data-testid="book-part-picker">
      <span style={{ fontWeight: 600 }}>Which parts-book part is “{name}”?</span>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <input type="search" autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Words in the part’s name" aria-label="Find it in the parts book" style={{ flex: '1 1 200px', minWidth: 0, minHeight: 34, borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--bg-subtle)', color: 'var(--text-strong)', font: 'inherit', padding: '0 0.6rem' }} />
        <button type="button" style={{ ...btn, minHeight: 34, fontSize: '0.78rem', fontWeight: 500 }} onClick={onCancel}>Cancel</button>
      </div>
      {failed ? <span style={{ color: 'var(--text-red-700)' }}>{failed}</span> : null}
      {hits && hits.length === 0 && !failed ? <span style={muted}>The parts book has no part with every one of those words. Try fewer words.</span> : null}
      {hits && hits.length > 0 ? (
        <div style={{ display: 'grid', gap: 2, maxHeight: 220, overflow: 'auto' }}>
          {hits.map((p) => (
            <button key={p.id} type="button" disabled={busy} onClick={() => onPick(p)} style={{ ...btn, minHeight: 32, fontSize: '0.8rem', fontWeight: 500, justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal' }} aria-label={`Tie to ${p.name}`}>
              {p.name}{p.manufacturer ? <span style={muted}> · {p.manufacturer}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      <span style={muted}>The row then reads the book’s name and price. Each box keeps its own count, and Undo takes the tie back.</span>
    </div>
  )
}
