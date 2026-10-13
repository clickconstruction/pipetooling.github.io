import { useState } from 'react'
import type { BlankFills } from '../../../../lib/quickReplies/blanks'
import { qrStepName, qrTotal, type QuickReply, type StepsByKind } from '../../../../lib/quickReplies/kernel'
import { shortName } from '../../../../lib/quickReplies/phone'
import { OFF_THE_PHONE, PHONE_TAB_WORDS, movePhone, phoneTabLines, reachesPhone, type PhonePlace } from '../../../../lib/quickReplies/phoneTab'
import { formatErrorMessage } from '../../../../utils/errorHandling'
import { FilledLine } from './FilledLine'

/** The button's name on the phone: its own, else the first sentence of its words (`shortName`). */
const nameOnPhone = (q: QuickReply, fills: BlankFills) => shortName({ text: q.text, phoneName: q.phoneName ?? null }, fills)

const press = { border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', padding: '0.1rem 0.45rem', cursor: 'pointer', fontSize: '0.78rem' } as const

/**
 * Messages R3: the quick replies editor's **Phone** tab (the residential prototype v0.8's `phoneTab`). The lines a tech
 * gets on Job Mode, in their places, each by its short name and its words as they would go. **↑** and **↓** move a
 * line one place, which saves the places that changed (`movePhone`), and **off** takes it off the phone. Past six, a
 * line waits until one above comes off. Every save goes through `edit_quick_reply`, which keeps a phone version.
 */
export function QuickRepliesPhoneTab({
  lines,
  steps,
  fills,
  onPlaces,
  onDone,
}: {
  lines: readonly QuickReply[]
  steps: StepsByKind
  fills: BlankFills
  /** Saves each place in turn; a place of 0 takes the line off the phone. */
  onPlaces: (places: PhonePlace[]) => Promise<void>
  /** After a save, with the words for the toast. */
  onDone: (words: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const list = phoneTabLines(lines)

  const save = async (places: PhonePlace[], words: string) => {
    if (!places.length) return
    setBusy(true)
    setProblem(null)
    try {
      await onPlaces(places)
      onDone(words)
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The phone’s order was not saved.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-qr-phone-tab style={{ display: 'grid', gap: '0.5rem' }}>
      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-600)' }}>{PHONE_TAB_WORDS.note}</p>
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {problem}
        </div>
      )}
      {list.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>{PHONE_TAB_WORDS.empty}</p>
      ) : (
        <ol data-qr-phone-list style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.35rem' }}>
          {list.map((q, i) => {
            const step = qrStepName(steps, q.for, q.stepId)
            const waiting = !reachesPhone(i)
            return (
              <li
                key={q.id}
                data-qr-phone-row={q.id}
                style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.45rem 0.55rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', opacity: waiting ? 0.7 : 1 }}
              >
                <span style={{ fontWeight: 600, minWidth: '1.2rem', textAlign: 'right', color: 'var(--text-600)' }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.86rem' }}>
                  <strong>{nameOnPhone(q, fills)}</strong> · <FilledLine text={q.text} fills={fills} />
                  <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {step ? `on ${step}` : 'no step'} · used {qrTotal(q)}
                    {waiting && <span data-qr-phone-waits> · {PHONE_TAB_WORDS.waiting}</span>}
                  </span>
                </span>
                <span style={{ display: 'flex', gap: '0.25rem', flex: 'none' }}>
                  <button type="button" aria-label={`${PHONE_TAB_WORDS.up}: ${nameOnPhone(q, fills)}`} title={PHONE_TAB_WORDS.up} disabled={busy || i === 0} onClick={() => void save(movePhone(lines, q.id, -1), PHONE_TAB_WORDS.moved)} style={press}>
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`${PHONE_TAB_WORDS.down}: ${nameOnPhone(q, fills)}`}
                    title={PHONE_TAB_WORDS.down}
                    disabled={busy || i === list.length - 1}
                    onClick={() => void save(movePhone(lines, q.id, 1), PHONE_TAB_WORDS.moved)}
                    style={press}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`${PHONE_TAB_WORDS.off}: ${nameOnPhone(q, fills)}`}
                    title={PHONE_TAB_WORDS.off}
                    disabled={busy}
                    onClick={() => void save([{ id: q.id, phoneOrder: OFF_THE_PHONE }], PHONE_TAB_WORDS.tookOff)}
                    style={press}
                  >
                    off
                  </button>
                </span>
              </li>
            )
          })}
        </ol>
      )}
      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>{PHONE_TAB_WORDS.max}</p>
    </div>
  )
}
