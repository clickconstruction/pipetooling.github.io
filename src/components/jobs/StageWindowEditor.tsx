/**
 * Set a window on a stage (v2.2927): pick the line item (when the row doesn't
 * already name one) and the span the office wants it done in. Inline on the
 * Subs tab — one row, no modal.
 */
import { useState } from 'react'
import { defaultStageWindow, stageWindowProblem, type StageWindowSpan } from '../../lib/subs/stageWindow'
import type { SubsStage } from '../../lib/subs/subsTabRows'
import { formatCurrency } from '../../lib/jobs/jobFormatting'

export type StageWindowEditorProps = {
  /** Line items to choose from; a single fixed stage renders as a label. */
  stages: SubsStage[]
  initialStageId?: string | null
  initialSpan?: StageWindowSpan | null
  todayYmd: string
  saving?: boolean
  onSave: (stageId: string, span: StageWindowSpan) => void
  onCancel: () => void
}

const input = { padding: '0.3rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-900)' } as const
const btn = (primary: boolean, disabled = false) =>
  ({
    padding: '0.3rem 0.7rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    borderRadius: 5,
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? '#9ca3af' : primary ? '#2563eb' : 'var(--surface)',
    color: primary ? 'white' : 'var(--text-700)',
    border: primary ? 'none' : '1px solid var(--border-strong)',
    whiteSpace: 'nowrap',
  }) as const

export function StageWindowEditor({ stages, initialStageId, initialSpan, todayYmd, saving, onSave, onCancel }: StageWindowEditorProps) {
  const fixed = stages.length === 1 ? stages[0]! : null
  const [stageId, setStageId] = useState<string>(initialStageId ?? fixed?.id ?? stages[0]?.id ?? '')
  const seed = initialSpan ?? defaultStageWindow(todayYmd)
  const [start, setStart] = useState(seed.start)
  const [end, setEnd] = useState(seed.end)
  const problem = stageWindowProblem(start, end)
  const canSave = !!stageId && !problem && !saving
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }} data-testid="stage-window-editor">
      {fixed ? (
        <span style={{ fontWeight: 600 }}>{fixed.name}{fixed.amount > 0 ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · ${formatCurrency(fixed.amount)}</span> : null}</span>
      ) : (
        <select value={stageId} onChange={(e) => setStageId(e.target.value)} style={input} aria-label="Stage">
          {stages.length === 0 ? <option value="">No line items on this job</option> : null}
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}{s.amount > 0 ? ` · $${formatCurrency(s.amount)}` : ''}
            </option>
          ))}
        </select>
      )}
      <span style={{ color: 'var(--text-muted)' }}>between</span>
      <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={input} aria-label="Window start" />
      <span style={{ color: 'var(--text-muted)' }}>and</span>
      <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={input} aria-label="Window end" />
      <button type="button" style={btn(true, !canSave)} disabled={!canSave} onClick={() => onSave(stageId, { start, end })}>
        {saving ? 'Saving…' : 'Set the window'}
      </button>
      <button type="button" style={btn(false)} onClick={onCancel}>
        Cancel
      </button>
      {problem && start && end ? <span style={{ color: 'var(--text-red-700)', fontSize: '0.75rem' }}>{problem}</span> : null}
    </div>
  )
}

export default StageWindowEditor
