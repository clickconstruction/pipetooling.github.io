/**
 * The line that says how the phone's location is doing (punch list #402): finding, on, a weak
 * signal, or a rough area with the steps to the switch for this phone. It is there in every state,
 * so a person is told they are set, and is not only told when something is wrong.
 *
 * The thresholds and the words are `preciseLocation.ts`. The wait before a rough reading is called
 * rough is the screen's to count (`useRoughHeld`), since the map beside the line waits on the same
 * answer. What the screen does about a weak or a rough reading is its own sentence, handed in.
 */
import type { CSSProperties } from 'react'
import { PRECISE_ALREADY_ON_WORDS, preciseSteps, preciseWords, roughCompareWords, type PhoneKind } from '../../lib/paintedMap/preciseLocation'

const amberBox: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.55rem 0.7rem' }
const row: CSSProperties = { margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }

/** A tick in a disc: the phone is set. A status colour, the same in both themes. */
export function PreciseTick() {
  return (
    <svg aria-hidden data-precise-tick width="18" height="18" viewBox="0 0 18 18" style={{ flex: 'none' }}>
      <circle cx="9" cy="9" r="9" fill="#16a34a" />
      <path d="M5 9.4l2.6 2.6L13 6.6" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The steps to the switch for this phone, and the line for a phone whose switch was on all along.
 * A phone's own steps are numbered, since they are done in order. Where the page cannot tell the
 * phone there is one line for each kind, and those are not numbered: a person does one of them.
 */
export function PreciseSteps({ kind }: { kind: PhoneKind }) {
  const steps = preciseSteps(kind)
  const List = kind === 'other' ? 'ul' : 'ol'
  return (
    <>
      <List data-precise-steps={kind} style={{ margin: '0.45rem 0 0', paddingLeft: '1.25rem', display: 'grid', gap: '0.2rem' }}>
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </List>
      <p data-precise-already-on style={{ margin: '0.45rem 0 0', fontSize: '0.8125rem' }}>{PRECISE_ALREADY_ON_WORDS}</p>
    </>
  )
}

type Props = {
  /** The newest reading's margin, or null while there is none. */
  accuracyM: number | null | undefined
  /** Which phone this is (`usePhoneKind`). */
  kind: PhoneKind
  /** The readings have stayed rough for the wait (`useRoughHeld`). A screen that asks once, on a press, hands in true. */
  roughHeld: boolean
  /** Said after the words while the signal is weak: what this screen does about it. */
  weakNote?: string
  /** Said after the words while the reading is rough: what this screen cannot do with it. */
  roughNote?: string
}

export function PreciseLocationLine({ accuracyM, kind, roughHeld, weakNote, roughNote }: Props) {
  const words = preciseWords(accuracyM, kind, roughHeld)
  // The lead is what is spoken when the state changes. The margin beside it moves each second, and is not.
  if (words.state === 'finding') {
    return (
      <p data-precise="finding" style={{ ...row, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--border-strong)', flex: 'none' }} />
        <span>
          <b role="status">{words.lead}</b> {words.tail}
        </span>
      </p>
    )
  }
  if (words.state === 'on') {
    return (
      <p data-precise="on" style={{ ...row, fontSize: '0.9375rem', color: 'var(--text-green-700)' }}>
        <PreciseTick />
        <span>
          <b role="status">{words.lead}</b> {words.tail}
        </span>
      </p>
    )
  }
  if (words.state === 'weak') {
    return (
      <p data-precise="weak" style={{ ...amberBox, display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: '#d97706', flex: 'none', marginTop: 5 }} />
        <span>
          <b role="status">{words.lead}</b> {words.tail}
          {weakNote ? ` ${weakNote}` : null}
        </span>
      </p>
    )
  }
  const compare = roughCompareWords(accuracyM, kind)
  return (
    <div role="alert" data-precise="rough" style={amberBox}>
      <b>{words.lead}</b>
      {compare ? (
        <dl data-precise-compare style={{ margin: '0.4rem 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.15rem 0.75rem', background: 'var(--surface)', border: '1px solid var(--border-amber)', borderRadius: 6, padding: '0.4rem 0.6rem', color: 'var(--text-strong)' }}>
          <dt>{compare.nowLabel}</dt>
          <dd style={{ margin: 0, fontWeight: 700 }}>{compare.now}</dd>
          <dt>{compare.onLabel}</dt>
          <dd style={{ margin: 0, fontWeight: 700, color: 'var(--text-green-700)' }}>{compare.on}</dd>
        </dl>
      ) : words.tail ? (
        ` ${words.tail}`
      ) : null}
      {roughNote ? <span data-precise-note>{compare ? roughNote : ` ${roughNote}`}</span> : null}
      <PreciseSteps kind={kind} />
    </div>
  )
}
