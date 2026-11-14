/**
 * A painted map as a picture (punch list #345, PR 4b): the browser part. Loads the tiles under the
 * frame, paints the lines and the numbered dots over them and, for a picture that travels alone,
 * a band of words under the map. Not pure: canvas and network. The geometry is `paintedMapPicture.ts`.
 */
import { lineRuns, type PaintedPart, type PaintedPoint } from './paintedLine'
import { PICTURE_ATTRIBUTION, PICTURE_START_WORD, pictureFrame, pictureKeyLine, picturePoint, pictureTiles, pictureTileUrl, PICTURE_HEIGHT, PICTURE_WIDTH } from './paintedMapPicture'

const PAINT = '#ff5a1f'
const INK = '#111827'
const PAPER = '#ffffff'
const MUTED = '#4b5563'
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
/** The longest one tile is waited for. A tile that never comes leaves a grey square, not a lost picture. */
const TILE_WAIT_MS = 8000
/** The most places the key under a picture lists. Past it, the key says how many more. */
export const PICTURE_KEY_MAX = 10

export type PictureLine = { points: ReadonlyArray<PaintedPoint>; poorParts: ReadonlyArray<PaintedPart> }
export type PicturePlace = { number: number; name: string; words: string; lat: number; lng: number }
export type PictureInput = {
  lines: ReadonlyArray<PictureLine>
  places: ReadonlyArray<PicturePlace>
  /** The words under the map. Left out, the picture is the map alone, for a page that says the rest in type. */
  band?: { name: string; summary: string; foot: string[] } | null
}

function loadTile(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    // Without this the canvas is tainted by the first tile and can never be read back as a file.
    img.crossOrigin = 'anonymous'
    const timer = window.setTimeout(() => resolve(null), TILE_WAIT_MS)
    img.onload = () => {
      window.clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      resolve(null)
    }
    img.src = url
  })
}

