/**
 * Messages, cut 2's screens, PR C2: what we owe someone, as a strip above the reply box (the prototype's
 * `owedStripHtml`, the owner's go on the two blanks, 2026-10-11): *We owe Greg [what] by [when]*. The what is picked from
 * their flow's steps of ours and the usual asks, or typed; the day from the day chips, or typed, and optional.
 * *Mark it* writes it; once marked, a new what or day writes the change, and the strip offers *Mark it done, with a team
 * note* (the reply box turns to that note) and *Put it off* (Remind me Monday). The words are `messages/owed.ts`'s.
 */
import { useState, type CSSProperties, type ReactNode } from 'react'
import type { ContactKind } from '../../lib/contacts/kernel'
import { firstName } from '../../lib/contacts/kernel'
import { owedChoices } from '../../lib/followUp/thread'
import { markedByTip, markedByWords, markItTip, OWED_FLOW_EMPTY, owedDay, owedFlowHead, type DayKept, type Owed } from '../../lib/messages/owed'
import { clauseButtonStyle, clauseInputStyle, clausePrimaryStyle } from '../contracts/clauseStyles'
import { DayPicker } from './DayPicker'

const small: CSSProperties = { ...clauseButtonStyle, padding: '0.2rem 0.55rem', fontSize: '0.8rem' }
const smallPrimary: CSSProperties = { ...clausePrimaryStyle, padding: '0.2rem 0.55rem', fontSize: '0.8rem' }
const head: CSSProperties = { fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', margin: '0.3rem 0 0.1rem' }
const tipOf = (t: { does: string; changes: string }) => `${t.does} ${t.changes}`

export interface OwedStripProps {
  person: { name: string; goesBy?: string | null; kind: ContactKind }
  owed: Owed | null
  todayYmd: string
  nowIso: string
  /** A press is running: the presses wait. */
  busy: boolean
  /** A reply box is there to take the team note that marks it done (`owedStore.takers`). */
  canSettle: boolean
  /** *Mark it*, or a new what or day once it is marked. */
  onMark: (what: string, day: DayKept) => void
  onSettle: () => void
  onPutOff: () => void
  onClose: () => void
}

const NO_DAY: DayKept = { ymd: null, words: null }

export function OwedStrip({ person, owed, todayYmd, nowIso, busy, canSettle, onMark, onSettle, onPutOff, onClose }: OwedStripProps) {
  const [editing, setEditing] = useState<'what' | 'when' | null>(owed ? null : 'what')
  const [draft, setDraft] = useState<{ what: string; day: DayKept }>({ what: '', day: NO_DAY })
  const [ownWords, setOwnWords] = useState('')
  const first = firstName(person) || 'them'
  const what = owed ? owed.what : draft.what
  const day = owed ? { ymd: owed.byYmd, words: owed.byWords } : draft.day
  const dayWords = owedDay({ byYmd: day.ymd, byWords: day.words })?.label ?? null
  const choices = owedChoices(person.kind)

  const pickWhat = (w: string) => {
    const words = w.trim()
    if (!words) return
    if (owed) {
      if (words !== owed.what) onMark(words, day)
    } else setDraft((d) => ({ ...d, what: words }))
    setOwnWords('')
    setEditing(null)
  }
  const pickDay = (d: DayKept) => {
    if (owed) {
      if (d.ymd !== owed.byYmd || d.words !== owed.byWords) onMark(owed.what, d)
    } else setDraft((x) => ({ ...x, day: d }))
    setEditing(null)
  }
  const blank = (key: 'what' | 'when', value: string | null, empty: string, tip: string): ReactNode => (
    <button
      type="button"
      aria-expanded={editing === key}
      title={tip}
      disabled={busy}
      onClick={() => setEditing((e) => (e === key ? null : key))}
      style={{
        border: 'none',
        borderBottom: `1px dashed ${value ? 'var(--border-strong)' : '#2563eb'}`,
        background: editing === key ? 'var(--bg-blue-tint)' : 'transparent',
        color: value ? 'var(--text-base)' : 'var(--text-link)',
        fontWeight: 600,
        cursor: 'pointer',
        font: 'inherit',
        padding: '0 0.15rem',
      }}
    >
      {value ?? empty} ▾
    </button>
  )
  const row = (w: string) => (
    <button
      key={w}
      type="button"
      aria-pressed={w === what}
      onClick={() => pickWhat(w)}
      style={{ textAlign: 'left', border: 'none', borderRadius: 6, padding: '0.25rem 0.4rem', background: w === what ? 'var(--bg-blue-tint)' : 'transparent', color: 'var(--text-base)', cursor: 'pointer', font: 'inherit' }}
    >
      {w}
    </button>
  )

  return (
    <section aria-label={`What we owe ${first}`} data-owed-strip style={{ display: 'grid', gap: '0.4rem', padding: '0.55rem 0.7rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', fontSize: '0.9rem' }}>
      <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span>
          We owe {first} {blank('what', what || null, 'what?', 'What we owe. Pick from the list, or type your own words.')} by{' '}
          {blank('when', dayWords, 'when?', 'By when. Pick a day, or type one. The day is optional.')}
        </span>
        {owed && (
          <span title={tipOf(markedByTip(owed, nowIso))} style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {markedByWords(owed, nowIso)}
          </span>
        )}
        {!owed && (
          <button type="button" disabled={busy || !draft.what} title={tipOf(markItTip(person, draft))} onClick={() => onMark(draft.what, draft.day)} style={draft.what && !busy ? smallPrimary : { ...small, opacity: 0.6, cursor: 'default' }}>
            Mark it
          </button>
        )}
        <button type="button" aria-label="Put the strip away" onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}>
          ×
        </button>
      </div>

      {editing === 'what' && (
        <div data-owed-what style={{ display: 'grid', gap: 2, padding: '0.3rem 0.4rem', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={head}>{owedFlowHead(person.kind)}</div>
          {choices.flow.length ? choices.flow.map(row) : <span style={{ color: 'var(--text-muted)', padding: '0.25rem 0.4rem' }}>{OWED_FLOW_EMPTY}</span>}
          <div style={head}>The usual</div>
          {choices.usual.map(row)}
          <div style={head}>Or</div>
          <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <input
              aria-label="What we owe, in your own words"
              value={ownWords}
              placeholder="say what, in a few words"
              onChange={(e) => setOwnWords(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  pickWhat(ownWords)
                }
              }}
              style={{ ...clauseInputStyle, flex: '1 1 14rem', padding: '0.3rem 0.5rem' }}
            />
            <button type="button" disabled={!ownWords.trim()} onClick={() => pickWhat(ownWords)} style={small}>
              Use these words
            </button>
          </span>
        </div>
      )}

      {editing === 'when' && (
        <div data-owed-when style={{ display: 'grid', gap: '0.3rem', padding: '0.4rem', borderRadius: 8, border: '1px solid var(--border)' }}>
          <DayPicker todayYmd={todayYmd} chosen={day} onPick={pickDay} typedLabel="By when, in your own words" />
          <button type="button" onClick={() => pickDay(NO_DAY)} style={{ ...small, justifySelf: 'start' }}>
            {day.ymd || day.words ? 'Clear the day' : 'No day'}
          </button>
        </div>
      )}

      {owed && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {canSettle && (
            <button type="button" disabled={busy} onClick={onSettle} title="A note for the team opens in the box. Say how it got done, or why nothing is owed. The note marks it done." style={small}>
              Mark it done, with a team note
            </button>
          )}
          <button type="button" disabled={busy} onClick={onPutOff} title="The row leaves Follow up until Monday. What we owe stays marked." style={small}>
            Put it off
          </button>
        </div>
      )}
    </section>
  )
}
