import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { EmptyState } from '../EmptyState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { formatErrorMessage } from '../../utils/errorHandling'
import { RESEARCH_CITIES, type ResearchPermitRow } from '../../lib/research/permitResearch'
import { builderNameOfPermit } from '../../lib/research/permitBuilders'
import { mayKeepFromClosed } from '../../lib/research/permitHistory'
import { findLastMoveWords, findMoreWords, findPermits, findPlaceWords, findReady } from '../../lib/research/permitFind'
import { skimTitle } from '../../lib/research/permitSkim'
import { loadResearchPermits } from '../../lib/research/permitResearchIo'

/**
 * Permits, Find a permit (punch list #302): one search over every list and every city. A person
 * who answered a permit before knows its street, its number, the project, the builder or the
 * city, and not which list it went to. The city on screen is searched from the rows the tab
 * already holds; the other cities are read one at a time when the search opens and searched as
 * they arrive, and a city that cannot be read is named while the rest are searched. A result says where the permit sits and the last
 * thing done to it; its name opens the permit, and a pass can be turned to Investigate or put
 * back on the skim from the row.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.78rem' }
const rowStyle: CSSProperties = { display: 'grid', gap: 3, padding: '11px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }
const chip = (on: boolean): CSSProperties => ({ padding: '5px 11px', borderRadius: 999, fontSize: '0.78rem', border: `1px solid ${on ? '#2563eb' : 'var(--border)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-700)', fontWeight: on ? 600 : 400, cursor: 'pointer', minHeight: 32 })
const linkPress: CSSProperties = { background: 'transparent', border: 0, padding: 0, font: 'inherit', color: 'var(--text-link)', textAlign: 'left', cursor: 'pointer' }
const placePill = (place: string): CSSProperties => ({
  display: 'inline-block',
  borderRadius: 999,
  padding: '1px 8px',
  fontSize: '0.72rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  background: place === 'Skim' ? 'var(--bg-blue-tint)' : place === 'Investigating' || place === 'Pursuing' ? 'var(--bg-green-tint)' : 'var(--bg-200)',
  color: place === 'Skim' ? 'var(--text-blue-800)' : place === 'Investigating' || place === 'Pursuing' ? 'var(--text-green-700)' : 'var(--text-700)',
})

/** The other cities' rows as they arrive. `reading` names the city being read; null once every city has answered. */
type Others = { rows: ResearchPermitRow[]; failed: Array<{ city: string; why: string }>; reading: string | null }
const NO_OTHERS: Others = { rows: [], failed: [], reading: null }

export function PermitFindPanel({
  city,
  cityRows,
  cityLoading,
  refreshKey,
  busyId,
  onOpen,
  onKeep,
  onPutBack,
}: {
  /** The city on screen: its rows are the tab's own. */
  city: string
  cityRows: readonly ResearchPermitRow[]
  cityLoading: boolean
  /** Bumped when an answer is written anywhere on the tab, so the other cities read again. */
  refreshKey: number
  busyId: string | null
  onOpen: (row: ResearchPermitRow) => void
  onKeep: (row: ResearchPermitRow) => void
  onPutBack: (row: ResearchPermitRow) => void
}) {
  const [query, setQuery] = useState('')
  const [everywhere, setEverywhere] = useState(true)
  const [others, setOthers] = useState<Others>(NO_OTHERS)

  // The other cities, read when every city is searched. One city at a time: each read is a heavy
  // one, and several at once crowd out the tab's own (a statement timeout, seen on the first walk).
  // What has arrived is searched while the rest are read; a city that fails is named and the rest stand.
  useEffect(() => {
    if (!everywhere) {
      setOthers(NO_OTHERS)
      return
    }
    let live = true
    const cities = RESEARCH_CITIES.filter((c) => c !== city)
    void (async () => {
      const rows: ResearchPermitRow[] = []
      const failed: Array<{ city: string; why: string }> = []
      for (const c of cities) {
        if (!live) return
        setOthers({ rows: [...rows], failed: [...failed], reading: c })
        try {
          rows.push(...(await loadResearchPermits(c, '2000-01-01', false)))
        } catch (e) {
          failed.push({ city: c, why: formatErrorMessage(e) })
        }
      }
      if (live) setOthers({ rows, failed, reading: null })
    })()
    return () => {
      live = false
    }
  }, [everywhere, city, refreshKey])

  const rows = useMemo(() => (everywhere ? [...cityRows, ...others.rows] : [...cityRows]), [everywhere, others, cityRows])
  const ready = findReady(query)
  const { found, more } = useMemo(() => findPermits(rows, query), [rows, query])
  // What is still being read: the city on screen first, then the other cities in turn.
  const reading = cityLoading ? city : everywhere ? others.reading : null
  const moreWords = findMoreWords(more)

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px 6px' }}>
        <input
          type="search"
          aria-label="Find a permit"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="A street, a permit number, a project, a builder or a city"
          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 11px', font: 'inherit', fontSize: '0.9375rem', minHeight: 44, background: 'var(--surface)', color: 'var(--text-strong)' }}
        />
      </div>
      <div role="group" aria-label="Where to look" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '0 14px 10px' }}>
        <button type="button" aria-pressed={everywhere} onClick={() => setEverywhere(true)} style={chip(everywhere)}>
          Every city
        </button>
        <button type="button" aria-pressed={!everywhere} onClick={() => setEverywhere(false)} style={chip(!everywhere)}>
          {city} only
        </button>
        <span style={muted}>{ready ? `${found.length + more} found${reading ? ` so far, reading ${reading}…` : ''}` : reading ? `Reading ${reading}…` : 'Every list is searched: Skim, Investigating, Pursuing and Closed.'}</span>
      </div>

      {everywhere && others.failed.length > 0 && (
        <div style={{ margin: '0 14px 10px', padding: '8px 11px', borderRadius: 10, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.8125rem' }}>
          {others.failed.map((f) => `${f.city} could not be read: ${f.why}`).join(' ')} The other cities are searched.
        </div>
      )}

      {ready && reading == null && found.length === 0 && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'permits', query }), { onPress: () => setQuery('') })} compact />
        </div>
      )}

      {found.map((row) => {
        const busy = busyId === row.id
        const place = findPlaceWords(row)
        const who = builderNameOfPermit(row) ?? row.contact
        return (
          <div key={row.id} style={{ ...rowStyle, opacity: busy ? 0.6 : 1 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <button type="button" onClick={() => onOpen(row)} style={{ ...linkPress, fontWeight: 700, fontSize: '0.9375rem' }}>
                {skimTitle(row)}
              </button>
              <span style={placePill(place)}>{place}</span>
            </div>
            <div style={{ fontSize: '0.8125rem' }}>
              {[row.address ?? row.permit_number, row.city].filter(Boolean).join(', ')}
              {who ? ` · ${who}` : ''}
            </div>
            <div style={{ ...muted, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span>{findLastMoveWords(row)}</span>
              <span>{row.permit_number}</span>
              {/* A pass or a drop can be turned around from the row, by anyone, until a plumber has the permit. */}
              {mayKeepFromClosed(row) && (
                <>
                  <button type="button" disabled={busy} onClick={() => onKeep(row)} style={{ ...linkPress, fontSize: '0.78rem', fontWeight: 700 }}>
                    Investigate
                  </button>
                  <button type="button" disabled={busy} onClick={() => onPutBack(row)} style={{ ...linkPress, fontSize: '0.78rem' }}>
                    Put back
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}
      {moreWords && <div style={{ ...muted, padding: '9px 14px', borderTop: '1px solid var(--border)' }}>{moreWords}</div>}
    </div>
  )
}
