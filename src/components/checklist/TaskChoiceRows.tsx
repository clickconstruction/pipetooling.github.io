import type { ReactNode } from 'react'
import { ArrowRight, ArrowUpToLine, CalendarArrowUp, Check, CircleSlash, Footprints, Hand, MapPin, PenLine, SkipForward, ThumbsUp, Undo2, UserRound } from 'lucide-react'
import type { TaskChoice, TaskChoiceIcon, TaskChoiceTone } from '../../lib/tasks/taskDoerActs'

const SIZE = 24
const STROKE = 2

/** The drawing for each name the kernel gives. Handing on is an arrow to a person, which no one icon of the set draws. */
const DRAWINGS: Readonly<Record<TaskChoiceIcon, () => ReactNode>> = {
  'to-top': () => <ArrowUpToLine size={SIZE} strokeWidth={STROKE} />,
  'put-back': () => <Undo2 size={SIZE} strokeWidth={STROKE} />,
  'calendar-on': () => <CalendarArrowUp size={SIZE} strokeWidth={STROKE} />,
  'stop-hand': () => <Hand size={SIZE} strokeWidth={STROKE} />,
  'thumbs-up': () => <ThumbsUp size={SIZE} strokeWidth={STROKE} />,
  'struck-circle': () => <CircleSlash size={SIZE} strokeWidth={STROKE} />,
  'to-person': () => (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <ArrowRight size={15} strokeWidth={2.5} style={{ marginRight: -1 }} />
      <UserRound size={21} strokeWidth={STROKE} />
    </span>
  ),
  pen: () => <PenLine size={SIZE} strokeWidth={STROKE} />,
  footsteps: () => <Footprints size={SIZE} strokeWidth={STROKE} />,
  pin: () => <MapPin size={SIZE} strokeWidth={STROKE} />,
  tick: () => <Check size={SIZE} strokeWidth={2.5} />,
  skip: () => <SkipForward size={SIZE} strokeWidth={STROKE} />,
}

/** Each tone's tile and ink, from the theme: the tint turns deep in dark and its ink turns pale, so the pair holds. */
const TONES: Readonly<Record<TaskChoiceTone, { tile: string; ink: string }>> = {
  blue: { tile: 'var(--bg-blue-tint)', ink: 'var(--text-blue-700)' },
  amber: { tile: 'var(--bg-amber-tint)', ink: 'var(--text-amber-700)' },
  green: { tile: 'var(--bg-green-tint)', ink: 'var(--text-green-700)' },
  red: { tile: 'var(--bg-red-tint)', ink: 'var(--text-red-700)' },
  violet: { tile: 'var(--bg-violet-tint)', ink: 'var(--text-violet-700)' },
  slate: { tile: 'var(--bg-muted)', ink: 'var(--text-slate-600)' },
}

/**
 * The rows of a task's choice sheet (v2.8034): each one a picture in a tinted tile, the choice's name and one line on
 * what it does, so a row says what it does before its words are read. The picture is the kernel's
 * (`TaskChoice.picture`), so a new choice cannot ship without one. It is decoration to a screen reader, which reads the
 * name and the line as before.
 */
export function TaskChoiceRows<K extends string>({
  choices,
  onPick,
  busy = false,
  keyAttr = 'data-task-choice',
}: {
  choices: ReadonlyArray<TaskChoice<K>>
  onPick: (key: K) => void
  /** Every row is dead while an answer is being saved. */
  busy?: boolean
  /** The attribute each row carries its key on. */
  keyAttr?: `data-${string}`
}) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      {choices.map((c, i) => {
        const tone = TONES[c.picture.tone]
        return (
          <button
            key={c.key}
            type="button"
            {...{ [keyAttr]: c.key }}
            disabled={busy}
            onClick={() => onPick(c.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 64, padding: '10px 12px', textAlign: 'left', fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)', border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--border)', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
          >
            <span aria-hidden="true" data-choice-picture={c.picture.icon} data-choice-tone={c.picture.tone} style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 12, background: tone.tile, color: tone.ink, flexShrink: 0 }}>
              {DRAWINGS[c.picture.icon]()}
            </span>
            <span style={{ display: 'grid', gap: 2, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.25 }}>{c.label}</span>
              <span style={{ fontSize: '0.8125rem', lineHeight: 1.35, color: 'var(--text-muted)', textWrap: 'balance' }}>{c.words}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
