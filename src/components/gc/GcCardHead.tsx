import type { CSSProperties } from 'react'
import { DOOR_GROUP_WORDS, cardDoors, cardFactParts, doorWords, type CardDoor, type CardFacts, type DoorFacts, type DoorGroup, type DoorKey } from '../../lib/gc/cardHead'
import { Chip, type Tone } from './gcUi'

/**
 * GC mode, a project's card (to-do #108, PR 1): the head in shape D. The name and the stage on the first line,
 * the facts on the second (`cardFactParts`), and on the right the doors as grouped sets (`cardDoors`), each door
 * with the fact that says whether to open it. The words are the kernel's; this draws them and presses the page's
 * handlers. The walkthrough's anchors (New here?) stay on the plans, a new set and the questions.
 */

const GROUPS: DoorGroup[] = ['job', 'work', 'money']

const groupBox: CSSProperties = { display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 7, overflow: 'hidden', flexWrap: 'wrap' }

const doorStyle = (first: boolean): CSSProperties => ({
  font: 'inherit',
  fontSize: '0.8rem',
  fontWeight: 600,
  padding: '0.25rem 0.6rem',
  background: 'var(--surface)',
  color: 'var(--text-base)',
  border: 0,
  borderLeft: first ? 0 : '1px solid var(--border)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  lineHeight: 1.35,
})

const COUNT_COLOR: Record<NonNullable<CardDoor['tone']> | 'plain', string> = {
  plain: 'var(--text-muted)',
  warn: 'var(--text-amber-700)',
  bad: 'var(--text-red-700)',
}

export function GcCardHead({
  name,
  stageWords,
  stageTone,
  facts,
  doors,
  tourOn,
  onDoor,
}: {
  name: string
  /** The stage chip's words, as the page's rows say it ("bidding", "building"). */
  stageWords: string
  stageTone: Tone
  facts: CardFacts
  doors: DoorFacts
  /** The walkthrough points at the first card only; false leaves the anchors off this one. */
  tourOn: boolean
  onDoor: (key: DoorKey) => void
}) {
  const parts = cardFactParts(facts)
  const list = cardDoors(doors)
  return (
    // Three lines, each the full width: the name and the stage, the facts, then the doors as a toolbar. The doors
    // sat to the right of the name in the mock-up; with the customer and the architect on the facts line that squeezed
    // the facts into a narrow column on the live card, so the toolbar takes its own line.
    <div data-gc-card-head style={{ display: 'grid', gap: '0.3rem', minWidth: 0 }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '1.08rem' }}>{name}</strong>
        <Chip tone={stageTone}>{stageWords}</Chip>
      </div>
      {parts.length > 0 && (
        <div data-gc-card-facts style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {parts.join(' · ')}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.15rem' }}>
        {GROUPS.map((group) => {
          const inGroup = list.filter((d) => d.group === group)
          if (inGroup.length === 0) return null
          return (
            <span key={group} role="group" aria-label={DOOR_GROUP_WORDS[group]} data-gc-doors={group} style={groupBox}>
              {inGroup.map((d, i) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => onDoor(d.key)}
                  title={d.title ?? (d.count ? doorWords(d) : undefined)}
                  aria-label={d.count ? doorWords(d) : undefined}
                  data-tour={tourOn && d.tour ? d.tour : undefined}
                  data-gc-door={d.key}
                  style={doorStyle(i === 0)}
                >
                  {d.label}
                  {d.count && (
                    <span aria-hidden style={{ color: COUNT_COLOR[d.tone ?? 'plain'], fontWeight: 500, marginLeft: '0.35rem' }}>
                      {d.count}
                    </span>
                  )}
                </button>
              ))}
            </span>
          )
        })}
      </div>
    </div>
  )
}
