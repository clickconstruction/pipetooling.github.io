import { useEffect, useState, type ReactNode } from 'react'
import type { CardPress, PressId, StepCard, Words } from '../../lib/flows/card'
import { Btn, input } from '../gc/gcUi'

/**
 * A step's card (`flows/card.ts`'s `StepCard`, the prototype v1.125's words): its title, one sentence that says where
 * it stands, then the sections that apply. At a desk it is a card beside the panel; on a phone, a sheet from the
 * bottom. A press the screen can do runs through `onPress`; one it cannot yet shows its name, greyed, with why.
 */

const MARK: Record<string, string> = { ok: '✓', no: '○', wait: '↗', bad: '!', off: '–', next: '→' }

/** A press that asks for words first: a note, the reason for a skip. */
export type AskFor = { press: CardPress; label: string; placeholder: string }

function Run({ words, onPress, can }: { words: Words; onPress: (p: CardPress) => void; can: (p: CardPress) => boolean }) {
  return (
    <>
      {words.map((w, i) =>
        w.press && can(w.press) ? (
          <button key={i} type="button" onClick={() => onPress(w.press!)} style={{ font: 'inherit', background: 'none', border: 0, padding: 0, color: 'var(--text-blue-500)', cursor: 'pointer', textDecoration: 'underline' }}>
            {w.text}
          </button>
        ) : (
          <span key={i} style={w.late ? { color: 'var(--text-orange-700)', fontWeight: 600 } : undefined}>
            {w.text}
          </span>
        ),
      )}
    </>
  )
}

function Presses({ presses, onPress, can }: { presses: readonly CardPress[]; onPress: (p: CardPress) => void; can: (p: CardPress) => boolean }) {
  if (!presses.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {presses.map((p, i) => (
        <Btn
          key={`${p.id}-${i}`}
          kind={p.primary ? 'primary' : 'plain'}
          onClick={() => onPress(p)}
          disabled={!can(p)}
          title={p.tip ? `${p.tip.name}: ${p.tip.does} ${p.tip.changes}` : can(p) ? undefined : 'Not on this screen yet.'}
        >
          {p.label}
        </Btn>
      ))}
    </div>
  )
}

export function FlowStepCard({
  card,
  onPress,
  handles,
  onClose,
  sheet,
  asking,
  onAnswer,
  onCancelAsk,
  busy,
  problem,
}: {
  card: StepCard
  onPress: (press: CardPress) => void
  /** The presses this screen can do. */
  handles: ReadonlySet<PressId>
  onClose: () => void
  /** On a phone: a sheet from the bottom. */
  sheet: boolean
  /** A press waiting for words. */
  asking: AskFor | null
  onAnswer: (words: string) => void
  onCancelAsk: () => void
  busy: boolean
  problem: string | null
}) {
  const [words, setWords] = useState('')
  useEffect(() => setWords(''), [asking])
  // Escape closes the card and not the window it is in: taken first, in the capture, and marked done.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      ;(asking ? onCancelAsk : onClose)()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [asking, onCancelAsk, onClose])
  const can = (p: CardPress) => handles.has(p.id)

  const frame = { display: 'grid', gap: '0.6rem', background: 'var(--surface)', color: 'inherit', border: '1px solid var(--border)', borderRadius: sheet ? '12px 12px 0 0' : 12, padding: '0.85rem', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', overflowY: 'auto' as const }
  const body: ReactNode = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <h4 style={{ margin: 0, fontSize: '1rem' }}>{card.title}</h4>
        <button type="button" onClick={onClose} aria-label="Close the card" style={{ font: 'inherit', background: 'none', border: 0, cursor: 'pointer', color: 'var(--text-muted)' }}>
          ×
        </button>
      </div>
      <p style={{ margin: 0 }}>
        <Run words={card.status} onPress={onPress} can={can} />
      </p>
      {card.sections.map((s) => (
        <section key={s.id} data-flow-card-section={s.id} style={{ display: 'grid', gap: 4 }}>
          <h5 style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{s.heading}</h5>
          {s.lines.map((l, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2em 1fr', gap: 6, alignItems: 'start' }}>
              <span aria-hidden="true">{MARK[l.mark] ?? ''}</span>
              <span style={{ display: 'grid', gap: 2 }}>
                <span>{l.text}</span>
                {l.small.length ? (
                  <small style={{ color: 'var(--text-muted)' }}>
                    <Run words={l.small} onPress={onPress} can={can} />
                  </small>
                ) : null}
                <Presses presses={l.presses} onPress={onPress} can={can} />
              </span>
            </div>
          ))}
          {s.says.map((w, i) => (
            <p key={i} style={{ margin: 0 }}>
              <Run words={w} onPress={onPress} can={can} />
            </p>
          ))}
          {s.history.map((h, i) => (
            <div key={i} style={{ fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{h.label}</span> {h.words}
            </div>
          ))}
          {s.teamNotes.map((n, i) => (
            <div key={i} style={{ fontSize: '0.85rem', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderRadius: 6, padding: '0.3rem 0.45rem' }}>
              <b>{n.by}</b> · {n.when}: {n.text}
            </div>
          ))}
          {s.empty ? <p style={{ margin: 0, color: 'var(--text-muted)' }}>{s.empty}</p> : null}
          <Presses presses={s.presses} onPress={onPress} can={can} />
        </section>
      ))}
      {asking ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (words.trim()) onAnswer(words.trim())
          }}
          style={{ display: 'grid', gap: 6 }}
        >
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: '0.85rem' }}>{asking.label}</span>
            <textarea value={words} onChange={(e) => setWords(e.target.value)} placeholder={asking.placeholder} rows={3} style={{ ...input, width: '100%' }} />
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn kind="primary" onClick={() => words.trim() && onAnswer(words.trim())} disabled={busy || !words.trim()}>
              {asking.press.label}
            </Btn>
            <Btn kind="plain" onClick={onCancelAsk}>
              Not now
            </Btn>
          </div>
        </form>
      ) : null}
      {problem ? (
        <p role="alert" style={{ margin: 0, color: 'var(--text-red-800)' }}>
          {problem}
        </p>
      ) : null}
    </>
  )

  if (!sheet)
    return (
      <div role="dialog" aria-label={card.title} data-flow-card="" style={frame}>
        {body}
      </div>
    )
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 760, display: 'flex', alignItems: 'flex-end', paddingTop: 'var(--app-top-chrome, 0px)' }}
    >
      <div role="dialog" aria-modal="true" aria-label={card.title} data-flow-card="" style={{ ...frame, width: '100%', maxHeight: 'min(80vh, 100%)' }}>
        {body}
      </div>
    </div>
  )
}
