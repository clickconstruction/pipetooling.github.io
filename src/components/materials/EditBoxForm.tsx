/**
 * Edit a box (v2.7179, the owner's ask of 2026-11-13): a cage's or a box's name, its kind and its where line,
 * changed after it was made. One form for both pages: the phone's box screen hosts it in its own sheet, the
 * office page in `EditBoxWindow` below. The rules and every word are `editBox.ts`; the write is the store's
 * `editContainer`, so a press made with no signal is kept and sent later like any other on-site press.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { Container } from '../../lib/materials/onSite'
import { BOX_KIND_CHOICES, BOX_NAME_MAX, BOX_WHERE_MAX, EDIT_BOX_HINT, boxDraftOf, boxKindWords, cleanBoxName, editBoxPressLabel, editBoxTitle, editBoxVerdict, editedBoxWords, renameLabelNote, type BoxDraft } from '../../lib/materials/editBox'
import { editContainer } from '../../lib/materials/onSiteStore'

const BLUE = '#2563eb'
const press = (h: number): CSSProperties => ({ minHeight: h, padding: '0 0.9rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' })
const field = (h: number): CSSProperties => ({ width: '100%', minHeight: h, padding: '0.5rem 0.9rem', fontSize: '1rem', boxSizing: 'border-box', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)' })
const note: CSSProperties = { margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.45 }

type Props = {
  container: Container
  /** Every container of the box's job, so a name a live box carries is refused before the press. */
  containers: ReadonlyArray<Container>
  /** Thumb-height presses for the phone; the office page's are shorter. */
  touch?: boolean
  onSaved: (words: string) => void
}

export default function EditBoxForm({ container, containers, touch = false, onSaved }: Props) {
  const [draft, setDraft] = useState<BoxDraft>(() => boxDraftOf(container))
  const h = touch ? 48 : 38
  const verdict = editBoxVerdict(containers, container.id, draft)
  const renaming = cleanBoxName(draft.label) !== container.label && cleanBoxName(draft.label) !== ''
  const save = () => {
    if (!verdict.ok) return
    editContainer(container.id, verdict.patch)
    onSaved(editedBoxWords(container, verdict.patch))
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); save() }} style={{ display: 'grid', gap: '0.75rem' }} data-testid="edit-box-form">
      <p style={note}>{EDIT_BOX_HINT}</p>
      <label style={{ display: 'grid', gap: '0.25rem', fontWeight: 600 }}>
        Its name
        <input type="text" value={draft.label} maxLength={BOX_NAME_MAX + 8} onChange={(e) => setDraft({ ...draft, label: e.target.value })} aria-label="Its name" autoCapitalize="characters" autoComplete="off" style={{ ...field(h), fontSize: '1.3rem', fontWeight: 800, textTransform: 'uppercase' }} />
      </label>
      {renaming && (verdict.ok || verdict.reason === 'same') ? <p style={note} data-testid="edit-box-label-note">{renameLabelNote(container)}</p> : null}
      <div style={{ display: 'grid', gap: '0.25rem' }}>
        <span style={{ fontWeight: 600 }}>How it sits</span>
        <div role="group" aria-label="How it sits" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.35rem' }}>
          {BOX_KIND_CHOICES.map((k) => (
            <button key={k} type="button" aria-pressed={draft.kind === k} style={{ ...press(h), padding: '0 0.4rem', ...(draft.kind === k ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) }} onClick={() => setDraft({ ...draft, kind: k })}>{boxKindWords(k)}</button>
          ))}
        </div>
        <p style={note}>A pallet, or a thing too big for a box, is a loose pile.</p>
      </div>
      <label style={{ display: 'grid', gap: '0.25rem', fontWeight: 600 }}>
        Where exactly, if it helps
        <input type="text" value={draft.where} maxLength={BOX_WHERE_MAX + 20} onChange={(e) => setDraft({ ...draft, where: e.target.value })} placeholder="on a pallet by the north door" aria-label="Where exactly" style={field(h)} />
      </label>
      {!verdict.ok && verdict.words ? <p role="alert" style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{verdict.words}</p> : null}
      <button type="submit" disabled={!verdict.ok} style={{ ...press(touch ? 52 : 40), width: '100%', background: BLUE, borderColor: BLUE, color: '#fff', ...(verdict.ok ? {} : { opacity: 0.45, cursor: 'default' }) }}>{editBoxPressLabel(container, draft)}</button>
    </form>
  )
}

/** The office page's host: a small window over the page, closed by ×, Escape or a press outside it. */
export function EditBoxWindow({ container, containers, onClose, onSaved }: Omit<Props, 'touch'> & { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const title = editBoxTitle(container)
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 12, width: 'min(440px, 100%)', maxHeight: '100%', overflowY: 'auto', padding: '1rem 1.25rem 1.25rem', display: 'grid', gap: '0.75rem', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', flex: '1 1 auto' }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)', minHeight: 36, minWidth: 36 }}>×</button>
        </div>
        <EditBoxForm container={container} containers={containers} onSaved={onSaved} />
      </div>
    </div>,
    document.body,
  )
}
