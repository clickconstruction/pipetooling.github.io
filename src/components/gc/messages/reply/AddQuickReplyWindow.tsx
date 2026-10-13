import { useEffect, useState } from 'react'
import {
  addQuickReply,
  guessWords,
  qrGuess,
  QR_KINDS,
  QR_KIND_ORDER,
  type QuickReplyFor,
  type QuickReplyTags,
  type StepsByKind,
} from '../../../../lib/quickReplies/kernel'
import { formatErrorMessage } from '../../../../utils/errorHandling'
import { Btn, input } from '../../gcUi'

/**
 * Messages, cut 3's screens: add a quick reply from the reply box, the strip's *Add a line* or a narrowed search that
 * found none (v1.145). The words come in from the narrow box; who it is for and its step start as the kernel's guess
 * from the words (`qrGuess`) and stay a guess until set here. A line goes to the team, or to the person alone with
 * *Just for me*. The words of the result are the kernel's (`addQuickReply`); the table keeps the version.
 */
export function AddQuickReplyWindow({
  initialText,
  me,
  steps,
  onSave,
  onClose,
}: {
  initialText: string
  me: string
  steps: StepsByKind
  onSave: (text: string, tags: QuickReplyTags, mine: boolean) => Promise<void>
  onClose: (words?: string) => void
}) {
  const [text, setText] = useState(initialText.trim())
  const [set, setSet] = useState<QuickReplyTags | null>(null)
  const [mine, setMine] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const tags: QuickReplyTags = set ?? qrGuess(text)
  const kindSteps = tags.for === 'any' ? [] : (steps[tags.for] ?? [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        if (!busy) onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose, busy])

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
      onClose(result.words)
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The line was not added.'))
    } finally {
      setBusy(false)
    }
  }

  const label = { fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-600)' } as const

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        if (!busy) onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.35)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add a quick reply"
        data-add-quick-reply
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(520px, 100%)', maxHeight: 'min(88vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Add a quick reply</h2>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => onClose()} disabled={busy} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
            ×
          </button>
        </div>
        <div style={{ padding: '0.8rem 1rem', overflowY: 'auto', display: 'grid', gap: '0.6rem', fontSize: '0.875rem' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span style={label}>The line</span>
            <textarea aria-label="The line" value={text} autoFocus rows={3} onChange={(e) => setText(e.target.value)} style={{ ...input, resize: 'vertical', font: 'inherit' }} />
          </label>
          <div role="radiogroup" aria-label="Who it is for" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={label}>For</span>
            {QR_KIND_ORDER.map((k: QuickReplyFor) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={tags.for === k}
                onClick={() => setSet({ for: k, stepId: k === tags.for ? tags.stepId : null })}
                style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '0.1rem 0.6rem', cursor: 'pointer', background: tags.for === k ? 'var(--bg-blue-tint)' : 'var(--surface)', fontWeight: tags.for === k ? 600 : 400 }}
              >
                {QR_KINDS[k]}
              </button>
            ))}
          </div>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <span style={label}>On the step</span>
            <select
              aria-label="On the step"
              value={tags.stepId ?? ''}
              disabled={tags.for === 'any'}
              onChange={(e) => setSet({ for: tags.for, stepId: e.target.value || null })}
              style={{ ...input, width: 'auto' }}
            >
              <option value="">No step</option>
              {kindSteps.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <span data-add-guess style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {guessWords(text, set !== null)}
            </span>
          </label>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
            <span>Just for me. It shows on your strip only.</span>
          </label>
          {problem && (
            <div role="alert" style={{ color: 'var(--text-red-700)' }}>
              {problem}
            </div>
          )}
        </div>
        <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <Btn onClick={() => onClose()} disabled={busy}>
            Cancel
          </Btn>
          <Btn kind="primary" onClick={() => void save()} disabled={busy}>
            {busy ? 'Adding…' : 'Add the line'}
          </Btn>
        </div>
      </div>
    </div>
  )
}
