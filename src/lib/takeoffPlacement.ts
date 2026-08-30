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

// --- Fitting derivation (owner ask, 2026-08-30): the joints are free — they fall out
// --- of the traced geometry. Every interior vertex of a run is a TURN (≈90° = elbow,
// --- ≈45° = 45-elbow); every run endpoint landing on another same-system run's body is
// --- a BRANCH (≈90° = tee, ≈45° = wye). Odd angles are flagged, never silently binned.

export type FittingKind = 'ell90' | 'ell45' | 'tee' | 'wye' | 'odd-turn' | 'odd-branch'
export type Fitting = { kind: FittingKind; lineType: string; page: number; at: Pt; angle: number }

const ANGLE_TOL = 20 // degrees either side of 90/45

function classifyAngle(theta: number, turn: boolean): FittingKind {
  if (Math.abs(theta - 90) <= ANGLE_TOL) return turn ? 'ell90' : 'tee'
  if (Math.abs(theta - 45) <= ANGLE_TOL) return turn ? 'ell45' : 'wye'
  return turn ? 'odd-turn' : 'odd-branch'
}

/**
 * Derive fittings from a takeoff's polylines. Same-page, same-lineType only (a branch
 * joins its own system). `joinFeet` is the snap radius for endpoint-to-run joins, in
 * real feet via the page scale — unscaled pages are skipped entirely (lines there are
 * already refused by validation).
 */
export function deriveFittings(t: TakeoffJson, joinFeet = 2): { fittings: Fitting[]; skippedUnscaledPages: number[] } {
  const nameById = new Map(t.lineTypes.map((lt) => [lt.id, lt.name]))
  const fittings: Fitting[] = []
  const skippedUnscaledPages: number[] = []
  const angleBetween = (a: Pt, b: Pt): number => {
    const la = Math.hypot(a.x, a.y)
    const lb = Math.hypot(b.x, b.y)
    if (la === 0 || lb === 0) return 0
    const cos = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (la * lb)))
    return (Math.acos(cos) * 180) / Math.PI
  }
  for (const p of t.pages) {
    const polys = p.polylines ?? []
    if (!polys.length) continue
    const ppu = p.scale?.pixelsPerUnit
    if (!ppu) {
      skippedUnscaledPages.push(p.index)
      continue
    }
    const joinPx = joinFeet * ppu
    // 1) Turns at interior vertices.
    for (const pl of polys) {
      for (let i = 1; i < pl.points.length - 1; i++) {
        const prev = pl.points[i - 1]!
        const v = pl.points[i]!
        const next = pl.points[i + 1]!
        const inDir = { x: v.x - prev.x, y: v.y - prev.y }
        const outDir = { x: next.x - v.x, y: next.y - v.y }
        const theta = angleBetween(inDir, outDir) // 0 = straight through
        if (theta < 15) continue // drawing wobble, not a fitting
        fittings.push({ kind: classifyAngle(theta, true), lineType: nameById.get(pl.lineTypeId) ?? pl.lineTypeId, page: p.index, at: v, angle: Math.round(theta) })
      }
    }
    // 2) Branches: an endpoint of one run on the BODY of another (same system).
    const byType = new Map<string, typeof polys>()
    for (const pl of polys) {
      const list = byType.get(pl.lineTypeId) ?? []
      list.push(pl)
      byType.set(pl.lineTypeId, list)
    }
    for (const [ltId, group] of byType) {
      for (let bi = 0; bi < group.length; bi++) {
        const b = group[bi]!
        for (const [end, dirNext] of [
          [b.points[0]!, b.points[1]!],
          [b.points[b.points.length - 1]!, b.points[b.points.length - 2]!],
        ] as Array<[Pt, Pt]>) {
          const branchDir = { x: dirNext.x - end.x, y: dirNext.y - end.y }
          let best: { dist: number; segDir: Pt; onEndpoint: boolean } | null = null
          for (let ai = 0; ai < group.length; ai++) {
            if (ai === bi) continue
            const a = group[ai]!
            for (let i = 1; i < a.points.length; i++) {
              const s1 = a.points[i - 1]!
              const s2 = a.points[i]!
              const dx = s2.x - s1.x
              const dy = s2.y - s1.y
              const len2 = dx * dx + dy * dy
              const u = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((end.x - s1.x) * dx + (end.y - s1.y) * dy) / len2))
              const proj = { x: s1.x + u * dx, y: s1.y + u * dy }
              const dist = Math.hypot(end.x - proj.x, end.y - proj.y)
              if (!best || dist < best.dist) {
                const nearSegEnd = Math.min(Math.hypot(proj.x - s1.x, proj.y - s1.y), Math.hypot(proj.x - s2.x, proj.y - s2.y))
                const isPolyEndpoint = (i === 1 && u === 0) || (i === a.points.length - 1 && u === 1)
                best = { dist, segDir: { x: dx, y: dy }, onEndpoint: isPolyEndpoint && nearSegEnd < 1 }
              }
            }
          }
          if (!best || best.dist > joinPx) continue
          const theta = angleBetween(branchDir, best.segDir)
          const branchAngle = Math.min(theta, 180 - theta) // vs the run's axis, direction-agnostic
          if (best.onEndpoint) {
            // End-to-end join: a continuation (coupling) or a drawn-in-two-pieces elbow.
            if (branchAngle < 15) continue
            fittings.push({ kind: classifyAngle(branchAngle, true), lineType: nameById.get(ltId) ?? ltId, page: p.index, at: end, angle: Math.round(branchAngle) })
          } else {
            if (branchAngle < 15) continue // running into the pipe axially — a coupling, not a fitting
            fittings.push({ kind: classifyAngle(branchAngle, false), lineType: nameById.get(ltId) ?? ltId, page: p.index, at: end, angle: Math.round(branchAngle) })
          }
        }
      }
    }
    // Dedupe co-located fittings (two detections of the same joint within the snap radius).
    for (let i = fittings.length - 1; i >= 0; i--) {
      const f = fittings[i]!
      if (f.page !== p.index) continue
      for (let j = 0; j < i; j++) {
        const g = fittings[j]!
        if (g.page === p.index && g.lineType === f.lineType && Math.hypot(g.at.x - f.at.x, g.at.y - f.at.y) < joinPx / 2) {
          // Branch beats turn at the same joint (the tee IS the fitting there).
          if ((f.kind === 'tee' || f.kind === 'wye') && (g.kind === 'ell90' || g.kind === 'ell45')) fittings[j] = f
          fittings.splice(i, 1)
          break
        }
      }
    }
  }
  return { fittings, skippedUnscaledPages }
}

