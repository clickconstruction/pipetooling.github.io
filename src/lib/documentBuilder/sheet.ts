/**
 * A filled builder's kernel (punch list #404, step 3): the rules of a sheet with blanks, one for each job. The first
 * such sheet is insurance requirements for subs, and nothing here is about insurance: the contents are a `SheetDef`.
 *
 * Two things are kept. The **standing sheet** is the usual: the name at the top, the title, the opening lines, the
 * words around the blanks, the coverage lines and the line at the foot. A **job's sheet** keeps only what is the
 * job's own: its name, its place, who must be named, the fields it changed, the usual lines it leaves off and the
 * lines it adds. Laid over the standing sheet, that is the page a sub reads (`layOver`).
 *
 * So the same idea shows as on the walked builder: a part that stays, a part that changes for one job, what differs
 * between them and the way back.
 *
 * Every piece of words on the sheet is a field with a path: `f.title`, `open.o2`, `cover.auto.limit`. Pure: no React,
 * no supabase, no clock.
 */

/** The standing sheet's own fields, in the order the page draws them. */
export const SHEET_FIELD_KEYS = ['co', 'addr1', 'addr2', 'title', 'sub', 'lead', 'at', 'holder', 'hName', 'hAddr1', 'hAddr2', 'colA', 'colB', 'foot'] as const
export type SheetFieldKey = (typeof SHEET_FIELD_KEYS)[number]

/** What each of those fields is, for the list of what differs and for a screen reader. */
export const SHEET_FIELD_NAMES: Record<SheetFieldKey, string> = {
  co: 'Your name at the top',
  addr1: 'Your address, first line',
  addr2: 'Your address, second line',
  title: 'The title',
  sub: 'The line under the title',
  lead: 'The words before the names',
  at: 'The words before the place',
  holder: "The certificate holder's label",
  hName: 'The certificate holder',
  hAddr1: "The holder's address, first line",
  hAddr2: "The holder's address, second line",
  colA: "The first column's heading",
  colB: "The second column's heading",
  foot: 'The line at the foot',
}

export type SheetLine = { key: string; text: string }
export type SheetCover = { key: string; label: string; limit: string }

/** The standing sheet: what every job starts on. */
export type SheetDef = {
  fields: Record<SheetFieldKey, string>
  /** The opening lines, each with a key of its own, so a job's change to one survives a line added above it. */
  open: SheetLine[]
  cover: SheetCover[]
}

/** A job's own part of its sheet. */
export type JobSheet = {
  /** The job's name, as the line under the title says it. */
  name: string
  /** Where the work is. */
  place: string
  /** Who the certificate must name as additional insured. */
  insured: string[]
  /** The fields the job changed, by path. A field that reads as the usual is never kept here. */
  over: Record<string, string>
  /** The keys of usual coverage lines this job does not ask for. */
  off: string[]
  /** Coverage lines added for this job. */
  extra: SheetCover[]
}

/** The page a sub reads: the standing sheet laid over by one job. Nothing in it points back at either. */
export type ResolvedSheet = {
  co: string
  addr1: string
  addr2: string
  title: string
  subtitle: string
  open: string[]
  lead: string
  insured: string[]
  at: string
  place: string
  holder: string
  hName: string
  hAddr1: string
  hAddr2: string
  colA: string
  colB: string
  cover: Array<{ label: string; limit: string }>
  foot: string
}

/** The words a new line, name or amount starts on. They are placeholders: a sheet cannot be published with one. */
export const SHEET_NEW = { line: 'A new line.', name: 'A name', coverLabel: 'A coverage', coverLimit: 'An amount', address1: 'Your address, first line', address2: 'Your address, second line' } as const

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

// ---------------------------------------------------------------------------
// Reading what the database holds
// ---------------------------------------------------------------------------

