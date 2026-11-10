import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../EmptyState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { leadDoor, shortDay, type ResearchPermitRow, type ValueFloor } from '../../lib/research/permitResearch'
import { mayKeepFromClosed } from '../../lib/research/permitHistory'
import {
  CLOSED_WORDS,
  PURSUE_FOR_WORDS,
  builderNameOfPermit,
  closedChipCounts,
  closedRows,
  keptByWords,
  keptChipCounts,
  keptRows,
  pursuingRows,
  tookPlumberSinceKept,
  type ClosedWhy,
  type KeptShowing,
} from '../../lib/research/permitBuilders'
import { skimMoney, skimTitle } from '../../lib/research/permitSkim'
import type { Researcher } from './PermitSkimDeck'

/**
 * Permits, the three lists after the skim (punch list #302, PR 7): Kept (what step two works, the
 * ones to look at again today first, with whose each one is), Pursuing (each with its lead) and
 * Closed (passed, not pursued, has a plumber: found again by a search, and put back). A row of
 * Kept opens the permit; a keep can be handed to a person from the row.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.78rem' }
const rowStyle: CSSProperties = { display: 'grid', gap: 3, padding: '11px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }
const chip = (on: boolean): CSSProperties => ({ padding: '5px 11px', borderRadius: 999, fontSize: '0.78rem', border: `1px solid ${on ? '#2563eb' : 'var(--border)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text)', fontWeight: on ? 600 : 400, minHeight: 32, cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap' })
const pill = (tone: 'green' | 'grey' | 'amber' | 'red'): CSSProperties => ({
  display: 'inline-block',
  borderRadius: 999,
  padding: '1px 8px',
  fontSize: '0.72rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  background: tone === 'green' ? 'var(--bg-green-tint)' : tone === 'amber' ? 'var(--bg-amber-tint)' : tone === 'red' ? 'var(--bg-red-tint)' : 'var(--bg-200)',
  color: tone === 'green' ? 'var(--text-green-700)' : tone === 'amber' ? 'var(--text-amber-800)' : tone === 'red' ? 'var(--text-red-700)' : 'var(--text-700)',
})
const linkPress: CSSProperties = { background: 'transparent', border: 0, padding: 0, font: 'inherit', color: 'var(--text-link)', textAlign: 'left', cursor: 'pointer' }

const KEPT_CHIPS: Array<{ key: KeptShowing; words: string }> = [
  { key: 'everyone', words: 'Everyone’s' },
  { key: 'mine', words: 'Mine' },
  { key: 'nobody', words: 'Nobody’s yet' },
  { key: 'again', words: 'Look again today' },
]
const CLOSED_CHIPS: ClosedWhy[] = ['passed', 'plumber', 'not_pursuing']

function Mark({ row }: { row: ResearchPermitRow }) {
  if (row.builder_mark === 'good') return <span style={pill('green')}>Good</span>
  if (row.builder_mark === 'avoid') return <span style={pill('red')}>Avoid</span>
  return null
}

function Head({ row, onOpen }: { row: ResearchPermitRow; onOpen: (row: ResearchPermitRow) => void }) {
  const who = builderNameOfPermit(row) ?? row.contact
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <button type="button" onClick={() => onOpen(row)} style={{ ...linkPress, fontWeight: 700, fontSize: '0.9375rem' }}>
          {skimTitle(row)}
        </button>
        <span style={{ ...muted, whiteSpace: 'nowrap' }}>{skimMoney(row)}</span>
      </div>
      <div style={{ fontSize: '0.8125rem' }}>
        {[row.address ?? row.permit_number, who].filter(Boolean).join(' · ')} <Mark row={row} />
      </div>
    </>
  )
}

export function PermitPlaceList({
  place,
  rows,
  floor,
  me,
  todayYmd,
  researchers,
  busyId,
  onOpen,
  onHandTo,
  onPutBack,
  onKeep,
  onSkim,
}: {
  place: 'kept' | 'pursuing' | 'closed'
  rows: readonly ResearchPermitRow[]
  floor: ValueFloor
  me: string
  todayYmd: string
  researchers: readonly Researcher[]
  /** The permit a write is running on, so its presses rest. */
  busyId: string | null
  onOpen: (row: ResearchPermitRow) => void
  onHandTo: (row: ResearchPermitRow, userId: string | null) => void
  onPutBack: (row: ResearchPermitRow) => void
  /** A closed permit goes to Kept: anyone may overturn a pass or a drop. */
  onKeep?: (row: ResearchPermitRow) => void
  /** Back to the skim, for the press an empty list offers. */
  onSkim: () => void
}) {
  const [keptShowing, setKeptShowing] = useState<KeptShowing>('everyone')
  const [closedWhy, setClosedWhy] = useState<ClosedWhy>('passed')
  const [search, setSearch] = useState('')

  const keptCounts = useMemo(() => keptChipCounts(rows, floor, me, todayYmd), [rows, floor, me, todayYmd])
  const closedCounts = useMemo(() => closedChipCounts(rows, floor), [rows, floor])
  const list = useMemo(() => {
    if (place === 'kept') return keptRows(rows, floor, keptShowing, me, todayYmd)
    if (place === 'pursuing') return pursuingRows(rows, floor)
    return closedRows(rows, floor, closedWhy, search)
  }, [place, rows, floor, keptShowing, me, todayYmd, closedWhy, search])
  // Kept permits a plumber has since taken sit in Closed; Kept says so once, with the door.
  const tookPlumber = useMemo(() => (place === 'kept' ? rows.filter(tookPlumberSinceKept).length : 0), [place, rows])

  const empty = () => {
    if (place === 'kept') {
      return keptShowing === 'everyone' ? (
        <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'permits to investigate', control: 'Investigate on the skim' }), { onPress: onSkim })} compact />
      ) : (
        <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'permits to investigate', query: '' }), { onPress: () => setKeptShowing('everyone') })} compact />
      )
    }
    if (place === 'pursuing') return <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'pursued permits', control: 'Pursue on a permit you are investigating' }), { onPress: onSkim })} compact />
    return <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'closed permits', query: search }), { onPress: () => setSearch('') })} compact />
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', overflow: 'hidden' }}>
      {place === 'kept' && (
        <>
          {tookPlumber > 0 && (
            <div style={{ margin: '10px 14px 0', padding: '8px 11px', borderRadius: 10, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.8125rem' }}>
              {tookPlumber === 1 ? '1 permit you were investigating got a plumber since.' : `${tookPlumber} permits you were investigating got a plumber since.`} {tookPlumber === 1 ? 'It is' : 'They are'} under Closed, Has a plumber.
            </div>
          )}
          <div role="group" aria-label="Whose" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 14px' }}>
            {KEPT_CHIPS.map((c) => (
              <button key={c.key} type="button" aria-pressed={keptShowing === c.key} onClick={() => setKeptShowing(c.key)} style={chip(keptShowing === c.key)}>
                {c.words} {keptCounts[c.key]}
              </button>
            ))}
          </div>
        </>
      )}
      {place === 'closed' && (
        <>
          <div role="group" aria-label="Why closed" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 14px 6px' }}>
            {CLOSED_CHIPS.map((w) => (
              <button key={w} type="button" aria-pressed={closedWhy === w} onClick={() => setClosedWhy(w)} style={chip(closedWhy === w)}>
                {CLOSED_WORDS[w]} {closedCounts[w]}
              </button>
            ))}
          </div>
          <div style={{ padding: '0 14px 10px' }}>
            <input
              type="search"
              aria-label="Search closed permits"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search a street, a builder or a permit number"
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', font: 'inherit', fontSize: '0.875rem', minHeight: 40, background: 'var(--surface)', color: 'var(--text)' }}
            />
          </div>
        </>
      )}

      {list.length === 0 && <div style={{ borderTop: '1px solid var(--border)' }}>{empty()}</div>}

      {list.map((row) => {
        const busy = busyId === row.id
        const due = row.verdict_look_again_on != null && row.verdict_look_again_on <= todayYmd
        return (
          <div key={row.id} style={{ ...rowStyle, opacity: busy ? 0.6 : 1 }}>
            <Head row={row} onOpen={onOpen} />
            {place === 'kept' && (
              <div style={{ ...muted, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>{keptByWords(row, todayYmd)}</span>
                {due && <span style={pill('amber')}>Look again today</span>}
                {researchers.length > 0 && (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span>Hand to</span>
                    <select aria-label={`Hand ${row.address ?? row.permit_number} to`} value={row.verdict_for_user ?? ''} disabled={busy} onChange={(e) => onHandTo(row, e.target.value || null)} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', font: 'inherit', fontSize: '0.78rem', background: 'var(--surface)', color: 'var(--text)', minHeight: 30 }}>
                      <option value="">nobody yet</option>
                      {researchers.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.id === me ? 'me' : r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {/* A keep made by mistake goes back to the skim; the answer bar's Undo only lasts a few seconds. */}
                <button type="button" disabled={busy} onClick={() => onPutBack(row)} style={{ ...linkPress, fontSize: '0.78rem' }}>
                  Put back
                </button>
              </div>
            )}
            {place === 'pursuing' && (
              <div style={{ ...muted, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>
                  Pursued by {row.verdict_by_name ?? 'someone'}, {shortDay(row.verdict_at ? row.verdict_at.slice(0, 10) : null)}
                  {row.verdict_for_name ? `, for ${row.verdict_for_name} to follow up` : ''}
                </span>
                {row.verdict_pursue_for && <span style={pill('grey')}>{PURSUE_FOR_WORDS[row.verdict_pursue_for]}</span>}
                {row.verdict_prospect_id && (
                  <Link to={leadDoor(row.verdict_prospect_id)} style={{ color: 'var(--text-link)' }}>
                    the lead
                  </Link>
                )}
              </div>
            )}
            {place === 'closed' && (
              <div style={{ ...muted, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {closedWhy === 'plumber' ? (
                  <span>
                    {row.plumber ? `${row.plumber} has it` : 'A plumbing permit is on file, no plumber named'}
                    {row.plumber_permit_on ? `, ${shortDay(row.plumber_permit_on)}` : ''}
                  </span>
                ) : (
                  <>
                    <span>
                      {row.verdict_by_name ?? 'Someone'}, {shortDay(row.verdict_at ? row.verdict_at.slice(0, 10) : null)}
                    </span>
                    <span style={pill('grey')}>{row.verdict_reason ?? 'no reason given'}</span>
                  </>
                )}
                {/* Anyone may keep a pass or a drop, their own included, until a plumber has the permit. */}
                {onKeep && mayKeepFromClosed(row) && (
                  <button type="button" disabled={busy} onClick={() => onKeep(row)} style={{ ...linkPress, fontSize: '0.78rem', fontWeight: 700 }}>
                    Investigate
                  </button>
                )}
                {/* A put-back only moves a permit the feed has not paired with a plumbing permit. */}
                {row.verdict != null && !row.plumber && !row.plumber_permit_on && (
                  <button type="button" disabled={busy} onClick={() => onPutBack(row)} style={{ ...linkPress, fontSize: '0.78rem' }}>
                    Put back
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