/** Per system+kind rollup for reports and materials counts. */
export function fittingSummary(fittings: Fitting[]): Array<{ lineType: string; kind: FittingKind; count: number }> {
  const acc = new Map<string, number>()
  for (const f of fittings) acc.set(`${f.lineType} ${f.kind}`, (acc.get(`${f.lineType} ${f.kind}`) ?? 0) + 1)
  return Array.from(acc.entries())
    .map(([k, count]) => {
      const [lineType, kind] = k.split(' ') as [string, FittingKind]
      return { lineType, kind, count }
    })
    .sort((a, b) => a.lineType.localeCompare(b.lineType) || a.kind.localeCompare(b.kind))
}

const FITTING_LABEL: Record<FittingKind, string> = {
  ell90: '90 Ell',
  ell45: '45 Ell',
  tee: 'Tee',
  wye: 'Wye (45)',
  'odd-turn': 'Odd turn',
  'odd-branch': 'Odd branch',
}

/**
 * Materialize derived fittings as counters + markers on the takeoff (mutates a copy):
 * they become visible, reviewable marks in CountTooling — "CW · Tee", "Sanitary · 90 Ell".
 * Odd angles materialize too (flagged names) so the reviewer sees them on the sheet.
 */
export function materializeFittings(t: TakeoffJson, fittings: Fitting[]): TakeoffJson {
  const out: TakeoffJson = JSON.parse(JSON.stringify(t))
  const counterIdFor = new Map<string, string>()
  for (const f of fittings) {
    const label = `${f.lineType} · ${FITTING_LABEL[f.kind]}`
    let cid = counterIdFor.get(label)
    if (!cid) {
      cid = 'fit-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      counterIdFor.set(label, cid)
      out.counters.push({ id: cid, name: label, color: '#888780' })
    }
    const page = out.pages.find((p) => p.index === f.page)
    if (!page) continue
    const markers = (page.counterMarkers ??= {})
    ;(markers[cid] ??= []).push({ x: f.at.x, y: f.at.y })
  }
  return out
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
