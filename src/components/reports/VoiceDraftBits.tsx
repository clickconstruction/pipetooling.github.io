import { useState, type CSSProperties } from 'react'
import { DRAFT_WORDS } from '../../lib/reports/voiceDraft'

/**
 * The small pieces of a drafted report on the form (punch list #186, item 1, PR 2, v2.5916): the mark under a field the
 * draft filled, which the host drops when the field is touched, and the fold under the fields that holds the words
 * said and the lines the draft set with the words each came from. Draw only.
 */
export function DraftedMark() {
  return (
    <p data-testid="drafted-mark" style={{ margin: '4px 0 0', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-blue-700)', display: 'flex', gap: 6, alignItems: 'center' }}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--text-blue-700)', display: 'inline-block' }} />
      {DRAFT_WORDS.mark}
    </p>
  )
}

/** What was said, under a fold, with the lines the draft set. Open when the draft lands so the tech can check it. */
export function HeardFold({ heard, language, lines }: { heard: string; language: string; lines: readonly string[] }) {
  const [open, setOpen] = useState(true)
  const title = DRAFT_WORDS.foldTitle(language)
  return (
    <div data-testid="heard-fold" style={foldStyle}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} style={foldHead}>
        <span aria-hidden>{open ? '▼' : '▶'}</span> {title}
      </button>
      {open ? (
        <div style={{ display: 'grid', gap: 6, paddingTop: 6 }}>
          <q style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.84rem' }}>{heard}</q>
          {lines.length ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-blue-700)' }}>
              <b style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{DRAFT_WORDS.foldLines}</b>
              {lines.map((l) => (
                <div key={l}>{l}</div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

const foldStyle: CSSProperties = { border: '1px dashed var(--border)', borderRadius: 8, padding: '8px 10px', marginBottom: '0.75rem', background: 'var(--surface)' }
const foldHead: CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }
