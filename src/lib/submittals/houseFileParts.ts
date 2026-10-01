/**
 * The house's own file builds the parts (2026-10-01). A supply house's submittal PDF — National
 * Wholesale's for BP375 is the shape — is already a parts list: a contents page, a divider page
 * per tag listing its parts and the page each starts on ("<job> DWH-1 VENDOR PART VENDOR
 * DESCRIPTION PAGE PROPH40 T2 RH400 Rheem ProTerra … 6 LFN36-M1 Watts … 10"), and on every cut
 * sheet page a stamp naming the tag, the maker and the model ("<job> WC-1 & WC-2 Toto |
 * TET2LBi31#SS …"). `readHouseFile` reads that into the file's parts, each with its pages;
 * `matchFileToRows` sets them beside the rows' parts — the same part, a different part in its
 * place, a part nobody priced, a priced part the file does not carry — so the estimator says
 * what the file changes before anything is written. Pure; pdf.js text in, words out.
 */
import { normalizeText, textHasModel } from './assignPagesWalk'
import type { SubmittalPartRow } from './itemParts'
import { TRIM_NAME } from './takeoffCandidates'

export type HouseFilePart = {
  /** The tag as the file prints it ("WC-1 & WC-2"). */
  tag: string
  maker: string
  model: string
  /** The words after the model on the divider ("Ecopower Touchless 1.28 Gpf …"); '' when none was found. */
  description: string
  /** Maker, model and description in capitals, the way the takeoff names a part. */
  label: string
  /** 1-based pages of the file. */
  pages: number[]
  /** The text of the part's first page, for telling what kind of part it is. */
  firstPageText: string
}

export type HouseFileRead = {
  /** The job line stamped on the pages ("SPACEX BA-2 CORE & SHELL"). */
  header: string
  /** The tags in file order. */
  tags: string[]
  parts: HouseFilePart[]
}

