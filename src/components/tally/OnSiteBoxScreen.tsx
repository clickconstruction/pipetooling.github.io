/**
 * Materials on site: the body of a box's own screen on the phone (punch list #398). Top to bottom: the box's name
 * with **More** beside it, the strips the tab hands in (a take left open, the pin ask), the parts as closed rows
 * with their numbers, four tiles that each carry their own fact, the box's photos and takes, and the tab's own
 * bottom bar. A tap on a part opens its presses under it, one part at a time.
 *
 * It draws and tells; every write and every sheet is the tab's (`TallyOnSiteTab.tsx`). The words and the rules are
 * `lib/materials/boxScreen.ts`.
 */
import { useState, type CSSProperties, type ReactNode } from 'react'
import { EmptyState } from '../EmptyState'
import { boxKindWords } from '../../lib/materials/editBox'
import { countWalkKeys } from '../../lib/materials/countWalk'
import type { Container, ContainerLine } from '../../lib/materials/onSite'
import { BOX_HISTORY_CAPTION, BOX_MORE_PRESS, PART_HINT, PART_PRESS_WORDS, addTileFact, boxTiles, countTileFact, countTileTitle, noneLeftWords, partPresses, partRowNote, partsCaption, partsOpenByThemselves, photoTileFact, whereTileFact, type PartPress } from '../../lib/materials/boxScreen'
import { WHERE_IS_IT_PRESS, whereIsBoxTitle } from '../../lib/materials/whereIsBox'
import { boxTileFactStyle, boxTileStyle, BOX_PRESS, BOX_PRESS_BLUE } from './boxTileStyle'

const TOUCH_MIN = 48
const BLUE = BOX_PRESS_BLUE
const btn = BOX_PRESS
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem' }
const caption: CSSProperties = { ...muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.72rem', margin: 0 }
const row: CSSProperties = { ...btn, width: '100%', minHeight: 56, justifyContent: 'flex-start', gap: '0.6rem', textAlign: 'left', borderColor: 'var(--border)', borderRadius: 10, padding: '0.4rem 0.75rem' }
const amber: CSSProperties = { color: 'var(--text-amber-800)', borderColor: 'var(--text-amber-800)' }

const tileName: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.95rem' }

function Glyph({ d, children }: { d?: string; children?: ReactNode }) {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      {d ? <path d={d} /> : children}
    </svg>
  )
}

export type OnSiteBoxScreenProps = {
  container: Container
  /** This box's lines, as the tab's `linesOf` gives them. */
  lines: ReadonlyArray<ContainerLine>
  /** What its stickers say beside the name (`stickerMarksWords`); empty when they say nothing. */
  stickers: string
  /** A person's own words for what is in it; empty when the app writes the line. */
  said: string
  now: Date
  lastCount: { at: string; byName: string } | null
  /** The place's name, null with no place yet. */
  place: string | null
  /** The pin's short mark (`boxPinShort`), null with no pin. */
  pin: string | null
  photos: ReadonlyArray<{ at: string }>
  /** What was just done to the box, while it is fresh (`actIsFresh`); null otherwise. */
  after: string | null
  /** A 320 px phone: the tiles and a part's presses stack one a row. */
  narrow: boolean
  /** Under the name: a take left open, the pin ask. */
  strips?: ReactNode
  /** The Photo tile. The tab draws it, since the press owns the camera: it gets the tile's look and its fact. */
  photoTile: (tile: { style: CSSProperties; factStyle: CSSProperties; fact: string; fresh: boolean }) => ReactNode
  /** Under the tiles: the box's photos and its takes. Null when it has none. */
  history?: ReactNode
  /** The tab's own bottom bar: Take from this box. */
  footer?: ReactNode
  onBack: () => void
  onMore: () => void
  onCount: () => void
  onAddPart: () => void
  onWhere: () => void
  onPart: (press: PartPress, line: ContainerLine) => void
}

