import { useState } from 'react'
import type { PaperChoice } from '../../lib/contracts/clauseRows'
import type { PreviewCompany } from '../../lib/contracts/clausesIo'
import { ClausePreviewWindow } from '../contracts/ClausePreviewWindow'
import { Btn, input } from './gcUi'

/**
 * Messages, cut 4c (v2.5334): the paper a statement of work or our contract is built from. Today's paper comes first,
 * a statement of work's lines or our contract file. Then each paper built from clauses in the Contract library
 * (`paperChoices`), with **Preview** opening it as it would go to this company or customer (`ClausePreviewWindow`).
 */
export function GcPaperPicker({
  choices,
  value,
  today,
  previewAs,
  disabled,
  labelled = true,
  onPick,
}: {
  /** Null while they load. */
  choices: readonly PaperChoice[] | null
  value: string | null
  /** Today's paper in words: *Today's paper: its lines*. */
  today: string
  /** Who the preview puts it together for. */
  previewAs: PreviewCompany
  disabled?: boolean
  /** False where the window's own field already says *Paper*. */
  labelled?: boolean
  onPick: (paperId: string | null) => void
}) {
  const [preview, setPreview] = useState(false)
  const chosen = choices?.find((c) => c.id === value) ?? null
  return (
    <div data-gc-paper-picker style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
      <label style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', maxWidth: '100%' }}>
        {labelled && <span style={{ color: 'var(--text-muted)' }}>Paper</span>}
        <select aria-label="Paper" value={value ?? ''} disabled={disabled || choices === null} onChange={(e) => onPick(e.target.value || null)} style={{ ...input, maxWidth: '100%' }}>
          <option value="">{today}</option>
          {(choices ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
          {/* A paper picked before its last clause was retired: shown as it stands, never offered again. */}
          {value && choices !== null && !chosen && <option value={value}>A paper no longer offered</option>}
        </select>
      </label>
      {chosen && <Btn onClick={() => setPreview(true)}>Preview</Btn>}
      {preview && chosen && <ClausePreviewWindow book={chosen.book} companies={[]} as={previewAs} onClose={() => setPreview(false)} />}
    </div>
  )
}
