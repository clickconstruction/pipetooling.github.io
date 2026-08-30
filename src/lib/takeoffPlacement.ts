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

// --- Scale calibration: doorways are the ruler (owner rule, 2026-08-30) ---
// Stated scales lie on reduced prints and can CHANGE PER PAGE. Doorways are the field-
// proven standard: a door opening is always 3 feet, every plan sheet has several, and
// many samples per page make the calibration self-verifying (median + outlier flags).

/** One measured span (raw px at `dpi`) of known real feet → base-frame px per foot. */
export function pixelsPerUnitFromSpan(a: Pt, b: Pt, feet: number, dpi: number): number {
  if (!(feet > 0) || !(dpi > 0)) throw new Error('feet and dpi must be positive')
  const pa = rawPxToBasePt(a, dpi)
  const pb = rawPxToBasePt(b, dpi)
  return Math.hypot(pb.x - pa.x, pb.y - pa.y) / feet
}

export type DoorSample = { a: Pt; b: Pt }

/**
 * Per-page scale from door-opening measurements (raw px at `dpi`, each spanning one
 * door opening jamb-to-jamb). Median wins; samples > tolerancePct off the median are
 * flagged (a mis-measured door, a non-standard opening) — remeasure or drop them.
 */
export function calibrateFromDoors(
  doors: DoorSample[],
  dpi: number,
  doorFeet = 3,
  tolerancePct = 10,
): { pixelsPerUnit: number; samples: number[]; outliers: number[] } {
  if (!doors.length) throw new Error('at least one door sample required')
  const samples = doors.map((d) => pixelsPerUnitFromSpan(d.a, d.b, doorFeet, dpi))
  const sorted = [...samples].sort((x, y) => x - y)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
  const outliers = samples
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => Math.abs(s - median) / median > tolerancePct / 100)
    .map(({ i }) => i)
  return { pixelsPerUnit: median, samples, outliers }
}

// --- takeoff.json assembly + local validation (mirror of import-takeoff's checks, so an
// --- agent's rejection happens on its own machine with the same field-naming errors) ---

export type PlacedMark = { counterId: string; pageIndex: number; raw: Pt; dpi: number }
export type PlacedNote = { pageIndex: number; raw: Pt; dpi: number; text: string }
/** A traced pipe run: vertices in RAW page px at `dpi`, in drawing order. */
export type PlacedLine = { lineTypeId: string; pageIndex: number; dpi: number; points: Pt[] }

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
    polylines?: Array<{ points: Pt[]; lineTypeId: string }>
    notes?: Array<Pt & { text: string }>
  }>
}

export function assembleTakeoff(input: {
  counters: TakeoffCounter[]
  lineTypes?: TakeoffLineType[]
  marks: PlacedMark[]
  lines?: PlacedLine[]
  notes?: PlacedNote[]
  pageLabels?: Record<number, string>
  pageScales?: Record<number, { pixelsPerUnit: number; unit: string }>
  /** Raw door-opening spans per page — per-page scale computed via calibrateFromDoors (3 ft doors). Explicit pageScales win. */
  doorSamples?: Record<number, { dpi: number; doors: DoorSample[] }>
}): TakeoffJson {
  const byPage = new Map<number, { counterMarkers: Record<string, Pt[]>; polylines: Array<{ points: Pt[]; lineTypeId: string }>; notes: Array<Pt & { text: string }> }>()
  const pageEntry = (i: number) => {
    let e = byPage.get(i)
    if (!e) {
      e = { counterMarkers: {}, polylines: [], notes: [] }
      byPage.set(i, e)
    }
    return e
  }
  for (const m of input.marks) {
    const e = pageEntry(m.pageIndex)
    const list = (e.counterMarkers[m.counterId] ??= [])
    list.push(rawPxToBasePt(m.raw, m.dpi))
  }
  for (const l of input.lines ?? []) {
    pageEntry(l.pageIndex).polylines.push({ points: l.points.map((p) => rawPxToBasePt(p, l.dpi)), lineTypeId: l.lineTypeId })
  }
  for (const n of input.notes ?? []) {
    pageEntry(n.pageIndex).notes.push({ ...rawPxToBasePt(n.raw, n.dpi), text: n.text })
  }
  const scaleFor = (index: number): { pixelsPerUnit: number; unit: string } | null => {
    const explicit = input.pageScales?.[index]
    if (explicit) return explicit
    const ds = input.doorSamples?.[index]
    if (ds?.doors?.length) return { pixelsPerUnit: calibrateFromDoors(ds.doors, ds.dpi).pixelsPerUnit, unit: 'ft' }
    return null
  }
  const pages = Array.from(byPage.keys()).sort((a, b) => a - b).map((index) => ({
    index,
    label: input.pageLabels?.[index],
    scale: scaleFor(index),
    counterMarkers: byPage.get(index)!.counterMarkers,
    polylines: byPage.get(index)!.polylines,
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
  const lineTypeIds = new Set<string>()
  for (const lt of t.lineTypes) {
    if (!lt.id || !lt.name?.trim()) problems.push('takeoff.lineTypes: each needs id + name')
    else if (lineTypeIds.has(lt.id)) problems.push(`takeoff.lineTypes: duplicate id ${lt.id}`)
    lineTypeIds.add(lt.id)
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
    for (const pl of p.polylines ?? []) {
      if (!lineTypeIds.has(pl.lineTypeId)) problems.push(`takeoff.pages[${p.index}].polylines: unknown lineTypeId ${pl.lineTypeId}`)
      if (!Array.isArray(pl.points) || pl.points.length < 2) problems.push(`takeoff.pages[${p.index}].polylines: points needs >= 2 {x,y}`)
      else for (const m of pl.points) if (!num(m.x) || !num(m.y)) problems.push(`takeoff.pages[${p.index}].polylines: each point needs numeric x,y`)
      if (pl.points?.length >= 2 && p.scale == null) problems.push(`takeoff.pages[${p.index}]: polylines without a page scale have meaningless lengths — calibrate (doorways are 3 ft) before tracing lines`)
    }
    for (const n of p.notes ?? []) {
      if (!num(n.x) || !num(n.y) || !n.text?.trim()) problems.push(`takeoff.pages[${p.index}].notes: each note needs x,y,text`)
    }
  }
  return problems
}

/** Feet per line-type NAME using each page's calibrated scale (takeoff-eval's denomination). */
export function feetByLineType(t: TakeoffJson): Array<{ lineType: string; feet: number; runs: number }> {
  const nameById = new Map(t.lineTypes.map((lt) => [lt.id, lt.name]))
  const acc = new Map<string, { feet: number; runs: number }>()
  for (const p of t.pages) {
    const ppu = p.scale?.pixelsPerUnit
    if (!ppu) continue
    for (const pl of p.polylines ?? []) {
      let px = 0
      for (let i = 1; i < pl.points.length; i++) {
        px += Math.hypot(pl.points[i]!.x - pl.points[i - 1]!.x, pl.points[i]!.y - pl.points[i - 1]!.y)
      }
      const name = nameById.get(pl.lineTypeId) ?? pl.lineTypeId
      const e = acc.get(name) ?? { feet: 0, runs: 0 }
      e.feet += px / ppu
      e.runs += 1
      acc.set(name, e)
    }
  }
  return Array.from(acc.entries()).map(([lineType, e]) => ({ lineType, feet: Math.round(e.feet * 10) / 10, runs: e.runs }))
}

/**
 * Connectivity self-check: every placed fixture should have a pipe run nearby — a WC
 * with no line within reach is a tracing miss. Distance is point-to-segment in base px,
 * converted to feet via the page scale; marks on unscaled pages are skipped (reported).
 */
export function marksFarFromLines(
  t: TakeoffJson,
  maxFeet = 6,
): { far: Array<{ counter: string; page: number; feet: number }>; skippedUnscaled: number } {
  const nameById = new Map(t.counters.map((c) => [c.id, c.name]))
  const far: Array<{ counter: string; page: number; feet: number }> = []
  let skippedUnscaled = 0
  const segDist = (m: Pt, a: Pt, b: Pt): number => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const u = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((m.x - a.x) * dx + (m.y - a.y) * dy) / len2))
    return Math.hypot(m.x - (a.x + u * dx), m.y - (a.y + u * dy))
  }
  for (const p of t.pages) {
    const marks = Object.entries(p.counterMarkers ?? {})
    if (!marks.length) continue
    const ppu = p.scale?.pixelsPerUnit
    if (!ppu) {
      skippedUnscaled += marks.reduce((n, [, ms]) => n + ms.length, 0)
      continue
    }
    const segs: Array<[Pt, Pt]> = []
    for (const pl of p.polylines ?? []) {
      for (let i = 1; i < pl.points.length; i++) segs.push([pl.points[i - 1]!, pl.points[i]!])
    }
    for (const [cid, ms] of marks) {
      for (const m of ms) {
        const best = segs.length ? Math.min(...segs.map(([a, b]) => segDist(m, a, b))) : Infinity
        const feet = best / ppu
        if (feet > maxFeet) far.push({ counter: nameById.get(cid) ?? cid, page: p.index, feet: Math.round(feet * 10) / 10 })
      }
    }
  }
  return { far, skippedUnscaled }
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
