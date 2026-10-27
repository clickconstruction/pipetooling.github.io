/**
 * The last 7 days (punch list #140 PR 5): the strip under the pills on `/messages`, five tiles over the week, each a
 * door to its rows — Needs a reply, the longest wait's thread, Went out on its texts, Waiting on them, and since
 * v2.5878 the Ratings tile's newest answer. A tile with nothing behind it reads *none* and is no press. Tiles and
 * words in `lib/messages/weekStrip.ts`; the read in `weekStripIo.ts`; the longest wait from the queue the panel
 * already reads (the page's `waits`). Two by two on a phone.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import type { KindPill } from '../../lib/messages/kindPills'
import { stripTiles, STRIP_WORDS, type StripWait, type TileDoor } from '../../lib/messages/weekStrip'
import { loadWeekStrip, type WeekStripRead } from '../../lib/messages/weekStripIo'

export interface WeekStripProps {
  pill: KindPill
  /** Needs a reply as the queue has it, the office's whole lane under the pill: the longest wait is its first row. */
  waits: readonly StripWait[]
  /** The Show lens is on Mine: the strip says it is the office's read. */
  mine?: boolean
  onOpenThread: (contactId: string, at?: string | null) => void
  onNeedsReply: () => void
  onWentOut: () => void
  onWaiting: () => void
  io?: (now?: Date) => Promise<WeekStripRead>
  now?: () => number
}

const answer: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.9rem' }
const tileStyle = (door: boolean): CSSProperties => ({
  display: 'grid',
  gap: '0.15rem',
  alignContent: 'start',
  textAlign: 'left',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '0.6rem 0.75rem',
  background: 'var(--surface)',
  color: 'inherit',
  font: 'inherit',
  cursor: door ? 'pointer' : 'default',
  minWidth: 0,
})

export function WeekStrip({ pill, waits, mine = false, onOpenThread, onNeedsReply, onWentOut, onWaiting, io = loadWeekStrip, now = Date.now }: WeekStripProps) {
  const [read, setRead] = useState<WeekStripRead | null | undefined>(undefined)
  const phone = useMatchMedia('(max-width: 760px)')
  useEffect(() => {
    let live = true
    io(new Date(now()))
      .then((r) => live && setRead(r))
      .catch(() => live && setRead(null))
    return () => {
      live = false
    }
  }, [io, now])

  const tiles = stripTiles({ lines: read?.lines ?? [], estimates: read?.estimates ?? [], ratings: read?.ratings ?? [], waits, now: new Date(now()), pill })
  const open = (door: TileDoor) => {
    if (door.kind === 'needs-reply') onNeedsReply()
    else if (door.kind === 'thread') onOpenThread(door.contactId, door.at)
    else if (door.kind === 'went-out') onWentOut()
    else onWaiting()
  }
  return (
    <section aria-label={STRIP_WORDS.title} data-testid="week-strip">
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{STRIP_WORDS.title}</h3>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{STRIP_WORDS.note}</span>
        {mine && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }} data-testid="strip-office">
            {STRIP_WORDS.officeWait}
          </span>
        )}
      </div>
      {read === undefined ? null : read === null ? (
        <div style={answer}>{STRIP_WORDS.problem}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr 1fr' : 'repeat(5, minmax(0, 1fr))', gap: '0.5rem' }}>
          {tiles.map((t) => (
            <button key={t.key} type="button" disabled={!t.door} title={t.door ? t.tip : undefined} onClick={() => t.door && open(t.door)} style={tileStyle(Boolean(t.door))} data-testid="strip-tile" data-key={t.key}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t.label}</span>
              <span style={{ fontSize: t.key === 'estimates' || t.key === 'ratings' ? '0.95rem' : '1.3rem', fontWeight: 700, color: t.door ? 'var(--text-strong)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} data-testid="strip-value">
                {t.value}
              </span>
              {t.sub && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} data-testid="strip-sub">
                  {t.sub}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