function isBag(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function coverFrom(raw: unknown): SheetCover | null {
  if (!isBag(raw) || typeof raw.key !== 'string' || !raw.key || typeof raw.label !== 'string' || typeof raw.limit !== 'string') return null
  return { key: raw.key, label: raw.label, limit: raw.limit }
}

export type ParsedSheetDef = { ok: true; def: SheetDef } | { ok: false; problems: string[] }

/** What the database holds for a standing sheet, as a `SheetDef`, or every gap it has. */
export function parseSheetDef(value: unknown): ParsedSheetDef {
  if (!isBag(value)) return { ok: false, problems: ['The contents are not a sheet.'] }
  const problems: string[] = []
  const fieldsBag = isBag(value.fields) ? value.fields : null
  if (!fieldsBag) problems.push('The sheet has no fields.')
  const fields = Object.fromEntries(
    SHEET_FIELD_KEYS.map((k) => {
      const v = fieldsBag?.[k]
      if (fieldsBag && typeof v !== 'string') problems.push(`The sheet has no words for: ${SHEET_FIELD_NAMES[k]}.`)
      return [k, typeof v === 'string' ? v : '']
    }),
  ) as Record<SheetFieldKey, string>
  const open: SheetLine[] = []
  if (!Array.isArray(value.open)) problems.push('The sheet has no list of opening lines.')
  else
    value.open.forEach((raw, i) => {
      if (isBag(raw) && typeof raw.key === 'string' && raw.key && typeof raw.text === 'string') open.push({ key: raw.key, text: raw.text })
      else problems.push(`Opening line ${i + 1} is not a line.`)
    })
  const cover: SheetCover[] = []
  if (!Array.isArray(value.cover)) problems.push('The sheet has no list of coverage lines.')
  else
    value.cover.forEach((raw, i) => {
      const one = coverFrom(raw)
      if (one) cover.push(one)
      else problems.push(`Coverage line ${i + 1} is not a line.`)
    })
  return problems.length > 0 ? { ok: false, problems } : { ok: true, def: { fields, open, cover } }
}

/** What stops a standing sheet being published, one line each. An empty list is a pass. */
export function sheetDefProblems(def: SheetDef): string[] {
  const problems: string[] = []
  for (const k of SHEET_FIELD_KEYS) {
    const words = def.fields[k].trim()
    if (!words) problems.push(`${SHEET_FIELD_NAMES[k]} has no words.`)
    else if (words === SHEET_NEW.address1 || words === SHEET_NEW.address2) problems.push(`${SHEET_FIELD_NAMES[k]} has not been typed yet.`)
  }
  const openKeys = def.open.map((l) => l.key)
  def.open.forEach((line, i) => {
    if (!line.text.trim() || line.text.trim() === SHEET_NEW.line) problems.push(`Opening line ${i + 1} has no words yet.`)
    if (openKeys.filter((k) => k === line.key).length > 1) problems.push(`Two opening lines share the key ${line.key}.`)
  })
  if (def.cover.length === 0) problems.push('The sheet asks for no coverage.')
  const coverKeys = def.cover.map((c) => c.key)
  for (const c of def.cover) {
    const name = c.label.trim() && c.label.trim() !== SHEET_NEW.coverLabel ? c.label.trim() : null
    if (!name) problems.push('A coverage line has no name yet.')
    if (!c.limit.trim() || c.limit.trim() === SHEET_NEW.coverLimit) problems.push(`${name ?? 'A coverage line'} has no amount yet.`)
    if (coverKeys.filter((k) => k === c.key).length > 1) problems.push(`Two coverage lines share the key ${c.key}.`)
  }
  return [...new Set(problems)]
}

/** A job's part as the database holds it. A value that is not one answers null, never a half-read sheet. */
export function parseJobSheet(value: unknown): JobSheet | null {
  if (!isBag(value)) return null
  const { name, place, insured, over, off, extra } = value
  if (typeof name !== 'string' || typeof place !== 'string') return null
  if (!Array.isArray(insured) || !insured.every((x) => typeof x === 'string')) return null
  if (!isBag(over) || !Object.values(over).every((x) => typeof x === 'string')) return null
  if (!Array.isArray(off) || !off.every((x) => typeof x === 'string')) return null
  if (!Array.isArray(extra)) return null
  const lines = extra.map(coverFrom)
  if (lines.some((l) => l === null)) return null
  return { name, place, insured: insured as string[], over: over as Record<string, string>, off: off as string[], extra: lines as SheetCover[] }
}

/** A job's sheet as it starts: its blanks filled from the job, and nothing changed. */
export function startJobSheet(from: { name: string; place: string; insured: ReadonlyArray<string> }): JobSheet {
  return { name: from.name.trim(), place: from.place.trim(), insured: from.insured.map((n) => n.trim()).filter(Boolean), over: {}, off: [], extra: [] }
}

// ---------------------------------------------------------------------------
// A field: its own words when it has any, else its base
// ---------------------------------------------------------------------------

export function fieldPath(key: SheetFieldKey): string {
  return `f.${key}`
}
export function openPath(lineKey: string): string {
  return `open.${lineKey}`
}
export function coverPath(coverKey: string, part: 'label' | 'limit'): string {
  return `cover.${coverKey}.${part}`
}

/** What the standing sheet says at a path. Undefined when the path names nothing on it, such as a line since removed. */
export function usualWords(def: SheetDef, path: string): string | undefined {
  const [kind, a, b] = path.split('.')
  if (kind === 'f') return (SHEET_FIELD_KEYS as readonly string[]).includes(a ?? '') ? def.fields[a as SheetFieldKey] : undefined
  if (kind === 'open') return def.open.find((l) => l.key === a)?.text
  if (kind === 'cover' && (b === 'label' || b === 'limit')) return def.cover.find((c) => c.key === a)?.[b]
  return undefined
}

/** What a path is, in words: for the list of what differs. */
export function pathName(def: SheetDef, path: string): string {
  const [kind, a, b] = path.split('.')
  if (kind === 'f' && (SHEET_FIELD_KEYS as readonly string[]).includes(a ?? '')) return SHEET_FIELD_NAMES[a as SheetFieldKey]
  if (kind === 'open') {
    const at = def.open.findIndex((l) => l.key === a)
    return at >= 0 ? `Opening line ${at + 1}` : 'An opening line'
  }
  if (kind === 'cover') {
    const label = def.cover.find((c) => c.key === a)?.label ?? 'A coverage line'
    return `${label}, ${b === 'limit' ? 'its amount' : 'its name'}`
  }
  return path
}

/**
 * The blank for the job's name, as the usual's line under the title holds it. The usual never holds a job's name:
 * it holds this blank, and each job fills it with its own.
 */
export const SHEET_JOB_BLANK = "[the job's name]"

/**
 * The usual's line under the title with one job's name in it. A line with the blank takes the name there, as many
 * times as the blank is written. A line with no blank takes the name at its end.
 */
export function subtitleWith(usualLine: string, jobName: string): string {
  if (usualLine.includes(SHEET_JOB_BLANK)) return usualLine.split(SHEET_JOB_BLANK).join(jobName).trim()
  return `${usualLine} ${jobName}`.trim()
}

/**
 * A job's whole line under the title as the usual would hold it: the job's name becomes the blank. Null when the
 * line does not say the job's name, since there is then no blank for another job to fill. `subtitleWith` of the
 * answer and the same name reads as the line, word for word.
 */
export function subtitleAsUsual(line: string, jobName: string): string | null {
  const name = jobName.trim()
  if (!name || !line.includes(name) || line.includes(SHEET_JOB_BLANK)) return null
  const blanked = line.split(name).join(SHEET_JOB_BLANK)
  // A line that only ends on the name is kept as the words before it: the name goes at the end by itself.
  const tail = ` ${SHEET_JOB_BLANK}`
  const head = blanked.endsWith(tail) ? blanked.slice(0, -tail.length) : null
  const usual = head && !head.includes(SHEET_JOB_BLANK) && head === head.trim() ? head : blanked
  return subtitleWith(usual, name) === line ? usual : null
}

/**
 * What the usual says at a path on one job. Every path reads as the usual's own words but the line under the title,
 * which reads with the job's name in its blank. This is what a job's own words are held against.
 */
export function usualWordsOn(def: SheetDef, job: { name: string }, path: string): string | undefined {
  return path === fieldPath('sub') ? subtitleWith(def.fields.sub, job.name) : usualWords(def, path)
}

/** What a job's sheet says at a path: the job's own words when it has any, else the usual. */
export function sheetWords(def: SheetDef, job: JobSheet | null, path: string): string {
  if (!job) return usualWords(def, path) ?? ''
  return job.over[path] ?? usualWordsOn(def, job, path) ?? ''
}

/** Where a field's words come from, for its mark. */
export type FieldMark = 'usual' | 'own'
export function fieldMark(job: JobSheet | null, path: string): FieldMark {
  return job != null && job.over[path] != null ? 'own' : 'usual'
}

/** A job's field typed over. Words that read as the usual are not kept, so a job holds only what differs. */
export function withJobWords(def: SheetDef, job: JobSheet, path: string, words: string): JobSheet {
  const over = { ...job.over }
  if (words === usualWordsOn(def, job, path)) delete over[path]
  else over[path] = words
  return { ...job, over }
}

/** A job's field put back to the usual. */
export function withoutJobWords(job: JobSheet, path: string): JobSheet {
  if (job.over[path] == null) return job
  const over = { ...job.over }
  delete over[path]
  return { ...job, over }
}

/** The standing sheet with one path typed over. A path that names nothing on it changes nothing. */
export function withUsualWords(def: SheetDef, path: string, words: string): SheetDef {
  const [kind, a, b] = path.split('.')
  if (kind === 'f' && (SHEET_FIELD_KEYS as readonly string[]).includes(a ?? '')) return { ...def, fields: { ...def.fields, [a as SheetFieldKey]: words } }
  if (kind === 'open') return { ...def, open: def.open.map((l) => (l.key === a ? { ...l, text: words } : l)) }
  if (kind === 'cover' && (b === 'label' || b === 'limit')) return { ...def, cover: def.cover.map((c) => (c.key === a ? { ...c, [b]: words } : c)) }
  return def
}

/** A key no line of the list holds yet: `o1`, `o2`, and so on. */
export function freshKey(taken: ReadonlyArray<string>, prefix: string): string {
  for (let n = taken.length + 1; ; n++) {
    const key = `${prefix}${n}`
    if (!taken.includes(key)) return key
  }
}

export function withUsualOpenLine(def: SheetDef): SheetDef {
  return { ...def, open: [...def.open, { key: freshKey(def.open.map((l) => l.key), 'o'), text: SHEET_NEW.line }] }
}
export function withoutUsualOpenLine(def: SheetDef, lineKey: string): SheetDef {
  return { ...def, open: def.open.filter((l) => l.key !== lineKey) }
}
export function withUsualCover(def: SheetDef, line?: { label: string; limit: string }): SheetDef {
  const key = freshKey(def.cover.map((c) => c.key), 'c')
  return { ...def, cover: [...def.cover, { key, label: line?.label ?? SHEET_NEW.coverLabel, limit: line?.limit ?? SHEET_NEW.coverLimit }] }
}
export function withoutUsualCover(def: SheetDef, coverKey: string): SheetDef {
  return { ...def, cover: def.cover.filter((c) => c.key !== coverKey) }
}

// ---------------------------------------------------------------------------
// A job's own parts
// ---------------------------------------------------------------------------

export function withJobInsured(job: JobSheet, at: number, name: string): JobSheet {
  return { ...job, insured: job.insured.map((n, i) => (i === at ? name : n)) }
}
export function withJobInsuredAdded(job: JobSheet): JobSheet {
  return { ...job, insured: [...job.insured, SHEET_NEW.name] }
}
export function withoutJobInsured(job: JobSheet, at: number): JobSheet {
  return { ...job, insured: job.insured.filter((_, i) => i !== at) }
}
/** A usual coverage line left off this job, or put back. */
export function withJobCoverOff(job: JobSheet, coverKey: string, off: boolean): JobSheet {
  const rest = job.off.filter((k) => k !== coverKey)
  return { ...job, off: off ? [...rest, coverKey] : rest }
}
export function withJobExtra(job: JobSheet): JobSheet {
  return { ...job, extra: [...job.extra, { key: freshKey(job.extra.map((x) => x.key), 'x'), label: SHEET_NEW.coverLabel, limit: SHEET_NEW.coverLimit }] }
}
export function withJobExtraWords(job: JobSheet, extraKey: string, part: 'label' | 'limit', words: string): JobSheet {
  return { ...job, extra: job.extra.map((x) => (x.key === extraKey ? { ...x, [part]: words } : x)) }
}
export function withoutJobExtra(job: JobSheet, extraKey: string): JobSheet {
  return { ...job, extra: job.extra.filter((x) => x.key !== extraKey) }
}

/**
 * A job's own words made the usual: the standing sheet's draft takes them. The job keeps its words meanwhile, so its
 * own sheet never reads differently because of the press. Once the usual is published the two read the same, and
 * `pruneJobSheet` lets the job's copy go.
 */
export function usualFromJobField(def: SheetDef, job: JobSheet, path: string): SheetDef {
  const words = job.over[path]
  if (words == null) return def
  if (path !== fieldPath('sub')) return withUsualWords(def, path, words)
  // The line under the title goes to the usual with the job's name as a blank, never as the filled words.
  const usual = subtitleAsUsual(words, job.name)
  return usual == null ? def : withUsualWords(def, path, usual)
}

/** Where a job's own words stand against the usual's draft: in it already, ready to be made the usual, or held. */
export type UsualOffer = { kind: 'in-usual' } | { kind: 'offer' } | { kind: 'held'; why: string }

/** Why a line under the title cannot be made the usual. */
export const SUB_NOT_USUAL = "This line does not say this job's name, so no other job could put its own name in it."

/** What the list of what differs offers beside **Back to the usual** for one field. */
export function usualOffer(def: SheetDef, job: JobSheet, path: string): UsualOffer {
  const words = job.over[path]
  if (words != null && usualWordsOn(def, job, path) === words) return { kind: 'in-usual' }
  if (path === fieldPath('sub') && words != null && subtitleAsUsual(words, job.name) == null) return { kind: 'held', why: SUB_NOT_USUAL }
  return { kind: 'offer' }
}
/** A line added for one job made a usual line: every job then asks for it, once the usual is published. */
export function usualFromJobExtra(def: SheetDef, job: JobSheet, extraKey: string): SheetDef {
  const line = job.extra.find((x) => x.key === extraKey)
  if (!line || usualHasCover(def, line)) return def
  return withUsualCover(def, { label: line.label, limit: line.limit })
}
/** True when the standing sheet already asks for this coverage, word for word. */
export function usualHasCover(def: SheetDef, line: { label: string; limit: string }): boolean {
  return def.cover.some((c) => c.label === line.label && c.limit === line.limit)
}
/**
 * A job's own part with everything let go that now reads as the usual: a field typed the same, and an added line the
 * usual asks for word for word. So a job keeps only what differs, also after the usual moves toward it.
 */
export function pruneJobSheet(def: SheetDef, job: JobSheet): JobSheet {
  const over = Object.fromEntries(Object.entries(job.over).filter(([path, words]) => usualWordsOn(def, job, path) !== words))
  const extra = job.extra.filter((x) => !usualHasCover(def, x))
  if (Object.keys(over).length === Object.keys(job.over).length && extra.length === job.extra.length) return job
  return { ...job, over, extra }
}

// ---------------------------------------------------------------------------
// What differs
// ---------------------------------------------------------------------------

export type SheetDiffer =
  | { kind: 'field'; path: string; name: string; usual: string; words: string }
  | { kind: 'off'; coverKey: string; name: string }
  | { kind: 'extra'; extraKey: string; name: string }

/**
 * What a job's sheet says differently from the usual, in the page's order: the fields it changed with the usual's
 * words, the usual lines it leaves off, the lines it adds. A change to a line the usual no longer has is left out,
 * since there is nothing left for it to differ from.
 */
export function sheetDiffers(def: SheetDef, job: JobSheet): SheetDiffer[] {
  const order = [...SHEET_FIELD_KEYS.map(fieldPath), ...def.open.map((l) => openPath(l.key)), ...def.cover.flatMap((c) => [coverPath(c.key, 'label'), coverPath(c.key, 'limit')])]
  const fields: SheetDiffer[] = order.flatMap((path): SheetDiffer[] => {
    const words = job.over[path]
    const usual = usualWordsOn(def, job, path)
    return words != null && usual != null && words !== usual ? [{ kind: 'field', path, name: pathName(def, path), usual, words }] : []
  })
  const off: SheetDiffer[] = def.cover.filter((c) => job.off.includes(c.key)).map((c) => ({ kind: 'off', coverKey: c.key, name: c.label }))
  const extra: SheetDiffer[] = job.extra.map((x) => ({ kind: 'extra', extraKey: x.key, name: x.label }))
  return [...fields, ...off, ...extra]
}

/** The line over the list of what differs. */
export function differsLine(n: number): string {
  return n === 0 ? 'This job is on your usual sheet' : `${plural(n, 'thing differs', 'things differ')} on this job`
}

// ---------------------------------------------------------------------------
// The page a sub reads
// ---------------------------------------------------------------------------

/** The standing sheet laid over by one job. */
export function layOver(def: SheetDef, job: JobSheet): ResolvedSheet {
  const w = (key: SheetFieldKey) => sheetWords(def, job, fieldPath(key))
  const usualLines = def.cover.filter((c) => !job.off.includes(c.key)).map((c) => ({ label: sheetWords(def, job, coverPath(c.key, 'label')), limit: sheetWords(def, job, coverPath(c.key, 'limit')) }))
  return {
    co: w('co'),
    addr1: w('addr1'),
    addr2: w('addr2'),
    title: w('title'),
    // The line under the title is the usual's line with the job's name in its blank, unless the job wrote the whole line.
    subtitle: sheetWords(def, job, fieldPath('sub')),
    open: def.open.map((l) => sheetWords(def, job, openPath(l.key))),
    lead: w('lead'),
    insured: [...job.insured],
    at: w('at'),
    place: job.place,
    holder: w('holder'),
    hName: w('hName'),
    hAddr1: w('hAddr1'),
    hAddr2: w('hAddr2'),
    colA: w('colA'),
    colB: w('colB'),
    cover: [...usualLines, ...job.extra.map((x) => ({ label: x.label, limit: x.limit }))],
    foot: w('foot'),
  }
}

/** A resolved sheet as the database or an edge function hands it back, or null for a value that is not one. */
export function parseResolvedSheet(value: unknown): ResolvedSheet | null {
  if (!isBag(value)) return null
  const text = ['co', 'addr1', 'addr2', 'title', 'subtitle', 'lead', 'at', 'place', 'holder', 'hName', 'hAddr1', 'hAddr2', 'colA', 'colB', 'foot'] as const
  if (!text.every((k) => typeof value[k] === 'string')) return null
  const { open, insured, cover } = value
  if (!Array.isArray(open) || !open.every((x) => typeof x === 'string')) return null
  if (!Array.isArray(insured) || !insured.every((x) => typeof x === 'string')) return null
  if (!Array.isArray(cover) || !cover.every((c) => isBag(c) && typeof c.label === 'string' && typeof c.limit === 'string')) return null
  const s = value as Record<(typeof text)[number], string>
  return {
    co: s.co,
    addr1: s.addr1,
    addr2: s.addr2,
    title: s.title,
    subtitle: s.subtitle,
    open: open as string[],
    lead: s.lead,
    insured: insured as string[],
    at: s.at,
    place: s.place,
    holder: s.holder,
    hName: s.hName,
    hAddr1: s.hAddr1,
    hAddr2: s.hAddr2,
    colA: s.colA,
    colB: s.colB,
    cover: (cover as Array<{ label: string; limit: string }>).map((c) => ({ label: c.label, limit: c.limit })),
    foot: s.foot,
  }
}

/**
 * What is missing before a job's sheet can be published, one line each. An empty list is a pass. The usual has to be
 * published first, since a job's sheet goes out laid over the published usual and never over a draft of it.
 */
export function jobSheetMissing(job: JobSheet, usual: { def: SheetDef; revision: number }): string[] {
  const missing: string[] = []
  if (usual.revision < 1) missing.push('Publish your usual sheet first.')
  if (!job.name.trim()) missing.push('The job has no name on the sheet.')
  if (!job.place.trim()) missing.push('The sheet does not say where the work is.')
  const names = job.insured.map((n) => n.trim())
  if (names.filter((n) => n && n !== SHEET_NEW.name).length === 0) missing.push('Nobody is named as additional insured.')
  if (names.some((n) => !n || n === SHEET_NEW.name)) missing.push('A name to insure has no words yet.')
  for (const [path, words] of Object.entries(job.over)) {
    if (usualWords(usual.def, path) != null && !words.trim()) missing.push(`${pathName(usual.def, path)} has no words.`)
  }
  for (const x of job.extra) {
    const name = x.label.trim() && x.label.trim() !== SHEET_NEW.coverLabel ? x.label.trim() : null
    if (!name) missing.push('An added coverage line has no name yet.')
    if (!x.limit.trim() || x.limit.trim() === SHEET_NEW.coverLimit) missing.push(`${name ?? 'An added coverage line'} has no amount yet.`)
  }
  if (layOver(usual.def, job).cover.length === 0) missing.push('This job asks for no coverage.')
  return [...new Set(missing)]
}

// ---------------------------------------------------------------------------
// The asks: what a certificate is checked against
// ---------------------------------------------------------------------------

/**
 * A published sheet as the lines a certificate is checked against: each name, the place, the certificate holder,
 * and each coverage with its amount. The other words on the sheet are not asks.
 */
export function sheetAsks(sheet: ResolvedSheet): string[] {
  return [
    ...sheet.insured.map((name) => `It names ${name} as additional insured.`),
    `It is for work at ${sheet.place}.`,
    `The certificate holder is ${sheet.hName}.`,
    ...sheet.cover.map((c) => `${c.label}: ${c.limit}.`),
  ].map((line) => line.replace(/\.\.$/, '.'))
}

/**
 * True when a certificate checked against `checked` no longer answers `now`: a name, the place, the holder or an
 * amount changed. A change to the sheet's other words, such as the line at the foot, leaves the two lists the same.
 */
export function asksOutdated(checked: ReadonlyArray<string>, now: ReadonlyArray<string>): boolean {
  return checked.length !== now.length || checked.some((line, i) => line !== now[i])
}

// ---------------------------------------------------------------------------
// The usual's publish: which jobs get it
// ---------------------------------------------------------------------------

/** One job as the usual's publish sees it. `revision` 0 is a job with no published sheet. */
export type UsualPublishJob = { id: string; name: string; revision: number; changed: boolean }

export type UsualPublishRow = { id: string; name: string; gets: true; asRevision: number } | { id: string; name: string; gets: false; why: 'no-sheet' | 'own-changes' }

/**
 * Where a change to the usual goes. A job with a published sheet and no changes of its own waiting gets it, as its
 * next revision. A job with no sheet yet, or with changes of its own waiting, is held: its half-made changes must not
 * go out with the usual.
 */
export function usualPublishPlan(jobs: ReadonlyArray<UsualPublishJob>): UsualPublishRow[] {
  return jobs.map((j): UsualPublishRow => {
    if (j.revision < 1) return { id: j.id, name: j.name, gets: false, why: 'no-sheet' }
    if (j.changed) return { id: j.id, name: j.name, gets: false, why: 'own-changes' }
    return { id: j.id, name: j.name, gets: true, asRevision: j.revision + 1 }
  })
}

export function usualHeldWords(why: 'no-sheet' | 'own-changes'): string {
  return why === 'no-sheet' ? 'Held. It has no sheet yet.' : 'Held. It has changes of its own waiting.'
}
