/**
 * A place on a painted map, being added or changed (punch list #345): what it is, a word for
 * whoever comes next, and a photo. The dot itself is on the map above this panel, dragged under
 * the magnifying glass or set by one reading of where the painter stands.
 *
 * The presses are kinds (punch list #393): each gives the dot its own mark, and a name to a place
 * that has none yet. A name somebody typed is theirs, and a press never changes it.
 *
 * Since punch list #413 (Taunya's three changes of 2026-11-21) the kinds are big presses, two to a
 * row and 56 px tall, made for a thumb in a glove. **Buried line** asks what is buried, and each
 * answer wears the color a locator paints for it. **＋ Something else**, the full width of the
 * sheet, is for anything on no list: the name box takes the keyboard. And the words are a
 * description as long as the person needs, in a box that grows with it.
 *
 * A place may start from a photo (#413, **Photo of a spot**): the sheet is handed the photo the
 * camera just took, shows it first and large, and says so when the dot could not be put where the
 * person stood.
 *
 * Under **Put the dot where I am** the Precise Location line says how that one reading did (punch
 * list #402): on, a weak signal, or a rough area. A rough reading does not move the dot, and the
 * line then shows the way to the switch. A press that got no reading at all says why in the same
 * place, in an amber box that stands in for the line until the next press answers.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { usePhoneKind } from '../../hooks/usePreciseLocation'
import { usePlaceMorePhotos } from '../../hooks/usePlaceMorePhotos'
import { useTaskShot } from '../../hooks/useTaskShot'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import type { MyFixFailure } from '../../lib/materials/myLocation'
import { handHeld } from '../../lib/paintedMap/handHeld'
import { PAINTED_PLACE_NAME_MAX, type PaintedPlace, type PlacePhoto } from '../../lib/paintedMap/paintedMap'
import { BURIED_KIND_TILES, PLACE_KIND_HINT_WORDS, PLACE_KIND_TILES, PLACE_KIND_WORDS, PLACE_WARN_COLOR, isBuriedKind, pressBuriedAnswer, pressBuriedTile, pressPlaceKindChip, pressSomethingElse, type PaintedPlaceKind } from '../../lib/paintedMap/paintedPlaceKind'
import { PAINTED_PLACE_WORDS_MAX, PLACE_WORDS_HINT, PLACE_WORDS_LABEL, PLACE_WORDS_PLACEHOLDER } from '../../lib/paintedMap/paintedPlaceWords'
import { PLACE_DOT_WEAK_NOTE_WORDS, placeDotNoFixWords, placeDotRoughNoteWords } from '../../lib/paintedMap/paintedPlaceDot'
import { PAINTED_PLACE_NO_CODES_WORDS } from '../../lib/paintedMap/paintedPlacePhoto'
import { PlaceGlyphDrawing } from './PaintedPlaceMark'
import { PreciseLocationLine } from './PreciseLocationLine'

/** The photo as the panel hands it over: a new picture, the one the place already has, or none. */
export type PaintedPlacePhotoChoice = { kind: 'new'; id: string; blob: Blob } | { kind: 'keep' } | { kind: 'none' }
/** A place's photos after its first (#413, step 7), as the panel hands them over: the saved ones still kept, and the new ones to send. */
export type PaintedPlaceMorePhotos = { keep: PlacePhoto[]; add: Array<{ id: string; blob: Blob }> }

