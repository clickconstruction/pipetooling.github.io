/**
 * Before we start (punch list #382, PR 7): Go or hold. The decision to send the crew is a press with a name on it.
 * Go sends the crew for our first day. With something open it is a go on their promise, and it comes back to the
 * office the day before the crew leaves. Hold keeps the crew home and moves our start to a day the office picks. A
 * hold tells nobody by itself: it writes the note for the contact, and the office sends it. Both go through one door
 * in the database, which keeps who pressed it. Nothing is blocked: a crew can be scheduled with no Go.
 */
import { useState, type CSSProperties } from 'react'
import { DECIDE_WORDS, addDays, goWords, holdText, monthDay, openBullets, openWords, weekDay, type Site, type Stage } from '../../lib/startChecks/startChecks'
import type { StartChecksIo } from '../../lib/startChecks/startChecksIo'
import { formatErrorMessage } from '../../utils/errorHandling'

const muted: CSSProperties = { color: 'var(--text-muted)' }
const box: CSSProperties = { border: '2px solid var(--border-strong)', borderRadius: 12, padding: '10px 12px', background: 'var(--surface)' }
const plainPress: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 8, padding: '7px 12px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }
const greenPress: CSSProperties = { ...plainPress, border: '1px solid #15803d', background: '#15803d', color: '#fff' }

export function StartCheckDecidePanel({
  stage,
  site,
  today,
  press,
  onClose,
  onHeld,
}: {
  stage: Stage
  site: Site
  today: string
  press: (write: (io: StartChecksIo) => Promise<void>) => Promise<void>
  onClose: () => void
  /** After a hold lands: the note for the contact, written for the day our start moved to. */
  onHeld: (note: string) => void
}) {
  const open = openBullets(stage)
  const [newStart, setNewStart] = useState(() => (stage.window ? addDays(stage.window[0], 7) : ''))
  const [busy, setBusy] = useState<'go' | 'hold' | null>(null)
  const [why, setWhy] = useState<string | null>(null)

  const decide = async (kind: 'go' | 'hold') => {
    if (busy) return
    setBusy(kind)
    setWhy(null)
    // The note is written from the stage as it stands before the hold moves its days.
    const note = kind === 'hold' ? holdText(site, stage, newStart) : ''
    try {
      await press((io) => io.decide(stage.id, kind, open.map((b) => b.words), kind === 'hold' ? newStart : null))
      if (kind === 'hold') onHeld(note)
      else onClose()
    } catch (e) {
      setWhy(formatErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const holdReady = !!stage.window && !!newStart && newStart >= today
  return (
    <div style={{ marginTop: 10, padding: '12px 14px', border: '1px solid var(--text-strong)', borderRadius: 12, background: 'var(--surface)' }} data-start-check-decide>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <b style={{ color: 'var(--text-strong)', fontSize: '1rem' }}>{DECIDE_WORDS.title}</b>
        <button type="button" className="scWord" onClick={onClose}>
          Close
        </button>
      </div>
      <p style={{ margin: '4px 0 0' }}>{openWords(stage)}</p>
      {open.length ? (
        <ul style={{ margin: '4px 0 0', paddingLeft: '1.2rem', fontSize: '0.875rem', color: 'var(--text-strong)' }}>
          {open.map((b) => (
            <li key={b.id}>{b.words}</li>
          ))}
        </ul>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 10 }}>
        <div style={{ ...box, borderColor: '#15803d' }} data-decide="go">
          <b style={{ color: 'var(--text-strong)' }}>{DECIDE_WORDS.go}</b>
          <p style={{ margin: '4px 0 8px' }}>{goWords(stage)}</p>
          <button type="button" className="scPress" style={greenPress} disabled={!!busy} aria-busy={busy === 'go' || undefined} onClick={() => void decide('go')}>
            {open.length ? DECIDE_WORDS.goOnPromise : DECIDE_WORDS.go}
          </button>
        </div>
        <div style={{ ...box, borderColor: '#b45309' }} data-decide="hold">
          <b style={{ color: 'var(--text-strong)' }}>{DECIDE_WORDS.hold}</b>
          {stage.window ? (
            <>
              <p style={{ margin: '4px 0 6px' }}>{DECIDE_WORDS.holdLead}</p>
              <input className="scAdd" type="date" aria-label="The day our start moves to" value={newStart} min={today} onChange={(e) => setNewStart(e.target.value)} style={{ flex: 'none' }} />
              <p style={{ margin: '8px 0 4px', fontSize: '0.8125rem', ...muted }}>The note for {site.contact}. A hold tells nobody by itself.</p>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', fontSize: '0.84375rem', lineHeight: 1.45, whiteSpace: 'pre-wrap', color: 'var(--text-base)' }} data-hold-note>
                {newStart ? holdText(site, stage, newStart) : ''}
              </div>
              <div style={{ marginTop: 8 }}>
                <button type="button" className="scPress" style={{ ...plainPress, opacity: holdReady && !busy ? 1 : 0.55, cursor: holdReady && !busy ? 'pointer' : 'default' }} disabled={!holdReady || !!busy} aria-busy={busy === 'hold' || undefined} onClick={() => void decide('hold')}>
                  {newStart ? `Hold until ${monthDay(newStart)}` : DECIDE_WORDS.hold}
                </button>
              </div>
            </>
          ) : (
            <p style={{ margin: '4px 0 0', ...muted }}>{DECIDE_WORDS.noDays}</p>
          )}
        </div>
      </div>
      {why ? (
        <p role="alert" style={{ margin: '8px 0 0', color: 'var(--text-red-700)', fontWeight: 600 }}>
          {why}
        </p>
      ) : null}
      <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', ...muted }}>
        {DECIDE_WORDS.notBlocked}
        {stage.window ? ` Our first day is ${weekDay(stage.window[0])}.` : ''}
      </p>
    </div>
  )
}