export default function OnSiteBoxScreen({ container, lines, stickers, said, now, lastCount, place, pin, photos, after, narrow, strips, photoTile, history, footer, onBack, onMore, onCount, onAddPart, onWhere, onPart }: OnSiteBoxScreenProps) {
  const unsorted = container.kind === 'unsorted'
  const openAll = partsOpenByThemselves(container.kind)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const tiles = boxTiles({ kind: container.kind, walkable: countWalkKeys(lines).length })
  const count = countTileFact(lastCount, now)
  const photo = photoTileFact({ label: container.label, photos, after, now })
  const kinds = lines.filter((l) => l.onHand > 0).length
  const cols = narrow ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.75rem' }} data-testid="on-site-box-screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <button type="button" aria-label="Back to the containers" onClick={onBack} style={{ ...btn, width: TOUCH_MIN, padding: 0, fontSize: '1.25rem', flex: 'none' }}>‹</button>
        <div style={{ minWidth: 0, display: 'grid' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.01em', lineHeight: 1.1 }}>{container.label}</span>
            <span style={{ ...muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem', fontWeight: 600 }}>{unsorted ? 'delivered' : boxKindWords(container.kind)}</span>
            {stickers ? <span style={{ ...muted, fontWeight: 600 }} title="The stickers on it" data-testid="on-site-box-header-stickers">{stickers}</span> : null}
          </div>
          {said ? <span style={{ fontWeight: 600, fontSize: '0.92rem', overflowWrap: 'anywhere' }} data-testid="on-site-box-said">{said}</span> : null}
        </div>
        {unsorted ? null : <button type="button" style={{ ...btn, marginLeft: 'auto', flex: 'none' }} aria-label={`${BOX_MORE_PRESS} for ${container.label}: edit, move, print, retire`} onClick={onMore}><span aria-hidden>⋯</span>{BOX_MORE_PRESS}</button>}
      </div>

      {strips}

      <p style={caption}>{partsCaption(container.label)}</p>
      {lines.length === 0 ? <EmptyState compact main={`Nothing in ${container.label} yet.`} tail="Add a part, or move one in from another box." /> : null}
      {lines.map((l) => {
        const open = openAll || openKey === l.partKey
        const note = partRowNote(l)
        const presses = partPresses({ unsorted, onHand: l.onHand })
        const top = (
          <>
            <span style={{ minWidth: 0, display: 'grid' }}>
              <span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{l.partName}</span>
              {l.manufacturer ? <span style={{ ...muted, fontWeight: 500 }}>{l.manufacturer}</span> : null}
              {note ? <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-amber-700)' }}>{note}</span> : null}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: '1.7rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1, flex: 'none' }}>{l.onHand}</span>
          </>
        )
        return (
          <div key={l.partKey} style={{ display: 'grid', gap: '0.4rem' }} data-testid="on-site-part">
            {openAll ? (
              <div style={{ ...row, cursor: 'default', ...(note ? { borderColor: 'var(--text-amber-800)' } : {}) }}>{top}</div>
            ) : (
              <button type="button" aria-expanded={open} style={{ ...row, ...(note ? { borderColor: 'var(--text-amber-800)' } : {}) }} onClick={() => setOpenKey(open ? null : l.partKey)}>
                {top}
                <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: '0.9rem', flex: 'none', width: 14, textAlign: 'center' }}>{open ? '▴' : '▾'}</span>
              </button>
            )}
            {open ? (
              <div style={{ display: 'grid', gridTemplateColumns: presses.length === 1 ? 'minmax(0, 1fr) auto' : cols, gap: '0.5rem', alignItems: 'center' }}>
                {l.onHand <= 0 ? <span style={muted}>{noneLeftWords(container.label)}</span> : null}
                {presses.map((p) => (
                  <button key={p} type="button" style={{ ...btn, minHeight: 52, minWidth: 0, ...(p === 'cannot_find' ? amber : {}), ...(p === 'put-in' ? { borderColor: BLUE, color: 'var(--text-link)' } : {}) }} onClick={() => onPart(p, l)}>{PART_PRESS_WORDS[p]}</button>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
      {lines.length > 0 && !openAll ? <p style={{ ...muted, margin: 0 }}>{PART_HINT}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '0.5rem' }} data-testid="on-site-box-tiles">
        {tiles.map((t, i) => {
          // An odd tile out takes the whole row, so nothing sits alone beside a gap.
          const span: CSSProperties = !narrow && tiles.length % 2 === 1 && i === tiles.length - 1 ? { gridColumn: '1 / -1' } : {}
          if (t === 'count') {
            const tone = count.due ? 'due' : 'plain'
            return (
              <button key={t} type="button" style={{ ...boxTileStyle(tone), ...span }} onClick={onCount}>
                <span style={tileName}><Glyph d="M4 12.5l5 5L20 6.5" />{countTileTitle(container.label)}</span>
                <span style={boxTileFactStyle(tone)}>{count.words}</span>
              </button>
            )
          }
          if (t === 'photo') {
            const tone = photo.fresh ? 'fresh' : 'plain'
            return <div key={t} style={{ display: 'grid', minWidth: 0, ...span }}>{photoTile({ style: boxTileStyle(tone), factStyle: boxTileFactStyle(tone), fact: photo.words, fresh: photo.fresh })}</div>
          }
          if (t === 'add') {
            return (
              <button key={t} type="button" style={{ ...boxTileStyle(), ...span }} aria-label={`Add a part to ${container.label}`} onClick={onAddPart}>
                <span style={tileName}><Glyph d="M12 5v14M5 12h14" />Add a part</span>
                <span style={boxTileFactStyle()}>{addTileFact(container.label, kinds)}</span>
              </button>
            )
          }
          return (
            <button key={t} type="button" style={{ ...boxTileStyle(), ...span }} aria-label={whereIsBoxTitle(container.label)} onClick={onWhere}>
              <span style={tileName}><Glyph><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /></Glyph>{WHERE_IS_IT_PRESS}</span>
              <span style={boxTileFactStyle()}>{whereTileFact({ place, where: container.where, pin })}</span>
            </button>
          )
        })}
      </div>

      {history ? (
        <>
          <p style={caption}>{BOX_HISTORY_CAPTION}</p>
          {history}
        </>
      ) : null}

      {footer}
    </div>
  )
}
