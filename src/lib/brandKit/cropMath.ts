/**
 * Cards and footers (punch list #313) — the maths of placing a photo in its ring by hand.
 *
 * The photo is kept whole. A crop is three numbers: the point of the picture that sits in the
 * middle of the ring, across and down (0 to 1), and a zoom, where 1 just covers the ring. These
 * functions turn a drag or a slide on the photo sheet into a new crop, and never let the picture
 * leave a gap inside the ring. Pure: the sheet hands in pixels, and gets numbers back.
 */
import type { KitCrop } from './person'

export const ZOOM_MIN = 1
export const ZOOM_MAX = 3

type Size = { w: number; h: number }

/** The share of the picture's width and height that the ring shows at this zoom. */
function shown(photo: Size, zoom: number): { across: number; down: number } {
  const side = Math.min(photo.w, photo.h) / Math.max(ZOOM_MIN, zoom)
  return { across: side / photo.w, down: side / photo.h }
}

/** A crop held in range: the zoom between 1 and 3, the middle point no nearer an edge than half of what the ring shows. */
export function clampCrop(crop: KitCrop, photo: Size): KitCrop {
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, crop.zoom || ZOOM_MIN))
  const { across, down } = shown(photo, zoom)
  const hold = (v: number, half: number) => Math.min(1 - half, Math.max(half, v))
  return { fx: hold(crop.fx, across / 2), fy: hold(crop.fy, down / 2), zoom }
}

/** The crop after the picture is dragged by `dx`, `dy` pixels on a square stage `stage` pixels wide. Dragging right shows more of the picture's left. */
export function dragCrop(crop: KitCrop, dx: number, dy: number, photo: Size, stage: number): KitCrop {
  const held = clampCrop(crop, photo)
  const { across, down } = shown(photo, held.zoom)
  return clampCrop({ fx: held.fx - (dx / stage) * across, fy: held.fy - (dy / stage) * down, zoom: held.zoom }, photo)
}

/** The crop at a new zoom, the same point kept in the middle where the edges allow. */
export function zoomCrop(crop: KitCrop, zoom: number, photo: Size): KitCrop {
  return clampCrop({ ...crop, zoom }, photo)
}

/** Where the whole picture sits on a square stage `stage` pixels wide, so the ring (the stage's inscribed circle) shows the crop: left, top, width, height in pixels. */
export function stagePlacement(crop: KitCrop, photo: Size, stage: number): { x: number; y: number; w: number; h: number } {
  const held = clampCrop(crop, photo)
  const s = (stage / Math.min(photo.w, photo.h)) * held.zoom
  const w = photo.w * s
  const h = photo.h * s
  return { x: stage / 2 - held.fx * w, y: stage / 2 - held.fy * h, w, h }
}
