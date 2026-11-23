import type { CSSProperties, ReactNode } from 'react'
import type { NeedsYouItem, NeedsYouShown } from '../../lib/dashboardNeedsYou'
import { ValueSentence } from '../valuesInPlace/ValuesInPlace'

/**
 * The words of a Needs you row (punch list #424). Most rows are a title and a sentence, drawn as they always were.
 * A row that carries `shown` draws its values apart from its words in place of the sentence: the count in the title
 * bold, the names it is about, one thing shown as itself, and a chip for each fact that has a value of its own (a
 * timed text's time, a held text's cause). The fixed words are grey, so a person can tell what changes from what does
 * not. Where the press and the count sit is the card's, not this piece's.
 */
const TITLE: CSSProperties = { fontWeight: 600, fontSize: '0.9375rem' }
const DETAIL: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: 1 }
const CHIP: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', borderRadius: 999, padding: '1px 0.55rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }
const AMBER_CHIP: CSSProperties = { ...CHIP, background: 'var(--bg-amber-tint)', borderColor: 'var(--border-amber)', color: 'var(--text-amber-800)' }
/** A value inside an amber chip keeps the chip's colour, so the whole chip reads as one caution. */
const inChip = (text: string): ReactNode => <b data-value="worked-out">{text}</b>
const AMBER_VALUES = { n: inChip, who: inChip, why: inChip, age: inChip, more: inChip }

function Clock() {
  return (
    <svg aria-hidden width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ flex: 'none' }}>
      <circle cx="6" cy="6" r="4.75" />
      <path d="M6 3.5V6l1.75 1" />
    </svg>
  )
}

function Shown({ shown }: { shown: NeedsYouShown }) {
  return (
    <div data-needs-you-shown>
      <div style={{ ...TITLE, fontWeight: 500, color: 'var(--text-700)' }}>
        <ValueSentence text={shown.title} />
      </div>
      {shown.peek ? (
        <div data-needs-you-peek style={{ marginTop: '0.35rem', padding: '0.35rem 0.65rem', borderRadius: '12px 12px 12px 4px', background: 'var(--bg-blue-tint)', color: 'var(--text-700)', fontSize: '0.8125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {shown.peek}
        </div>
      ) : null}
      {shown.names ? (
        <div data-needs-you-names style={{ ...DETAIL, marginTop: shown.peek ? '0.3rem' : 2 }}>
          <ValueSentence text={shown.names} />
        </div>
      ) : null}
      {shown.chips.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.4rem' }}>
          {shown.chips.map((chip, i) => (
            <span key={i} data-needs-you-chip={chip.kind} style={chip.kind === 'timed' ? CHIP : AMBER_CHIP}>
              {chip.kind === 'timed' ? <Clock /> : <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', flex: 'none' }} />}
              <span>{chip.kind === 'timed' ? <ValueSentence text={chip.text} /> : <ValueSentence text={chip.text} values={AMBER_VALUES} />}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function NeedsYouRowWords({ item }: { item: Pick<NeedsYouItem, 'title' | 'detail' | 'shown'> }) {
  if (item.shown) return <Shown shown={item.shown} />
  return (
    <>
      <div style={TITLE}>{item.title}</div>
      <div style={DETAIL}>{item.detail}</div>
    </>
  )
}
