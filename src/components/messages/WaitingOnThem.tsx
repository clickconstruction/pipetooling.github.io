/**
 * Waiting on them (v2.5704, punch list #139 PR 12): the section on `/messages` between the queues and Went out —
 * the people who went quiet after our send, longest quiet first, each row with the nudge (the thread, where the
 * office writes it) and the call. Rows and words in `lib/messages/waitingOnThem.ts`; the read in `waitingOnThemIo.ts`;
 * drawn like the sections around it.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { waitingOnThem, WAITING_WORDS, type WaitLine } from '../../lib/messages/waitingOnThem'
import { loadWaitingOnThem } from '../../lib/messages/waitingOnThemIo'
import type { KindPill } from '../../lib/messages/kindPills'

export interface WaitingOnThemProps {
  pill: KindPill
  onOpenThread: (contactId: string) => void
  io?: (now?: Date) => Promise<WaitLine[]>
  now?: () => number
}

const answer: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.9rem' }
const row: CSSProperties = { display: 'flex', gap: '0.6rem', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 10, padding: '0.55rem 0.85rem', background: 'var(--surface)' }
const chip: CSSProperties = { fontSize: '0.72rem', fontWeight: 700, padding: '0.05rem 0.5rem', borderRadius: 999, border: '1px solid var(--border-amber)', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', whiteSpace: 'nowrap' }
const nudge: CSSProperties = { border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0.3rem 0.8rem', background: 'var(--surface)', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }
const call: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.8rem', borderRadius: 999, background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }

export function WaitingOnThem({ pill, onOpenThread, io = loadWaitingOnThem, now = Date.now }: WaitingOnThemProps) {
  const [lines, setLines] = useState<WaitLine[] | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    io(new Date(now()))
      .then((l) => live && setLines(l))
      .catch(() => live && setLines(null))
    return () => {
      live = false
    }
  }, [io, now])

  const rows = waitingOnThem(lines ?? [], pill, new Date(now()))
  return (
    <section aria-label="Waiting on them" data-testid="waiting-on-them">
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{WAITING_WORDS.title(rows.length)}</h3>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{WAITING_WORDS.note}</span>
      </div>
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {lines === undefined ? null : lines === null ? (
          <div style={answer}>{WAITING_WORDS.problem}</div>
        ) : rows.length === 0 ? (
          <div style={answer} data-testid="waiting-empty">
            {WAITING_WORDS.empty}
          </div>
        ) : (
          rows.map((r) => (
            <div key={r.contactId} style={row} data-testid="waiting-row">
              <span style={{ display: 'grid', gap: '0.1rem', minWidth: 0, flex: 1 }}>
                <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => onOpenThread(r.contactId)} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: 'inherit', cursor: 'pointer' }} data-testid="waiting-name">
                    {r.name}
                  </button>
                  <span style={chip} data-testid="waiting-chip">
                    {r.chip}
                  </span>
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Us · {r.words} · {r.when}
                </span>
              </span>
              <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', whiteSpace: 'nowrap' }}>
                <button type="button" onClick={() => onOpenThread(r.contactId)} title={WAITING_WORDS.nudgeTip} style={nudge} data-testid="waiting-nudge">
                  {WAITING_WORDS.nudge}
                </button>
                {r.tel ? (
                  <a href={r.tel} style={call} data-testid="waiting-call">
                    ☎ {WAITING_WORDS.call}
                  </a>
                ) : null}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
