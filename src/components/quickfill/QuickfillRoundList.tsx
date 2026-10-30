import { useState, type CSSProperties, type ReactNode } from 'react'
import { describeRoundRow, roundHeadline, roundQueue, type RoundRow, type RoundState } from '../../lib/quickfill/round'
import type { RoundCloseSheet } from '../../lib/quickfill/roundClose'
import {
  QUICKFILL_RHYTHM_STRIP_KEY,
  filterRoundRows,
  rhythmStripAxis,
  roundHeadChipWords,
  roundHeadChips,
  stationRhythmStrip,
  type RhythmStripTone,
  type RoundHeadFilter,
} from '../../lib/quickfill/stationRhythmStrip'
import { QuickfillRoundCloseSheet } from './QuickfillRoundCloseSheet'
import { EmptyState } from '../EmptyState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { ShapeSwitch, SideBySide, useShapeView } from '../prototypes/SideBySide'
import { QuickfillRhythmStripAxis, QuickfillStationRhythmStrip, RhythmStripChip } from './QuickfillStationRhythmStrip'

const dotColor: Record<RoundState, string> = {
  due: '#dc2626',
  never: '#dc2626',
  due_today: '#d97706',
  not_yet: 'var(--border-strong)',
  fresh: '#16a34a',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  width: '100%',
  padding: '0.6rem 0.75rem',
  minHeight: 56,
  border: 'none',
  borderBottom: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  textAlign: 'left',
  cursor: 'pointer',
  font: 'inherit',
  boxSizing: 'border-box',
}

const HEAD_CHIP_TONE: Record<RhythmStripTone, CSSProperties> = {
  red: { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', borderColor: 'var(--border-red)' },
  amber: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderColor: 'var(--border-amber)' },
  green: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)', borderColor: 'var(--bg-green-200)' },
  grey: { background: 'var(--bg-muted)', color: 'var(--text-muted)', borderColor: 'var(--border)' },
}

const NO_MARKS: ReadonlyArray<string> = []

type ListProps = {
  /** The company-time hour (v2.5841): an afternoon station is out of the queue before its hour. */
  hourNow?: number | null
  /** The day's close sheet (v2.5845): drawn under the head once the queue is empty. */
  closeSheet?: RoundCloseSheet | null
  rows: RoundRow[]
  search: string
  onSearch: (q: string) => void
  onOpen: (sectionId: string) => void
  now: Date
  /** Each station's marks for the strip (`rhythmMarksBySection` over the round's events); none draws the strips bare. */
  marksOf?: (sectionId: string) => ReadonlyArray<string>
}

/**
 * The list itself, in one of its two shapes. `strip` off is the list as it is: the head's
 * counts as a sentence, a grey rhythm line under each name. On, the head's counts are chips
 * that filter the list and each row carries its two-week strip (punch list #217, office-8).
 */
