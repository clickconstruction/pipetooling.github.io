/**
 * Themes on the record (v2.6545, punch list #269 T1): a theme is a plain-words name for a pattern the office wants to
 * find again across a large record — *Dishonesty*, *Disrespectful conduct*, *Interference with the business* — a
 * company-wide word with one line on what counts and optional words for counsel, retired and never deleted. A mark is a
 * row on something that already exists (an HR entry, a piece of evidence, a matter's document or event) carrying why
 * it fits and how it proves the theme. Pure: no React, no supabase, no app import — it lives in
 * `supabase/functions/_shared/` so the Settings card, the pickers, the By theme view and the dev seat read one set of
 * words and rules; `src/lib/legal/legalThemes.ts` is the app's door to it.
 */

export type ProvesBy = 'document' | 'own_words' | 'firsthand' | 'relayed'

/** How a mark proves its theme, strongest first: the matrix's A, B, C grade asked at the moment of marking. */
export const PROVES_BY: ReadonlyArray<{ key: ProvesBy; label: string; short: string }> = [
  { key: 'document', label: 'a document', short: 'by a document' },
  { key: 'own_words', label: 'their own words', short: 'by their own words' },
  { key: 'firsthand', label: 'a firsthand account', short: 'firsthand' },
  { key: 'relayed', label: 'a relayed account', short: 'relayed' },
]

export function provesByWords(key: ProvesBy | null | undefined): string {
  return PROVES_BY.find((p) => p.key === key)?.label ?? ''
}

export type MarkTargetKind = 'hr_entry' | 'hr_evidence' | 'matter_document' | 'matter_entry'

export type LegalTheme = {
  id: string
  name: string
  what_counts: string
  counsel_words: string
  created_by: string | null
  created_at: string
  updated_at: string
  retired_at: string | null
  retired_by: string | null
  proposed_by_agent: boolean
  kept_at: string | null
}

export type LegalThemeMark = {
  id: string
  theme_id: string
  target_kind: MarkTargetKind
  target_id: string
  person_id: string | null
  matter_id: string | null
  why: string
  proves_by: ProvesBy | null
  marked_by: string | null
  marked_at: string
  author_label: string | null
  proposed: boolean
  kept_at: string | null
  kept_by: string | null
  removed_at: string | null
  removed_by: string | null
  removed_why: string
}

export const THEME_NAME_MAX = 80
export const THEME_WHAT_COUNTS_MAX = 400
export const THEME_COUNSEL_WORDS_MAX = 200
export const MARK_WHY_MAX = 200

export type ThemeDraft = { name: string; whatCounts: string; counselWords: string }

/** Why a theme cannot be saved as typed; null when it can. A name, under the caps, not a standing theme's name. */
export function themeDraftProblem(d: ThemeDraft, standing: ReadonlyArray<Pick<LegalTheme, 'id' | 'name' | 'retired_at'>>, editingId: string | null = null): string | null {
  const name = d.name.trim()
  if (!name) return 'Give the theme a name.'
  if (name.length > THEME_NAME_MAX) return `The name is over ${THEME_NAME_MAX} characters.`
  if (d.whatCounts.length > THEME_WHAT_COUNTS_MAX) return `What counts is over ${THEME_WHAT_COUNTS_MAX} characters.`
  if (d.counselWords.length > THEME_COUNSEL_WORDS_MAX) return `Counsel’s words are over ${THEME_COUNSEL_WORDS_MAX} characters.`
  const taken = standing.find((t) => !t.retired_at && t.id !== editingId && t.name.trim().toLowerCase() === name.toLowerCase())
  if (taken) return `A theme named ${taken.name.trim()} already stands.`
  return null
}

/** A theme that stands: not retired. */
export function themeStands(t: Pick<LegalTheme, 'retired_at'>): boolean {
  return !t.retired_at
}

/** Standing themes by name, the agent's proposals among them, then the retired ones by name. */
export function sortThemes<T extends Pick<LegalTheme, 'name' | 'retired_at'>>(themes: ReadonlyArray<T>): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  return [...themes.filter((t) => !t.retired_at).sort(byName), ...themes.filter((t) => !!t.retired_at).sort(byName)]
}

/** A mark that stands: not removed. */
export function markStands(m: Pick<LegalThemeMark, 'removed_at'>): boolean {
  return !m.removed_at
}

