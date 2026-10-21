/**
 * Went out (v2.5686, punch list #133 PR 3): the fourth section on `/messages`, under the queues — every text we sent in
 * the last `WENT_OUT_DAYS` days, newest first under day headers (v2.5699; today alone before, which emptied at
 * midnight), each row opening the thread. The queues are inbound, so this is where a send the office pressed shows
 * once the sheet's receipt closes. Words, rows and days in `lib/messages/wentOut.ts`; the read in `wentOutIo.ts`;
 * drawn like the Follow up sections above it.
 */
import { useEffect, useState } from 'react'
import { wentOutDays, WENT_OUT_WORDS, type WentOutLine } from '../../lib/messages/wentOut'
import { loadWentOut } from '../../lib/messages/wentOutIo'
import type { KindPill } from '../../lib/messages/kindPills'

export interface WentOutTodayProps {
  pill: KindPill
  onOpenThread: (contactId: string) => void
  io?: (now?: Date) => Promise<WentOutLine[]>
  now?: () => number
}

export function WentOutToday({ pill, onOpenThread, io = loadWentOut, now = Date.now }: WentOutTodayProps) {
  const [lines, setLines] = useState<WentOutLine[] | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    io(new Date(now()))
      .then((l) => live && setLines(l))
      .catch(() => live && setLines(null))
    return () => {
      live = false
    }
  }, [io, now])

  const days = wentOutDays(lines ?? [], pill, new Date(now()))
  const total = days.reduce((n, d) => n + d.rows.length, 0)
  return (
    <section aria-label="Went out" data-testid="went-out-today">
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{WENT_OUT_WORDS.title(total)}</h3>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{WENT_OUT_WORDS.note}</span>
      </div>
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {lines === undefined ? null : lines === null ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{WENT_OUT_WORDS.problem}</div>
        ) : total === 0 ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.9rem' }} data-testid="went-out-empty">
            {WENT_OUT_WORDS.empty}
          </div>
        ) : (
          days.map((day) => (
            <div key={day.ymd} style={{ display: 'grid', gap: '0.5rem' }} data-testid="went-out-day">
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: '0.2rem' }} data-testid="went-out-day-label">
                {day.label}
              </div>
              {day.rows.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onOpenThread(r.contactId)}
                  data-testid="went-out-row"
                  style={{
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
                  }}
                >
                  <span style={{ display: 'grid', gap: '0.05rem', minWidth: 0 }}>
                    <span style={{ fontWeight: 600 }}>{r.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.words}</span>
                  </span>
                  <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{r.when}</span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