function RoundListBody({ hourNow = null, closeSheet = null, rows, search, onSearch, onOpen, now, marksOf, strip, switchEl }: ListProps & { strip: boolean; switchEl?: ReactNode }) {
  const [filter, setFilter] = useState<RoundHeadFilter | null>(null)
  const queue = roundQueue(rows, hourNow)
  const q = search.trim().toLowerCase()
  const byChip = filterRoundRows(rows, strip ? filter : null)
  const shown = q ? byChip.filter((r) => r.label.toLowerCase().includes(q)) : byChip
  const chips = strip ? roundHeadChips(rows) : []
  const headline = roundHeadline(rows)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.6rem' }}>
        {strip ? (
          <div role="group" aria-label="The round by state" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', minWidth: 0 }}>
            {chips.map((c) => {
              const pressed = filter === c.filter
              return (
                <button
                  key={c.filter}
                  type="button"
                  aria-pressed={pressed}
                  aria-label={roundHeadChipWords(c, pressed)}
                  onClick={() => setFilter((f) => (f === c.filter ? null : c.filter))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.15rem 0.55rem',
                    borderRadius: 999,
                    border: '1px solid',
                    font: 'inherit',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: pressed ? 'inset 0 0 0 1px currentColor' : undefined,
                    ...HEAD_CHIP_TONE[c.tone],
                  }}
                >
                  {c.label}
                  <b style={{ fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>{c.n}</b>
                </button>
              )
            })}
          </div>
        ) : (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
            <b>{headline.split(' · ')[0]}</b>
            {headline.includes(' · ') ? ` · ${headline.split(' · ').slice(1).join(' · ')}` : ''}
          </div>
        )}
        {queue.length > 0 ? (
          <button
            type="button"
            onClick={() => onOpen(queue[0]!)}
            style={{ flexShrink: 0, padding: '0.4rem 0.7rem', borderRadius: 999, border: '1px solid var(--text-link)', background: 'var(--text-link)', color: 'var(--surface)', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}
          >
            Round · {queue.length} ›
          </button>
        ) : (
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-green-700)', fontWeight: 600 }}>Round done ✓</span>
        )}
      </div>
      {queue.length === 0 && closeSheet && closeSheet.stations > 0 ? (
        <div style={{ marginBottom: '0.6rem' }}>
          <QuickfillRoundCloseSheet sheet={closeSheet} onOpenStation={onOpen} />
        </div>
      ) : null}
      {switchEl ? <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.4rem' }}>{switchEl}</div> : null}
      <input
        type="search"
        placeholder="Search sections…"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        aria-label="Search Quickfill sections"
        style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: 16, border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', marginBottom: '0.6rem' }}
      />
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
        {shown.length === 0 ? (
          // The search hides every row: quote it and offer Clear the search (punch list #184, sweep C); a pressed chip, the same with Clear the filters.
          q ? (
            <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'sections', query: search }), { onPress: () => onSearch('') })} />
          ) : strip && filter != null ? (
            <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'sections', query: '' }), { onPress: () => setFilter(null) })} />
          ) : (
            <EmptyState compact main="Every Quickfill section is hidden. A developer shows them again under Active sections." />
          )
        ) : strip ? (
          shown.map((r) => {
            const s = stationRhythmStrip(r, (marksOf ?? (() => NO_MARKS))(r.sectionId), now, hourNow)
            return (
              <button key={r.sectionId} type="button" onClick={() => onOpen(r.sectionId)} style={{ ...rowStyle, alignItems: 'flex-start' }} aria-label={`${r.label} — ${s.words}`}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, background: r.personal ? 'var(--border-strong)' : dotColor[r.state], flexShrink: 0 }} />
                <span style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>{r.label}</span>
                    <RhythmStripChip chip={s.chip} />
                    {r.personal ? (
                      <span aria-hidden="true" style={{ color: 'var(--text-faint)', fontSize: '1.1rem' }}>›</span>
                    ) : r.countSource === 'none' ? (
                      <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>—</span>
                    ) : (
                      <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {r.count}
                        <span style={{ fontWeight: 500, fontSize: '0.625rem', color: 'var(--text-muted)', marginLeft: 3 }}>{r.countSource === 'open' ? 'open' : 'at last look'}</span>
                      </span>
                    )}
                  </span>
                  <QuickfillStationRhythmStrip strip={s} height={14} />
                </span>
              </button>
            )
          })
        ) : (
          shown.map((r) => (
            <button key={r.sectionId} type="button" onClick={() => onOpen(r.sectionId)} style={rowStyle} aria-label={`${r.label} — ${describeRoundRow(r, now, hourNow)}`}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: r.personal ? 'var(--border-strong)' : dotColor[r.state], flexShrink: 0 }} />
              <span style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{describeRoundRow(r, now, hourNow)}</span>
              </span>
              {r.personal ? (
                <span aria-hidden="true" style={{ color: 'var(--text-faint)', fontSize: '1.1rem' }}>›</span>
              ) : r.countSource === 'none' ? (
                <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>—</span>
              ) : (
                <span style={{ textAlign: 'right', flexShrink: 0, minWidth: 40 }}>
                  <span style={{ display: 'block', fontWeight: 800, fontSize: '1rem', color: 'var(--text-strong)' }}>{r.count}</span>
                  <span style={{ display: 'block', fontSize: '0.625rem', color: 'var(--text-muted)' }}>{r.countSource === 'open' ? 'open' : 'at last look'}</span>
                </span>
              )}
            </button>
          ))
        )}
        {strip && shown.length > 0 ? (
          <div style={{ padding: '0.3rem 0.75rem 0.45rem calc(0.75rem + 8px + 0.5rem)' }}>
            <QuickfillRhythmStripAxis axis={rhythmStripAxis(now)} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * The phone Quickfill (punch list #30, PR 3): the sections' marks as rows measured against
 * each section's own rhythm — due first, fresh last, the personal doors at the bottom. Since
 * punch list #217 (office-8) a per-person switch, **Show the strips**, draws each row's
 * two-week rhythm strip and the head's counts as chips that filter the list; with `?sbs=1` on
 * the page a dev sees both shapes, one above the other.
 */
export function QuickfillRoundList(props: ListProps) {
  const view = useShapeView(QUICKFILL_RHYTHM_STRIP_KEY)
  if (view.sideBySide) {
    return <SideBySide testId="quickfill-round-list-sbs" label="With the strip" today={<RoundListBody {...props} strip={false} />} shape={<RoundListBody {...props} strip />} />
  }
  return <RoundListBody {...props} strip={view.on} switchEl={<ShapeSwitch view={view} words={{ on: "Show today's look", off: 'Show the strips' }} />} />
}
