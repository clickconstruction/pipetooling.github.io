/**
 * Waiting on them (v2.5704, punch list #139 PR 12): the section on `/messages` between the queues and Went out —
 * the people who went quiet after our send, longest quiet first, each row with the nudge and the call. Since punch
 * list #140 PR 4 Nudge opens the thread with the reminder written and the send window open (`?nudge=text`), and a last
 * text Quo could not deliver draws the row red with **☎ Call them** and **Send it as an email** (`?nudge=email`) in its
 * place. Since v2.5790 the *Their move · N d* chip sits at the right over Nudge and Call, so the name and our last words
 * read on their own. Since v2.6500 **Heard back ▾** on every row: By phone, By text from my phone, In person, No answer
 * needed — the row clears at once with Undo on the toast for ten seconds, and when the ten seconds pass the gray line
 * lands on the thread (`heardBack`); Undo writes nothing. Leaving the page writes a pending one at once. A refused
 * write puts the row back and says why. Rows and words in `lib/messages/waitingOnThem.ts`; the read and the write in
 * `waitingOnThemIo.ts`; drawn like the sections around it.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useCloseOnOutsideClick } from '../../hooks/useCloseOnOutsideClick'
import { useToastContext } from '../../contexts/ToastContext'
import { pressProblem } from '../../lib/followUp/followUpIo'
import { boxForNew } from '../../lib/messages/boxes'
import { HEARD_ROWS, HEARD_UNDO_MS, HEARD_WORDS, waitingOnThem, WAITING_WORDS, type HeardHow, type WaitLine, type WaitingRow } from '../../lib/messages/waitingOnThem'
import { CallButton } from './CallButton'
import { heardBack, loadWaitingOnThem } from '../../lib/messages/waitingOnThemIo'
import type { KindPill } from '../../lib/messages/kindPills'
import { JUMP_LANE_COLOR, JUMP_LANE_LABEL } from '../../lib/messages/jumpStrip'
import type { OpenThreadMore } from '../gc/messages/useThreadWindow'

export interface WaitingOnThemProps {
  pill: KindPill
  /** The name opens the thread; Nudge and Send it as an email open it with the nudge written (`more.nudge`). */
  onOpenThread: (contactId: string, more?: OpenThreadMore) => void
  io?: (now?: Date) => Promise<WaitLine[]>
  /** Heard back's write (v2.6500): the gray line on the thread, once Undo's time has passed. */
  write?: (contactId: string, how: HeardHow) => Promise<void>
  /** How long Undo stands before the line is written. */
  undoMs?: number
  now?: () => number
  /** Hears the heading's count once the lines are read (and 0 on a failed read), for the page's jump strip. */
  onCount?: (count: number) => void
}