type Props = {
  /** The place being changed, or null for a new one. */
  place: PaintedPlace | null
  /** The saved photo, to look at. */
  photoUrl: string | null
  /**
   * The margin of a reading taken on this visit, while the dot still sits on it. Null once the dot was moved by hand,
   * and for a saved place's own margin, which says nothing of the phone as it is now.
   */
  accuracyM: number | null
  /** The last press got a rough reading: the phone gave an area, and the dot was left where it was. Its margin. */
  roughAccuracyM?: number | null
  /** The last press got no reading at all: the phone said no, ran out of time, or has none to give. The dot was left where it was. */
  noFix?: MyFixFailure | null
  /** A reading was taken and the dot was then moved off it. */
  movedOffReading: boolean
  finding: boolean
  busy: boolean
  /** The place is the caller's to remove. */
  canRemove: boolean
  /** A photo taken before the sheet opened (#413): the sheet takes it as the place's photo and shows it first. */
  startShot?: File | null
  /** A line for the top of the sheet: why the dot is not where the person stands. */
  note?: string | null
  /** The saved other photos, by path, to look at. */
  morePhotoUrls?: ReadonlyMap<string, string>
  onUseWhereIAm: () => void
  /** `more` is handed over only when the place's other photos changed, so a place whose photos a newer app keeps is not rewritten by an older one. */
  onSave: (input: { name: string; words: string; kind: PaintedPlaceKind | null; photo: PaintedPlacePhotoChoice; more?: PaintedPlaceMorePhotos }) => void
  onRemove: () => void
  onCancel: () => void
}

