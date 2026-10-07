import { useEffect, useState, type CSSProperties } from 'react'
import { legalNarrativeBandWords, legalNarrativeProblem, LEGAL_NARRATIVE_MAX_CHARS, LEGAL_NARRATIVE_OUTLINE } from '../../../lib/legal/legalNarrative'
import { legalNarrativeHtml } from '../../../lib/legal/legalNarrativeHtml'

/**
 * The narrative for the firm, on the Legal desk's first tab (v2.4812): the office's account of the
 * matter in markdown, saved on the matter and read by the firm as the first tab of its portal and the
 * first section of its printed packet. Write, preview as the firm sees it, save. An outline of the four
 * parts counsel reads first is one click away. Read only for a role that cannot edit the review.
 */
export type NarrativeDesk = {
  markdown: string
  updatedOn: string
  updatedByName: string
  canEdit: boolean
  /** Saves (making the matter first when the account has none); true on success. */
  save: (markdown: string) => Promise<boolean>
}

const MUTED: CSSProperties = { color: 'var(--text-muted)' }
const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 0.55rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.74rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }
const btnPrimary: CSSProperties = { ...btn, background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' }

export default function LegalNarrativeEditor({ narrative, busy }: { narrative: NarrativeDesk; busy: boolean }) {
  const [draft, setDraft] = useState(narrative.markdown)
  const [preview, setPreview] = useState(false)
  // A reload after a save, or another account, brings a new saved text: the draft follows it.
  useEffect(() => setDraft(narrative.markdown), [narrative.markdown])
  const dirty = draft.trim() !== narrative.markdown.trim()
  const problem = legalNarrativeProblem(draft)
  const saved = narrative.markdown.trim() ? `Saved ${narrative.updatedOn || ''}${narrative.updatedByName ? ` by ${narrative.updatedByName}` : ''}`.replace(/\s+/g, ' ').trim() : 'Not written yet'

  if (!narrative.canEdit) {
    return (
      <div data-legal-narrative-desk>
        {narrative.markdown.trim() ? <NarrativeRendered markdown={narrative.markdown} updatedOn={narrative.updatedOn} updatedByName={narrative.updatedByName} /> : <p style={{ ...MUTED, fontSize: '0.84rem' }}>No narrative yet. The office cohort writes it here; the firm reads it first on its portal.</p>}
      </div>
    )
  }
  return (
    <div data-legal-narrative-desk style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <b style={{ fontSize: '0.86rem' }}>Narrative for the firm</b>
        <span style={{ ...MUTED, fontSize: '0.78rem' }}>{saved} · the firm reads it first, above the record, labelled as the office's account</span>
      </div>
      <div role="group" aria-label="Write or preview" style={{ display: 'inline-flex', gap: 4 }}>
        <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)} style={!preview ? btnPrimary : btn}>Write</button>
        <button type="button" aria-pressed={preview} onClick={() => setPreview(true)} style={preview ? btnPrimary : btn}>Preview as the firm sees it</button>
        {!draft.trim() ? <button type="button" onClick={() => { setDraft(LEGAL_NARRATIVE_OUTLINE); setPreview(false) }} style={btn}>Start from the outline</button> : null}
      </div>
      {preview ? (
        draft.trim() ? <NarrativeRendered markdown={draft} updatedOn={narrative.updatedOn} updatedByName={narrative.updatedByName} /> : <p style={{ ...MUTED, fontSize: '0.84rem' }}>Nothing to preview yet.</p>
      ) : (
        <textarea
          aria-label="Narrative for the firm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={16}
          placeholder="## The parties&#10;&#10;## What happened&#10;&#10;## What they say, what the record shows&#10;&#10;## Still missing"
          style={{ font: '12.5px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace', padding: 10, border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', resize: 'vertical', width: '100%' }}
        />
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" disabled={busy || !dirty || Boolean(problem)} onClick={() => void narrative.save(draft)} style={{ ...btnPrimary, opacity: busy || !dirty || problem ? 0.6 : 1 }}>Save narrative</button>
        {dirty ? <button type="button" onClick={() => setDraft(narrative.markdown)} style={btn}>Undo changes</button> : null}
        <span style={{ ...MUTED, fontSize: '0.74rem' }}>
          Markdown: ## headings, **bold**, lists and tables. Name each document by its title under Evidence so the firm can open it. {draft.length.toLocaleString('en-US')} of {LEGAL_NARRATIVE_MAX_CHARS.toLocaleString('en-US')} characters.
        </span>
        {problem ? <span role="alert" style={{ color: 'var(--text-amber-700)', fontSize: '0.78rem' }}>{problem}</span> : null}
      </div>
    </div>
  )
}

/** The narrative as the firm reads it: the standing line, then the rendered text. */
function NarrativeRendered({ markdown, updatedOn, updatedByName }: { markdown: string; updatedOn: string; updatedByName: string }) {
  return (
    <div data-theme="light" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px' }}>
      <p style={{ ...MUTED, fontSize: '0.78rem', margin: '0 0 8px' }}>{legalNarrativeBandWords({ updatedOn, updatedByName })}</p>
      <div className="legalNarrative" style={{ fontSize: '0.86rem' }} dangerouslySetInnerHTML={{ __html: legalNarrativeHtml(markdown) }} />
    </div>
  )
}