const collapse = (t: string | null | undefined) => (t ?? '').replace(/\s+/g, ' ').trim()
const DIVIDER = /^(.{2,40}?) VENDOR PART VENDOR DESCRIPTION PAGE /i
const TAG_RE = /^([A-Z]{1,5}-?\d{1,3}[A-Z]?(?:\s*(?:&|,|and)\s*[A-Z]{1,5}-?\d{1,3}[A-Z]?)*)(?=\s|$)/i
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The words most pages start with, as printed: the pages sharing their first two words, when they are at least half the file, cut at a word. */
export function rawCommonHeader(texts: ReadonlyArray<string>): string {
  const pages = texts.map(collapse).filter((t) => t.length >= 20)
  if (pages.length < 2) return ''
  const keyOf = (t: string) => t.split(' ').slice(0, 2).join(' ')
  const counts = new Map<string, number>()
  for (const t of pages) counts.set(keyOf(t), (counts.get(keyOf(t)) ?? 0) + 1)
  const [key, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!
  if (n < 2 || n * 2 < pages.length) return ''
  const shared = pages.filter((t) => keyOf(t) === key)
  let prefix = shared[0]!
  for (const t of shared.slice(1)) {
    let i = 0
    while (i < prefix.length && i < t.length && prefix[i] === t[i]) i += 1
    prefix = prefix.slice(0, i)
  }
  const cut = prefix.lastIndexOf(' ')
  return cut > 0 ? prefix.slice(0, cut + 1) : ''
}

/** The model as a loose pattern: its letters and digits in order, anything else between ("PROPH40-T2" ~ "PROPH40 T2"). */
function modelPattern(model: string): RegExp | null {
  const chunks = model.split(/[^A-Za-z0-9]+/).filter(Boolean)
  return chunks.length > 0 ? new RegExp(chunks.map(escapeRe).join('[^A-Za-z0-9]*'), 'i') : null
}

/**
 * The divider's line for a part: the model as the divider prints it (it may run on —
 * "PROPH40 T2 RH400" where the page stamp says "PROPH40"), and the description between the
 * maker and the start page.
 */
function dividerLine(text: string, maker: string, model: string, firstPage: number): { model: string; description: string } | null {
  const re = modelPattern(model)
  if (!re) return null
  const m = re.exec(text)
  if (!m) return null
  let rest = text.slice(m.index + m[0].length)
  let fullModel = text.slice(m.index, m.index + m[0].length)
  const at = maker ? rest.toLowerCase().indexOf(maker.toLowerCase()) : -1
  if (at >= 0 && at <= 30) {
    fullModel = `${fullModel}${rest.slice(0, at)}`.trim()
    rest = rest.slice(at + maker.length)
  }
  const end = new RegExp(`\\s${firstPage}(?:\\s|$)`).exec(rest)
  const description = (end ? rest.slice(0, end.index) : rest.slice(0, 160)).replace(/^[\s\-–—|,]+/, '').trim()
  return { model: fullModel.replace(/\s+/g, ' ').trim(), description: description.slice(0, 200) }
}

/**
 * Read a house's submittal file into its parts. Null when the file has no stamped header or no
 * part could be read — a plain PDF of cut sheets is for Assign pages, not for this.
 * `texts[0]` is page 1.
 */
export function readHouseFile(texts: ReadonlyArray<string>): HouseFileRead | null {
  const pages = texts.map(collapse)
  const header = rawCommonHeader(pages)
  if (!header) return null
  const dividerTags = new Map<string, string>()
  pages.forEach((t) => {
    if (!t.startsWith(header)) return
    const m = DIVIDER.exec(t.slice(header.length))
    if (m && /\d/.test(m[1]!) && !/table of contents/i.test(m[1]!)) dividerTags.set(m[1]!.trim(), t)
  })
  const known = [...dividerTags.keys()].sort((a, b) => b.length - a.length)
  type Draft = { tag: string; maker: string; model: string; key: string; pages: number[]; firstPageText: string }
  const drafts: Draft[] = []
  let current: Draft | null = null
  let started = false
  pages.forEach((t, i) => {
    const page = i + 1
    if (t.length < 20) {
      // A scan inside a part's run (no text) stays with the part it sits in.
      if (current) current.pages.push(page)
      return
    }
    if (!t.startsWith(header)) {
      current = null
      return
    }
    const rest = t.slice(header.length)
    if (DIVIDER.test(rest)) {
      started = true
      current = null
      return
    }
    const tag = known.find((k) => rest.startsWith(`${k} `)) ?? (started ? TAG_RE.exec(rest)?.[1] ?? null : null)
    if (!tag) {
      if (current) current.pages.push(page)
      return
    }
    started = true
    const after = rest.slice(tag.length).trim()
    const bar = after.indexOf('|')
    let maker = ''
    let model = ''
    if (bar > 0 && bar <= 60) {
      maker = after.slice(0, bar).trim()
      model = (after.slice(bar + 1).trim().split(' ')[0] ?? '').replace(/[,;:]+$/, '')
    } else if (current && current.tag === tag) {
      current.pages.push(page)
      return
    } else {
      model = (after.split(' ')[0] ?? '').replace(/[,;:]+$/, '')
    }
    const key = `${tag}|${normalizeText(model).trim()}`
    if (current && current.key === key) {
      current.pages.push(page)
      return
    }
    current = { tag, maker, model, key, pages: [page], firstPageText: t }
    drafts.push(current)
  })
  if (drafts.length === 0) return null
  const contents = pages.filter((t) => /table of contents/i.test(t)).join(' ')
  const parts: HouseFilePart[] = drafts.map((d) => {
    const line = dividerLine(dividerTags.get(d.tag) ?? '', d.maker, d.model, d.pages[0]!) ?? dividerLine(contents, d.maker, d.model, d.pages[0]!)
    const model = line?.model || d.model
    const description = line?.description ?? ''
    const label = [d.maker, model, description].filter(Boolean).join(' ').replace(/\s+/g, ' ').toUpperCase().slice(0, 300)
    return { tag: d.tag, maker: d.maker, model, description, label, pages: d.pages, firstPageText: d.firstPageText }
  })
  const tags: string[] = []
  for (const p of parts) if (!tags.includes(p.tag)) tags.push(p.tag)
  return { header: header.trim(), tags, parts }
}

// ---------- beside the rows ----------

/** "WC-1 & WC-2" · "WC-1, WC-2" · "WC 1&2" → the set {WC 1, WC 2}; a word with no number is no tag. */
export function tagSet(tag: string): string[] {
  const out = new Set<string>()
  for (const piece of tag.split(/[,&/]|\band\b/i)) {
    const n = normalizeText(piece).trim()
    if (n && /\d/.test(n)) out.add(n)
  }
  // "WC 1&2": the second number borrows the letters of the first.
  const first = [...out][0]
  if (first) {
    const letters = /^([A-Z]+) /.exec(first)?.[1]
    if (letters) for (const n of [...out]) if (/^\d/.test(n)) {
      out.delete(n)
      out.add(`${letters} ${n}`)
    }
  }
  return [...out].sort()
}

/** What kind of part a name describes, when its words say so. */
const ROLES: Array<[string, RegExp]> = [
  ['flush valve', /FLUSHOMETER VALVE|FLUSH ?VALVE/],
  ['seat', /\bSEAT\b/],
  ['carrier', /CARRIER/],
  ['mixing valve', /MIXING|TEMPERATURE LIMITING|THERMOSTATIC/],
  ['soap', /\bSOAP\b/],
  ['faucet', /FAUCET|\bSPOUT\b/],
  ['drain', /GRID|DRAIN|TAIL ?PIECE|TAILPIECE/],
  ['supply', /SUPPLY|\bSTOPS?\b|\bANG\b|\bSP-KT\b/],
  ['trap', /\bP-?\s*TRAPS?\b|\bTRAPS?\b(?!\s*PRIMER)|\bTRP\b/],
  ['flange', /FLANGE|ESCUTCHEON/],
  ['urinal', /URINAL/],
  ['toilet', /TOILET|WATER CLOSET/],
  ['lavatory', /LAVATORY|\bLAV\b|BASIN|\bSINK\b/],
  ['water heater', /WATER HEATER|HEAT PUMP/],
  ['expansion tank', /EXPANSION TANK|THERM-?X-?TROL/],
  ['relief valve', /RELIEF VALVE/],
  ['pressure valve', /PRESSURE REDUCING/],
  ['circulator', /CIRC|CIRCULATOR|\bPUMP\b/],
  ['cooler', /COOLER|BOTTLE FILL/],
]
export function partRole(text: string): string | null {
  const t = text.toUpperCase()
  for (const [role, re] of ROLES) if (re.test(t)) return role
  return null
}

/** The tokens of a name worth matching a model on: a digit in them and four characters or more. */
function modelTokens(text: string): string[] {
  return normalizeText(text).trim().split(' ').filter((t) => t.length >= 4 && /\d/.test(t))
}

export type FilePartKind = 'same' | 'different' | 'not_priced'

export type FilePartMatch = {
  file: HouseFilePart
  kind: FilePartKind
  /** The row's part it stands beside: the same one, or the one it takes the place of. */
  rowPart: SubmittalPartRow | null
}

export type FileTagMatch = {
  tag: string
  /** The rows this tag lands on: one, or every split row of a combined tag. */
  itemIds: string[]
  /** How the rows were found: by tag, or (no row by that tag) by its parts — a row to rename. */
  how: 'tag' | 'parts' | null
  parts: FilePartMatch[]
  /** The row's parts the file does not carry. */
  notInFile: SubmittalPartRow[]
}

type RowLike = { id: string; tag: string }

/**
 * Pair one tag's file parts with a row's parts: the same model first; then the same kind of part
 * (a drain for a drain); then a shared model start of four characters (TET2LBi31 for TET2UB31);
 * then, when exactly one is left on each side, those two.
 */
export function pairParts(fileParts: ReadonlyArray<HouseFilePart>, rowParts: ReadonlyArray<SubmittalPartRow>): { parts: FilePartMatch[]; notInFile: SubmittalPartRow[] } {
  const taken = new Set<string>()
  const out: FilePartMatch[] = fileParts.map((file) => ({ file, kind: 'not_priced' as FilePartKind, rowPart: null }))
  const free = () => rowParts.filter((p) => !taken.has(p.id))
  // 1 · the same model
  for (const m of out) {
    const toks = modelTokens(m.file.model)
    const hit = free().find((p) => toks.some((t) => textHasModel(normalizeText(p.label), t)))
    if (hit) {
      m.kind = 'same'
      m.rowPart = hit
      taken.add(hit.id)
    }
  }
  // 2 · the same kind of part
  for (const m of out.filter((x) => !x.rowPart)) {
    // The divider's words first; the page's own first words only when they say nothing.
    const role = partRole(m.file.description) ?? partRole(m.file.firstPageText.slice(0, 220))
    if (!role) continue
    const hit = free().find((p) => partRole(p.label) === role)
    if (hit) {
      m.kind = 'different'
      m.rowPart = hit
      taken.add(hit.id)
    }
  }
  // 3 · a shared start of the model
  for (const m of out.filter((x) => !x.rowPart)) {
    const fileModel = normalizeText(m.file.model).replace(/ /g, '')
    const hit = free().find((p) => modelTokens(p.label).some((t) => {
      let i = 0
      while (i < t.length && i < fileModel.length && t[i] === fileModel[i]) i += 1
      return i >= 4
    }))
    if (hit) {
      m.kind = 'different'
      m.rowPart = hit
      taken.add(hit.id)
    }
  }
  // 4 · one left on each side (trim aside)
  const openFile = out.filter((x) => !x.rowPart)
  const openRow = free().filter((p) => !TRIM_NAME.test(p.label))
  if (openFile.length === 1 && openRow.length === 1) {
    openFile[0]!.kind = 'different'
    openFile[0]!.rowPart = openRow[0]!
    taken.add(openRow[0]!.id)
  }
  return { parts: out, notInFile: free() }
}

/**
 * Every tag of the file beside the rows: a tag lands on the rows that carry it (a combined
 * tag on each of its split rows); a tag no row carries looks for the row whose parts share the
 * most models with it (the row named "12" DEEP MOP SINK" for MB-1) — a row to rename; else it
 * stands alone, a row to add.
 */
export function matchFileToRows(read: HouseFileRead, rows: ReadonlyArray<RowLike>, partsByItem: ReadonlyMap<string, ReadonlyArray<SubmittalPartRow>>): FileTagMatch[] {
  const byTag = new Map<string, HouseFilePart[]>()
  for (const p of read.parts) byTag.set(p.tag, [...(byTag.get(p.tag) ?? []), p])
  const claimed = new Set<string>()
  const out: FileTagMatch[] = []
  for (const tag of read.tags) {
    const want = tagSet(tag)
    const hits = rows.filter((r) => {
      const have = tagSet(r.tag)
      return have.length > 0 && have.every((t) => want.includes(t))
    })
    for (const r of hits) claimed.add(r.id)
    out.push({ tag, itemIds: hits.map((r) => r.id), how: hits.length > 0 ? 'tag' : null, parts: [], notInFile: [] })
  }
  for (const m of out.filter((x) => x.itemIds.length === 0)) {
    const fileParts = byTag.get(m.tag) ?? []
    let best: { id: string; n: number } | null = null
    for (const r of rows) {
      if (claimed.has(r.id)) continue
      const rp = partsByItem.get(r.id) ?? []
      const n = fileParts.filter((f) => modelTokens(f.model).some((t) => rp.some((p) => textHasModel(normalizeText(p.label), t)))).length
      if (n > 0 && (!best || n > best.n)) best = { id: r.id, n }
    }
    if (best) {
      m.itemIds = [best.id]
      m.how = 'parts'
      claimed.add(best.id)
    }
  }
  for (const m of out) {
    const fileParts = byTag.get(m.tag) ?? []
    const first = m.itemIds[0]
    const paired = pairParts(fileParts, first ? partsByItem.get(first) ?? [] : [])
    m.parts = paired.parts
    m.notInFile = first ? paired.notInFile : []
  }
  return out
}

/** "14 the same · 15 a different part · 3 not priced" over every tag. */
export function fileMatchCounts(matches: ReadonlyArray<FileTagMatch>): Record<FilePartKind, number> {
  const c: Record<FilePartKind, number> = { same: 0, different: 0, not_priced: 0 }
  for (const m of matches) for (const p of m.parts) c[p.kind] += 1
  return c
}

// ---------- what Use the file's parts writes ----------

/** The estimator's say on one tag, in the review before anything is written. */
export type FileTagChoice = {
  /** Use this tag's parts at all. */
  use: boolean
  /** Per file part (its index among the tag's parts): the row part it takes the place of; null = a part of its own. */
  inPlaceOf: Record<number, string | null>
  /** Per row part the file does not carry: keep it, as order only; else it comes off. */
  keep: Record<string, boolean>
  /** A tag no row carries: add it as a row. */
  addRow: boolean
  /** A row found by its parts: give it the file's tag. */
  rename: boolean
}

/** The review's starting point: the pairing the reader made; trim and order-only parts kept, any other part the file drops taken off. */
export function defaultFileChoice(m: FileTagMatch): FileTagChoice {
  const inPlaceOf: Record<number, string | null> = {}
  m.parts.forEach((p, i) => {
    inPlaceOf[i] = p.rowPart?.id ?? null
  })
  const keep: Record<string, boolean> = {}
  for (const p of m.notInFile) keep[p.id] = !p.on_submittal || TRIM_NAME.test(p.label)
  return { use: true, inPlaceOf, keep, addRow: m.itemIds.length === 0, rename: m.how === 'parts' }
}

export type FilePartWrite = {
  label: string
  manufacturer: string | null
  model: string | null
  description: string | null
  on_submittal: true
  source: 'file'
  supply_house_id: string | null
  sheet_file: number
  sheet_pages: number[]
}

export type FileApplyPlan = {
  itemId: string
  /** Row parts the file's parts take the place of: rewritten as the file's part. */
  updates: Array<{ partId: string; patch: FilePartWrite & { sequence_order: number; priced_label?: string | null; part_id?: null } }>
  /** File parts that stand beside nothing on the row. */
  inserts: Array<FilePartWrite & { sequence_order: number }>
  /** Row parts the file does not carry and the estimator took off. */
  deletes: string[]
  /** Row parts the file does not carry, kept: order only, after the file's parts. */
  keptOrderOnly: Array<{ partId: string; sequence_order: number }>
  /** The row: the file's pages as its sheet, and the file's tag when renamed. */
  rowPatch: { sheet_file: number; sheet_pages: number[]; sheet_source: 'house'; tag?: string }
}

/**
 * What one tag writes on one row, from the review's choices. A file part in place of a row part
 * rewrites that part (same model: its priced name stays as it was; another model: the takeoff's
 * name is kept as what was priced, and the catalog link goes); a file part beside nothing is a
 * new part; a row part the file does not carry is kept as order only, or comes off. The file's
 * parts come first, in the file's order, every one on the GC's submittal with its own pages; the
 * row's sheet is every page they use.
 */
export function planFileApply(m: FileTagMatch, choice: FileTagChoice, itemId: string, rowParts: ReadonlyArray<SubmittalPartRow>, ctx: { fileIndex: number; houseId: string | null }): FileApplyPlan {
  const byId = new Map(rowParts.map((p) => [p.id, p]))
  const write = (f: HouseFilePart): FilePartWrite => ({
    label: f.label,
    manufacturer: f.maker || null,
    model: f.model || null,
    description: f.description || null,
    on_submittal: true,
    source: 'file',
    supply_house_id: ctx.houseId,
    sheet_file: ctx.fileIndex,
    sheet_pages: [...f.pages],
  })
  const updates: FileApplyPlan['updates'] = []
  const inserts: FileApplyPlan['inserts'] = []
  const used = new Set<string>()
  m.parts.forEach((p, i) => {
    const seq = i + 1
    const target = choice.inPlaceOf[i] ?? null
    const was = target ? byId.get(target) : undefined
    if (was && !used.has(was.id)) {
      used.add(was.id)
      const same = p.kind === 'same' && p.rowPart?.id === was.id
      updates.push({ partId: was.id, patch: { ...write(p.file), sequence_order: seq, ...(same ? {} : { priced_label: was.priced_label ?? was.label, part_id: null }) } })
    } else inserts.push({ ...write(p.file), sequence_order: seq })
  })
  const leftover = rowParts.filter((p) => !used.has(p.id)).sort((a, b) => a.sequence_order - b.sequence_order)
  const deletes: string[] = []
  const keptOrderOnly: FileApplyPlan['keptOrderOnly'] = []
  for (const p of leftover) {
    if (choice.keep[p.id] ?? (!p.on_submittal || TRIM_NAME.test(p.label))) keptOrderOnly.push({ partId: p.id, sequence_order: m.parts.length + keptOrderOnly.length + 1 })
    else deletes.push(p.id)
  }
  const pages = [...new Set(m.parts.flatMap((p) => p.file.pages))].sort((a, b) => a - b)
  return {
    itemId,
    updates,
    inserts,
    deletes,
    keptOrderOnly,
    rowPatch: { sheet_file: ctx.fileIndex, sheet_pages: pages, sheet_source: 'house', ...(choice.rename ? { tag: m.tag.replace(/\s*&\s*/g, ', ') } : {}) },
  }
}
