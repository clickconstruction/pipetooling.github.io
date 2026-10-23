/**
 * Went out (v2.5686, punch list #133 PR 3): the section on `/messages` under the queues — every text and email we
 * sent in the last `WENT_OUT_DAYS` days (the emails since v2.5707), newest first under day headers (v2.5699), each
 * row opening the thread. A text's row carries Quo's answer beside its time (v2.5703) and, when the text did not reach
 * them, reads red with the call to make; an estimate email's row carries what the customer did with it. The lane's
 * own Both · Texts · Emails row narrows it. Words, rows and days in `lib/messages/wentOut.ts`; the read in
 * `wentOutIo.ts`; drawn like the Follow up sections above it.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { wentOutDays, WENT_OUT_FILTERS, WENT_OUT_WORDS, type WentOutFilter, type WentOutLine, type WentOutRow } from '../../lib/messages/wentOut'
import { loadWentOut } from '../../lib/messages/wentOutIo'
import type { KindPill } from '../../lib/messages/kindPills'

export interface WentOutTodayProps {
  pill: KindPill
  onOpenThread: (contactId: string) => void
  /** The lane's filter as the page holds it (punch list #140 PR 5: the strip's Texts not delivered opens the texts); its own when left out. */
  filter?: WentOutFilter
  onFilter?: (filter: WentOutFilter) => void
  io?: (now?: Date) => Promise<WentOutLine[]>
  now?: () => number
  /** Hears the heading's count once the lines are read (and 0 on a failed read), for the page's jump strip. */
  onCount?: (count: number) => void
}

const answer: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.9rem' }
const rowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.6rem',
  alignItems: 'baseline',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '0.55rem 0.85rem',
  background: 'var(--surface)',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  boxSizing: 'border-box',
  font: 'inherit',
}
const rowBad: CSSProperties = { ...rowStyle, borderColor: 'var(--border-red)', background: 'var(--bg-red-tint)' }
const callLink: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem', padding: '0.2rem 0.65rem', borderRadius: 999, background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none', width: 'fit-content' }
const didChip: CSSProperties = { fontSize: '0.7rem', fontWeight: 700, padding: '0.05rem 0.5rem', borderRadius: 999, border: '1px solid #16a34a', color: '#16a34a', marginLeft: '0.4rem', verticalAlign: 'middle' }
const filterBtn = (on: boolean): CSSProperties => ({
  padding: '0.15rem 0.6rem',
  borderRadius: 999,
  border: `1px solid ${on ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: on ? 'var(--text-blue-500)' : 'var(--text-600)',
  fontWeight: on ? 600 : 400,
  cursor: 'pointer',
  fontSize: '0.75rem',
})

function Row({ r, onOpenThread }: { r: WentOutRow; onOpenThread: (contactId: string) => void }) {
  return (
    <button type="button" onClick={() => onOpenThread(r.contactId)} data-testid="went-out-row" data-channel={r.channel} data-delivery={r.mark ? (r.mark.bad ? 'bad' : 'ok') : undefined} style={r.mark?.bad ? rowBad : rowStyle}>
      <span aria-hidden style={{ fontSize: '0.9rem' }}>
        {r.channel === 'email' ? '📧' : '💬'}
      </span>
      <span style={{ display: 'grid', gap: '0.05rem', minWidth: 0 }}>
        <span style={{ fontWeight: 600 }}>
          {r.name}
          {r.chip ? (
            <span style={didChip} data-testid="went-out-did">
              {r.chip}
            </span>
          ) : null}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.words}</span>
        {r.tel ? (
          // A link inside the row's button: the dial is its own press, the row's press stays the thread.
          <a href={r.tel} onClick={(e) => e.stopPropagation()} style={callLink} data-testid="went-out-call">
            ☎ {WENT_OUT_WORDS.call}
          </a>
        ) : null}
      </span>
      <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap', display: 'grid', justifyItems: 'end', gap: '0.1rem' }}>
        <span>{r.when}</span>
        {r.mark ? (
          <span title={r.mark.title} style={{ fontWeight: 700, color: r.mark.bad ? 'var(--text-red-700)' : '#16a34a' }} data-testid="went-out-mark">
            {r.mark.words}
          </span>
        ) : null}
      </span>
    </button>
  )
}

export function WentOutToday({ pill, onOpenThread, filter: filterGiven, onFilter, io = loadWentOut, now = Date.now, onCount }: WentOutTodayProps) {
  const [lines, setLines] = useState<WentOutLine[] | null | undefined>(undefined)
  const [own, setOwn] = useState<WentOutFilter>('both')
  const filter = filterGiven ?? own
  const setFilter = (f: WentOutFilter) => {
    setOwn(f)
    onFilter?.(f)
  }
  useEffect(() => {
    let live = true
    io(new Date(now()))
      .then((l) => live && setLines(l))
      .catch(() => live && setLines(null))
    return () => {
      live = false
    }
  }, [io, now])

  const days = wentOutDays(lines ?? [], pill, new Date(now()), filter)
  const total = days.reduce((n, d) => n + d.rows.length, 0)
  const count = lines === undefined ? null : total
  useEffect(() => {
    if (count !== null) onCount?.(count)
  }, [count, onCount])
  return (
    <section id="went-out" className="messagesLane" aria-label="Went out" data-testid="went-out-today">
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{WENT_OUT_WORDS.title(total)}</h3>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{WENT_OUT_WORDS.note}</span>
        <span role="group" aria-label={WENT_OUT_WORDS.filters} style={{ marginLeft: 'auto', display: 'flex', gap: '0.3rem' }}>
          {WENT_OUT_FILTERS.map((f) => (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)} style={filterBtn(filter === f.key)}>
              {f.label}
            </button>
          ))}
        </span>
      </div>
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {lines === undefined ? null : lines === null ? (
          <div style={answer}>{WENT_OUT_WORDS.problem}</div>
        ) : total === 0 ? (
          <div style={answer} data-testid="went-out-empty">
            {WENT_OUT_WORDS.empty}
          </div>
        ) : (
          days.map((day) => (
            <div key={day.ymd} style={{ display: 'grid', gap: '0.5rem' }} data-testid="went-out-day">
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: '0.2rem' }} data-testid="went-out-day-label">
                {day.label}
              </div>
              {day.rows.map((r) => (
                <Row key={r.id} r={r} onOpenThread={onOpenThread} />
              ))}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
