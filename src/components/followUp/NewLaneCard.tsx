/**
 * Messages, residential R7 (PR 3): the sort card above a thread, for a person waiting in Follow up's New lane (the
 * customer Messages prototype v0.8, screen 7, mockup A's `sortCardHtml`). Its head says which sort, its first line why,
 * then its presses: *Who is this?*'s guesses in the box's order, *Which job?*'s jobs with the default picked, or *Who
 * has it?*'s people with the rule's pick first. A guess that needs a record made first waits, and says where to make it.
 * This draws; `useNewLaneThreadSlots.tsx` reads and writes.
 */
import { useState, type ReactNode } from 'react'
import type { HasChoice, JobChoice, NewLaneRow, WhoGuess } from '../../lib/followUp/newLane'
import { guessWait } from '../../lib/followUp/newLaneRows'
import { Btn } from '../gc/gcUi'

export interface NewLaneCardProps {
  row: NewLaneRow
  /** *Who is this?*'s guesses; null while the records they may be are read. */
  guesses?: readonly WhoGuess[] | null
  /** *Which job?*'s jobs, the default first picked. */
  jobs?: readonly JobChoice[]
  /** *Who has it?*'s people, the rule's pick first. */
  people?: ReadonlyArray<HasChoice & { userId: string }>
  /** A press is running: every press waits. */
  busy?: boolean
  onName: (guess: WhoGuess) => void
  onSomeoneElse: () => void
  onTie: (jobKey: string) => void
  onHand: (userId: string) => void
}

const OPTION = {
  display: 'grid',
  gap: '0.1rem',
  textAlign: 'left',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--surface)',
  color: 'var(--text-base)',
  font: 'inherit',
  fontSize: '0.875rem',
  padding: '0.4rem 0.65rem',
} as const

function Option({ label, words, onPress, disabled }: { label: string; words: string; onPress: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onPress} disabled={disabled} style={{ ...OPTION, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
      <strong style={{ fontWeight: 600 }}>{label}</strong>
      <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{words}</small>
    </button>
  )
}

export function NewLaneCard({ row, guesses, jobs = [], people = [], busy = false, onName, onSomeoneElse, onTie, onHand }: NewLaneCardProps) {
  // The default starts picked. The caller keys the card by its line, so a new line starts from its own default.
  const [picked, setPicked] = useState<string | null>(() => jobs.find((j) => j.isDefault)?.id ?? jobs[0]?.id ?? null)
  const pickedJob = jobs.find((j) => j.id === picked) ?? null

  let body: ReactNode = null
  if (row.sort === 'who') {
    body = !guesses ? (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Reading who it may be…</div>
    ) : (
      <div style={{ display: 'grid', gap: '0.35rem' }}>
        {guesses.map((g, i) => {
          if (g.kind === 'someone_else') return <Option key={i} label={g.label} words={g.words} onPress={onSomeoneElse} disabled={busy} />
          const wait = guessWait(g)
          return <Option key={i} label={g.label} words={wait ?? g.words} onPress={() => onName(g)} disabled={busy || wait !== null} />
        })}
      </div>
    )
  } else if (row.sort === 'job') {
    body = (
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.25rem' }}>
          <legend style={{ fontSize: '0.85rem', marginBottom: '0.2rem' }}>Which job is this line about?</legend>
          {jobs.map((j) => (
            <label key={j.id} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.875rem' }}>
              <input type="radio" name={`lane-job-${row.messageId}`} checked={picked === j.id} onChange={() => setPicked(j.id)} disabled={busy} />
              <span>
                <strong>{j.number}</strong> {j.name}
                {j.isDefault && <span style={{ color: 'var(--text-muted)' }}> · the default</span>}
              </span>
            </label>
          ))}
        </fieldset>
        {pickedJob && (
          <div>
            <Btn kind="primary" onClick={() => onTie(pickedJob.id)} disabled={busy}>
              {pickedJob.isDefault ? `Keep it on ${pickedJob.number}` : `Move it to ${pickedJob.number}`}
            </Btn>
          </div>
        )}
      </div>
    )
  } else {
    body =
      people.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nobody on the office team to give it to.</div>
      ) : (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          {people.map((p) => (
            <Option key={p.userId} label={p.name} words={p.words} onPress={() => onHand(p.userId)} disabled={busy} />
          ))}
        </div>
      )
  }

  return (
    <section
      aria-label={`Sort: ${row.head}`}
      data-new-lane-card={row.sort}
      style={{ margin: '0.5rem 0.9rem 0', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-blue-tint)', padding: '0.6rem 0.75rem', display: 'grid', gap: '0.45rem' }}
    >
      <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{row.head}</h3>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-600)' }}>{row.why}</div>
      {body}
    </section>
  )
}
