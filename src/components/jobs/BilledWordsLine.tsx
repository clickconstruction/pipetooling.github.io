import type { ReactNode } from 'react'
import type { BilledWordsLine as BilledWordsLineModel } from '../../lib/jobs/billedWordsLine'
import type { ProgressPaymentTone } from '../../lib/jobs/progressPaymentCell'

/**
 * The words line under a Billed row's bar (v2.4130): "Billed Sep 15 · 21 d past
 * expected · they said Oct 3". The expectation clause is the click — it opens
 * They said… (no promise yet) or New date… (one is on record) — so the row
 * carries no separate link for it. Colour comes from the bar's words div, which
 * takes the line's tone; the button inherits it.
 */
export default function BilledWordsLine({ line, onExpect }: { line: BilledWordsLineModel; onExpect?: () => void }) {
  const clickTitle = onExpect ? ` — click to record ${line.action === 'new-date' ? 'a new date the customer named' : 'what the customer said'}` : ''
  return (
    <span data-testid="billed-words-line">
      {line.billed}
      {line.expect ? (
        <>
          {' · '}
          {onExpect ? (
            <button
              type="button"
              data-testid="billed-words-expect"
              onClick={(e) => {
                e.stopPropagation()
                onExpect()
              }}
              title={`${line.title}${clickTitle}`}
              style={{ padding: 0, border: 'none', background: 'none', font: 'inherit', color: 'inherit', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 2 }}
            >
              {line.expect}
            </button>
          ) : (
            <span data-testid="billed-words-expect" title={line.title}>
              {line.expect}
            </span>
          )}
        </>
      ) : null}
    </span>
  )
}

/** What the bar's words div takes in place of the crew's sentence; `below` (v2.4147) is drawn right under it — the pay history behind the estimate. */
export type WordsOverride = { node: ReactNode; tone: ProgressPaymentTone; title: string; below?: ReactNode }

export function billedWordsOverride(line: BilledWordsLineModel, onExpect?: () => void, below?: ReactNode): WordsOverride {
  return { node: <BilledWordsLine line={line} onExpect={onExpect} />, tone: line.tone, title: line.full, below }
}
