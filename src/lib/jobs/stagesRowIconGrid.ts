/**
 * How many icons sit on each row of a Pipeline row's icon block (v2.4305, owner ask): never
 * more than four a row, and the rows split evenly so five read 3 over 2 rather than 4 over a
 * lone 1. Nine or more icons take a third row.
 */
export const STAGES_ROW_ICONS_PER_ROW_MAX = 4

export function stagesRowIconsPerRow(count: number): number {
  if (count <= 0) return 0
  const rows = Math.ceil(count / STAGES_ROW_ICONS_PER_ROW_MAX)
  return Math.ceil(count / rows)
}