/** Live marks by theme id. */
export function marksByTheme<M extends Pick<LegalThemeMark, 'theme_id' | 'removed_at'>>(marks: ReadonlyArray<M>): Map<string, M[]> {
  const out = new Map<string, M[]>()
  for (const m of marks) {
    if (m.removed_at) continue
    const list = out.get(m.theme_id) ?? []
    list.push(m)
    out.set(m.theme_id, list)
  }
  return out
}

/** `17 marks` · `1 mark` · `no marks yet`. */
export function markCountWords(n: number): string {
  if (n <= 0) return 'no marks yet'
  return n === 1 ? '1 mark' : `${n} marks`
}

/** `9 by a document · 3 by their own words · 2 firsthand · 0 relayed`, the proof counts a person says to counsel. */
export function proofCountsWords(marks: ReadonlyArray<Pick<LegalThemeMark, 'proves_by' | 'removed_at'>>): string {
  const live = marks.filter((m) => !m.removed_at)
  return PROVES_BY.map((p) => `${live.filter((m) => m.proves_by === p.key).length} ${p.short}`).join(' · ')
}

/** `2 proposed by the agent, not yet kept`; '' when none. */
export function proposedCountWords(marks: ReadonlyArray<Pick<LegalThemeMark, 'proposed' | 'kept_at' | 'removed_at'>>): string {
  const n = marks.filter((m) => !m.removed_at && m.proposed && !m.kept_at).length
  return n === 0 ? '' : `${n} proposed by the agent, not yet kept`
}

/** A standing mark the agent proposed and no dev has kept: drawn dashed, with Keep and Drop. */
export function markIsProposed(m: Pick<LegalThemeMark, 'proposed' | 'kept_at' | 'removed_at'>): boolean {
  return !m.removed_at && m.proposed && !m.kept_at
}

// ─── marks on the record (v2.6546, T2) ─────────────────────────────────────

export type MarkTarget = { kind: MarkTargetKind; id: string }

/** What a composer or a line's picker holds before the marks are written: the themes picked, why, how it proves them. */
export type MarkDraft = { themeIds: string[]; why: string; provesBy: ProvesBy | null }

export const EMPTY_MARK_DRAFT: MarkDraft = { themeIds: [], why: '', provesBy: null }

/** Why the marks cannot be written as typed; null when they can (no theme picked is nothing to write, not a problem). */
export function markDraftProblem(d: MarkDraft): string | null {
  if (d.why.length > MARK_WHY_MAX) return `Why it fits is over ${MARK_WHY_MAX} characters.`
  return null
}

export function toggleThemeId(d: MarkDraft, themeId: string): MarkDraft {
  return d.themeIds.includes(themeId) ? { ...d, themeIds: d.themeIds.filter((id) => id !== themeId) } : { ...d, themeIds: [...d.themeIds, themeId] }
}

const LINE_TABLE_TO_KIND: Record<string, MarkTargetKind> = { person_file_entries: 'hr_entry', person_file_evidence: 'hr_evidence', legal_matter_documents: 'matter_document', legal_matter_entries: 'matter_entry' }

/** The thing a Timeline line can carry a mark on, or null for a line that points into another record (a license, a paper, a write-up). */
export function markTargetOfLine(line: { ref: { table: string; id: string } }): MarkTarget | null {
  const kind = LINE_TABLE_TO_KIND[line.ref.table]
  return kind ? { kind, id: line.ref.id } : null
}

export function sameTarget(a: MarkTarget, b: Pick<LegalThemeMark, 'target_kind' | 'target_id'>): boolean {
  return a.kind === b.target_kind && a.id === b.target_id
}

/** The live marks on one thing. */
export function marksOnTarget<M extends Pick<LegalThemeMark, 'target_kind' | 'target_id' | 'removed_at'>>(marks: ReadonlyArray<M>, target: MarkTarget): M[] {
  return marks.filter((m) => !m.removed_at && sameTarget(target, m))
}

