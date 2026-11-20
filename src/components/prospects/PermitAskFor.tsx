import type { CSSProperties } from 'react'
import { GoogleSearchPress } from './GoogleSearchPress'
import { ValueLine, ValueLines, ValueSentence, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { googleAskForCompany } from '../../lib/research/permitPublic'
import { ASK_FOR_EMPTY } from '../../lib/research/permitCallList'
import {
  LOOKUPS_UNREAD,
  LOOKUP_FACT_LABELS,
  LOOKUP_GAP_TAIL,
  checkedWords,
  kindUnknownWords,
  lookedUpDayWords,
  lookupFacts,
  lookupFootWords,
  lookupHasGap,
  lookupNotFoundWords,
  lookupPill,
  lookupPressName,
  lookupValueWords,
  sourceWords,
  telHref,
  wrongWords,
  type BuilderLookup,
  type LookupStanding,
  type LookupVerdict,
} from '../../lib/research/builderLookups'

/**
 * Permits, Market: the Ask for block on a call-list row (punch list #405, step three). What a
 * one-time lookup found about the name: what kind of company it is, an office phone, and a
 * person and title to ask for, one fact a line. Each fact names the page it came from and the
 * day it was read there.
 *
 * A fact nobody checked is drawn grey, with **Checked** and **Wrong** beside it. A checked fact
 * is plain bold, the look of a permit fact, with who checked it and when and a quiet **Not
 * right**. A fact marked wrong is off the row: its line says who marked it, with **Put back**.
 * A kind the lookup could not tell says so, and nothing is guessed. A name nobody looked up
 * reads as it did before, with the Google press.
 */
const block: CSSProperties = { fontSize: '0.8125rem', background: 'var(--bg-200)', borderRadius: 8, padding: '6px 8px', display: 'grid', gap: 6 }
const top: CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.45 }
const small: CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.4 }
// A fact nobody checked: grey and regular weight, so it never reads as a permit fact.
const unchecked: CSSProperties = { color: 'var(--text-muted)', fontWeight: 400 }
const pill = (checked: boolean): CSSProperties => ({ display: 'inline-block', borderRadius: 999, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap', ...(checked ? { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' } : { border: '1px dashed currentColor', color: 'var(--text-muted)' }) })
const miniPress: CSSProperties = { background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 9px', fontSize: '0.78rem', minHeight: 30, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }
const yesPress: CSSProperties = { ...miniPress, color: 'var(--text-green-700)', fontWeight: 600 }
const deadPress: CSSProperties = { ...miniPress, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }
const linkPress: CSSProperties = { background: 'none', border: 0, padding: 0, fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left', minHeight: 30 }
const pageLink: CSSProperties = { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2, overflowWrap: 'anywhere' }
// A value in a line of small print: set apart by its weight, in the line's own colour.
const quiet = (text: string) => <b style={{ fontWeight: 600 }}>{text}</b>
const QUIET_VALUES = { day: quiet, who: quiet }

export function PermitAskFor({
  name,
  city,
  lookup,
  unread,
  me,
  nameOf,
  todayYmd,
  busyId,
  onPress,
}: {
  /** The builder's name, for the Google press and each press's own name. */
  name: string
  city: string
  /** What was looked up about the name. Null when nobody looked. */
  lookup: BuilderLookup | null
  /** The lookups could not be read: the block says so, and does not claim nobody looked. */
  unread: boolean
  me: string
  nameOf: (userId: string) => string | null
  todayYmd: string
  /** The fact a press is being kept on: its presses wait. */
  busyId: string | null
  onPress: (standing: LookupStanding, verdict: LookupVerdict) => void
}) {
  const google = <GoogleSearchPress ask={googleAskForCompany(name, city)} words="Google the builder" />
  if (!lookup) {
    return (
      <div data-ask-for="none" style={{ ...block, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>Ask for</strong>
        <span>{unread ? LOOKUPS_UNREAD : ASK_FOR_EMPTY.main}</span>
        {google}
        <span style={muted}>{ASK_FOR_EMPTY.tail}</span>
      </div>
    )
  }
  const state = lookupPill(lookup)
  const notFound = lookupNotFoundWords(lookup)
  const foot = lookupFootWords(lookup, todayYmd)
  return (
    <div data-ask-for={state.checked ? 'checked' : 'unchecked'} style={block}>
      <div style={top}>
        <strong>Ask for</strong>
        <span style={pill(state.checked)}>{state.words}</span>
      </div>
      <ValueLines>
        {lookupFacts(lookup).map((s) => (
          <ValueLine key={s.row.id} label={LOOKUP_FACT_LABELS[s.row.fact]}>
            <Fact standing={s} name={name} me={me} nameOf={nameOf} todayYmd={todayYmd} busy={busyId === s.row.id} onPress={onPress} />
          </ValueLine>
        ))}
      </ValueLines>
      {notFound && <div style={muted}>{notFound}</div>}
      {foot && (
        <div style={muted}>
          <ValueSentence text={foot} values={QUIET_VALUES} />
        </div>
      )}
      {lookupHasGap(lookup) && (
        <div style={top}>
          {google}
          <span style={muted}>{LOOKUP_GAP_TAIL}</span>
        </div>
      )}
    </div>
  )
}

/** One fact: its value in the look its state gives it, where it came from, and its presses. */
function Fact({ standing, name, me, nameOf, todayYmd, busy, onPress }: { standing: LookupStanding; name: string; me: string; nameOf: (userId: string) => string | null; todayYmd: string; busy: boolean; onPress: (standing: LookupStanding, verdict: LookupVerdict) => void }) {
  const { row, state, said } = standing
  const press = (words: 'Checked' | 'Wrong' | 'Not right' | 'Put back', verdict: LookupVerdict, style: CSSProperties) => (
    <button type="button" aria-label={lookupPressName(words, row.fact, name)} aria-disabled={busy} onClick={() => !busy && onPress(standing, verdict)} style={busy && style !== linkPress ? deadPress : style}>
      {words}
    </button>
  )
  const line: CSSProperties = { display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap' }
  if (state === 'wrong' && said) {
    return (
      <span data-lookup-fact={row.fact} data-lookup-state="wrong" style={line}>
        <span style={{ ...muted, fontStyle: 'italic' }}>
          <ValueSentence text={wrongWords(said, me, nameOf, todayYmd)} values={QUIET_VALUES} />
        </span>
        {press('Put back', 'back', linkPress)}
      </span>
    )
  }
  if (row.fact === 'kind' && row.value === 'unknown') {
    return (
      <span data-lookup-fact="kind" data-lookup-state="unknown" style={{ ...muted, fontStyle: 'italic' }}>
        <ValueSentence text={kindUnknownWords(row, todayYmd)} values={QUIET_VALUES} />
      </span>
    )
  }
  const checked = state === 'checked' && said != null
  const words = lookupValueWords(row)
  const tel = row.fact === 'phone' ? telHref(row.value) : null
  const value = tel ? (
    <a href={tel} style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}>
      {words}
    </a>
  ) : (
    words
  )
  const detail = row.detail.trim() ? `, ${row.detail.trim()}` : ''
  const page = (
    <a href={row.source_url} target="_blank" rel="noopener noreferrer" title="The page this was read on" style={pageLink}>
      {sourceWords(row.source_url)}
    </a>
  )
  return (
    <span data-lookup-fact={row.fact} data-lookup-state={checked ? 'checked' : 'unchecked'} style={line}>
      <span style={{ minWidth: 0, flex: '1 1 200px' }}>
        {checked ? (
          <>
            <WorkedOutValue>{value}</WorkedOutValue>
            {detail}
          </>
        ) : (
          <span data-value="looked-up" style={unchecked}>
            {value}
            {detail}
          </span>
        )}
        <span style={small}>
          {checked && said ? (
            <>
              <ValueSentence text={checkedWords(said, me, nameOf, todayYmd)} values={QUIET_VALUES} /> · from {page}
            </>
          ) : (
            <>
              from {page} · <ValueSentence text={lookedUpDayWords(row, todayYmd)} values={QUIET_VALUES} />
            </>
          )}
        </span>
      </span>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {checked ? (
          press('Not right', 'wrong', linkPress)
        ) : (
          <>
            {press('Checked', 'checked', yesPress)}
            {press('Wrong', 'wrong', miniPress)}
          </>
        )}
      </span>
    </span>
  )
}
