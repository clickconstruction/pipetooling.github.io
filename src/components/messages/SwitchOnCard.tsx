/**
 * Punch list #140 PR 2: **Finish switching Messages on**, a line at the top of Messages for the owner and a dev that
 * opens a card of the eight switches the loop runs on (`switchCard.ts`), each with its state and a door to its setting.
 * It reads the eight `app_settings` rows once (`switchCardIo.ts`); the presses are the owner's, on Settings. **Later**
 * folds it for a week on this device; it is gone on its own once all eight are on. Nothing is drawn while the read is
 * out or when it fails: the card is a nudge, never a wall.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { allOn, cardLine, laterHolds, laterUntil, onCount, stateTone, SWITCH_LATER_STORAGE_KEY, SWITCH_ROWS, SWITCH_WORDS, switchStates, type SwitchKey, type SwitchState } from '../../lib/messages/switchCard'
import { supabaseSwitchCardIo, type SwitchCardIo } from '../../lib/messages/switchCardIo'
import { Chip } from '../gc/gcUi'

const DEFAULT_IO = supabaseSwitchCardIo()

const readLater = (): string | null => {
  try {
    return localStorage.getItem(SWITCH_LATER_STORAGE_KEY)
  } catch {
    return null
  }
}
const keepLater = (iso: string) => {
  try {
    localStorage.setItem(SWITCH_LATER_STORAGE_KEY, iso)
  } catch {
    // A browser that keeps nothing folds the card for this visit alone.
  }
}

const line: CSSProperties = { border: '1px solid var(--border-amber-soft)', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 999, padding: '0.25rem 0.8rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', font: 'inherit' }
const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.9rem', display: 'grid', gap: '0.5rem', background: 'var(--surface)', maxWidth: 720 }
const quiet: CSSProperties = { border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0.2rem 0.7rem', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', font: 'inherit', fontSize: '0.85rem' }

export function SwitchOnCard({ io = DEFAULT_IO, now = () => new Date().toISOString() }: { io?: SwitchCardIo; now?: () => string }) {
  const [states, setStates] = useState<Record<SwitchKey, SwitchState> | null>(null)
  const [open, setOpen] = useState(false)
  const [later, setLater] = useState<string | null>(readLater)

  useEffect(() => {
    let live = true
    io.load().then(
      (raw) => live && setStates(switchStates(raw)),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [io])

  if (!states || allOn(states) || laterHolds(later, now())) return null
  const count = onCount(states)
  return (
    <div data-switch-card style={{ display: 'grid', gap: '0.45rem', justifyItems: 'start' }}>
      <button type="button" data-switch-card-line aria-expanded={open} onClick={() => setOpen((v) => !v)} style={line}>
        {cardLine(count)} {open ? '▾' : '›'}
      </button>
      {open && (
        <section aria-label={SWITCH_WORDS.title} data-switch-card-open style={card}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {SWITCH_WORDS.count(count)}. {SWITCH_WORDS.note}
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.4rem' }}>
            {SWITCH_ROWS.map((r) => {
              const state = states[r.key]
              return (
                <li key={r.key} data-switch-row={r.key} data-switch-state={state} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                  <Chip tone={stateTone(state)} small>
                    {SWITCH_WORDS.state[state]}
                  </Chip>
                  <strong>{r.title}</strong>
                  <span style={{ color: 'var(--text-muted)' }}>{r.why}</span>
                  {state !== 'on' && (
                    <Link to={r.href} style={{ marginLeft: 'auto', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {r.door} ›
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              title={SWITCH_WORDS.laterTip}
              onClick={() => {
                const until = laterUntil(now())
                keepLater(until)
                setLater(until)
              }}
              style={quiet}
            >
              {SWITCH_WORDS.later}
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{SWITCH_WORDS.footer}</span>
          </div>
        </section>
      )}
    </div>
  )
}
