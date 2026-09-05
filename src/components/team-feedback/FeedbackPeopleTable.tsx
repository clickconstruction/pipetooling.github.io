/**
 * People → Feedback (v2.2835): one row per person — Deck chip, crew mini bars over the office
 * lane, gap chip, words count. Cards under 640px. Click a row to open the person drawer.
 */
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { RATING_DEFS } from '../prospects/ratingDimensions'
import {
  deckStateLabel,
  feedbackFilterCounts,
  filterFeedbackRows,
  roleLabel,
  type DeckState,
  type FeedbackPersonRow,
  type RowFilter,
} from '../../lib/people/feedbackTabRows'

const FILTERS: Array<{ id: RowFilter; label: string }> = [
  { id: 'clocks_out', label: 'Clocks out' },
  { id: 'due', label: 'Due now' },
  { id: 'words', label: 'Has words' },
  { id: 'everyone', label: 'Everyone' },
]

type Props = {
  rows: FeedbackPersonRow[]
  nowMs: number
  enabled: boolean
  selectedUserId: string | null
  onSelect: (userId: string) => void
  narrow: boolean
}

export default function FeedbackPeopleTable({ rows, nowMs, enabled, selectedUserId, onSelect, narrow }: Props) {
  const [filter, setFilter] = useState<RowFilter>('clocks_out')
  const [search, setSearch] = useState('')
  const counts = useMemo(() => feedbackFilterCounts(rows), [rows])
  const visible = useMemo(() => filterFeedbackRows(rows, filter, search), [rows, filter, search])
  const shownFilters = enabled ? FILTERS : FILTERS.filter((f) => f.id !== 'due')

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', margin: '0.85rem 0 0.5rem' }}>
        {shownFilters.map((f) => (
          <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} style={pill(filter === f.id)}>
            {f.label} · {counts[f.id]}
          </button>
        ))}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          aria-label="Search people"
          style={{ marginLeft: narrow ? 0 : 'auto', minWidth: 160, padding: '0.3rem 0.6rem', font: 'inherit', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)' }}
        />
      </div>

      {visible.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.75rem 0' }}>Nobody matches.</p>
      ) : narrow ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {visible.map((r) => (
            <button key={r.userId} type="button" onClick={() => onSelect(r.userId)} style={{ ...card, outline: selectedUserId === r.userId ? '2px solid var(--text-link)' : 'none' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{r.name}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{roleLabel(r.role)}</span>
                <span style={{ marginLeft: 'auto' }}>
                  <DeckChip deck={r.deck} nowMs={nowMs} />
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.4rem' }}>
                <MiniBars row={r} compact />
                <CrewCountChip row={r} />
                {r.wordsCount > 0 && <span style={chipStyle('n')}>{r.wordsCount} words</span>}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Deck</Th>
                <Th>Crew · Ability / Drive / Integrity</Th>
                <Th> </Th>
                <Th>Words</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const selected = selectedUserId === r.userId
                return (
                  <tr
                    key={r.userId}
                    onClick={() => onSelect(r.userId)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelect(r.userId)
                      }
                    }}
                    aria-selected={selected}
                    style={{ cursor: 'pointer', background: selected ? 'var(--bg-subtle)' : 'transparent' }}
                  >
                    <Td>
                      <div style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{r.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{roleLabel(r.role)}</div>
                    </Td>
                    <Td>
                      <DeckChip deck={r.deck} nowMs={nowMs} />
                    </Td>
                    <Td>
                      <MiniBars row={r} />
                    </Td>
                    <Td>
                      <span style={{ display: 'inline-flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {r.crew.gapDimensions.length > 0 && <span style={chipStyle('gap')}>split on {r.crew.gapDimensions.join(', ')}</span>}
                        <CrewCountChip row={r} />
                      </span>
                    </Td>
                    <Td>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: r.wordsCount > 0 ? 'var(--text-strong)' : 'var(--text-faint)' }}>{r.wordsCount > 0 ? r.wordsCount : '—'}</span>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function DeckChip({ deck, nowMs }: { deck: DeckState; nowMs: number }) {
  const kind = deck.kind === 'due' ? (deck.never ? 'nev' : 'due') : deck.kind === 'done' ? (deck.skipped ? 'n' : 'done') : deck.kind === 'snoozed' ? 'snz' : 'off'
  return <span style={chipStyle(kind)}>{deckStateLabel(deck, nowMs)}</span>
}

function CrewCountChip({ row }: { row: FeedbackPersonRow }) {
  const c = row.crew.crewRaterCount
  const o = row.crew.officeReviewerCount
  if (c === 0 && o === 0) return null
  return (
    <span style={chipStyle('n')} title={c < 2 ? 'The office sees a crew average only once two people have rated' : undefined}>
      {c} crew{o > 0 ? ` · ${o} office` : ''}
    </span>
  )
}

function MiniBars({ row, compact = false }: { row: FeedbackPersonRow; compact?: boolean }) {
  const c = row.crew.crewRaterCount
  const o = row.crew.officeReviewerCount
  if (c === 0 && o === 0) return <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>no ratings yet</span>
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${compact ? 52 : 64}px)`, gap: '0.5rem' }}>
      {RATING_DEFS.map((def) => {
        const lane = row.crew.lanes.find((l) => l.key === def.key)
        return (
          <div key={def.key} title={`${def.short}: crew ${lane?.crew ?? '—'} · office ${lane?.office ?? '—'}`}>
            <Bar value={lane?.crew ?? null} color={def.color} opacity={1} />
            <Bar value={lane?.office ?? null} color={def.color} opacity={0.4} />
            {!compact && (
              <small style={{ display: 'block', fontSize: '0.66rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                {lane?.crew == null ? '—' : Math.round(lane.crew)} / {lane?.office == null ? '—' : Math.round(lane.office)}
              </small>
            )}
          </div>
        )
      })}
      {!compact && c === 0 && <small style={{ gridColumn: '1 / span 3', fontSize: '0.66rem', color: 'var(--text-faint)' }}>office only · no crew rating yet</small>}
      {!compact && c === 1 && <small style={{ gridColumn: '1 / span 3', fontSize: '0.66rem', color: 'var(--text-faint)' }}>1 crew rating · the office sees it at 2</small>}
    </div>
  )
}

function Bar({ value, color, opacity }: { value: number | null; color: string; opacity: number }) {
  return (
    <div aria-hidden style={{ height: 4, borderRadius: 999, background: 'var(--bg-muted)', overflow: 'hidden', marginTop: 3 }}>
      <div style={{ height: '100%', width: `${value ?? 0}%`, background: color, opacity, borderRadius: 999 }} />
    </div>
  )
}

function Th({ children }: { children: ReactNode }) {
  return <th style={{ textAlign: 'left', fontSize: '0.62rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border)' }}>{children}</th>
}
function Td({ children }: { children: ReactNode }) {
  return <td style={{ padding: '0.5rem 0.5rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>{children}</td>
}

export function chipStyle(kind: 'due' | 'done' | 'snz' | 'nev' | 'gap' | 'n' | 'off'): CSSProperties {
  const palette: Record<typeof kind, { background: string; color: string }> = {
    due: { background: 'var(--bg-orange-tint)', color: 'var(--text-orange-700)' },
    done: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
    snz: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' },
    nev: { background: 'var(--bg-muted)', color: 'var(--text-muted)' },
    off: { background: 'var(--bg-muted)', color: 'var(--text-faint)' },
    gap: { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' },
    n: { background: 'var(--bg-muted)', color: 'var(--text-700)' },
  }
  return { ...palette[kind], fontSize: '0.68rem', fontWeight: 700, padding: '1px 8px', borderRadius: 999, whiteSpace: 'nowrap', display: 'inline-block' }
}

function pill(active: boolean): CSSProperties {
  return {
    font: 'inherit',
    fontSize: '0.78rem',
    fontWeight: active ? 700 : 500,
    padding: '0.25rem 0.75rem',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--text-strong)' : 'var(--border-strong)'}`,
    background: active ? 'var(--text-strong)' : 'transparent',
    color: active ? 'var(--surface)' : 'var(--text-700)',
    cursor: 'pointer',
  }
}

const card: CSSProperties = { textAlign: 'left', width: '100%', font: 'inherit', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', cursor: 'pointer', color: 'var(--text-base)' }