const press: CSSProperties = { minHeight: 44, padding: '0 0.9rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer' }
const deadPress: CSSProperties = { ...press, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: 'var(--border)', cursor: 'default' }
/** A kind's press (#413): two to a row and 56 px tall, so a thumb in a glove lands on it. */
const tile: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', minHeight: 56, padding: '0 0.85rem', borderRadius: 12, borderWidth: 1.5, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 700, fontSize: '1rem', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }
const tileOn: CSSProperties = { ...tile, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }
/** ＋ Something else: the full width of the sheet, dashed until it is pressed. */
const tileElse: CSSProperties = { ...tile, gridColumn: '1 / -1', justifyContent: 'center', borderStyle: 'dashed' }
const tileElseOn: CSSProperties = { ...tileOn, gridColumn: '1 / -1', justifyContent: 'center' }
const tiles: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }
/** The color a locator paints for what is buried, as a bar at the press's left. */
const swatch = (color: string): CSSProperties => ({ width: 12, height: 30, borderRadius: 4, background: color, flex: 'none', boxShadow: '0 0 0 1.5px rgba(255,255,255,.85)' })
const field: CSSProperties = { minHeight: 44, padding: '0.5rem 0.6rem', fontSize: '1rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', boxSizing: 'border-box', width: '100%' }
const label: CSSProperties = { display: 'grid', gap: '0.3rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }
/** The amber box of the Precise Location line, for the press's own answer when there is no reading to draw a line for. */
const amberBox: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.55rem 0.7rem' }
/** A place's other photo, small beside the first. */
const moreThumb: CSSProperties = { width: 72, height: 54, objectFit: 'cover', borderRadius: 6, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', background: 'var(--bg-muted)', display: 'block' }
/** A press that reads as a link: Take another, Remove the photo, Remove, Remove this place. 44 px tall, a thumb's height (#413's walk). */
const quiet: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontFamily: 'inherit', fontSize: '0.875rem', textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', minHeight: 44 }

export function PaintedPlacePanel({ place, photoUrl, accuracyM, roughAccuracyM = null, noFix = null, movedOffReading, finding, busy, canRemove, startShot = null, note = null, morePhotoUrls, onUseWhereIAm, onSave, onRemove, onCancel }: Props) {
  const [name, setName] = useState(place?.name ?? '')
  const [kind, setKind] = useState<PaintedPlaceKind | null>(place?.kind ?? null)
  const [words, setWords] = useState(place?.words ?? '')
  // ＋ Something else was the last kind press: under What is here?, or under What is buried?. The name box says so.
  const [elseOn, setElseOn] = useState<'top' | 'buried' | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const wordsRef = useRef<HTMLTextAreaElement>(null)
  // The description's box grows with what is in it, so a long one is read whole as it is written.
  useEffect(() => {
    const el = wordsRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(96, el.scrollHeight + 2)}px`
  }, [words])
  const buried = isBuriedKind(kind)
  const take = (next: { name: string; kind: PaintedPlaceKind | null }, other: 'top' | 'buried' | null = null) => {
    setName(next.name)
    setKind(next.kind)
    setElseOn(other)
    // Something else is on no list: the name is the person's to type, so the keyboard comes up on its box.
    if (other) window.requestAnimationFrame(() => nameRef.current?.focus())
  }
  // The saved photo stays until the painter takes it off or takes another.
  const [keepSaved, setKeepSaved] = useState(Boolean(place?.photoPath))
  const inputRef = useRef<HTMLInputElement>(null)
  const moreRef = useRef<HTMLInputElement>(null)
  const { shot, shrinking, error: shotError, pick, clear } = useTaskShot()
  // The place's photos after its first (#413, step 7): open and covered, before and after.
  const more = usePlaceMorePhotos(place?.morePhotos)
  const savedMore = place?.morePhotos ?? []
  const moreChanged = more.added.length > 0 || more.kept.length !== savedMore.length

  useEffect(() => {
    if (shot) setKeepSaved(false)
  }, [shot])
  // The photo the sheet was opened with is read once, as a photo picked here would be.
  const photoFirst = !!startShot
  useEffect(() => {
    if (startShot) void pick(startShot)
    // Once, for the photo the sheet opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const phoneKind = usePhoneKind()
  // A rough reading moves nothing on the map, so its words are the only sign the press did anything. On a phone they
  // can land under the fold of this panel: bring them into view when they come.
  const roughRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (roughAccuracyM != null) roughRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [roughAccuracyM])
  // No reading moves nothing either. Its words come into view when the press answers, and again on each press that
  // fails the same way: the press was made twice, and is seen to answer twice.
  const noFixRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (noFix && !finding) noFixRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [noFix, finding])
  const preview = shot?.previewUrl ?? (keepSaved ? photoUrl : null)
  const hasPhoto = Boolean(shot) || keepSaved
  const waiting = busy || shrinking || more.shrinking

  const save = () => {
    if (waiting) return
    onSave({ name, words, kind, photo: shot ? { kind: 'new', id: shot.id, blob: shot.blob } : keepSaved ? { kind: 'keep' } : { kind: 'none' }, ...(moreChanged ? { more: { keep: more.kept, add: more.added.map((p) => ({ id: p.id, blob: p.blob })) } } : null) })
  }

  const photoBlock = (
      <div data-place-photo={photoFirst ? 'first' : 'after'} style={{ display: 'grid', gap: '0.35rem' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>Photo</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture={handHeld() ? 'environment' : undefined}
          aria-label="Photo of the place"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void pick(file)
          }}
        />
        {hasPhoto ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {preview ? (
              <img src={preview} alt="The photo of the place" style={photoFirst ? { width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)', display: 'block' } : { width: 96, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
            ) : (
              <span style={{ width: 96, height: 72, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-muted)', display: 'grid', placeItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>A photo is saved</span>
            )}
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.9rem' }}>
              <button type="button" style={quiet} disabled={waiting} onClick={() => inputRef.current?.click()}>
                {shrinking ? 'Reading the photo…' : 'Take another'}
              </button>
              <button
                type="button"
                style={quiet}
                disabled={waiting}
                onClick={() => {
                  clear()
                  setKeepSaved(false)
                }}
              >
                Remove the photo
              </button>
            </span>
          </div>
        ) : (
          <button type="button" disabled={waiting} onClick={() => inputRef.current?.click()} style={{ display: 'grid', placeItems: 'center', width: '100%', minHeight: 64, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.875rem', fontFamily: 'inherit', cursor: 'pointer' }}>
            {shrinking ? 'Reading the photo…' : '＋ Add a photo'}
          </button>
        )}
        {shotError ? (
          <p role="alert" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
            {shotError}
          </p>
        ) : null}
        {hasPhoto || more.kept.length + more.added.length > 0 ? (
          // More than one photo (#413, step 7): the trench open and the trench filled, the valve and the wall it is in.
          <div data-place-more-photos style={{ display: 'grid', gap: '0.4rem' }}>
            <input
              ref={moreRef}
              type="file"
              accept="image/*"
              capture={handHeld() ? 'environment' : undefined}
              aria-label="Another photo of the place"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void more.pick(file)
              }}
            />
            {more.kept.length + more.added.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {more.kept.map((p, i) => (
                  <span key={p.path} data-place-more-photo="kept" style={{ display: 'grid', gap: '0.15rem', justifyItems: 'center' }}>
                    {morePhotoUrls?.get(p.path) ? <img src={morePhotoUrls.get(p.path)} alt={`Photo ${i + 2} of the place`} style={moreThumb} /> : <span style={{ ...moreThumb, display: 'grid', placeItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Saved</span>}
                    <button type="button" style={quiet} disabled={waiting} aria-label={`Remove photo ${i + 2}`} onClick={() => more.removeKept(p.path)}>
                      Remove
                    </button>
                  </span>
                ))}
                {more.added.map((p, i) => (
                  <span key={p.id} data-place-more-photo="new" style={{ display: 'grid', gap: '0.15rem', justifyItems: 'center' }}>
                    <img src={p.previewUrl} alt={`Photo ${more.kept.length + i + 2} of the place`} style={moreThumb} />
                    <button type="button" style={quiet} disabled={waiting} aria-label={`Remove photo ${more.kept.length + i + 2}`} onClick={() => more.removeAdded(p.id)}>
                      Remove
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            {more.canAdd ? (
              <button type="button" data-place-more-add disabled={waiting} onClick={() => moreRef.current?.click()} style={waiting ? { ...deadPress, minHeight: 48 } : { ...press, minHeight: 48 }}>
                {more.shrinking ? 'Reading the photo…' : '＋ Another photo'}
              </button>
            ) : (
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>A place holds twelve more photos. Take one off to add another.</span>
            )}
            {more.error ? (
              <p role="alert" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
                {more.error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
  )

  return (
    <div data-painted-place-panel style={{ display: 'grid', gap: '0.7rem' }}>
      {note ? (
        <p role="status" data-place-note style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-blue-800)', background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)', borderRadius: 8, padding: '0.55rem 0.7rem' }}>
          {note}
        </p>
      ) : null}
      {photoFirst ? photoBlock : null}
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)' }}>What is here?</span>
        <div data-place-kinds style={tiles}>
          {PLACE_KIND_TILES.map((k) => {
            const on = k.kind === 'buried' ? buried : kind === k.kind
            return (
              <button key={k.kind} type="button" data-place-kind={k.kind} aria-pressed={on} style={on ? tileOn : tile} onClick={() => take(k.kind === 'buried' ? pressBuriedTile({ name, kind }) : pressPlaceKindChip({ name, kind }, k.kind))}>
                <PlaceGlyphDrawing glyph={k.glyph} size={24} color={k.warns && !on ? PLACE_WARN_COLOR : 'currentColor'} />
                {k.name}
              </button>
            )
          })}
          <button type="button" data-place-kind-else="top" aria-pressed={elseOn === 'top' && kind === null} style={elseOn === 'top' && kind === null ? tileElseOn : tileElse} onClick={() => take(pressSomethingElse({ name, kind }), 'top')}>
            {PLACE_KIND_WORDS.somethingElse}
          </button>
        </div>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{PLACE_KIND_HINT_WORDS}</span>
        {buried ? (
          <div data-place-buried style={{ display: 'grid', gap: '0.5rem', padding: '0.7rem', borderRadius: 12, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', background: 'var(--bg-subtle)' }}>
            <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)' }}>{PLACE_KIND_WORDS.buriedAsk}</span>
            <div style={tiles}>
              {BURIED_KIND_TILES.map((k) => {
                const on = kind === k.kind
                return (
                  <button key={k.kind} type="button" data-place-kind={k.kind} aria-pressed={on} style={on ? tileOn : tile} onClick={() => take(pressBuriedAnswer({ name, kind }, k.kind))}>
                    <span aria-hidden style={swatch(k.color ?? 'var(--text-strong)')} />
                    {k.short ?? k.name}
                  </button>
                )
              })}
              <button type="button" data-place-kind-else="buried" aria-pressed={elseOn === 'buried' && kind === 'buried'} style={elseOn === 'buried' && kind === 'buried' ? tileElseOn : tileElse} onClick={() => take(pressSomethingElse({ name, kind }, 'buried'), 'buried')}>
                {PLACE_KIND_WORDS.somethingElse}
              </button>
            </div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{PLACE_KIND_WORDS.buriedHint}</span>
          </div>
        ) : null}
        <label style={label}>
          {elseOn === 'top' ? PLACE_KIND_WORDS.elseAsk : elseOn === 'buried' ? PLACE_KIND_WORDS.buriedElseAsk : 'Name'}
          <input ref={nameRef} type="text" data-place-name value={name} maxLength={PAINTED_PLACE_NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder={elseOn === 'top' ? 'Septic tank lid' : elseOn === 'buried' ? 'Buried conduit' : 'Truck gate'} style={field} />
        </label>
      </div>
      <div style={{ display: 'grid', gap: '0.3rem' }}>
        <label style={label}>
          {PLACE_WORDS_LABEL}
          <textarea ref={wordsRef} data-place-words-box value={words} maxLength={PAINTED_PLACE_WORDS_MAX} rows={3} onChange={(e) => setWords(e.target.value)} placeholder={PLACE_WORDS_PLACEHOLDER} style={{ ...field, minHeight: 96, lineHeight: 1.4, fontFamily: 'inherit', fontWeight: 400, resize: 'vertical', display: 'block' }} />
        </label>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{PLACE_WORDS_HINT}</span>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{PAINTED_PLACE_NO_CODES_WORDS}</span>
      </div>

      {photoFirst ? null : photoBlock}

      <div style={{ display: 'grid', gap: '0.35rem' }}>
        <button type="button" style={finding ? deadPress : press} disabled={finding} onClick={onUseWhereIAm}>
          {finding ? 'Finding you…' : 'Put the dot where I am'}
        </button>
        {noFix ? (
          // No reading came. The reason stands in for the line: an older reading's line here would read as this press's answer.
          <p ref={noFixRef} role="alert" data-painted-place-fix="no-reading" data-painted-place-no-fix={noFix} style={amberBox}>
            {placeDotNoFixWords(noFix)}
          </p>
        ) : roughAccuracyM != null ? (
          // One reading, asked for by the press: there is no better one to wait for, so it is called rough at once.
          <div ref={roughRef} data-painted-place-fix="rough">
            <PreciseLocationLine accuracyM={roughAccuracyM} kind={phoneKind} roughHeld roughNote={placeDotRoughNoteWords(phoneKind)} />
          </div>
        ) : accuracyM != null ? (
          <div data-painted-place-fix="read">
            <PreciseLocationLine accuracyM={accuracyM} kind={phoneKind} roughHeld weakNote={PLACE_DOT_WEAK_NOTE_WORDS} />
          </div>
        ) : movedOffReading ? (
          <p role="status" data-painted-place-fix="moved" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            You moved the dot. The place is where the dot is now.
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Drag the blue dot onto the spot, or press the map to bring it there. Your phone is read once, on that press, and not followed.</p>
        )}
      </div>

      <button type="button" data-painted-place-save style={waiting ? { ...deadPress, minHeight: 56, fontSize: '1.0625rem' } : { ...press, minHeight: 56, fontSize: '1.0625rem', background: '#2563eb', borderColor: '#2563eb', color: '#fff' }} disabled={waiting} onClick={save}>
        {busy ? 'Saving…' : place ? 'Save the place' : 'Add this place'}
      </button>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <button type="button" style={press} onClick={onCancel}>
          Cancel
        </button>
        {place && canRemove ? (
          <button type="button" style={quiet} onClick={onRemove}>
            Remove this place
          </button>
        ) : null}
      </div>
    </div>
  )
}