/** How many of the given lines carry each theme (live marks), by theme id. */
export function themeCountsOnLines(lines: ReadonlyArray<{ ref: { table: string; id: string } }>, marks: ReadonlyArray<Pick<LegalThemeMark, 'theme_id' | 'target_kind' | 'target_id' | 'removed_at'>>): Map<string, number> {
  const out = new Map<string, number>()
  for (const line of lines) {
    const t = markTargetOfLine(line)
    if (!t) continue
    const seen = new Set<string>()
    for (const m of marksOnTarget(marks, t)) {
      if (seen.has(m.theme_id)) continue
      seen.add(m.theme_id)
      out.set(m.theme_id, (out.get(m.theme_id) ?? 0) + 1)
    }
  }
  return out
}

/** The lines that carry the theme. */
export function linesWithTheme<L extends { ref: { table: string; id: string } }>(lines: ReadonlyArray<L>, marks: ReadonlyArray<Pick<LegalThemeMark, 'theme_id' | 'target_kind' | 'target_id' | 'removed_at'>>, themeId: string): L[] {
  return lines.filter((line) => {
    const t = markTargetOfLine(line)
    return !!t && marksOnTarget(marks, t).some((m) => m.theme_id === themeId)
  })
}

/** `3 lines ticked` · `1 line ticked`. */
export function tickedWords(n: number): string {
  return n === 1 ? '1 line ticked' : `${n} lines ticked`
}

/** `Dishonesty marked on 3 lines.` · `Dishonesty and Interference with the business marked on 1 line.` · `… 2 were marked already.` */
export function markedWords(themeNames: ReadonlyArray<string>, made: number, already: number, noun: readonly [string, string] = ['line', 'lines']): string {
  const names = themeNames.length <= 1 ? themeNames[0] ?? 'The theme' : themeNames.length === 2 ? `${themeNames[0]} and ${themeNames[1]}` : `${themeNames.slice(0, -1).join(', ')} and ${themeNames[themeNames.length - 1]}`
  const count = (n: number) => `${n} ${n === 1 ? noun[0] : noun[1]}`
  if (made === 0 && already > 0) return `${names} already on ${already === 1 ? 'that ' + noun[0] : 'those ' + noun[1]}.`
  const head = `${names} marked on ${count(made)}.`
  return already > 0 ? `${head} ${already === 1 ? '1 was' : `${already} were`} marked already.` : head
}

// ─── By theme: the investigation (v2.6547, T3) ─────────────────────────────

/** A Timeline line as the By theme view and the packet read it: what the kernel needs, no React. */
export type ThemeLine = {
  key: string
  ymd: string
  loggedAt: string | null
  kindWords: string
  what: string
  notes: string
  byName: string
  ref: { table: string; id: string }
  attachmentIds: ReadonlyArray<string>
}

/** One item of a theme: the line, the theme's own mark on it, and every live mark on it. */
export type ThemeItem<L extends ThemeLine = ThemeLine> = { line: L; mark: LegalThemeMark; marks: LegalThemeMark[] }

export type ThemeItemsOrder = 'oldest' | 'strongest'
/** `every` · `with_file` · `proposed` · one grade. */
export type ThemeItemsShow = 'every' | 'with_file' | 'proposed' | ProvesBy

export const THEME_ITEMS_SHOW: ReadonlyArray<{ key: ThemeItemsShow; label: string }> = [
  { key: 'every', label: 'every item' },
  { key: 'with_file', label: 'with a file' },
  ...PROVES_BY.map((p) => ({ key: p.key as ThemeItemsShow, label: p.short })),
  { key: 'proposed', label: 'proposed' },
]

const PROVES_BY_RANK: Record<ProvesBy, number> = { document: 0, own_words: 1, firsthand: 2, relayed: 3 }

function gradeRank(m: Pick<LegalThemeMark, 'proves_by'>): number {
  return m.proves_by ? PROVES_BY_RANK[m.proves_by] : 4
}

