/**
 * Placement engine v0 coordinate kernel (estimator-twin pipeline Wave 3.4).
 *
 * The vision model IS the engine: it reads rotated crops of plan sheets and names where
 * fixture tags sit. This kernel owns the deterministic half — mapping what the model read
 * back into CountTooling's base frame, and assembling/validating a takeoff.json the
 * import-takeoff contract accepts (CT TAKEOFF_IMPORT.md; procedure docs/twins/PLACEMENT.md).
 *
 * Frames:
 *  - RAW page pixels at a render DPI — pdftoppm's frame (pre-rotation), origin top-left.
 *  - READABLE crop pixels — the crop image after the kit's 90° CW rotation for reading.
 *  - CT base frame — PDF points at scale 1, rotation 0 (1 unit = 1/72 inch). This is what
 *    import-takeoff stores; converting: pt = px_raw * 72 / dpi.
 */

export type Pt = { x: number; y: number }

/** RAW page px → CT base frame (PDF points). */
export function rawPxToBasePt(p: Pt, dpi: number): Pt {
  if (!(dpi > 0)) throw new Error('dpi must be positive')
  return { x: (p.x * 72) / dpi, y: (p.y * 72) / dpi }
}

/**
 * A point read off a 90° CW-rotated crop image → RAW page px.
 * The crop was taken at (cropX, cropY, cropW, cropH) in RAW px; after CW rotation the
 * readable image is cropH wide × cropW tall, and readable (xr, yr) came from raw
 * (x = cropX + xr' , y = cropY + yr') with xr' = yr, yr' = cropH - 1 - xr… expressed
 * continuously (sub-pixel aims don't need the -1):
 *   x_raw = cropX + y_readable
 *   y_raw = cropY + (cropH - x_readable)
 */
export function readablePtToRawPx(p: Pt, crop: { x: number; y: number; w: number; h: number }): Pt {
  return { x: crop.x + p.y, y: crop.y + (crop.h - p.x) }
}

/** Overview bbox (low-DPI readable frame) → crop-pass RAW px rect, per EXTRACTOR.md math. */
export function overviewBoxToRawRect(
  box: { x: number; y: number; w: number; h: number },
  overviewDpi: number,
  cropDpi: number,
  rawPageHeightAtOverviewDpi: number,
): { x: number; y: number; w: number; h: number } {
  const k = cropDpi / overviewDpi
  return {
    x: box.y * k,
    y: (rawPageHeightAtOverviewDpi - (box.x + box.w)) * k,
    w: box.h * k,
    h: box.w * k,
  }
}

// --- takeoff.json assembly + local validation (mirror of import-takeoff's checks, so an
// --- agent's rejection happens on its own machine with the same field-naming errors) ---

export type PlacedMark = { counterId: string; pageIndex: number; raw: Pt; dpi: number }
export type PlacedNote = { pageIndex: number; raw: Pt; dpi: number; text: string }

export type TakeoffCounter = { id: string; name: string; color?: string }
export type TakeoffLineType = { id: string; name: string; color?: string }

export type TakeoffJson = {
  version: 1
  counters: TakeoffCounter[]
  lineTypes: TakeoffLineType[]
  pages: Array<{
    index: number
    label?: string
    scale?: { pixelsPerUnit: number; unit: string } | null
    counterMarkers?: Record<string, Pt[]>
    notes?: Array<Pt & { text: string }>
  }>
}

