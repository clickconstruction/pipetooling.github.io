/**
 * Edit a box (v2.7179, the owner's ask of 2026-11-13): a cage's or a box's name, its kind and its where line,
 * changed after it was made. Since v2.7199 the same form also moves it to another place on the site, and it sits
 * on the Cage tab of the box window (`BoxTabs.tsx`), which both pages host. The rules and every word are `editBox.ts`; the write is the store's
 * `editContainer`, so a press made with no signal is kept and sent later like any other on-site press.
 */
import { useState, type CSSProperties } from 'react'
import type { Container, Place } from '../../lib/materials/onSite'
import { BOX_KIND_CHOICES, BOX_NAME_MAX, BOX_WHERE_MAX, EDIT_BOX_HINT, PLACE_NAME_MAX, boxDraftOf, boxKindWords, boxPlaceDraftOf, cleanBoxName, editBoxPlan, editBoxPressLabel, renameLabelNote, savedBoxWords, type BoxDraft, type BoxPlaceDraft } from '../../lib/materials/editBox'
import { addPlace, editContainer, moveContainer } from '../../lib/materials/onSiteStore'

const BLUE = '#2563eb'
const press = (h: number): CSSProperties => ({ minHeight: h, padding: '0 0.9rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' })
const field = (h: number): CSSProperties => ({ width: '100%', minHeight: h, padding: '0.5rem 0.9rem', fontSize: '1rem', boxSizing: 'border-box', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)' })
const note: CSSProperties = { margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.45 }

type Props = {
  container: Container
  /** Every container of the box's job, so a name a live box carries is refused before the press. */
  containers: ReadonlyArray<Container>
  /** The job's places, for **Which place on site**. */
  places: ReadonlyArray<Place>
  /** Who moves the box, kept on the move as the phone's Move box keeps it. */
  byName: string
  byUserId: string | null
  /** Thumb-height presses for the phone; the office page's are shorter. */
  touch?: boolean
  onSaved: (words: string) => void
}

export default function EditBoxForm({ container, containers, places, byName, byUserId, touch = false, onSaved }: Props) {
  const [draft, setDraft] = useState<BoxDraft>(() => boxDraftOf(container))
  const h = touch ? 48 : 38
  const [placeDraft, setPlaceDraft] = useState<BoxPlaceDraft>(() => boxPlaceDraftOf(container))
  const plan = editBoxPlan(containers, places, container.id, draft, placeDraft)
  const renaming = cleanBoxName(draft.label) !== container.label && cleanBoxName(draft.label) !== ''
  const save = () => {
    if (!plan.ok) return
    // The box's own fields first, then the move, so a rename and a move are two presses kept in that order.
    editContainer(container.id, plan.patch)
    if (plan.place) {
      const to = plan.place.kind === 'new' ? addPlace({ jobId: container.jobId, name: plan.place.name, byUserId }).id : plan.place.placeId
      moveContainer(container.id, to, byName, byUserId)
    }
    onSaved(savedBoxWords(container, plan.patch, plan.place?.name ?? null))
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); save() }} style={{ display: 'grid', gap: '0.75rem' }} data-testid="edit-box-form">
      <p style={note}>{EDIT_BOX_HINT}</p>
      <label style={{ display: 'grid', gap: '0.25rem', fontWeight: 600 }}>
        Its name
        <input type="text" value={draft.label} maxLength={BOX_NAME_MAX + 8} onChange={(e) => setDraft({ ...draft, label: e.target.value })} aria-label="Its name" autoCapitalize="characters" autoComplete="off" style={{ ...field(h), fontSize: '1.3rem', fontWeight: 800, textTransform: 'uppercase' }} />
      </label>
      {renaming && plan.ok && plan.patch.label !== undefined ? <p style={note} data-testid="edit-box-label-note">{renameLabelNote(container)}</p> : null}
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
      <div style={{ display: 'grid', gap: '0.25rem' }}>
        <span style={{ fontWeight: 600 }}>Which place on site</span>
        {places.length > 0 ? (
          <div role="group" aria-label="Which place on site" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {places.map((p) => {
              const on = placeDraft.placeId === p.id && !placeDraft.newPlace.trim()
              return <button key={p.id} type="button" aria-pressed={on} style={{ ...press(touch ? 40 : 32), padding: '0 0.75rem', borderRadius: 999, fontSize: '0.85rem', ...(on ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) }} onClick={() => setPlaceDraft({ placeId: p.id, newPlace: '' })}>{p.name}</button>
            })}
          </div>
        ) : null}
        <input type="text" value={placeDraft.newPlace} maxLength={PLACE_NAME_MAX + 20} onChange={(e) => setPlaceDraft({ ...placeDraft, newPlace: e.target.value })} placeholder={places.length ? 'Or a new place: Laydown yard' : 'Building C · level 2'} aria-label="A new place" style={field(h)} />
      </div>
      {!plan.ok && plan.words ? <p role="alert" style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{plan.words}</p> : null}
      <button type="submit" disabled={!plan.ok} style={{ ...press(touch ? 52 : 40), width: '100%', background: BLUE, borderColor: BLUE, color: '#fff', ...(plan.ok ? {} : { opacity: 0.45, cursor: 'default' }) }}>{editBoxPressLabel(container, draft)}</button>
    </form>
  )
}
