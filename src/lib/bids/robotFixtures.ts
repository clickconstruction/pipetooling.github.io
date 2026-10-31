/**
 * Robot fixtures (punch list #221, PR 2): the pure half of the window where the estimator takes the fixtures
 * the robot found into her own count. One kernel over the pull the robot wrote (`bid_fixture_pulls` +
 * `bid_fixture_pull_rows`, twin-mcp `put_fixtures`) and her count rows: which row of hers each robot row
 * pairs to (by tag first, then the book's name match, never fuzzy), the buckets the window draws, what starts
 * ticked, the button's and the foot's words, the set line, the price words, and the fallback read of a
 * substrate for a bid the robot read before the verb existed. No IO. Every sentence a first-timer reads is
 * held to `plainWordsFailures` under test.
 *
 * Words: a robot fixture she does not want is *set aside*, never deleted (the owner's case, decision 8). The
 * data says `set_aside_*`; the screen says *Set aside* and *Put back*. A voided run reads *Set aside.* too
 * (`robotProgress.ts`): she set the run aside, she set the fixture aside, one word for one act.
 */
import { countedLabel } from '../batchWords'
import { formatCurrency } from '../format'
import { fixtureKey, normalizeFixtureName } from './takeoffFixtureKey'
import { flagWords, type PlanPageRow, type PlanSubstrate } from './planText'

export const SET_ASIDE_REASONS = ['by_others', 'existing', 'alternate', 'wrong_count', 'not_sure', 'other'] as const
export type SetAsideReason = (typeof SET_ASIDE_REASONS)[number]
/** The reason as the chip and the fold line say it. */
export const SET_ASIDE_REASON_WORDS: Record<SetAsideReason, string> = {
  by_others: 'by others',
  existing: 'existing',
  alternate: 'alternate',
  wrong_count: 'wrong count',
  not_sure: 'not sure',
  other: 'other',
}
export type ScopeFlag = 'by_others' | 'existing' | 'alternate'
export const SCOPE_FLAG_WORDS: Record<ScopeFlag, string> = { by_others: 'by others', existing: 'existing', alternate: 'alternate' }
export type FixtureAgreement = 'agree' | 'conflict' | 'unverifiable'
/** The submittal robot's line: a row at or over it, agreeing with itself and not given away by the plans, is sure. */
export const SURE_LINE = 0.7

/** One row of `bid_fixture_pull_rows`, as the window reads it. Numbers may arrive as strings (numeric columns). */
export type FixturePullRow = {
  id: string
  pull_id: string
  tag: string
  name: string
  description?: string | null
  manufacturer?: string | null
  model?: string | null
  connections?: unknown
  count: number | string
  unit?: string | null
  per_sheet?: unknown
  backing?: unknown
  scope_flag?: string | null
  confidence?: number | string | null
  agreement?: string | null
  remark?: string | null
  robot_book_entry?: string | null
  robot_unit_price?: number | string | null
  sequence_order: number
  taken_at?: string | null
  taken_as?: string | null
  taken_count?: number | string | null
  prior_count?: number | string | null
  count_row_id?: string | null
  priced_as?: string | null
  set_aside_at?: string | null
  set_aside_reason?: string | null
}

/** One row of `bid_fixture_pulls`. */
export type FixturePull = {
  id: string
  bid_id: string
  plan_link?: string | null
  ct_link?: string | null
  sheet_count?: number | null
  source: string
  check_summary?: unknown
  robot_total?: number | string | null
  read_at: string
}

export type FixtureSheet = { sheet: string | null; page: number | null; count: number | null; pins: Array<{ x: number; y: number }> }
export type FixtureBackingKind = 'schedule' | 'note' | 'legend' | 'callout' | 'other'
export type FixtureBacking = { kind: FixtureBackingKind; sheet: string | null; page: number | null; text: string; flags: string[] }

