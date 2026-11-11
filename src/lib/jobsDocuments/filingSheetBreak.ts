/**
 * Where a printed paper breaks across sheets, and what the window says about it (punch list #305, v2.6896). Pure.
 *
 * A signature, the statement above it and the notary's block under it are one run a page does not split
 * (`filingKeepTogetherRuns`, v2.6810): when the run does not fit under what comes before it, the print engine moves it
 * whole to the next sheet. That is right, and nobody is told: the office learns the affidavit is two pages at the
 * printer. The window lays the paper out in a hidden frame as wide as the sheet (`filingDocPrintHtml` with `sheet`),
 * `measureFilingSheet` reads how tall it came out and where each run sits, and `filingSheetBreak` walks the runs down
 * the sheets the way the engine does.
 *
 * The walk knows runs, not lines: text above a run breaks wherever a sheet ends. So the count is exact for a paper
 * that is one sheet or a little over, the case that matters, and can be a line off deep into a long paper.
 */

/** The paper as it lay in the frame: its height, the room on one sheet, and each keep-together run, in CSS pixels from the paper's top. */
export type FilingSheetMeasure = { heightPx: number; roomPx: number; runs: ReadonlyArray<{ topPx: number; bottomPx: number }> }

/** How it prints: the sheets it takes, and the sheet its closing (the last run) lands on, with whether it was moved there. */
export type FilingSheetBreak = { pages: number; closing: { page: number; moved: boolean } | null }

/** Layout rounds to 1/64 px: an edge that sits on a sheet's end is on that sheet. */
const EDGE = 0.02

export function filingSheetBreak(m: FilingSheetMeasure | null | undefined): FilingSheetBreak | null {
  if (!m || !(m.heightPx > 0) || !(m.roomPx > 0)) return null
  let pushed = 0
  let closing: FilingSheetBreak['closing'] = null
  for (const run of m.runs) {
    const top = run.topPx + pushed
    const bottom = run.bottomPx + pushed
    const firstSheet = Math.floor((top + EDGE) / m.roomPx)
    const lastSheet = Math.floor((bottom - EDGE) / m.roomPx)
    // A run that crosses a sheet's end starts the next sheet. One taller than a sheet cannot be kept, and splits.
    const moved = lastSheet > firstSheet && bottom - top <= m.roomPx
    if (moved) pushed += (firstSheet + 1) * m.roomPx - top
    closing = { page: (moved ? firstSheet + 1 : lastSheet) + 1, moved }
  }
  return { pages: Math.max(1, Math.ceil((m.heightPx + pushed - EDGE) / m.roomPx)), closing }
}

/** What the window says under the print press. Nothing for a paper on one sheet: there is nothing to warn of. */
export function filingSheetWords(b: FilingSheetBreak | null | undefined): string {
  if (!b || b.pages <= 1) return ''
  const pages = `This paper prints on ${b.pages} pages.`
  if (!b.closing) return pages
  return b.closing.moved
    ? `${pages} The last statement, the signature and the notary’s block moved to page ${b.closing.page} together, so none of it is cut.`
    : `${pages} The signature and the notary’s block are on page ${b.closing.page}.`
}

/** Read the paper laid out by `filingDocPrintHtml(…, { sheet: true })`; null when the frame has no paper or no layout yet. */
export function measureFilingSheet(doc: Document | null | undefined, roomPx: number): FilingSheetMeasure | null {
  const paper = doc?.querySelector('.filing-page tbody td')
  if (!paper) return null
  const box = paper.getBoundingClientRect()
  if (!(box.height > 0)) return null
  const runs = Array.from(paper.querySelectorAll('.filing-keep'), (el) => {
    const r = el.getBoundingClientRect()
    return { topPx: r.top - box.top, bottomPx: r.bottom - box.top }
  })
  return { heightPx: box.height, roomPx, runs }
}