/** The theme's items from the lines and the marks: oldest first, or strongest first (by a document before their own words before firsthand before relayed, the ungraded last, then by day). */
export function themeItems<L extends ThemeLine>(lines: ReadonlyArray<L>, marks: ReadonlyArray<LegalThemeMark>, themeId: string, opts: { order?: ThemeItemsOrder; show?: ThemeItemsShow } = {}): ThemeItem<L>[] {
  const order = opts.order ?? 'oldest'
  const show = opts.show ?? 'every'
  const out: ThemeItem<L>[] = []
  for (const line of lines) {
    const t = markTargetOfLine(line)
    if (!t) continue
    const live = marksOnTarget(marks, t)
    const mark = live.find((m) => m.theme_id === themeId)
    if (!mark) continue
    if (show === 'with_file' && line.attachmentIds.length === 0) continue
    if (show === 'proposed' && !markIsProposed(mark)) continue
    if (show !== 'every' && show !== 'with_file' && show !== 'proposed' && mark.proves_by !== show) continue
    out.push({ line, mark, marks: live })
  }
  const byDay = (a: ThemeItem<L>, b: ThemeItem<L>) => a.line.ymd.localeCompare(b.line.ymd) || (a.line.loggedAt ?? '').localeCompare(b.line.loggedAt ?? '')
  out.sort(order === 'strongest' ? (a, b) => gradeRank(a.mark) - gradeRank(b.mark) || byDay(a, b) : byDay)
  return out
}

/** `14 items · first Apr 3, 2026 · last Aug 15, 2026 · 6 with a file`; `1 item · Apr 3, 2026`; `no items yet`. */
export function themeItemsHeadWords(items: ReadonlyArray<ThemeItem>, dayWords: (ymd: string) => string): string {
  if (items.length === 0) return 'no items yet'
  const days = items.map((i) => i.line.ymd).sort()
  const withFile = items.filter((i) => i.line.attachmentIds.length > 0).length
  const span = days.length === 1 || days[0] === days[days.length - 1] ? dayWords(days[0]!) : `first ${dayWords(days[0]!)} · last ${dayWords(days[days.length - 1]!)}`
  const files = withFile > 0 ? ` · ${withFile} with a file` : ''
  return `${items.length === 1 ? '1 item' : `${items.length} items`} · ${span}${files}`
}

/** `Dishonesty · item 3 of 14`. */
export function itemKickerWords(themeName: string, index: number, total: number): string {
  return `${themeName} · item ${index + 1} of ${total}`
}

/** The lines around one on the record, up to `n` either side, in the record's order. */
export function nearbyLines<L extends { key: string }>(lines: ReadonlyArray<L>, key: string, n = 2): { before: L[]; after: L[] } {
  const i = lines.findIndex((l) => l.key === key)
  if (i < 0) return { before: [], after: [] }
  return { before: lines.slice(Math.max(0, i - n), i), after: lines.slice(i + 1, i + 1 + n) }
}

/**
 * The theme as a list for counsel, plain text: the name, what counts, counsel's words, the counts, then one line an
 * item — the day, the words, how it proves the theme, why, who marked it. What a Copy press puts on the clipboard.
 */
export function themeListText(theme: Pick<LegalTheme, 'name' | 'what_counts' | 'counsel_words'>, personName: string, items: ReadonlyArray<ThemeItem>, dayWords: (ymd: string) => string, nameOf: (userId: string | null, fallback: string | null) => string): string {
  const head = [`${theme.name} — ${personName}`, theme.what_counts ? `What counts: ${theme.what_counts}` : '', theme.counsel_words ? `Counsel’s words: ${theme.counsel_words}` : '', `${themeItemsHeadWords(items, dayWords)} · ${proofCountsWords(items.map((i) => i.mark))}`].filter(Boolean)
  const rows = items.map((i, n) => {
    const bits = [`${n + 1}. ${dayWords(i.line.ymd)} · ${i.line.kindWords} · ${i.line.what.replace(/\s+/g, ' ').trim()}`]
    if (i.line.notes) bits.push(`   ${i.line.notes.replace(/\s+/g, ' ').trim()}`)
    const proof = [i.mark.proves_by ? `proves it by ${provesByWords(i.mark.proves_by)}` : 'not graded', i.mark.why ? `why: ${i.mark.why}` : '', `marked by ${nameOf(i.mark.marked_by, i.mark.author_label)}${markIsProposed(i.mark) ? ' (proposed, not yet kept)' : ''}`].filter(Boolean)
    bits.push(`   ${proof.join(' · ')}`)
    if (i.line.attachmentIds.length > 0) bits.push(`   ${i.line.attachmentIds.length === 1 ? '1 file' : `${i.line.attachmentIds.length} files`}`)
    return bits.join('\n')
  })
  return [...head, '', ...rows].join('\n')
}