const answer: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.9rem' }
const row: CSSProperties = { display: 'flex', gap: '0.6rem', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 10, padding: '0.55rem 0.85rem', background: 'var(--surface)' }
const chip: CSSProperties = { fontSize: '0.72rem', fontWeight: 700, padding: '0.05rem 0.5rem', borderRadius: 999, border: '1px solid var(--border-amber)', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', whiteSpace: 'nowrap' }
const rowBad: CSSProperties = { ...row, borderColor: 'var(--border-red)', background: 'var(--bg-red-tint)' }
const chipBad: CSSProperties = { ...chip, border: '1px solid var(--border-red)', color: 'var(--text-red-700)', background: 'var(--surface)' }
const nudge: CSSProperties = { border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0.3rem 0.8rem', background: 'var(--surface)', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }
const call: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.8rem', borderRadius: 999, background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }
const menuPanel: CSSProperties = { position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 20, minWidth: 210, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 10px 30px rgba(17, 24, 39, 0.16)', padding: 4, display: 'grid' }
const menuItem: CSSProperties = { width: '100%', textAlign: 'left', padding: '0.5rem 0.65rem', border: 'none', background: 'transparent', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.88rem', color: 'inherit', minHeight: 40 }

const without = (h: Record<string, HeardHow>, contactId: string): Record<string, HeardHow> => Object.fromEntries(Object.entries(h).filter(([id]) => id !== contactId))

/** A Heard back pressed and not undone: the row stays away while the line is pending, written or being written. */
interface Pending {
  how: HeardHow
  name: string
  timer: ReturnType<typeof setTimeout>
}

export function WaitingOnThem({ pill, onOpenThread, io = loadWaitingOnThem, write = heardBack, undoMs = HEARD_UNDO_MS, now = Date.now, onCount }: WaitingOnThemProps) {
  const { showToast, showActionToast } = useToastContext()
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

  // Heard back (v2.6500): the rows cleared on this page, each until its line is written or Undo brings it back.
  const [heard, setHeard] = useState<Record<string, HeardHow>>({})
  const pending = useRef(new Map<string, Pending>())
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const land = useCallback(
    async (contactId: string, how: HeardHow) => {
      pending.current.delete(contactId)
      try {
        await write(contactId, how)
      } catch (e) {
        if (!live.current) return
        setHeard((h) => without(h, contactId))
        showToast(pressProblem(e), 'error')
      }
    },
    [write, showToast],
  )
  // Leaving the page, or closing it, writes what Undo still held: a pressed Heard back is never lost.
  useEffect(() => {
    const flush = () => {
      for (const [contactId, p] of pending.current) {
        clearTimeout(p.timer)
        void land(contactId, p.how)
      }
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [land])
  const undo = (contactId: string) => {
    const p = pending.current.get(contactId)
    if (!p) return
    clearTimeout(p.timer)
    pending.current.delete(contactId)
    setHeard((h) => without(h, contactId))
    showToast(HEARD_WORDS.undone(p.name), 'info')
  }
  const pick = (r: WaitingRow, how: HeardHow) => {
    const timer = setTimeout(() => void land(r.contactId, how), undoMs)
    pending.current.set(r.contactId, { how, name: r.name, timer })
    setHeard((h) => ({ ...h, [r.contactId]: how }))
    showActionToast(HEARD_WORDS.toast(how, r.name), { label: HEARD_WORDS.undo, onClick: () => undo(r.contactId) }, { durationMs: undoMs })
  }

  const rows = waitingOnThem(lines ?? [], pill, new Date(now())).filter((r) => !(r.contactId in heard))
  // Unread or failed is no count at all: the bar and the band say … until a read lands, never a false 0 (#183 PR 5).
  const count = lines == null ? null : rows.length
  useEffect(() => {
    if (count !== null) onCount?.(count)
  }, [count, onCount])
  return (
    <section id="waiting-on-them" className="messagesLane" aria-label="Waiting on them" data-testid="waiting-on-them">
      {/* The band (v2.5802, punch list #151 PR 3): the lane's color, the count in a pill; the sentence sits behind the bar's ?. */}
      <div className="stagesSectionBand messagesLaneBand" style={{ '--stage-color': JUMP_LANE_COLOR.waiting } as CSSProperties} data-testid="lane-band">
        <h3 className="stagesBandTitle" aria-label={count === null ? JUMP_LANE_LABEL.waiting : WAITING_WORDS.title(count)}>
          {JUMP_LANE_LABEL.waiting}{' '}
          <span className="stagesBandCount" aria-hidden>
            {count ?? '…'}
          </span>
        </h3>
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
            <div key={r.contactId} style={r.mark?.bad ? rowBad : row} data-testid="waiting-row" data-delivery={r.mark ? (r.mark.bad ? 'bad' : 'ok') : undefined}>
              <span style={{ display: 'grid', gap: '0.1rem', minWidth: 0, flex: 1 }}>
                <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => onOpenThread(r.contactId)} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: 'inherit', cursor: 'pointer' }} data-testid="waiting-name">
                    {r.name}
                  </button>
                  {r.mark?.bad ? (
                    <span style={chipBad} title={r.mark.title} data-testid="waiting-mark">
                      {r.mark.words}
                    </span>
                  ) : null}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Us · {r.words} · {r.when}
                </span>
              </span>
              <span style={{ display: 'grid', gap: '0.3rem', justifyItems: 'end' }}>
                <span style={chip} data-testid="waiting-chip">
                  {r.chip}
                </span>
                <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', whiteSpace: 'nowrap', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {r.mark?.bad ? (
                    <>
                      {r.number ? (
                        <CallButton site="waiting-on-them" number={r.number} name={r.name} verb={WAITING_WORDS.callThem} box={r.kind ? boxForNew({ kind: r.kind }) : 'team'} glyph="☎ " style={call} testId="waiting-call" />
                      ) : null}
                      <button type="button" onClick={() => onOpenThread(r.contactId, { nudge: 'email' })} title={WAITING_WORDS.asEmailTip} style={nudge} data-testid="waiting-email">
                        {WAITING_WORDS.asEmail}
                      </button>
                      <HeardBackMenu name={r.name} onPick={(how) => pick(r, how)} />
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => onOpenThread(r.contactId, { nudge: 'text' })} title={WAITING_WORDS.nudgeTip} style={nudge} data-testid="waiting-nudge">
                        {WAITING_WORDS.nudge}
                      </button>
                      <HeardBackMenu name={r.name} onPick={(how) => pick(r, how)} />
                      {r.number ? (
                        <CallButton site="waiting-on-them" number={r.number} name={r.name} verb={WAITING_WORDS.call} box={r.kind ? boxForNew({ kind: r.kind }) : 'team'} glyph="☎ " style={call} testId="waiting-call" />
                      ) : null}
                    </>
                  )}
                </span>
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

/** Heard back ▾ (v2.6500): the four ways, a small menu under the press, closed by a tap outside or Escape. */
function HeardBackMenu({ name, onPick }: { name: string; onPick: (how: HeardHow) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useCloseOnOutsideClick(ref, open, close)
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} title={HEARD_WORDS.tip} aria-haspopup="menu" aria-expanded={open} style={nudge} data-testid="waiting-heard">
        {HEARD_WORDS.press} ▾
      </button>
      {open ? (
        <div role="menu" aria-label={`How you heard back from ${name}`} style={menuPanel} data-testid="waiting-heard-menu">
          {HEARD_ROWS.map((r) => (
            <button
              key={r.how}
              type="button"
              role="menuitem"
              style={menuItem}
              onClick={() => {
                setOpen(false)
                onPick(r.how)
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  )
}
