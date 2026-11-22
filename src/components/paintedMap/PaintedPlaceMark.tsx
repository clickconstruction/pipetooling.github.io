/**
 * A place's mark beside its name (punch list #393): the plain numbered dot, or its kind's drawing
 * in a disc with the number on its shoulder. One component for every list a place shows in, so a
 * row's mark is the mark on the map. The drawing itself is `paintedPlaceKind.ts`'s path data.
 */
import type { CSSProperties } from 'react'
import { PLACE_GLYPH_SHARE, placeBadgeSize, placeKindColor, placeKindInfo, type PlaceGlyph } from '../../lib/paintedMap/paintedPlaceKind'

/** A kind's drawing alone, in the colour of the words around it unless told another. */
export function PlaceGlyphDrawing({ glyph, size, color = 'currentColor' }: { glyph: PlaceGlyph; size: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ display: 'block', flex: 'none' }}>
      <path d={glyph.stroke} />
      {glyph.dots.map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill={color} stroke="none" />
      ))}
    </svg>
  )
}

type Props = {
  /** What the dot is called: a map's own place has a number, and a place kept on the job a letter. */
  number: number | string
  /** The place's kind as stored. None, or one this app does not know, draws the plain dot. */
  kind?: string | null
  /** The mark's whole width. A row's marks are all this wide, so its names line up. */
  size?: number
  ink?: string
  paper?: string
  /** A dashed ring: a place kept on the job, shown on one of the job's painted maps. */
  dashed?: boolean
  style?: CSSProperties
}

export function PaintedPlaceMark({ number, kind, size = 28, ink = 'var(--text-strong)', paper = 'var(--surface)', dashed = false, style }: Props) {
  const info = placeKindInfo(kind)
  const disc: CSSProperties = { width: size, height: size, boxSizing: 'border-box', borderRadius: '50%', borderWidth: 2, borderStyle: dashed ? 'dashed' : 'solid', display: 'grid', placeItems: 'center', flex: 'none' }
  if (!info) {
    return (
      <span aria-hidden data-place-mark="plain" style={{ ...disc, borderColor: ink, fontSize: Math.round(size * 0.43), fontWeight: 800, ...style }}>
        {number}
      </span>
    )
  }
  const color = placeKindColor(info, ink)
  const badge = placeBadgeSize(size)
  const lift = Math.round(badge.size * 0.36)
  return (
    <span role="img" aria-label={`${info.label}, place ${number}`} title={info.label} data-place-mark={info.kind} style={{ position: 'relative', display: 'block', width: size, height: size, flex: 'none', ...style }}>
      <span style={{ ...disc, borderColor: color }}>
        <PlaceGlyphDrawing glyph={info.glyph} size={Math.round(size * PLACE_GLYPH_SHARE)} color={color} />
      </span>
      <span data-place-mark-number style={{ position: 'absolute', top: -lift, right: -lift, minWidth: badge.size, height: badge.size, boxSizing: 'border-box', padding: '0 2px', borderRadius: 999, background: ink, color: paper, borderWidth: 1.5, borderStyle: 'solid', borderColor: paper, display: 'grid', placeItems: 'center', fontSize: badge.font, fontWeight: 800, lineHeight: 1 }}>
        {number}
      </span>
    </span>
  )
}
