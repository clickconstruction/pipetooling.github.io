/**
 * Messages, cut 2's screens, PR C3: what a line was heard as, under it (the prototype's `promiseOffer` and its written
 * lines, v1.178). A day heard: *Wed Oct 7 is a promise of* each kind it could be by who they are (`promiseChoices`),
 * or *just talk*; once said, who wrote it down or called it talk. A plans question: *Ask the architect* (only on a line on
 * a GC project) or *Answer it myself*; once said, who sent it or is answering it. A written promise runs the move line,
 * the pill and Follow up's row; the words claim no other place (the lead, 2026-10-12).
 */
import type { CSSProperties } from 'react'
import {
  ANSWER_IT_MYSELF,
  ASK_THE_ARCHITECT,
  IS_A_PROMISE_OF,
  JUST_TALK,
  PLANS_QUESTION_WORDS,
  answeringLineWords,
  askedLineWords,
  heardDay,
  notAPromiseWords,
  promiseChoiceTip,
  promiseChoices,
  writtenLineWords,
  type HeardLine,
  type PromiseChoice,
  type PromisePerson,
} from '../../lib/messages/promises'
import { clauseButtonStyle, clausePrimaryStyle } from '../contracts/clauseStyles'

const small: CSSProperties = { ...clauseButtonStyle, padding: '0.15rem 0.5rem', fontSize: '0.78rem' }
const smallPrimary: CSSProperties = { ...clausePrimaryStyle, padding: '0.15rem 0.5rem', fontSize: '0.78rem' }
const row: CSSProperties = { display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.3rem', fontSize: '0.82rem' }
const done: CSSProperties = { marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--text-green-700)' }

export interface HeardUnderLineProps {
  line: HeardLine
  person: PromisePerson
  /** The line's job, for the words that name it; null reads "a job". */
  jobName: string | null
  /** The line is on a GC project, so its plans question can go to that project's architect. */
  onGcProject: boolean
  busy: boolean
  onWrite: (choice: PromiseChoice) => void
  onJustTalk: () => void
  onAsk: () => void
  onAnswerMyself: () => void
}

export function HeardUnderLine({ line, person, jobName, onGcProject, busy, onWrite, onJustTalk, onAsk, onAnswerMyself }: HeardUnderLineProps) {
  if (line.kind === 'question') {
    if (line.state === 'asked') return <div style={done}>{askedLineWords(line.by)}</div>
    if (line.state === 'answered') return <div style={done}>{answeringLineWords(line.by)}</div>
    return (
      <div data-heard-question style={row}>
        <span>{PLANS_QUESTION_WORDS}</span>
        {onGcProject && (
          <button type="button" disabled={busy} onClick={onAsk} title="Puts it on the job's questions about the plans and emails it to the architect." style={smallPrimary}>
            {ASK_THE_ARCHITECT}
          </button>
        )}
        <button type="button" disabled={busy} onClick={onAnswerMyself} style={small}>
          {ANSWER_IT_MYSELF}
        </button>
      </div>
    )
  }
  if (line.state === 'written') return <div style={done}>{writtenLineWords(line)}</div>
  if (line.state === 'no') return <div style={{ ...done, color: 'var(--text-muted)' }}>{notAPromiseWords(line.by)}</div>
  const day = heardDay(line)
  return (
    <div data-heard-day style={row}>
      <span>
        <b>{day}</b> {IS_A_PROMISE_OF}
      </span>
      {promiseChoices(person, jobName).map((choice, i) => (
        <button key={choice.kind} type="button" disabled={busy} title={promiseChoiceTip(choice, day)} onClick={() => onWrite(choice)} style={i === 0 ? smallPrimary : small}>
          {choice.label}
        </button>
      ))}
      <button type="button" disabled={busy} onClick={onJustTalk} style={{ ...small, borderStyle: 'dashed', color: 'var(--text-muted)' }}>
        {JUST_TALK}
      </button>
    </div>
  )
}