export function assembleTakeoff(input: {
  counters: TakeoffCounter[]
  lineTypes?: TakeoffLineType[]
  marks: PlacedMark[]
  notes?: PlacedNote[]
  pageLabels?: Record<number, string>
  pageScales?: Record<number, { pixelsPerUnit: number; unit: string }>
}): TakeoffJson {
  const byPage = new Map<number, { counterMarkers: Record<string, Pt[]>; notes: Array<Pt & { text: string }> }>()
  const pageEntry = (i: number) => {
    let e = byPage.get(i)
    if (!e) {
      e = { counterMarkers: {}, notes: [] }
      byPage.set(i, e)
    }
    return e
  }
  for (const m of input.marks) {
    const e = pageEntry(m.pageIndex)
    const list = (e.counterMarkers[m.counterId] ??= [])
    list.push(rawPxToBasePt(m.raw, m.dpi))
  }
  for (const n of input.notes ?? []) {
    pageEntry(n.pageIndex).notes.push({ ...rawPxToBasePt(n.raw, n.dpi), text: n.text })
  }
  const pages = Array.from(byPage.keys()).sort((a, b) => a - b).map((index) => ({
    index,
    label: input.pageLabels?.[index],
    scale: input.pageScales?.[index] ?? null,
    counterMarkers: byPage.get(index)!.counterMarkers,
    notes: byPage.get(index)!.notes,
  }))
  return { version: 1, counters: input.counters, lineTypes: input.lineTypes ?? [], pages }
}

/** Same rules import-takeoff enforces; returns problems (empty = will not be rejected). */
export function validateTakeoff(t: TakeoffJson, pdfPageCount?: number): string[] {
  const problems: string[] = []
  if (t.version !== 1) problems.push('takeoff.version: must be 1')
  if (!t.pages.length || t.pages.length > 200) problems.push('takeoff.pages: 1..200 pages')
  const counterIds = new Set<string>()
  for (const c of t.counters) {
    if (!c.id || !c.name?.trim()) problems.push('takeoff.counters: each needs id + name')
    else if (counterIds.has(c.id)) problems.push(`takeoff.counters: duplicate id ${c.id}`)
    counterIds.add(c.id)
  }
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
  for (const p of t.pages) {
    if (!Number.isInteger(p.index) || p.index < 0) problems.push('takeoff.pages[].index: non-negative integer required')
    if (pdfPageCount != null && p.index >= pdfPageCount) problems.push(`takeoff.pages[${p.index}].index: beyond the PDF's page count (${pdfPageCount})`)
    if (p.scale != null && !(num(p.scale.pixelsPerUnit) && p.scale.pixelsPerUnit > 0)) {
      problems.push(`takeoff.pages[${p.index}].scale.pixelsPerUnit: must be a positive number when scale is given`)
    }
    for (const [cid, marks] of Object.entries(p.counterMarkers ?? {})) {
      if (!counterIds.has(cid)) problems.push(`takeoff.pages[${p.index}].counterMarkers: unknown counter id ${cid}`)
      for (const m of marks) if (!num(m.x) || !num(m.y)) problems.push(`takeoff.pages[${p.index}].counterMarkers.${cid}: each mark needs numeric x,y`)
    }
    for (const n of p.notes ?? []) {
      if (!num(n.x) || !num(n.y) || !n.text?.trim()) problems.push(`takeoff.pages[${p.index}].notes: each note needs x,y,text`)
    }
  }
  return problems
}

/**
 * The engine's self-check (counters prove out): placed counts per counter NAME vs the
 * substrate fixture schedule's expectation. A schedule without quantities (qty null)
 * contributes presence-only rows — placed 0 of a scheduled tag is still a miss.
 */
export function countsVsSchedule(
  t: TakeoffJson,
  schedule: Array<{ tag: string; qty: number | null }>,
): Array<{ tag: string; placed: number; scheduled: number | null; ok: boolean }> {
  const nameById = new Map(t.counters.map((c) => [c.id, c.name]))
  const placed = new Map<string, number>()
  for (const p of t.pages) {
    for (const [cid, marks] of Object.entries(p.counterMarkers ?? {})) {
      const name = nameById.get(cid) ?? cid
      placed.set(name, (placed.get(name) ?? 0) + marks.length)
    }
  }
  const rows = schedule.map((s) => {
    const n = placed.get(s.tag) ?? 0
    return { tag: s.tag, placed: n, scheduled: s.qty, ok: s.qty == null ? n > 0 : n === s.qty }
  })
  const scheduledTags = new Set(schedule.map((s) => s.tag))
  for (const [name, n] of placed) {
    if (!scheduledTags.has(name)) rows.push({ tag: name, placed: n, scheduled: null, ok: false })
  }
  return rows
}