/** Words cut to fit a width, with a mark that they were cut. */
function fitted(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

function path(ctx: CanvasRenderingContext2D, pts: ReadonlyArray<{ x: number; y: number }>): void {
  ctx.beginPath()
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
}

/**
 * Draw the picture. Resolves to a JPEG, or null for a map with nothing on it and for a browser
 * that will not hand the canvas back. `tilesMissing` counts the squares that did not load.
 */
export async function drawPaintedMapPicture(input: PictureInput): Promise<{ blob: Blob; tilesMissing: number } | null> {
  const all: PaintedPoint[] = [...input.lines.flatMap((l) => l.points), ...input.places]
  const frame = pictureFrame(all)
  if (!frame) return null
  const band = input.band ?? null
  const keyed = band ? input.places.slice(0, PICTURE_KEY_MAX) : []
  const more = band ? input.places.length - keyed.length : 0
  const bandHeight = band ? 118 + keyed.length * 38 + (more > 0 ? 38 : 0) + band.foot.length * 30 + 26 : 0

  const canvas = document.createElement('canvas')
  canvas.width = PICTURE_WIDTH
  canvas.height = PICTURE_HEIGHT + bandHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#d1d5db'
  ctx.fillRect(0, 0, PICTURE_WIDTH, PICTURE_HEIGHT)
  const tiles = pictureTiles(frame)
  const loaded = await Promise.all(tiles.map((t) => loadTile(pictureTileUrl(t))))
  let tilesMissing = 0
  loaded.forEach((img, i) => {
    const t = tiles[i]!
    if (img) ctx.drawImage(img, t.left, t.top, t.size, t.size)
    else tilesMissing += 1
  })

  // The lines: a white casing under the paint, so the line reads over a roof and over a field.
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const line of input.lines) {
    const runs = lineRuns(line.points, line.poorParts)
    for (const run of runs.sure) {
      const pts = run.map((p) => picturePoint(frame, p))
      path(ctx, pts)
      ctx.setLineDash([])
      ctx.strokeStyle = PAPER
      ctx.lineWidth = 13
      ctx.stroke()
      path(ctx, pts)
      ctx.strokeStyle = PAINT
      ctx.lineWidth = 8
      ctx.stroke()
    }
    // A stretch the phone was not sure of: dots, as on the screen.
    for (const run of runs.poor) {
      const pts = run.map((p) => picturePoint(frame, p))
      path(ctx, pts)
      ctx.setLineDash([2, 16])
      ctx.strokeStyle = PAPER
      ctx.lineWidth = 11
      ctx.stroke()
      path(ctx, pts)
      ctx.strokeStyle = PAINT
      ctx.lineWidth = 7
      ctx.stroke()
    }
  }
  ctx.setLineDash([])

  // Which end the way begins at: a picture that travels alone has no Directions press to say so.
  const first = input.lines[0]?.points[0]
  if (first) {
    const p = picturePoint(frame, first)
    ctx.beginPath()
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2)
    ctx.fillStyle = PAPER
    ctx.fill()
    ctx.lineWidth = 5
    ctx.strokeStyle = PAINT
    ctx.stroke()
    ctx.font = `700 24px ${FONT}`
    ctx.textBaseline = 'middle'
    // The word sits on the side with room for it.
    const toRight = p.x < PICTURE_WIDTH - 130
    ctx.textAlign = toRight ? 'left' : 'right'
    const x = p.x + (toRight ? 20 : -20)
    ctx.lineWidth = 6
    ctx.strokeStyle = PAPER
    ctx.strokeText(PICTURE_START_WORD, x, p.y + 1)
    ctx.fillStyle = INK
    ctx.fillText(PICTURE_START_WORD, x, p.y + 1)
  }

  // The dots, numbered.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const place of input.places) {
    const p = picturePoint(frame, place)
    ctx.beginPath()
    ctx.arc(p.x, p.y, 21, 0, Math.PI * 2)
    ctx.fillStyle = PAPER
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeStyle = INK
    ctx.stroke()
    ctx.fillStyle = INK
    ctx.font = `700 ${place.number > 9 ? 20 : 24}px ${FONT}`
    ctx.fillText(String(place.number), p.x, p.y + 1)
  }

  // Whose picture is under the line.
  ctx.font = `500 17px ${FONT}`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  const credit = ctx.measureText(PICTURE_ATTRIBUTION).width
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.fillRect(PICTURE_WIDTH - credit - 20, PICTURE_HEIGHT - 30, credit + 20, 30)
  ctx.fillStyle = INK
  ctx.fillText(PICTURE_ATTRIBUTION, PICTURE_WIDTH - 10, PICTURE_HEIGHT - 9)

  if (band) {
    const left = 36
    const width = PICTURE_WIDTH - left * 2
    ctx.fillStyle = PAPER
    ctx.fillRect(0, PICTURE_HEIGHT, PICTURE_WIDTH, bandHeight)
    ctx.textAlign = 'left'
    ctx.fillStyle = INK
    ctx.font = `700 40px ${FONT}`
    ctx.fillText(fitted(ctx, band.name, width), left, PICTURE_HEIGHT + 56)
    ctx.fillStyle = MUTED
    ctx.font = `500 26px ${FONT}`
    if (band.summary) ctx.fillText(fitted(ctx, band.summary, width), left, PICTURE_HEIGHT + 94)
    let y = PICTURE_HEIGHT + 118
    for (const place of keyed) {
      y += 38
      ctx.beginPath()
      ctx.arc(left + 15, y - 9, 15, 0, Math.PI * 2)
      ctx.lineWidth = 3
      ctx.strokeStyle = INK
      ctx.stroke()
      ctx.fillStyle = INK
      ctx.textAlign = 'center'
      ctx.font = `700 ${place.number > 9 ? 15 : 18}px ${FONT}`
      ctx.fillText(String(place.number), left + 15, y - 3)
      ctx.textAlign = 'left'
      ctx.font = `500 26px ${FONT}`
      ctx.fillText(fitted(ctx, pictureKeyLine(place), width - 46), left + 46, y)
    }
    if (more > 0) {
      y += 38
      ctx.fillStyle = MUTED
      ctx.font = `500 24px ${FONT}`
      ctx.fillText(`and ${more} more ${more === 1 ? 'place' : 'places'} on the map`, left + 46, y)
    }
    ctx.fillStyle = MUTED
    ctx.font = `500 21px ${FONT}`
    for (const words of band.foot) {
      y += 30
      ctx.fillText(fitted(ctx, words, width), left, y)
    }
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88)
    } catch {
      resolve(null)
    }
  })
  return blob ? { blob, tilesMissing } : null
}

/** A blob as a `data:` address, for a page that must carry its own pictures. Null when it cannot be read. */
export function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(blob)
  })
}

/**
 * A place's photo, made small enough to sit in a printed page that carries its own pictures.
 * Null when the photo cannot be fetched or read: the page prints without it.
 */
export async function photoThumbDataUrl(url: string, maxSide = 420): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const bitmap = await createImageBitmap(await res.blob())
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.8)
  } catch {
    return null
  }
}
