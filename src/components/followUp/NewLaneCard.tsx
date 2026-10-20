/**
 * Messages, residential R7 (PR 3): the sort card above a thread, for a person waiting in Follow up's New lane (the
 * customer Messages prototype v0.8, screen 7, mockup A's `sortCardHtml`). Its head says which sort, its first line why,
 * then its presses: *Who is this?*'s guesses in the box's order, *Which job?*'s jobs with the default picked, or *Who
 * has it?*'s people with the rule's pick first. A guess that needs a record made first waits, and says where to make it.
 * *One of our own team* (v2.5546) turns the card into *Which of ours?*: the roster, subs left out, a name filter and a
 * press per person that names the number as them. This draws; `useNewLaneThreadSlots.tsx` reads and writes.
 */
import { useState, type ReactNode } from 'react'
import { teamGuess, type HasChoice, type JobChoice, type NewLaneRow, type RosterChoice, type WhoGuess } from '../../lib/followUp/newLane'
import { guessWait } from '../../lib/followUp/newLaneRows'
import { Btn, input } from '../gc/gcUi'

export interface NewLaneCardProps {
  row: NewLaneRow
  /** *Who is this?*'s guesses; null while the records they may be are read. */
  guesses?: readonly WhoGuess[] | null
  /** The roster for *One of our own team*, as `rosterChoices` lists it. */
  roster?: readonly RosterChoice[]
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

/** The roster whose names hold the words typed; everyone while nothing is typed. */
function rosterMatching(roster: readonly RosterChoice[], words: string): RosterChoice[] {
  const q = words.trim().toLowerCase()
  return q ? roster.filter((p) => p.name.toLowerCase().includes(q)) : [...roster]
}

export function NewLaneCard({ row, guesses, roster = [], jobs = [], people = [], busy = false, onName, onSomeoneElse, onTie, onHand }: NewLaneCardProps) {
  // The default starts picked. The caller keys the card by its line, so a new line starts from its own default.
  const [picked, setPicked] = useState<string | null>(() => jobs.find((j) => j.isDefault)?.id ?? jobs[0]?.id ?? null)
  const pickedJob = jobs.find((j) => j.id === picked) ?? null
  // *One of our own team* pressed: the card shows the roster until a pick or Back.
  const [teamOpen, setTeamOpen] = useState(false)
  const [teamWords, setTeamWords] = useState('')

  let head = row.head
  let why: ReactNode = row.why
  let body: ReactNode = null
  if (row.sort === 'who' && teamOpen) {
    head = 'Which of ours?'
    why = 'The number goes on their People record. Next time the app knows them without asking.'
    const shown = rosterMatching(roster, teamWords)
    body = (
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.85rem' }}>
          <span>Find a name</span>
          <input value={teamWords} onChange={(e) => setTeamWords(e.target.value)} placeholder="Type a name" style={input} disabled={busy} autoFocus />
        </label>
        {roster.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nobody on the roster yet. Add them on People first.</div>
        ) : shown.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nobody on the roster goes by that.</div>
        ) : (
          <div role="group" aria-label="Our team" style={{ display: 'grid', gap: '0.35rem' }}>
            {shown.map((p) => (
              <Option key={p.id} label={p.name} words={p.words} onPress={() => onName(teamGuess(p))} disabled={busy} />
            ))}
          </div>
        )}
        <div>
          <Btn kind="quiet" onClick={() => setTeamOpen(false)} disabled={busy}>
            Back
          </Btn>
        </div>
      </div>
    )
  } else if (row.sort === 'who') {
    body = !guesses ? (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Reading who it may be…</div>
    ) : (
      <div style={{ display: 'grid', gap: '0.35rem' }}>
        {guesses.map((g, i) => {
          if (g.kind === 'someone_else') return <Option key={i} label={g.label} words={g.words} onPress={onSomeoneElse} disabled={busy} />
          if (g.kind === 'team' && !g.record) return <Option key={i} label={g.label} words={g.words} onPress={() => setTeamOpen(true)} disabled={busy} />
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
      aria-label={`Sort: ${head}`}
      data-new-lane-card={row.sort}
      data-new-lane-team={row.sort === 'who' && teamOpen ? 'open' : undefined}
      style={{ margin: '0.5rem 0.9rem 0', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-blue-tint)', padding: '0.6rem 0.75rem', display: 'grid', gap: '0.45rem' }}
    >
      <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{head}</h3>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-600)' }}>{why}</div>
      {body}
    </section>
  )
}
