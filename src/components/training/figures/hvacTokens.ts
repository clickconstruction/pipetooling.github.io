/**
 * The tints and widths of the HVAC drawings (the Intro to HVAC course), in a file of their own so the parts file
 * exports components only (React fast refresh). See `hvacParts.tsx` for the drawing language.
 */

export type AirTint = 'warm' | 'cool' | 'room'

/**
 * Air is a block arrow filled with its tint: warm air the plumbing's hot red, cooled air its cold blue, room air the
 * surface. The same two tints mark the refrigerant in its line, hot on the high side and cold on the low side, so a
 * reader learns one pair of colours for heat in the whole course.
 */
export const AIR: Record<AirTint, string> = {
  warm: 'var(--bg-red-100)',
  cool: 'var(--bg-blue-200)',
  room: 'var(--surface)',
}

/** A refrigerant line's bore: thinner than a supply pipe, so copper for refrigerant never reads as copper for water. */
export const LINE = 3.4

/** The big line of the line set, the cold one that comes back to the compressor. */
export const SUCTION = 5

/** A duct's width: wider than a drain, so air reads as the biggest thing in a drawing. */
export const DUCT = 16

/** The flame's orange, as `WaterHeaterCutaway` draws its burner. */
export const FLAME = '#f97316'
