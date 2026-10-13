import { useState } from 'react'
import {
  addQuickReply,
  EDITOR_WORDS,
  FLOW_NAMES,
  guessWords,
  qrGuess,
  QR_KINDS,
  QR_KIND_ORDER,
  type QuickReplyFor,
  type QuickReplyTags,
  type StepRef,
  type StepsByKind,
} from '../../../../lib/quickReplies/kernel'
import { formatErrorMessage } from '../../../../utils/errorHandling'
import { Btn, input } from '../../gcUi'

const label = { fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-600)' } as const

/** A kind's steps cut by flow, in order, when they come from two flows; one group with no name otherwise. */
function byFlow(steps: readonly StepRef[]): Array<{ name: string | null; steps: StepRef[] }> {
  const groups: Array<{ name: string | null; flow: StepRef['flow']; steps: StepRef[] }> = []
  for (const s of steps) {
    const last = groups[groups.length - 1]
    if (last && last.flow === s.flow) last.steps.push(s)
    else groups.push({ name: s.flow && s.flow !== 'unknown' ? FLOW_NAMES[s.flow] : null, flow: s.flow, steps: [s] })
  }
  return groups.length > 1 ? groups : [{ name: null, steps: [...steps] }]
}

/**
 * A line's two tags as the editor sets them: who it is for, as a row of choices, and its step in that kind's flow. A
 * line for anyone has no step. Shared by the add row and a line opened to change. A kind with two flows (customers:
 * the residential flow and the GC customer's) lists each flow's steps under its name, as the residential prototype's
 * `stepOptions` did.
 */
export function QuickReplyTagFields({
  tags,
  steps,
  onTags,
  disabled,
  aside,
}: {
  tags: QuickReplyTags
  steps: StepsByKind
  onTags: (tags: QuickReplyTags) => void
  disabled?: boolean
  /** Words after the step, such as the guess. */
  aside?: string
}) {
  const kindSteps = tags.for === 'any' ? [] : (steps[tags.for] ?? [])
  return (
    <>
      <div role="radiogroup" aria-label="Who it is for" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={label}>For</span>
        {QR_KIND_ORDER.map((k: QuickReplyFor) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={tags.for === k}
            disabled={disabled}
            onClick={() => onTags({ for: k, stepId: k === tags.for ? tags.stepId : null })}
            style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '0.1rem 0.6rem', cursor: disabled ? 'not-allowed' : 'pointer', background: tags.for === k ? 'var(--bg-blue-tint)' : 'var(--surface)', fontWeight: tags.for === k ? 600 : 400 }}
          >
            {QR_KINDS[k]}
          </button>
        ))}
      </div>
      <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={label}>On the step</span>
        <select
          aria-label="On the step"
          value={tags.stepId ?? ''}
          disabled={disabled || tags.for === 'any'}
          onChange={(e) => onTags({ for: tags.for, stepId: e.target.value || null })}
          style={{ ...input, width: 'auto' }}
        >
          <option value="">No step</option>
          {byFlow(kindSteps).map((g) =>
            g.name ? (
              <optgroup key={g.name} label={g.name}>
                {g.steps.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ) : (
              g.steps.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))
            ),
          )}
        </select>
        {aside && (
          <span data-add-guess style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {aside}
          </span>
        )}
      </label>
    </>
  )
}

/**
 * Messages, cut 3's screens: the quick replies editor's add row (v1.145), opened by its **+ Add a line**, or filled from
 * a narrowed search that found none (the strip's or *Find a reply*'s). Who it is for and its step start as the kernel's
 * guess from the words (`qrGuess`) and stay a guess until set here. A line goes to the team, or to the person alone with
 * *Just for me*. The words of the result are the kernel's (`addQuickReply`); the table keeps the version.
 */
export function QuickRepliesEditorAdd({
  initialText,
  me,
  steps,
  onSave,
  onCancel,
}: {
  initialText: string
  me: string
  steps: StepsByKind
  onSave: (text: string, tags: QuickReplyTags, mine: boolean) => Promise<void>
  /** Closes the row; with the kernel's words once a line was added. */
  onCancel: (words?: string) => void
}) {
  const [text, setText] = useState(initialText.trim())
  const [set, setSet] = useState<QuickReplyTags | null>(null)
  const [mine, setMine] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const tags: QuickReplyTags = set ?? qrGuess(text)

  const save = async () => {
    const result = addQuickReply({ id: '', text, tags, mine, by: me, at: Date.now() })
    if ('error' in result) {
      setProblem(result.error)
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      await onSave(result.line.text, { for: result.line.for, stepId: result.line.stepId }, mine)
      onCancel(result.words)
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The line was not added.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-qr-add style={{ border: '1px solid var(--border-blue)', borderRadius: 8, background: 'var(--bg-blue-tint)', padding: '0.6rem 0.7rem', display: 'grid', gap: '0.5rem' }}>
      <textarea
        aria-label="The line"
        value={text}
        autoFocus
        rows={2}
        placeholder={EDITOR_WORDS.addPlaceholder}
        onChange={(e) => setText(e.target.value)}
        style={{ ...input, resize: 'vertical', font: 'inherit' }}
      />
      <QuickReplyTagFields tags={tags} steps={steps} onTags={setSet} disabled={busy} aside={guessWords(text, set !== null)} />
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
          <span>Just for me. It shows on your strip only.</span>
        </label>
        <span style={{ flex: 1 }} />
        <Btn onClick={() => onCancel()} disabled={busy}>
          Cancel
        </Btn>
        <Btn kind="primary" onClick={() => void save()} disabled={busy}>
          {busy ? 'Adding…' : 'Add the line'}
        </Btn>
      </div>
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {problem}
        </div>
      )}
    </div>
  )
}