/** A number from a numeric column or a string; null when it is neither. */
export function numberOf(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function strOf(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s : null
}

/** The sheets the robot counted on, with its pins (0..1 of the page). */
export function sheetsOf(row: Pick<FixturePullRow, 'per_sheet'>): FixtureSheet[] {
  if (!Array.isArray(row.per_sheet)) return []
  const out: FixtureSheet[] = []
  for (const s of row.per_sheet as unknown[]) {
    if (!s || typeof s !== 'object') continue
    const o = s as Record<string, unknown>
    const pins: Array<{ x: number; y: number }> = []
    if (Array.isArray(o.pins)) {
      for (const p of o.pins as unknown[]) {
        if (!p || typeof p !== 'object') continue
        const x = numberOf((p as Record<string, unknown>).x)
        const y = numberOf((p as Record<string, unknown>).y)
        if (x != null && y != null) pins.push({ x, y })
      }
    }
    out.push({ sheet: strOf(o.sheet), page: numberOf(o.page), count: numberOf(o.count), pins })
  }
  return out
}

const BACKING_KINDS: ReadonlySet<string> = new Set(['schedule', 'note', 'legend', 'callout'])

/** Every line of plan text that backs the row, in the order the robot gave them. */
export function backingOf(row: Pick<FixturePullRow, 'backing'>): FixtureBacking[] {
  if (!Array.isArray(row.backing)) return []
  const out: FixtureBacking[] = []
  for (const b of row.backing as unknown[]) {
    if (!b || typeof b !== 'object') continue
    const o = b as Record<string, unknown>
    const text = strOf(o.text)
    if (!text) continue
    const kind = typeof o.kind === 'string' && BACKING_KINDS.has(o.kind) ? (o.kind as FixtureBackingKind) : 'other'
    const flags = Array.isArray(o.flags) ? (o.flags as unknown[]).filter((f): f is string => typeof f === 'string').map(flagWords) : []
    out.push({ kind, sheet: strOf(o.sheet), page: numberOf(o.page), text, flags })
  }
  return out
}

/** The row's scope flag when the plans give the fixture away; else null. */
export function scopeOf(row: Pick<FixturePullRow, 'scope_flag'>): ScopeFlag | null {
  const f = row.scope_flag
  return f === 'by_others' || f === 'existing' || f === 'alternate' ? f : null
}

/** Sure: at or over the line, the three voices agree (or the robot did not say), and the plans do not give it away. */
export function isSure(row: Pick<FixturePullRow, 'confidence' | 'agreement' | 'scope_flag'>): boolean {
  const c = numberOf(row.confidence) ?? 1
  const a = row.agreement ?? 'agree'
  return c >= SURE_LINE && a === 'agree' && scopeOf(row) == null
}

/** The robot's check of the row, in one or two plain sentences, with its remark. */
export function checkWords(row: Pick<FixturePullRow, 'agreement' | 'remark' | 'confidence'>): string {
  const a = row.agreement ?? null
  const first =
    a === 'agree'
      ? 'The schedule, the drawings and the riser agree.'
      : a === 'conflict'
        ? 'The schedule and the drawings do not agree.'
        : a === 'unverifiable'
          ? 'The robot could not check this one against the schedule.'
          : 'The robot did not say how sure it is.'
  const remark = strOf(row.remark)
  return remark ? `${first} ${remark.endsWith('.') || remark.endsWith('?') || remark.endsWith('!') ? remark : `${remark}.`}` : first
}

/** Her count row, as the pairing reads it. */
export type HerCountRow = {
  id: string
  fixture: string
  count: number | string
  plan_tag?: string | null
  group_tag?: string | null
  page?: string | null
}

/** `WC-1` → a pattern that finds the tag as a whole token in a normalized name. */
function tagPattern(tag: string): RegExp | null {
  const t = normalizeFixtureName(tag)
  if (!t) return null
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`)
}

/**
 * Pairing, by row id → her row or null. By tag first (her `plan_tag`, then the tag inside her name as a whole
 * token: *WC-1*, *Water closet (WC-1)*), then the exact normalized name (through the book's alias when one is
 * given: *Toilet* → *Water closet*), then the tag-stripped key. A level with more than one candidate pairs
 * nothing, and a row of hers pairs once; never fuzzy, since the books match by exact name. Rows the robot's
 * own take landed (a pull row's `count_row_id`) are never candidates for another robot row.
 */
export function pairRobotFixtures(
  rows: ReadonlyArray<FixturePullRow>,
  hers: ReadonlyArray<HerCountRow>,
  aliasOf?: (normalizedName: string) => string,
): Map<string, HerCountRow | null> {
  const landed = new Set(rows.map((r) => r.count_row_id).filter((id): id is string => !!id))
  const candidates = hers.filter((h) => !landed.has(h.id))
  const claimed = new Set<string>()
  const out = new Map<string, HerCountRow | null>()
  const canon = (name: string): string => {
    const n = normalizeFixtureName(name)
    return aliasOf ? normalizeFixtureName(aliasOf(n)) || n : n
  }
  const ordered = [...rows].sort((a, b) => a.sequence_order - b.sequence_order)
  for (const r of ordered) {
    if (r.count_row_id) {
      out.set(r.id, hers.find((h) => h.id === r.count_row_id) ?? null)
      continue
    }
    const tag = normalizeFixtureName(r.tag)
    const pat = tagPattern(r.tag)
    const name = canon(r.name)
    const key = fixtureKey(r.name)
    const levels: Array<(h: HerCountRow) => boolean> = [
      (h) => !!tag && normalizeFixtureName(h.plan_tag ?? '') === tag,
      (h) => !!pat && pat.test(normalizeFixtureName(h.fixture)),
      (h) => !!name && canon(h.fixture) === name,
      (h) => !!key && fixtureKey(h.fixture) === key,
    ]
    let pick: HerCountRow | null = null
    for (const test of levels) {
      const found = candidates.filter(test)
      if (found.length === 0) continue
      if (found.length === 1 && !claimed.has(found[0]!.id)) pick = found[0]!
      break
    }
    if (pick) claimed.add(pick.id)
    out.set(r.id, pick)
  }
  return out
}

export type FixtureBucket = 'new' | 'on_count' | 'same' | 'taken' | 'set_aside'

export type FixtureReviewRow = {
  row: FixturePullRow
  bucket: FixtureBucket
  hers: HerCountRow | null
  count: number
  sure: boolean
  scope: ScopeFlag | null
  /** New and sure with no scope chip starts ticked; everything else starts unticked. */
  startTicked: boolean
  unitPrice: number | null
  /** count × the robot's unit price, or null without a price. */
  extended: number | null
  sheets: FixtureSheet[]
  backing: FixtureBacking[]
  check: string
  /** The set-aside reason's words, on a set-aside row. */
  reason: string | null
  /** One line under the name: what the robot counted against hers, or where it stands. */
  words: string
}

export type FixtureReview = {
  rows: FixtureReviewRow[]
  byBucket: Record<FixtureBucket, FixtureReviewRow[]>
  found: number
  sure: number
  /** Rows that carry a robot price. */
  priced: number
  /** Sum of count × price over the priced rows; null when none is priced. */
  robotTotal: number | null
}

function countsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9
}

/** Whole dollars when the figure is whole, else cents: `$31,480` · `$412.50`. */
export function moneyWords(n: number): string {
  const s = formatCurrency(Math.round(n * 100) / 100)
  return `$${s.endsWith('.00') ? s.slice(0, -3) : s}`
}

/** `$412 each`. */
export function priceEachWords(unitPrice: number | null | undefined): string | null {
  return unitPrice == null ? null : `${moneyWords(unitPrice)} each`
}

function rowWords(bucket: FixtureBucket, hers: HerCountRow | null, count: number, row: FixturePullRow, reason: string | null): string {
  switch (bucket) {
    case 'new':
      return 'Not on your count.'
    case 'on_count': {
      const h = numberOf(hers?.count) ?? 0
      return `Your row ${hers?.fixture ?? ''} has ${h}. The robot counted ${count}.`
    }
    case 'same':
      return 'On your count with the same number.'
    case 'taken':
      return row.taken_as === 'updated' ? 'On your count, the robot’s number on your row.' : 'On your count, shaded.'
    case 'set_aside':
      return reason ? `Set aside, ${reason}.` : 'Set aside.'
  }
}

/** The window's rows in their buckets against her sheet. */
export function reviewRobotFixtures(
  rows: ReadonlyArray<FixturePullRow>,
  hers: ReadonlyArray<HerCountRow>,
  aliasOf?: (normalizedName: string) => string,
): FixtureReview {
  const pairs = pairRobotFixtures(rows, hers, aliasOf)
  const out: FixtureReviewRow[] = []
  for (const row of [...rows].sort((a, b) => a.sequence_order - b.sequence_order)) {
    const count = numberOf(row.count) ?? 0
    const paired = pairs.get(row.id) ?? null
    // A taken row whose count row is gone (History's Undo, a delete outside the window) is offered again.
    const bucket: FixtureBucket = row.set_aside_at
      ? 'set_aside'
      : row.taken_at && row.count_row_id
        ? 'taken'
        : paired
          ? countsEqual(numberOf(paired.count) ?? 0, count) ? 'same' : 'on_count'
          : 'new'
    const sure = isSure(row)
    const scope = scopeOf(row)
    const unitPrice = numberOf(row.robot_unit_price)
    const reasonKey = row.set_aside_reason as SetAsideReason | null | undefined
    const reason = reasonKey && reasonKey in SET_ASIDE_REASON_WORDS ? SET_ASIDE_REASON_WORDS[reasonKey] : null
    out.push({
      row,
      bucket,
      hers: paired,
      count,
      sure,
      scope,
      startTicked: bucket === 'new' && sure,
      unitPrice,
      extended: unitPrice == null ? null : Math.round(count * unitPrice * 100) / 100,
      sheets: sheetsOf(row),
      backing: backingOf(row),
      check: checkWords(row),
      reason,
      words: rowWords(bucket, paired, count, row, reason),
    })
  }
  const byBucket: Record<FixtureBucket, FixtureReviewRow[]> = { new: [], on_count: [], same: [], taken: [], set_aside: [] }
  for (const r of out) byBucket[r.bucket].push(r)
  const pricedRows = out.filter((r) => r.extended != null)
  return {
    rows: out,
    byBucket,
    found: out.length,
    sure: out.filter((r) => r.sure).length,
    priced: pricedRows.length,
    robotTotal: pricedRows.length ? Math.round(pricedRows.reduce((s, r) => s + (r.extended ?? 0), 0) * 100) / 100 : null,
  }
}

/** The bucket heads: *New · 17*, *On your count · 2*, *Same · 4*, *On your count from the robot · 15*, *Set aside · 2*. */
export const FIXTURE_BUCKET_WORDS: Record<FixtureBucket, string> = {
  new: 'New',
  on_count: 'On your count',
  same: 'Same',
  taken: 'On your count from the robot',
  set_aside: 'Set aside',
}

export function bucketHead(bucket: FixtureBucket, n: number): string {
  return `${FIXTURE_BUCKET_WORDS[bucket]} · ${n}`
}

export type FixtureTicks = {
  /** Row ids in New ticked to add. */
  add: ReadonlySet<string>
  /** Row ids in On your count ticked to update her paired row. */
  update: ReadonlySet<string>
}

export type FixtureButton = {
  button: string
  dead: boolean
  /** The sentences under the button: what lands, the price, what stays. */
  foot: string
  adds: number
  updates: number
  /** The robot's total for the ticked rows that carry a price; null when none does. */
  total: number | null
}

/** The button's and the foot's words from what is ticked (`batchWords`'s shape: the count on the button, dead at zero). */
export function fixtureButtonWords(ticks: FixtureTicks, review: FixtureReview, herRowCount: number): FixtureButton {
  const addRows = review.byBucket.new.filter((r) => ticks.add.has(r.row.id))
  const updRows = review.byBucket.on_count.filter((r) => ticks.update.has(r.row.id))
  const adds = addRows.length
  const updates = updRows.length
  const priced = [...addRows, ...updRows].filter((r) => r.extended != null)
  const total = priced.length ? Math.round(priced.reduce((s, r) => s + (r.extended ?? 0), 0) * 100) / 100 : null
  if (adds + updates === 0) {
    return { button: 'Add fixtures', dead: true, foot: 'Tick the fixtures you want on your count.', adds, updates, total }
  }
  const button = adds > 0 && updates > 0 ? `${countedLabel('Add', adds)} · update ${updates}` : adds > 0 ? countedLabel('Add', adds, 'fixture') : countedLabel('Update', updates, 'fixture')
  const sentences: string[] = []
  if (adds > 0) {
    const priceClause = total != null && addRows.some((r) => r.extended != null) ? `, ${moneyWords(addRows.reduce((s, r) => s + (r.extended ?? 0), 0))} at the robot’s prices` : ''
    sentences.push(adds === 1 ? `1 row lands on your count, shaded${priceClause}.` : `${adds} rows land on your count, shaded${priceClause}.`)
    sentences.push('Your book prices the ones it knows.', 'The robot’s price fills the rest, marked.')
  }
  if (updates > 0) {
    sentences.push(updates === 1 ? '1 of your rows takes the robot’s count and keeps its parts and prices.' : `${updates} of your rows take the robot’s count and keep their parts and prices.`)
  }
  const stay = Math.max(0, herRowCount - updates)
  if (stay > 0) {
    const other = updates > 0 ? ' other' : ''
    sentences.push(stay === 1 ? `Your${other} row stays as it is.` : `Your ${stay}${other} rows stay as they are.`)
  }
  return { button, dead: false, foot: sentences.join(' '), adds, updates, total }
}

/**
 * The set line at the top of the window. `when` is the read's time in the company's words (*Thu 2:08 PM*),
 * formatted by the caller so the kernel stays clock-free; `setName` names the set through `planSetsForBid`.
 */
export function fixtureSetLineWords(args: {
  pull: Pick<FixturePull, 'source' | 'sheet_count'>
  setName: string | null
  when: string | null
  review: Pick<FixtureReview, 'found' | 'sure' | 'robotTotal'>
  herRowCount: number
}): string {
  const { pull, setName, when, review, herRowCount } = args
  const sentences: string[] = []
  if (pull.source === 'derived') {
    sentences.push(when ? `From the robot’s read of ${when}.` : 'From the robot’s read.')
    sentences.push('Counts are the set’s totals, not per sheet. No prices.')
  } else {
    const parts: string[] = []
    if (setName) parts.push(setName)
    if (pull.sheet_count != null && pull.sheet_count > 0) parts.push(`${pull.sheet_count} sheets`)
    if (when) parts.push(`read ${when}`)
    sentences.push(parts.length ? `From the set the robot read: ${parts.join(', ')}.` : 'From the set the robot read.')
  }
  const counted = `${review.found} ${review.found === 1 ? 'fixture' : 'fixtures'}, ${review.sure} sure${review.robotTotal != null ? `, ${moneyWords(review.robotTotal)} at the robot’s prices` : ''}.`
  sentences.push(counted)
  sentences.push(herRowCount === 1 ? 'Your count has 1 row.' : `Your count has ${herRowCount} rows.`)
  return sentences.join(' ')
}

/** The fixtures score as `score_locked_shadows` writes it at send (v2.6180). */
export type FixturesScore = { found: number; taken: number; changed: number; set_aside: number; left: number; missed: number; reasons: Record<string, number> }

/** The score as its jsonb column lands, or null when the run has none. */
export function fixturesScoreOf(raw: unknown): FixturesScore | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const n = (k: string) => numberOf(o[k]) ?? 0
  const reasons: Record<string, number> = {}
  if (o.reasons && typeof o.reasons === 'object' && !Array.isArray(o.reasons)) {
    for (const [k, v] of Object.entries(o.reasons as Record<string, unknown>)) {
      const c = numberOf(v)
      if (c != null) reasons[k] = c
    }
  }
  return { found: n('found'), taken: n('taken'), changed: n('changed'), set_aside: n('set_aside'), left: n('left'), missed: n('missed'), reasons }
}

/** *Fixtures: 19 of 23 taken, 2 changed, 2 set aside, 3 the robot missed.* The honest measure of the augment. */
export function fixturesScoreWords(score: FixturesScore): string {
  const parts = [`${score.taken} of ${score.found} taken`]
  if (score.changed > 0) parts.push(`${score.changed} changed`)
  if (score.set_aside > 0) parts.push(`${score.set_aside} set aside`)
  if (score.left > 0) parts.push(`${score.left} not taken`)
  if (score.missed > 0) parts.push(`${score.missed} the robot missed`)
  return `Fixtures: ${parts.join(', ')}.`
}

/** Before the robot seals: what the window says when it is opened too soon. */
export const FIXTURES_NOT_YET_WORDS = 'Its fixtures open when it seals its number, usually within the hour. The Plans panel answers questions about the set now.'

/** After the press: the toast. */
export function fixturesAddedToast(adds: number, updates: number): string {
  const parts: string[] = []
  if (adds > 0) parts.push(`${adds} ${adds === 1 ? 'fixture' : 'fixtures'} added from the robot`)
  if (updates > 0) parts.push(`${updates} ${updates === 1 ? 'row' : 'rows'} updated`)
  return parts.length ? `${parts.join(', ')}.` : 'Nothing changed.'
}

/** The schedule row's one line: *Kohler Highline K-96057 · 1.28 gpf · waste 4"*. */
export function scheduleLineWords(row: Pick<FixturePullRow, 'manufacturer' | 'model' | 'description' | 'connections'>): string | null {
  const parts: string[] = []
  const mm = [strOf(row.manufacturer), strOf(row.model)].filter(Boolean).join(' ')
  if (mm) parts.push(mm)
  const d = strOf(row.description)
  if (d && !mm) parts.push(d)
  if (row.connections && typeof row.connections === 'object' && !Array.isArray(row.connections)) {
    for (const [k, v] of Object.entries(row.connections as Record<string, unknown>)) {
      const s = strOf(v)
      if (s) parts.push(`${k.replace(/_/g, ' ')} ${s}`)
    }
  }
  return parts.length ? parts.join(' · ') : null
}

/**
 * The fallback read for a bid the robot read before `put_fixtures` existed: the fixture schedule's rows from
 * the substrate (one per tag), each backed by its schedule row, the notes that name the tag, and the page
 * text's lines that name it. Counts are the schedule's or the rollup's totals; no sheets, no pins, no price.
 */
export function deriveFixtureRows(sub: PlanSubstrate | null | undefined, pages: ReadonlyArray<PlanPageRow>, pullId = 'derived'): FixturePullRow[] {
  if (!sub) return []
  const valueOf = (v: unknown): string | null => {
    if (v == null) return null
    if (typeof v === 'object') return strOf((v as { value?: unknown }).value)
    return strOf(v)
  }
  const rollup = (sub as { rollup?: { fixture_tags?: unknown } }).rollup?.fixture_tags
  const rollupByTag = new Map<string, { qty: number | null; reconciliation: string | null }>()
  if (Array.isArray(rollup)) {
    for (const t of rollup as unknown[]) {
      if (!t || typeof t !== 'object') continue
      const o = t as Record<string, unknown>
      const tag = valueOf(o.tag)
      if (tag) rollupByTag.set(tag.toLowerCase(), { qty: numberOf(valueOf(o.qty)), reconciliation: valueOf(o.reconciliation) })
    }
  }
  const notes: Array<{ sheet: string | null; text: string; flags: string[] }> = []
  for (const s of sub.sheets ?? []) {
    const sheet = valueOf(s.sheet_no)
    for (const n of s.notes ?? []) {
      const text = valueOf(n.text)
      if (text) notes.push({ sheet, text, flags: (n.flags ?? []).map(flagWords) })
    }
  }
  const out: FixturePullRow[] = []
  const seen = new Set<string>()
  let seq = 0
  for (const s of sub.sheets ?? []) {
    const sheet = valueOf(s.sheet_no)
    for (const sch of s.schedules ?? []) {
      const type = (sch.schedule_type ?? '').toLowerCase()
      if (type && !/fixture|plumb/.test(type)) continue
      for (const r of sch.rows ?? []) {
        const tag = valueOf(r.tag) ?? valueOf(r.mark)
        if (!tag || seen.has(tag.toLowerCase())) continue
        seen.add(tag.toLowerCase())
        const description = valueOf(r.description)
        const pat = tagPattern(tag)
        const backing: FixtureBacking[] = []
        const line = Object.entries(r)
          .map(([k, v]) => [k, valueOf(v)] as const)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
          .join(' · ')
        if (line) backing.push({ kind: 'schedule', sheet, page: null, text: line, flags: [] })
        for (const n of notes) {
          if (pat && pat.test(normalizeFixtureName(n.text))) backing.push({ kind: 'note', sheet: n.sheet, page: null, text: n.text, flags: n.flags })
        }
        let callouts = 0
        for (const p of pages) {
          if (!p.text || callouts >= 6) continue
          for (const l of p.text.split('\n')) {
            if (callouts >= 6) break
            if (pat && pat.test(normalizeFixtureName(l))) {
              backing.push({ kind: 'callout', sheet: p.sheet_no, page: p.page, text: l.trim(), flags: [] })
              callouts++
            }
          }
        }
        const roll = rollupByTag.get(tag.toLowerCase())
        const qty = numberOf(valueOf(r.qty_scheduled)) ?? roll?.qty ?? 0
        const rec = roll?.reconciliation ?? null
        const flags = backing.flatMap((b) => b.flags)
        const scope: ScopeFlag | null = flags.includes('exclusion') ? 'by_others' : null
        out.push({
          id: `${pullId}:${tag}`,
          pull_id: pullId,
          tag,
          name: description ?? tag,
          description,
          manufacturer: valueOf(r.manufacturer) ?? valueOf(r.make),
          model: valueOf(r.model),
          connections: null,
          count: qty,
          unit: 'ea',
          per_sheet: [],
          backing,
          scope_flag: scope,
          confidence: null,
          agreement: rec === 'full' ? 'agree' : rec === 'partial' || rec === 'conflict' ? 'conflict' : rec ? 'unverifiable' : null,
          remark: null,
          robot_book_entry: null,
          robot_unit_price: null,
          sequence_order: ++seq,
        })
      }
    }
  }
  return out
}
