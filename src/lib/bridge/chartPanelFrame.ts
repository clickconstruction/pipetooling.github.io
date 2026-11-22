/**
 * The frame the Bridge's two chart panels share, Money owed and Crew hours: how each grid of the panel is cut at a
 * desk and on a phone.
 *
 * At a desk the panel is two columns over two columns, and the sources are a four-column table. On a phone that
 * frame does not fit (punch list #334, found on its final walk): the summary column keeps its 260 px, the charts are
 * left 41, and the sources table needs 219 px in a column 164 wide, so its doors hang past the panel's edge and the
 * whole page scrolls sideways, to 404 px at 375 for Money owed and 395 for Crew hours. So on a phone every grid is
 * one column, and a source reads as three lines: its name with its door, where it is read from, what can be wrong.
 *
 * Pure: the panels read `useIsMobile` and draw what this says. The desk frame is the one there was.
 */

export type ChartPanelFrame = {
  /** The panel itself: the charts beside the summary. */
  section: string
  /** The foot: the waterfall beside the sources. */
  foot: string
  /** The sources table. */
  sources: string
  /** True on a phone: a source is stacked, its door beside its name, and the table has no heading row. */
  stacked: boolean
}

const ONE_COLUMN = 'minmax(0, 1fr)'

export const CHART_PANEL_DESK: ChartPanelFrame = {
  section: 'minmax(0, 2fr) minmax(260px, 1fr)',
  foot: 'minmax(0, 1fr) minmax(0, 1.2fr)',
  sources: '90px minmax(0, 1.1fr) minmax(0, 1fr) auto',
  stacked: false,
}

export const CHART_PANEL_PHONE: ChartPanelFrame = {
  section: ONE_COLUMN,
  foot: ONE_COLUMN,
  sources: `${ONE_COLUMN} auto`,
  stacked: true,
}

export function chartPanelFrame(phone: boolean): ChartPanelFrame {
  return phone ? CHART_PANEL_PHONE : CHART_PANEL_DESK
}

/** The least width a grid's fixed tracks ask for, in px: every `Npx` in its template, a `minmax(Npx, …)` floor among them. */
export function fixedTrackFloorPx(template: string): number {
  let sum = 0
  for (const m of template.matchAll(/(\d+(?:\.\d+)?)px/g)) sum += Number(m[1])
  return sum
}
